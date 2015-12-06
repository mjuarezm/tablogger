import unittest
import os
import time
import shutil
import hashlib
import sqlite3
import struct
import array
from xvfbwrapper import Xvfb
from selenium import webdriver

# get script directory
CURRENT_PATH = os.path.dirname(os.path.realpath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_PATH,
                                        os.pardir, os.pardir, os.pardir))

# globals
XVFB = True
XVFB_W = 1280
XVFB_H = 720
TIMEOUT_ALERT = 10
TIMEOUT_TEARDOWN = 3

EVENT = ["'onCreated'", "'onLoaded'", "'onUpdated'", "'onRemoved'"]


def parse_event(byte_list):
    up, low = byte_list[0:2], byte_list[2:]
    up_str = array.array('B', up[::-1]).tostring()
    low_str = array.array('B', low[::-1] + [0]).tostring()
    tabid = struct.unpack("<h", up_str)[0]
    low_int = struct.unpack("<L", low_str)[0]
    offset = int(low_int >> 0x2)
    name = EVENT[int(low_int & 0x3)]
    return {'tabid': tabid, 'name':  name.strip('\''), 'offset': offset}


class BasicTest(unittest.TestCase):

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
        chrome_options = webdriver.ChromeOptions()
        crx_path = os.path.join(BASE_DIR, 'bin', 'tablogger.crx')
        chrome_options.add_experimental_option("prefs", {})
        hash_timestamp = hashlib.sha256(str(time.time() * 1000)).hexdigest()
        self.profile_path = os.path.join(CURRENT_PATH, hash_timestamp)
        self.localstorage_path = os.path.join(self.profile_path,
                                              "Default", "Local Storage")
        chrome_options.add_extension(crx_path)
        chrome_options.add_argument("user-data-dir=%s" % self.profile_path)
        # set prerender switch
        chrome_options.add_argument("prerender")
        self.driver = webdriver.Chrome('/usr/bin/chromedriver',
                                       chrome_options=chrome_options)

    def tearDown(self):
        time.sleep(TIMEOUT_TEARDOWN)  # delays for 5 seconds
        self.driver.quit()
        shutil.rmtree(self.profile_path)

    def load_local_storage(self):
        pass

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

    def read_local_storage(self):
        # read localstorage
        ext_ls_files = [f for f in os.listdir(self.localstorage_path)
                        if "chrome-extension" in f and "journal" not in f]
        # assume tablogger is the only installed extension
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
        result_str = str(result[1]).decode('utf-16le').strip(' \t\r\n\0') \
            .replace(' ', '')[1:-1]
        items = map(int, result_str.split(','))
        c.close()
        return items

    def test_prerender(self):
        # page with embeded prerender link
        self.driver.get("https://jsbin.com/jikibowacu")
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
        self.assertTrue(len(event_names) == 50)
