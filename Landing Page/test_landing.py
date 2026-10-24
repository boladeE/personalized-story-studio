"""Real-browser acceptance tests for the local studio landing page."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import unittest
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
class LandingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
        Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
        cls.base=f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
    def tearDown(self): self.page.close()
    def test_landing_and_actual_sample_work(self):
        self.assertTrue((ROOT/'index.html').exists(),'The landing page has not been built yet')
        errors=[];self.page.on('pageerror',lambda e:errors.append(str(e)))
        self.page.goto(self.base)
        self.assertIn('Little Things',self.page.title())
        self.assertTrue(self.page.get_by_role('heading',level=1).is_visible())
        self.page.get_by_role('link',name='Explore the birthday story').click()
        self.page.wait_for_function('window.giftV2 && giftV2.ready')
        self.assertTrue(self.page.get_by_role('button',name='Admit one: Zara. Tap to begin').is_visible())
        self.assertEqual(errors,[])
    def test_personal_brief_downloads_without_sending_an_order(self):
        self.page.goto(self.base)
        self.page.get_by_role('button',name='Your anniversary',exact=True).click()
        self.page.locator('#start-brief').click()
        dialog=self.page.get_by_role('dialog')
        self.assertTrue(dialog.is_visible())
        self.assertEqual(self.page.get_by_label('Occasion',exact=True).input_value(),'Anniversary')
        self.page.get_by_label('Your name',exact=True).fill('Ada')
        self.page.get_by_label('Your email',exact=True).fill('ada@example.com')
        self.page.get_by_label('Their name or nickname',exact=True).fill('Obi')
        self.page.get_by_label('The little things',exact=True).fill('Our first rainy date and the stolen chips.')
        requests=[];self.page.on('request',lambda r:requests.append((r.method,r.url)))
        with self.page.expect_download() as dl:
            self.page.get_by_role('button',name='Download my brief',exact=True).click()
        download=dl.value
        self.assertIsNone(download.failure())
        text=Path(download.path()).read_text()
        for value in ['Ada','Obi','Anniversary','stolen chips','ada@example.com']:
            self.assertIn(value,text)
        self.assertIn('Nothing has been sent',dialog.inner_text())
        self.assertFalse(any(method=='POST' for method,url in requests))
        self.page.keyboard.press('Escape')
        self.assertFalse(dialog.is_visible())
    def test_mobile_navigation_and_formats_preselect(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.goto(self.base)
        self.page.get_by_role('button',name='Open navigation',exact=True).click()
        self.assertEqual(self.page.locator('.menu-toggle').get_attribute('aria-expanded'),'true')
        self.page.locator('#nav').get_by_role('link',name='Draft your gift').click()
        self.assertTrue(self.page.get_by_role('dialog').is_visible())
        self.assertEqual(self.page.locator('.menu-toggle').get_attribute('aria-expanded'),'false')
        self.page.keyboard.press('Escape')
        self.page.get_by_role('link',name='Plan a keepsake film gift').click()
        self.assertEqual(self.page.get_by_label('Gift format',exact=True).input_value(),'Keepsake film')
        self.page.get_by_role('button',name='Close brief',exact=True).click()
        self.page.get_by_role('link',name='Plan an interactive website gift').click()
        self.assertEqual(self.page.get_by_label('Gift format',exact=True).input_value(),'Interactive website')
    def test_required_fields_prevent_empty_brief(self):
        self.page.goto(self.base)
        self.page.locator('#start-brief').click()
        downloads=[];self.page.on('download',lambda d:downloads.append(d))
        self.page.get_by_role('button',name='Download my brief',exact=True).click()
        self.assertFalse(self.page.locator('#brief-form').evaluate('(f)=>f.checkValidity()'))
        self.assertEqual(downloads,[])
        self.assertEqual(self.page.locator('#brief-status').inner_text(),'')
    def test_responsive_assets_and_no_javascript_errors(self):
        errors=[];self.page.on('pageerror',lambda e:errors.append(str(e)))
        failed=[];self.page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
        self.page.goto(self.base)
        for width in [320,390,600,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.page.evaluate('document.fonts.ready')
            self.page.evaluate('window.scrollTo(0,document.body.scrollHeight)')
            self.page.wait_for_function('Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width,f'Horizontal overflow at {width}px')
            self.page.locator('#start-brief').click()
            self.assertLessEqual(self.page.locator('#brief-dialog').bounding_box()['width'],width)
            self.page.keyboard.press('Escape')
        self.assertEqual(errors,[])
        self.assertEqual(failed,[])
if __name__=='__main__': unittest.main(verbosity=2)
