"""Real-browser acceptance tests for the Little Things Digital landing page."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlparse
import filecmp
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
DEMO = ROOT.parent / 'Demos' / 'For Zara v2'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class SampleCopyTests(unittest.TestCase):
    def test_bundled_sample_matches_preferred_demo(self):
        """Landing Page/sample must not silently drift from Demos/For Zara v2."""
        if not DEMO.exists():
            self.skipTest('Standalone demo folder not present')
        shared = ['index.html', 'app.js', 'style.css', 'music.json', 'MEDIA.md']
        _, mismatch, errors = filecmp.cmpfiles(ROOT / 'sample', DEMO, shared, shallow=False)
        self.assertEqual((mismatch, errors), ([], []))
        assets = sorted(p.name for p in (ROOT / 'sample' / 'assets').iterdir())
        _, mismatch, errors = filecmp.cmpfiles(ROOT / 'sample' / 'assets', DEMO / 'assets', assets, shallow=False)
        self.assertEqual((mismatch, errors), ([], []))


class LandingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
        Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)

    def tearDown(self):
        self.page.close()

    def brief_value(self, field):
        return self.page.get_by_label(field, exact=True).input_value()

    def test_landing_and_actual_sample_work(self):
        errors = []
        self.page.on('pageerror', lambda e: errors.append(str(e)))
        self.page.goto(self.base)
        self.assertIn('Little Things Digital', self.page.title())
        self.assertEqual(self.page.get_by_role('heading', level=1).inner_text(), 'Little things, made into a moment.')
        self.page.get_by_role('link', name='Open the sample: For Zara, from Tobi, a fictional birthday website').click()
        self.page.wait_for_function('window.giftV2 && giftV2.ready')
        self.assertTrue(self.page.get_by_role('button', name='Admit one: Zara. Tap to begin').is_visible())
        self.assertEqual(errors, [])

    def test_public_copy_has_no_pilot_or_unfinished_wording(self):
        self.page.goto(self.base)
        text = self.page.locator('body').inner_text().lower()
        for phrase in ['pilot', 'still being', 'not available yet', 'preview site', 'taking orders yet', '₦']:
            self.assertNotIn(phrase, text)

    def test_hero_moment_reveals_and_replays(self):
        self.page.goto(self.base)
        moment = self.page.locator('#moment')
        self.assertEqual(moment.get_attribute('data-state'), 'playing')
        self.page.wait_for_function("document.querySelector('#moment').dataset.state === 'done'", timeout=8000)
        self.assertEqual(self.page.locator('.moment-lines li.shown').count(), 4)
        self.page.get_by_role('button', name='Play the moment again').click()
        self.assertEqual(moment.get_attribute('data-state'), 'playing')
        self.assertLess(self.page.locator('.moment-lines li.shown').count(), 4)
        self.page.wait_for_function("document.querySelector('#moment').dataset.state === 'done'", timeout=8000)
        self.assertTrue(self.page.get_by_text('A fictional quick moment. AI-generated photos.').is_visible())

    def test_reduced_motion_shows_the_whole_moment_at_once(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.page.goto(self.base)
        self.assertEqual(self.page.locator('#moment').get_attribute('data-state'), 'done')
        self.assertEqual(self.page.locator('.moment-lines li.shown').count(), 4)
        self.assertEqual(self.page.locator('.moment-photo').evaluate('e => getComputedStyle(e).opacity'), '1')

    def test_occasion_selection_updates_examples_and_brief(self):
        self.page.goto(self.base)
        self.page.get_by_role('button', name='Romance', exact=True).click()
        self.assertEqual(self.page.get_by_role('button', name='Romance', exact=True).get_attribute('aria-pressed'), 'true')
        self.assertIn('Saying sorry', self.page.locator('#occasion-examples').inner_text())
        self.page.get_by_role('link', name='Start a brief for a romantic moment').click()
        self.assertTrue(self.page.get_by_role('dialog').is_visible())
        self.assertEqual(self.brief_value('Occasion'), 'Romance')

    def test_personal_brief_downloads_without_sending_an_order(self):
        self.page.goto(self.base)
        self.page.get_by_role('button', name='Family', exact=True).click()
        self.page.get_by_role('link', name='Draft a full story brief').click()
        dialog = self.page.get_by_role('dialog')
        self.assertTrue(dialog.is_visible())
        self.assertEqual(self.brief_value('Occasion'), 'Family')
        self.assertEqual(self.brief_value('Size'), 'A full story')
        self.page.get_by_label('Your name', exact=True).fill('Ada')
        self.page.get_by_label('Your email', exact=True).fill('ada@example.com')
        self.page.get_by_label('Their name or nickname', exact=True).fill('Mummy')
        self.page.get_by_label('Format', exact=True).select_option('Video')
        self.page.get_by_label('The little things', exact=True).fill('Sunday jollof and the way she sings off-key.')
        requests = []
        self.page.on('request', lambda r: requests.append((r.method, r.url)))
        with self.page.expect_download() as dl:
            self.page.get_by_role('button', name='Download my brief', exact=True).click()
        download = dl.value
        self.assertIsNone(download.failure())
        self.assertEqual(download.suggested_filename, 'Little-Things-Digital-Brief.txt')
        text = Path(download.path()).read_text()
        for value in ['Ada', 'Mummy', 'Family', 'A full story', 'Video', 'off-key', 'ada@example.com', 'not a submitted order']:
            self.assertIn(value, text)
        self.assertIn('Your brief is saved to your device.', dialog.inner_text())
        self.assertFalse(any(method == 'POST' for method, _ in requests))
        self.assertFalse(any('Mummy' in url or 'ada%40example' in url for _, url in requests))
        self.page.keyboard.press('Escape')
        self.assertFalse(dialog.is_visible())

    def test_mobile_navigation_and_format_preselect(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.goto(self.base)
        self.page.get_by_role('button', name='Open navigation', exact=True).click()
        self.assertEqual(self.page.locator('.menu-toggle').get_attribute('aria-expanded'), 'true')
        self.page.locator('#nav').get_by_role('link', name='Start a brief').click()
        self.assertTrue(self.page.get_by_role('dialog').is_visible())
        self.assertEqual(self.page.locator('.menu-toggle').get_attribute('aria-expanded'), 'false')
        self.page.keyboard.press('Escape')
        self.page.get_by_role('link', name='Draft a quick moment brief').click()
        self.assertEqual(self.brief_value('Size'), 'A quick moment')
        self.assertEqual(self.brief_value('Format'), 'Interactive website')
        self.page.get_by_role('button', name='Close brief', exact=True).click()
        self.page.get_by_role('link', name='Plan a video').click()
        self.assertEqual(self.brief_value('Format'), 'Video')
        self.assertEqual(self.brief_value('Size'), 'A full story')

    def test_required_fields_prevent_empty_brief(self):
        self.page.goto(self.base)
        self.page.locator('#start-brief').click()
        downloads = []
        self.page.on('download', lambda d: downloads.append(d))
        self.page.get_by_role('button', name='Download my brief', exact=True).click()
        self.assertFalse(self.page.locator('#brief-form').evaluate('(f)=>f.checkValidity()'))
        self.assertEqual(downloads, [])
        self.assertEqual(self.page.locator('#brief-status').inner_text(), '')

    def test_landing_makes_no_third_party_requests(self):
        hosts = set()
        self.page.on('request', lambda r: hosts.add(urlparse(r.url).netloc) if r.url.startswith('http') else None)
        self.page.goto(self.base)
        self.page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        self.page.wait_for_load_state('networkidle')
        self.assertEqual(hosts, {urlparse(self.base).netloc})

    def test_responsive_assets_and_no_javascript_errors(self):
        errors = []
        self.page.on('pageerror', lambda e: errors.append(str(e)))
        failed = []
        self.page.on('response', lambda r: failed.append(r.url) if r.status >= 400 else None)
        self.page.goto(self.base)
        for width in [320, 390, 600, 768, 1024, 1440]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            self.page.evaluate('document.fonts.ready')
            self.page.evaluate('async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } }')
            self.page.wait_for_function('Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)')
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width, f'Horizontal overflow at {width}px')
            self.page.locator('#start-brief').click()
            box = self.page.locator('#brief-dialog').bounding_box()
            self.assertLessEqual(box['width'], width)
            self.assertGreaterEqual(box['x'], 0)
            self.page.keyboard.press('Escape')
        self.assertTrue(self.page.evaluate("document.fonts.check('16px Bricolage')"))
        self.assertEqual(errors, [])
        self.assertEqual(failed, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
