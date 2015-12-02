import unittest
import os
import time
from xvfbwrapper import Xvfb
from selenium import webdriver

# get script directory
CURRENT_PATH = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_PATH, os.pardir, os.pardir))


class BasicTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.vdisplay = Xvfb(width=1280, height=720)
        cls.vdisplay.start()

    @classmethod
    def tearDownClass(cls):
        cls.vdisplay.stop()

    def setUp(self):
        chrome_options = webdriver.ChromeOptions()
        crx_path = os.path.join(BASE_DIR, 'bin', 'tablogger.crx')
        chrome_options.add_extension(crx_path)

        self.driver = webdriver.Chrome('/usr/bin/chromedriver',
                                       chrome_options=chrome_options)

    def tearDown(self):
        time.sleep(5)  # delays for 5 seconds
        self.driver.quit()

    def test_get(self):
        self.driver.get('https://google.com')

        # Page Loaded
        self.assertIn("google", self.driver.page_source)
