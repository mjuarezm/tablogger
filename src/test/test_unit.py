import unittest
import os
from subprocess import check_call
import time
import shutil
import hashlib
import sqlite3
import struct
import array
from xvfbwrapper import Xvfb
from selenium import webdriver

# Requirements:
#  Crxmake: https://github.com/Constellation/crxmake
#  Selenium: sudo pip install selenium
#  Chromedriver: https://sites.google.com/a/chromium.org/chromedriver/
#  Xvfb: sudo apt-get install xvfb & sudo pip install xvfbwrapper

# You may need to change the constants below to suit your dir structure
CHROME_DRIVER = '/usr/local/bin/chromedriver'
CURRENT_PATH = os.path.dirname(os.path.realpath(__file__))
TABLOGGER_PATH = os.path.abspath(os.path.join(CURRENT_PATH, os.pardir, os.pardir))
BIN_PATH = os.path.join(TABLOGGER_PATH, 'bin')

XVFB = True  # set to False to disable Xvfb
XVFB_W = 1280
XVFB_H = 720
TIMEOUT_ALERT = 10
TIMEOUT_TEARDOWN = 3
SLEEP_VISIT = 5

EVENT = ["'onCreated'", "'onLoaded'", "'onUpdated'", "'onRemoved'"]


class ChromeDriverTest(object):

    @classmethod
    def setUpClass(cls):
        if XVFB:
            cls.vdisplay = Xvfb(width=XVFB_W, height=XVFB_H)
            cls.vdisplay.start()

    @classmethod
    def tearDownClass(cls):
        if XVFB:
            cls.vdisplay.stop()

    def setUp(self):
        # prepare directory structure
        key_path = os.path.join(BIN_PATH, 'tablogger.pem')
        self.crx_path = os.path.join(BIN_PATH, 'tablogger.crx')
        self.build_dirs(self.crx_path, key_path)

        # pack extension
        check_call(['crxmake',
                    '--pack-extension={}'.format(TABLOGGER_PATH),
                    '--extension-output={}'.format(self.crx_path),
                    '--key-output={}'.format(key_path)])

        # set selenium chrome driver up
        self.configure_chrome_driver()

    def tearDown(self):
        time.sleep(TIMEOUT_TEARDOWN)  # delays for 5 seconds
        self.driver.quit()
        shutil.rmtree(self.profile_path)

    def configure_chrome_driver(self):
        # configure driver
        self.chrome_options = webdriver.ChromeOptions()
        self.chrome_options.add_experimental_option("prefs", {})
        hash_timestamp = hashlib.sha256(str(time.time() * 1000)).hexdigest()
        self.profile_path = os.path.join(CURRENT_PATH, hash_timestamp)
        self.localstorage_path = os.path.join(self.profile_path,
                                              "Default", "Local Storage")
        self.chrome_options.add_extension(self.crx_path)
        self.chrome_options.add_argument("user-data-dir=%s" % self.profile_path)

    def build_dirs(self, crx_path, key_path):
        if not os.path.isdir(BIN_PATH):
            os.makedirs(BIN_PATH)
        if os.path.isfile(crx_path):
            os.remove(crx_path)
        if os.path.isfile(key_path):
            os.remove(key_path)

    def read_local_storage(self):
        # read localstorage
        ext_ls_files = [f for f in os.listdir(self.localstorage_path)
                        if "chrome-extension" in f and "journal" not in f]
        # ASSUME tablogger is the only installed extension
        tablogger_ls = ext_ls_files[-1]
        dbfile_path = os.path.join(self.localstorage_path, tablogger_ls)

        # retrieve from db
        items = self.retrieve_from_db(dbfile_path)
        return items

    def retrieve_from_db(self, dbfile_path):
        conn = sqlite3.connect(dbfile_path)
        c = conn.cursor()
        c.execute('select * from ItemTable')
        result = c.fetchone()
        result_str = str(result[1]).decode('utf-16le').strip(' \t\r\n\0').replace(' ', '')
        items = map(int, result_str.split(','))
        c.close()
        return items

    def read_and_parse_events(self):
        # read localstorage
        items = self.read_local_storage()

        # parse items
        step = 5
        events_bytes = [items[i:i + step] for i in xrange(0, len(items), step)]
        events = [parse_event(eb) for eb in events_bytes]

        # assert event names
        event_names = [event['name'] for event in events]
        return event_names


class BasicTest(ChromeDriverTest, unittest.TestCase):

    def setUp(self):
        ChromeDriverTest.setUp(self)

        # set prerender switch
        self.chrome_options.add_argument("prerender")

        # start driver
        self.driver = webdriver.Chrome(CHROME_DRIVER,
                                       chrome_options=self.chrome_options)

    def test_get(self):
        self.driver.get('https://google.com')

        # Page Loaded
        self.assertIn("google", self.driver.page_source)

    def test_run_js(self):
        test_value = 5
        value = self.driver.execute_script("""
                                            localStorage['b'] = 'c';
                                            return {};
                                           """.format(test_value))
        self.assertEqual(value, test_value)

    def test_local_storage(self):
        # visit page
        self.driver.get('https://www.google.com')
        self.driver.close()

        # read localstorage
        items = self.read_local_storage()

        # parse items
        step = 5
        events_bytes = [items[i:i + step] for i in xrange(0, len(items), step)]
        events = [parse_event(eb) for eb in events_bytes]

        # assert event names
        event_names = [event['name'] for event in events]
        print event_names
        self.assertIn('onUpdated', event_names)
        self.assertIn('onLoaded', event_names)


class PrerenderTest(ChromeDriverTest, unittest.TestCase):
    # chrome docs: https://support.google.com/chrome/answer/1385029?hl=en

    # Be aware of difference between different types of prefetching
    # (eg, prefetching vs prerendering vs dns prefetching):
    #  https://en.wikipedia.org/wiki/Link_prefetching

    # you can manually check prerender in: chrome://net-internals/#prerender

    # Prefetching in Tor (network.prefetch-next option in FF about:config):
    #  https://trac.torproject.org/projects/tor/ticket/3010
    #  https://trac.torproject.org/projects/tor/ticket/12050
    #  it seems dns prefetching is disabled but link refetching is enabled

    # how to detect it in extension:
    #  https://github.com/EFForg/privacybadgerchrome/pull/438/files#diff-f70da41c29c6cfaaec74fcf92d1d465cR262

    def test_prerender(self):
        """
        In Chrome documentation (https://developer.chrome.com/extensions/webNavigation#tab_ids),
        they report that pre-rendered tabs are not accessible through the tabs API. However, in this
        test, we observe that the tablogger extension is capturing the events of the prerendering, because
        it also uses the webNabigation API for the onLoaded events.
        """
        # visit blank page
        self.driver = webdriver.Chrome(CHROME_DRIVER,
                                       chrome_options=self.chrome_options)
        self.driver.get("http://homes.esat.kuleuven.be/~mjuarezm/research/blank.html")
        time.sleep(SLEEP_VISIT)
        self.driver.close()
        events_blank = self.read_and_parse_events()

        # page with embedded prerender link
        self.tearDown()
        self.configure_chrome_driver()
        self.chrome_options.add_argument("prerender")
        self.driver = webdriver.Chrome(CHROME_DRIVER,
                                       chrome_options=self.chrome_options)
        self.driver.get("http://homes.esat.kuleuven.be/~mjuarezm/research/prerender.html")
        time.sleep(SLEEP_VISIT)
        self.driver.close()
        events_prerender = self.read_and_parse_events()

        # Tablogger should have recorded less than 4 events,
        # since the only loaded resource is the html.
        num_events_blank = 4
        self.assertLessEqual(len(events_blank), num_events_blank)

        # In localstorage we should now have more than 4 events if prereder is working
        # 4 (visit to prerender.html) + nyt resources
        self.assertGreater(len(events_prerender), num_events_blank)

    @unittest.skip("TODO")
    def test_detect_prerender(self):
        self.configure_chrome_driver()
        self.chrome_options.add_argument("prerender")
        self.driver = webdriver.Chrome(CHROME_DRIVER,
                                       chrome_options=self.chrome_options)
        self.driver.get("http://homes.esat.kuleuven.be/~mjuarezm/research/prerender.html")
        time.sleep(SLEEP_VISIT)
        self.driver.close()
        events_prerender = self.read_and_parse_events()


def parse_event(byte_list):
    up, low = byte_list[0:2], byte_list[2:]
    up_str = array.array('B', up[::-1]).tostring()
    low_str = array.array('B', low[::-1] + [0]).tostring()
    tabid = struct.unpack("<h", up_str)[0]
    low_int = struct.unpack("<L", low_str)[0]
    offset = int(low_int >> 0x2)
    name = EVENT[int(low_int & 0x3)]
    return {'tabid': tabid, 'name':  name.strip('\''), 'offset': offset}

