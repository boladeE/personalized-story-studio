/* Original fictional story. No customer material. */
(function(root){
'use strict';
const chapters = [
  {id:'invitation', name:'An invitation', duration:6},
  {id:'first-date', name:'Five minutes away', duration:10},
  {id:'memories', name:'The little things', duration:11},
  {id:'reasons', name:'Side A: you', duration:10},
  {id:'letter', name:'A little note', duration:13},
  {id:'birthday', name:'Make a wish', duration:10}
];
const duration = chapters.reduce((n,c)=>n+c.duration,0);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function locate(time){
  const t=clamp(Number.isFinite(time)?time:0,0,duration);
  let start=0;
  for(let index=0;index<chapters.length;index++){
    const c=chapters[index];
    if(t<start+c.duration || index===chapters.length-1)
      return {index,start,local:t-start,progress:clamp((t-start)/c.duration,0,1),time:t};
    start+=c.duration;
  }
}
const api={chapters,duration,clamp,locate};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.BirthdayStory=api;
})(typeof globalThis!=='undefined'?globalThis:this);
