"""Browser contract tests. Run with the dedicated gift-demo-env Python."""
import functools
import http.server
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent

class GiftV2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.server.shutdown()
    def setUp(self):
        self.page = self.browser.new_page(viewport={'width':1440, 'height':900}, reduced_motion='reduce')
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/')
    def tearDown(self):
        self.page.close()
    def ready(self):
        self.page.wait_for_function('window.giftV2 && giftV2.ready', timeout=4000)
    def test_ticket_opens_read_at_your_pace_story(self):
        self.assertTrue((ROOT / 'index.html').exists(), 'Complete HTML must exist')
        self.ready()
        self.page.get_by_role('button', name='Admit one: Zara. Tap to begin').click()
        self.page.get_by_role('button', name='Skip countdown').click()
        self.assertEqual(self.page.evaluate('giftV2.getState().scene'), 1)
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.evaluate('giftV2.getState().scene'), 2)
        self.page.keyboard.press('ArrowLeft')
        self.assertEqual(self.page.evaluate('giftV2.getState().scene'), 1)
        self.assertGreaterEqual(self.page.locator('.chapter-dot').count(), 11)

    def test_music_is_opt_in_visible_and_follows_scene_intent(self):
        self.ready()
        self.assertEqual(self.page.locator('#youtube-container iframe').count(), 0)
        self.page.locator('#music-toggle').click()
        self.assertGreaterEqual(self.page.locator('#track-select option').count(), 3)
        self.page.locator('#soundtrack-enable').click()
        self.assertEqual(self.page.locator('#youtube-container iframe').count(), 1)
        self.assertEqual(self.page.locator('#soundtrack-enable').inner_text(), 'YouTube player shown')
        self.assertIn('19WTWVw15n0', self.page.locator('iframe').get_attribute('src'))
        self.assertTrue(self.page.locator('iframe').is_visible())
        self.page.get_by_role('button', name='Close music panel').click()
        self.page.evaluate('giftV2.go(4)')
        self.assertIn('CSK5eApRGwQ', self.page.locator('iframe').get_attribute('src'))
        self.page.evaluate('giftV2.go(11)')
        self.assertIn('aDeNQNtW1f8', self.page.locator('iframe').get_attribute('src'))
        self.page.locator('#music-toggle').click()
        self.page.locator('#stop-music').click()
        self.assertEqual(self.page.locator('iframe').count(), 0)

    def test_keyboard_arrows_work_after_using_next_button(self):
        self.ready()
        self.page.evaluate('giftV2.go(2)')
        self.page.locator('#next').click()
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.evaluate('giftV2.getState().scene'), 4)

    def test_all_scenes_mobile_no_horizontal_overflow(self):
        self.ready()
        for width in [320, 390, 768, 1440]:
            self.page.set_viewport_size({'width':width, 'height':844 if width < 800 else 900})
            for i in range(14):
                self.page.evaluate(f'giftV2.go({i})')
                self.page.evaluate('document.fonts.ready')
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width, f'Scene {i} overflows at {width}px')
                self.assertTrue(self.page.locator('#scene-title').is_visible())
        self.page.evaluate('giftV2.go(13)')
        self.page.locator('#wish').click()
        self.assertTrue(self.page.locator('#bonus-letter').is_visible())
        self.assertTrue(self.page.evaluate('giftV2.getState().wished'))
        self.assertIn('Candle out', self.page.locator('#wish').inner_text())

    def test_mobile_photos_have_face_safe_landscape_window(self):
        self.ready(); self.page.set_viewport_size({'width':390,'height':844})
        for i in [2,3,4,6,12]:
            self.page.evaluate(f'giftV2.go({i})')
            rect = self.page.locator('.backdrop').bounding_box()
            self.assertLessEqual(rect['height'], 360, 'Landscape photos must not crop to a whole tall mobile scene')

    def test_gallery_credits_local_file_and_assets(self):
        self.ready()
        errors=[]; self.page.on('pageerror', lambda e: errors.append(str(e)))
        for i in range(14):
            self.page.evaluate(f'giftV2.go({i})')
            self.page.wait_for_function('Array.from(document.querySelectorAll("#scene img")).every(im=>im.complete && im.naturalWidth>0)')
        self.page.evaluate('giftV2.go(8)')
        self.page.locator('[data-photo=selfie]').click()
        self.assertTrue(self.page.locator('#photo-dialog').is_visible())
        self.page.keyboard.press('Escape')
        self.page.locator('#credits-toggle').click()
        self.assertIn('fictional', self.page.locator('#credits-panel').inner_text())
        self.page.get_by_role('button',name='Close credits',exact=True).click()
        self.page.locator('#music-toggle').click()
        self.page.locator('#local-audio').set_input_files({'name':'permission-test.mp3','mimeType':'audio/mpeg','buffer':b''})
        self.assertTrue(self.page.locator('#local-player').is_visible())
        self.assertTrue(self.page.locator('#local-player').get_attribute('src').startswith('blob:'))
        self.assertTrue(self.page.evaluate('giftV2.getState().localAudioSelected'))
        self.page.wait_for_function("document.querySelector('#music-status').textContent.includes('could not be played')")
        self.page.locator('#local-audio').focus(); self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.evaluate('giftV2.getState().scene'),8)
        self.assertEqual(errors, [])

    def test_file_preview_uses_defaults_without_http_fetch(self):
        requests=[]
        self.page.on('request',lambda r: requests.append(r.url))
        self.page.goto((ROOT/'index.html').as_uri()); self.ready()
        self.assertEqual(self.page.locator('#track-select option').count(),3)
        self.assertFalse(any(u.startswith('http') for u in requests))

if __name__ == '__main__': unittest.main(verbosity=2)
