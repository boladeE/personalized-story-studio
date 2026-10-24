"""Build the offline demo and an original, synthesized instrumental score."""
from pathlib import Path
import base64,math,array,wave,subprocess,json,shutil
ROOT=Path(__file__).resolve().parent
fonts=Path('/usr/share/fonts/google-crosextra-caladea-fonts')
html=(ROOT/'index.template.html').read_text()
for marker,name in [('__SERIF_REGULAR__','Caladea-Regular.ttf'),('__SERIF_ITALIC__','Caladea-Italic.ttf')]:
    html=html.replace(marker,base64.b64encode((fonts/name).read_bytes()).decode())
for name in ['story.js','renderer.js','player.js']:
    html=html.replace(f'<script src="{name}"></script>','<script>\n'+(ROOT/name).read_text()+'\n</script>')
(ROOT/'index.html').write_text(html)
shutil.copyfile('/usr/share/licenses/google-crosextra-caladea-fonts/LICENSE-2.0.txt',ROOT/'FONT-LICENSE.txt')
duration=json.loads(subprocess.check_output(['node','-e','console.log(JSON.stringify(require("./story.js").duration))'],cwd=ROOT,text=True))
sr=24000
samples=array.array('f',[0.0])*int(duration*sr)
def note(start,midi,length,amp,pad=False):
    freq=440*2**((midi-69)/12)
    first=int(start*sr);n=min(int(length*sr),len(samples)-first)
    for j in range(max(0,n)):
        t=j/sr
        attack=min(1,t/(.35 if pad else .012))
        end=min(1,(length-t)/(.5 if pad else .12))
        env=attack*end*(.7 if pad else math.exp(-t*3.5))
        v=math.sin(2*math.pi*freq*t)+(.08 if pad else .23)*math.sin(2*math.pi*freq*2*t)
        samples[first+j]+=amp*env*v
melody=[60,64,67,69,67,64,62,60,62,64,67,71,69,67,64,62]
for i in range(int(duration/.625)):
    if i%16 in (7,15):continue
    note(i*.625,melody[i%len(melody)],1.15,.10 if i%4 else .13)
chords=[(48,52,55),(45,48,52),(41,45,48),(43,47,50)]
for i in range(int(duration/5)):
    for midi in chords[i%4]:note(i*5,midi,5.5,.035,True)
peak=max(abs(v) for v in samples) or 1
pcm=array.array('h')
for i,v in enumerate(samples):
    t=i/sr;fade=min(1,t/1.5,(duration-t)/2.5)
    pcm.append(int(max(-1,min(1,v/peak*.5*fade))*32767))
wav=ROOT/'soundtrack.wav'
with wave.open(str(wav),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(pcm.tobytes())
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(wav),'-c:a','aac','-b:a','128k','-ar','48000','-ac','2',str(ROOT/'soundtrack.m4a')],check=True)
wav.unlink()
print(json.dumps({'html_bytes':(ROOT/'index.html').stat().st_size,'duration':duration,'soundtrack_bytes':(ROOT/'soundtrack.m4a').stat().st_size,'fonts':'Embedded Caladea, included Apache 2.0 license','media':'Original vector art and synthesized music; no customer media'}))
