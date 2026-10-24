from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
assert (ROOT/'index.html').exists(), 'The playable demo has not been built yet'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'index.html').as_uri())
    page.wait_for_function('window.giftDemo && window.giftDemo.ready')
    assert page.title()=='For Zara — a little birthday film'
    page.get_by_role('button',name='Open your gift').click()
    page.get_by_role('button',name='Pause story').click()
    page.get_by_role('button',name='Next chapter').click()
    assert page.evaluate('giftDemo.getState().chapter')==1
    page.keyboard.press('ArrowRight')
    assert page.evaluate('giftDemo.getState().chapter')==2
    page.get_by_role('button',name='Previous chapter').click()
    assert page.evaluate('giftDemo.getState().chapter')==1
    shots=ROOT/'previews';shots.mkdir(exist_ok=True)
    for label,t in [('invitation',2),('first-date',11),('memories',21),('reasons',32),('letter',43),('birthday',56)]:
        page.evaluate('(t)=>giftDemo.seek(t)',t)
        page.screenshot(path=str(shots/f'{label}.png'),full_page=True)
    page.evaluate('giftDemo.seek(giftDemo.duration)')
    page.get_by_role('button',name='Replay story').click()
    assert page.evaluate('giftDemo.getState().time')<2
    page.get_by_role('button',name='Pause story').click()
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('giftDemo.seek(21)')
    page.screenshot(path=str(shots/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Mobile horizontal overflow'
    assert page.get_by_role('link',name='Download the film').get_attribute('href')=='for-zara.mp4'
    assert not errors,errors
    browser.close()
print(json.dumps({'status':'pass','checks':['start/pause','next/previous','keyboard navigation','replay','six chapter previews','mobile overflow','download target','no JavaScript errors']}))
