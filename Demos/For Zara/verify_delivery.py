"""Exercise real HTTP downloads and decode/play the exported video in Chrome."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import hashlib,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
thread=Thread(target=server.serve_forever,daemon=True);thread.start()
base=f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1400,'height':950},accept_downloads=True)
        page.goto(base+'/index.html');page.wait_for_function('giftDemo.ready')
        with page.expect_download() as d:page.get_by_role('link',name='Download the film').click()
        download=d.value
        assert download.failure() is None
        assert hashlib.sha256(Path(download.path()).read_bytes()).digest()==hashlib.sha256((ROOT/'for-zara.mp4').read_bytes()).digest()
        page.goto(base+'/for-zara.mp4')
        page.wait_for_function('document.querySelector("video") && document.querySelector("video").readyState>=1')
        info=page.evaluate('(()=>{const v=document.querySelector("video");return{duration:v.duration,width:v.videoWidth,height:v.videoHeight}})()')
        assert info['duration']==60 and info['width']==1280
        page.evaluate('document.querySelector("video").muted=true;document.querySelector("video").play()')
        page.wait_for_function('document.querySelector("video").currentTime>.3')
        page.goto(base+'/index.html')
        page.wait_for_function('giftDemo.ready')
        page.set_viewport_size({'width':390,'height':844})
        for name,t in [('invitation',2),('first-date',11),('reasons',32),('letter',43),('birthday',56)]:
            page.evaluate('(t)=>giftDemo.seek(t)',t)
            page.screenshot(path=str(ROOT/'previews'/f'mobile-{name}.png'),full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.evaluate('giftDemo.seek(56)')
        page.get_by_role('button',name='Make a wish').click()
        assert page.get_by_role('button',name='Consider it wished.').is_disabled()
        page.get_by_role('button',name='Sound on').click()
        assert page.get_by_role('button',name='Sound off').get_attribute('aria-pressed')=='false'
        page.emulate_media(reduced_motion='reduce');page.reload();page.wait_for_function('giftDemo.ready')
        assert not page.evaluate('giftDemo.getState().playing')
        browser.close()
    report={'http_download':'pass, downloaded bytes match original MP4','video_playback':'pass','metadata':info,'mobile_all_chapters':'pass','wish_control':'pass','sound_toggle':'pass','reduced_motion_initial_state':'paused'}
    (ROOT/'browser-verification.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
finally:server.shutdown();server.server_close()
