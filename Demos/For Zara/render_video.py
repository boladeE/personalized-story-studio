"""Render the exact browser artwork to a frame-accurate H.264/AAC MP4."""
from pathlib import Path
import subprocess,base64,time,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
FPS=24
out=ROOT/'for-zara.mp4'
started=time.monotonic()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-background-timer-throttling'])
    page=browser.new_page(viewport={'width':1280,'height':720},device_scale_factor=1)
    page.goto((ROOT/'index.html').as_uri()+'?render=1')
    page.wait_for_function('window.giftDemo && giftDemo.ready')
    duration=page.evaluate('giftDemo.duration')
    count=round(duration*FPS)
    log=(ROOT/'render.log').open('wb')
    proc=subprocess.Popen(['ffmpeg','-y','-hide_banner','-loglevel','warning','-f','image2pipe','-framerate',str(FPS),'-vcodec','png','-i','pipe:0','-i',str(ROOT/'soundtrack.m4a'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','veryfast','-crf','19','-threads','2','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','-shortest',str(out)],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=log)
    try:
        for frame in range(count):
            data=page.evaluate('(t)=>{giftDemo.frame(t);return document.getElementById("film").toDataURL("image/png").split(",")[1]}',frame/FPS)
            proc.stdin.write(base64.b64decode(data))
            if frame%240==0:print(json.dumps({'frame':frame,'of':count,'render_seconds':round(time.monotonic()-started,1)}),flush=True)
    finally:
        proc.stdin.close()
        result=proc.wait(timeout=90)
        log.close()
        browser.close()
    if result:raise RuntimeError((ROOT/'render.log').read_text())
info=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_streams','-show_format','-of','json',str(out)],text=True))
v=next(s for s in info['streams'] if s['codec_type']=='video')
a=next(s for s in info['streams'] if s['codec_type']=='audio')
assert v['codec_name']=='h264' and v['width']==1280 and v['height']==720
assert a['codec_name']=='aac'
assert abs(float(info['format']['duration'])-duration)<.2
subprocess.run(['ffmpeg','-v','error','-i',str(out),'-f','null','-'],check=True)
report={'file':str(out),'duration_seconds':float(info['format']['duration']),'width':v['width'],'height':v['height'],'frames':int(v['nb_frames']),'fps':v['r_frame_rate'],'video':v['codec_name'],'audio':a['codec_name'],'bytes':out.stat().st_size,'render_seconds':round(time.monotonic()-started,1),'decode_check':'pass'}
(ROOT/'video-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
