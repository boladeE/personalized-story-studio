(function(){
'use strict';
const S=BirthdayStory, canvas=document.getElementById('film');
const el=id=>document.getElementById(id);
const renderOnly=new URLSearchParams(location.search).has('render');
if(renderOnly)document.body.classList.add('render-only');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={time:0,playing:false,opened:false,sound:true,wish:false,chapter:-1};
const audio=new Audio('soundtrack.m4a');audio.preload='metadata';audio.volume=.5;
let last=0;
const fmt=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function size(){const portrait=!renderOnly&&innerWidth<=650;const rect=canvas.getBoundingClientRect();const dpr=renderOnly?1:Math.min(devicePixelRatio||1,2);canvas.width=renderOnly?1280:Math.round(rect.width*dpr);canvas.height=renderOnly?720:Math.round(rect.height*dpr);return portrait;}
let portrait=size();
function draw(){GiftRenderer.render(canvas,state.time,{portrait,wish:state.wish,reducedMotion:reduce&&!renderOnly});}
function sync(){const f=S.locate(state.time);el('elapsed').textContent=fmt(state.time);el('total').textContent=fmt(S.duration);el('seek').value=state.time;el('seek').style.setProperty('--progress',`${state.time/S.duration*100}%`);el('seek').setAttribute('aria-valuetext',`${fmt(state.time)} of ${fmt(S.duration)}`);if(state.chapter!==f.index){state.chapter=f.index;el('chapter').textContent=S.chapters[f.index].name;}const done=state.time>=S.duration;el('play').textContent=done?'↺':state.playing?'Ⅱ':'▶';el('play').setAttribute('aria-label',done?'Replay story':state.playing?'Pause story':'Play story');el('previous').disabled=f.index===0;el('next').disabled=f.index===S.chapters.length-1;el('wish').hidden=f.index!==5;el('wish').textContent=state.wish?'Consider it wished.':'Make a wish';el('wish').disabled=state.wish;}
function silence(){audio.pause();}
function playAudio(){if(!state.sound)return;try{audio.currentTime=state.time;audio.play().catch(()=>{});}catch(_){}}
function seek(t){state.time=S.clamp(Number(t)||0,0,S.duration);state.wish=false;state.playing=false;silence();sync();draw();}
function play(){if(state.time>=S.duration)state.time=0;state.opened=true;el('open').hidden=true;el('play').hidden=false;state.playing=true;last=performance.now();playAudio();sync();}
function pause(){state.playing=false;silence();sync();draw();}
function toggle(){state.playing?pause():play();}
function jump(delta){const f=S.locate(state.time);const index=S.clamp(f.index+delta,0,S.chapters.length-1);const t=S.chapters.slice(0,index).reduce((v,c)=>v+c.duration,0);const wasPlaying=state.playing;seek(t);if(wasPlaying)play();}
el('open').addEventListener('click',play);el('play').addEventListener('click',toggle);
el('previous').addEventListener('click',()=>jump(-1));el('next').addEventListener('click',()=>jump(1));
el('seek').max=S.duration;el('seek').addEventListener('input',e=>{state.opened=true;el('open').hidden=true;el('play').hidden=false;seek(e.target.value);});
function mute(){state.sound=!state.sound;el('sound').setAttribute('aria-pressed',String(state.sound));el('sound').setAttribute('aria-label',state.sound?'Sound on':'Sound off');el('sound').innerHTML=`<span aria-hidden="true"></span>Sound ${state.sound?'on':'off'}`;if(state.sound&&state.playing)playAudio();else silence();}
el('sound').addEventListener('click',mute);el('wish').addEventListener('click',()=>{state.wish=true;sync();draw();});
document.querySelector('.wordmark').addEventListener('click',e=>{e.preventDefault();seek(0);});
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if(e.code==='Space'){if(e.target.matches('button,a,summary'))return;e.preventDefault();toggle();}if(e.key==='ArrowRight'){e.preventDefault();jump(1);}if(e.key==='ArrowLeft'){e.preventDefault();jump(-1);}if(e.key.toLowerCase()==='m')mute();});
window.addEventListener('resize',()=>{portrait=size();draw();});
function tick(now){if(state.playing){const dt=Math.min((now-last)/1000,.1);state.time=Math.min(S.duration,state.time+Math.max(0,dt));if(state.time>=S.duration){state.playing=false;silence();}sync();draw();}last=now;requestAnimationFrame(tick);}
window.giftDemo={ready:false,duration:S.duration,seek,getState:()=>({...state}),frame(t){state.time=S.clamp(t,0,S.duration);state.playing=false;GiftRenderer.render(canvas,state.time,{portrait:false,wish:false,reducedMotion:false});return state.time;}};
document.fonts.ready.then(()=>{sync();draw();giftDemo.ready=true;if(!renderOnly)requestAnimationFrame(tick);});
})();
