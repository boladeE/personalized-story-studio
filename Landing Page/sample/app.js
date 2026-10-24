'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const sceneNode = $('#scene');
  const photo = (file, alt) => `<img class="backdrop" src="assets/${file}.jpg" alt="${alt}" loading="eager">`;
  const content = (eyebrow, title, body, aside = '') => `<div class="story-content"><p class="eyebrow">${eyebrow}</p><h2 id="scene-title">${title}</h2><p class="body-copy">${body}</p>${aside ? `<p class="aside">${aside}</p>` : ''}</div>`;
  const scenes = [
    {name:'The invitation', className:'ticket-scene', track:0, html:`<div class="ticket-wrap"><button id="admit" class="ticket" aria-label="Admit one: Zara. Tap to begin"><span class="ticket-main"><span><span class="ticket-label">A very private screening</span><span class="admit" id="scene-title">Admit one</span><span class="ticket-name">Zara</span></span><span class="ticket-details"><span>Seat: next to me</span><span>Occasion: your birthday</span></span></span><span class="ticket-stub"><span>Tap to begin</span></span></button><p class="ticket-hint">Space or → to continue · ← to go back · M for music</p><p class="headphones">Headphones, if you have them. No rushing.</p></div>`},
    {name:'Before we begin', className:'opening-scene', track:0, html:`<div class="story-content opening-content"><p class="eyebrow">For Zara. From Tobi.</p><h1 id="scene-title">You said<br><em>“no fuss.”</em></h1><p class="body-copy">I heard you. Then I made you a whole birthday screening.<br>In my defence, you also say “I’m not hungry”<br>and we both know how that ends.</p><p class="signature">Stay with me, birthday girl.</p></div>`},
    {name:'My favourite person', className:'has-photo photo-portrait', track:0, html:photo('laughing','Zara, a fictional adult Nigerian woman, in warm evening light')+`<div class="story-content"><p class="eyebrow">01 · The main character</p><h1 id="scene-title">There<br>she <em>is.</em></h1><p class="body-copy">The woman who can spot my mood from one “hey.” Who tells me to eat before giving me advice. Who laughs with her whole face when she forgets I’m taking a picture.</p><p class="aside">That last one. That’s my favourite Zara.</p></div>`},
    {name:'The Uno allegation', className:'has-photo photo-right', track:0, html:photo('selfie','Fictional Zara and Tobi smiling together in a candid photograph')+content('02 · Where the trouble started','You called<br>me a <em>cheat.</em>','At our friend’s games night. Over Uno. You said nobody could be that lucky, then made me shuffle again while you watched my hands.<br><br>I had absolutely no good reply. You were very distracting.','For the record: still no evidence.')},
    {name:'The rainy café', className:'has-photo photo-right', track:1, html:photo('cafe','Zara and Tobi on a rainy café date, imagined photograph')+content('03 · A date with terrible weather','The rain<br>can <em>wait.</em>','We were meant to stay for one drink. Then the rain started, and you moved your chair closer so I could hear your gist.<br><br>I remember the window fogging up. Your cold hands around the cup. Me hoping the rain would take its time.','We missed the traffic. Allegedly.')},
    {name:'The quick gist', className:'has-photo photo-portrait', track:1, html:photo('laughing','Zara laughing naturally, fictional AI-generated photograph')+content('04 · Eleven minutes later','“Quick gist.”<br><em>11:07.</em>','That was the length of the voice note, Zara.<br><br>You introduced three people, stopped to remember someone’s name, said “anyway” four times, and somehow I still needed part two. I listened to the whole thing outside my gate.','I like being the person you tell.')},
    {name:'The chips arrangement', className:'has-photo photo-right', track:1, html:photo('dinner','The fictional couple sharing an intimate dinner')+content('05 · A standing arrangement','My chips.<br><em>Our</em> chips.','You: “Don’t order for me. I’m not hungry.”<br>Also you: reaching across the table before I’ve even sat down.<br><br>I order the larger portion now. I still act shocked. You still don’t ask. We have a system.','I will never let you live this down.')},
    {name:'Nothing to say', className:'has-photo photo-wide', track:2, html:photo('beach','Zara and Tobi at a sunset beach, fictional photograph')+content('06 · That evening by the water','We didn’t need<br>a <em>big plan.</em>','Our shoes were full of sand. You kept saying “one more minute” every time the sky changed.<br><br>I wanted to take a picture. Then you leaned into me, so I put my phone away. Some of the best bits aren’t in the camera roll.')},
    {name:'The camera roll', className:'montage-scene', track:2, html:`<div class="montage-header"><div><p class="eyebrow">07 · Evidence of a very good thing</p><h2 id="scene-title">Look at <em>us.</em></h2></div><p>Not perfectly posed. Not always on time.<br>Very, very much my favourite.<br>Tap a photograph to stay a little longer.</p></div><div class="montage"><button class="photo-print" data-photo="selfie" data-caption="The one you made me retake. Twice."><img src="assets/selfie.jpg" alt="Zara and Tobi in a candid selfie"><span>The one you made me retake. Twice.</span></button><button class="photo-print" data-photo="cafe" data-caption="One drink became the whole afternoon."><img src="assets/cafe.jpg" alt="The couple at the café"><span>One drink. A whole afternoon.</span></button><button class="photo-print" data-photo="beach" data-caption="Yes, there was sand in the car."><img src="assets/beach.jpg" alt="The couple together on a beach at sunset"><span>Yes, there was sand in the car.</span></button></div>`},
    {name:'A thoroughly biased review', className:'has-photo reviews-scene', track:2, html:photo('laughing','Zara laughing, imagined photograph')+`<div class="story-content reviews-content"><div><p class="eyebrow">08 · A thoroughly biased review</p><h2 id="scene-title">Would fall<br>for her<br><em>again.</em></h2></div><div class="reviews"><figure class="review"><div class="stars" aria-label="5 out of 5 stars">★★★★★</div><blockquote>“Excellent company. Dangerous smile.”</blockquote><p>Went for a games night. Now willingly listens to eleven-minute voice notes.</p><cite>— Tobi, repeat customer</cite></figure><figure class="review"><div class="stars" aria-label="5 out of 5 stars">★★★★★</div><blockquote>“Makes ordinary days suspiciously good.”</blockquote><p>Even buying bread becomes an outing. I have no explanation.</p><cite>— Also Tobi. Small review pool.</cite></figure></div></div>`},
    {name:'The tiny complaints department', className:'has-photo photo-right', track:2, html:photo('selfie','The fictional couple in a playful candid selfie')+content('09 · The tiny complaints department','A few<br><em>minor</em> notes.','You steal the duvet, then ask why I’m cold.<br>You say “I’m ready” while choosing earrings.<br>You remember an argument I thought we’d both forgotten.<br><br>And somehow, after all of that, I’m still the one asking when I get to see you.','Five stars. No returns. Please keep the receipt.')},
    {name:'A letter for you', className:'has-photo letter-scene', track:3, html:photo('portrait','Zara in soft light, fictional portrait')+`<div class="story-content letter-content"><p class="eyebrow">10 · The bit without a joke</p><h2 id="scene-title">Zara, <em>my love.</em></h2><div class="letter-body"><p>I know I make a joke when I’m trying to say something properly. So let me try without one.</p><p>I notice the way you remember the small things. You ask how something went even when I mentioned it once, in passing. You can tell when I need advice and when I just need you to sit there and let me complain.</p><p>You don’t have to be the one holding everything together today. You don’t have to make a plan, check on everyone, or pretend you don’t want a little fuss. Let me look after you for a change.</p><p>For this new year of your life, I want you to get some of the care you give away so easily. More rest without guilt. More good news you can’t wait to call me about. More things that are yours, just because you want them.</p><p>I’m glad you walked into that games night. I’m even glad you accused me of cheating. I love the life we’re making out of all these little moments.</p></div><p class="letter-sign">Always on your team,<br>Tobi</p></div>`},
    {name:'Your birthday', className:'has-photo photo-wide', track:3, html:photo('birthday','Fictional Zara with a candlelit birthday cake and Tobi beside her')+content('11 · Absolutely a little fuss','Happy birthday,<br><em>Zara.</em>','To your laugh from the other room. Your very long stories. Your hand finding mine without looking.<br><br>To another year of you being you. And me being very lucky to be here for it.','Yes, I got the cake. Of course I got the cake.')},
    {name:'Make a wish', className:'has-photo finale-scene', track:3, html:photo('birthday','The fictional birthday candle moment for Zara and Tobi')+`<div class="story-content finale-content"><p class="eyebrow">12 · One more thing</p><h1 id="scene-title">Make a<br><em>wish.</em></h1><p class="body-copy">Don’t tell me. Just close your eyes for a second.<br>I’ll be right here when you open them.</p><button id="wish" class="wish-button"><span class="flame" aria-hidden="true"></span>Blow out the candle</button><p class="wish-confirmation" id="wish-confirmation" hidden aria-live="polite">There. That one’s between you and the universe.</p><div id="bonus-letter" class="bonus-letter" hidden>My wish? More afternoons that run late. More pictures you say I can’t post. More of your hand in mine on the way home.<br><br>And yes, you can have my chips.<br><em>Love you, birthday girl. — Tobi</em></div></div>`}
  ];
  let scene = 0;
  let wished = false;
  let countdownTimer = null;
  let countdownActive = false;
  let onTrackChange = () => {};
  const dots = $('#chapter-dots');
  scenes.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'chapter-dot';
    b.setAttribute('aria-label', `Chapter ${i + 1}: ${s.name}`); b.title = s.name;
    b.addEventListener('click', () => go(i)); dots.append(b);
  });
  function stopCountdown() { clearInterval(countdownTimer); countdownActive = false; $('#countdown').hidden = true; }
  function go(index) {
    stopCountdown();
    scene = Math.max(0, Math.min(scenes.length - 1, Number(index) || 0));
    sceneNode.className = `scene ${scenes[scene].className} entering`;
    sceneNode.innerHTML = scenes[scene].html;
    const backdrop = sceneNode.querySelector('.backdrop');
    sceneNode.dataset.image = backdrop ? backdrop.getAttribute('src').split('/').pop().split('.')[0] : '';
    $('#scene-counter').textContent = `${String(scene + 1).padStart(2,'0')} / ${scenes.length}`;
    $('#previous').disabled = scene === 0; $('#next').disabled = scene === scenes.length - 1;
    dots.querySelectorAll('button').forEach((b,i) => b.setAttribute('aria-current', String(i === scene)));
    window.scrollTo({top:0, behavior:'instant'});
    onTrackChange(scenes[scene].track);
    if (scene === 13 && wished) showWish();
  }
  function begin() {
    if (countdownActive) return;
    countdownActive = true; $('#countdown').hidden = false; $('#count-number').textContent = '3';
    $('#skip-countdown').focus(); let n = 3;
    countdownTimer = setInterval(() => { n--; if (n <= 0) { go(1); $('#screen').focus({preventScroll:true}); } else $('#count-number').textContent = String(n); }, 700);
  }
  function next() { if (scene === 0) begin(); else go(scene + 1); }
  function showWish() {
    wished = true; sceneNode.classList.add('wish-made'); $('#wish').disabled = true;
    $('#wish').lastChild.textContent = ' Candle out';
    $('#wish-confirmation').hidden = false; $('#bonus-letter').hidden = false;
  }
  $('#previous').addEventListener('click', () => go(scene - 1));
  $('#next').addEventListener('click', next);
  $('#skip-countdown').addEventListener('click', () => { go(1); $('#screen').focus({preventScroll:true}); });
  sceneNode.addEventListener('click', (e) => {
    if (e.target.closest('#admit')) begin();
    if (e.target.closest('#wish')) showWish();
    const image = e.target.closest('[data-photo]');
    if (image) { $('#enlarged-photo').src = `assets/${image.dataset.photo}.jpg`; $('#enlarged-photo').alt = image.querySelector('img').alt; $('#photo-caption').textContent = image.dataset.caption; $('#photo-dialog').showModal(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, audio, iframe, [contenteditable="true"]') || document.querySelector('dialog[open]:not(#music-panel)')) return;
    if (e.code === 'Space' && e.target.closest('button')) return;
    if (countdownActive) { if (e.key === 'Escape' || e.key === 'ArrowRight' || e.code === 'Space') { e.preventDefault(); go(1); } return; }
    if (e.key === 'ArrowRight' || e.code === 'Space') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(scene-1); }
    if (e.key.toLowerCase() === 'm') $('#music-toggle').click();
  });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if(e.target === d) { const r=d.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close(); }}));
  $('#credits-toggle').addEventListener('click', () => $('#credits-panel').showModal());
  const defaultTracks = [
    {id:'roju', title:'Roju', artist:'Chike', videoId:'19WTWVw15n0'},
    {id:'friend', title:'How Are You (My Friend)', artist:'Johnny Drille', videoId:'CSK5eApRGwQ'},
    {id:'grow', title:'Grow As We Go', artist:'Ben Platt', videoId:'aDeNQNtW1f8'}
  ];
  let tracks = defaultTracks;
  let intendedTrack = 0;
  let soundtrackEnabled = false;
  let localObjectURL = null;
  const dock = document.createElement('aside'); dock.id = 'music-dock'; dock.hidden = true;
  dock.setAttribute('aria-label', 'Visible YouTube soundtrack player');
  const dockHeader = document.createElement('div'); dockHeader.className = 'dock-header';
  const dockLabel = document.createElement('span'); dockLabel.textContent = 'YouTube soundtrack';
  const dockStop = document.createElement('button'); dockStop.textContent = '×'; dockStop.setAttribute('aria-label','Stop YouTube soundtrack');
  const dockFallback = document.createElement('a'); dockFallback.target = '_blank'; dockFallback.rel = 'noopener noreferrer'; dockFallback.textContent = 'Can’t play here? Open on YouTube ↗';
  dockHeader.append(dockLabel,dockStop); dock.append(dockHeader, $('#youtube-container'), dockFallback); document.body.append(dock);
  function updateTrackOptions() {
    $('#track-select').replaceChildren(...tracks.map((t,i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${t.title} — ${t.artist}`; return o; }));
  }
  function renderPlayer() {
    const track = tracks[intendedTrack];
    const current = $('#youtube-container iframe');
    if (current && current.dataset.videoId === track.videoId) return;
    const iframe = document.createElement('iframe');
    iframe.title = `${track.title} by ${track.artist} — official YouTube player`;
    const origin = location.protocol.startsWith('http') ? `&origin=${encodeURIComponent(location.origin)}` : '';
    iframe.src = `https://www.youtube.com/embed/${track.videoId}?autoplay=0&playsinline=1&rel=0${origin}`;
    iframe.dataset.videoId = track.videoId;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    $('#youtube-container').replaceChildren(iframe); dock.hidden = false;
    dockLabel.textContent = `${track.title} · ${track.artist}`;
    dockFallback.href = `https://www.youtube.com/watch?v=${track.videoId}`;
    $('#music-status').textContent = 'The visible player stays in the corner while you read. Press play in YouTube. Scene changes cue the next song; browsers may require play again. Internet is required, and some videos cannot be embedded.';
  }
  function selectTrack(i) {
    intendedTrack = Math.max(0, Math.min(tracks.length-1, i));
    const t = tracks[intendedTrack];
    $('#track-title').textContent = soundtrackEnabled ? t.title : `Music · ${t.title}`;
    $('#youtube-fallback').href = `https://www.youtube.com/watch?v=${t.videoId}`;
    $('#track-artist').textContent = `${t.artist} · ${soundtrackEnabled ? 'YouTube enabled' : 'music off · tap to choose'}`;
    $('#track-select').value = String(intendedTrack);
    if (soundtrackEnabled) renderPlayer();
  }
  function stopYouTube() { soundtrackEnabled = false; dock.hidden = true; $('#youtube-container').replaceChildren(); $('#soundtrack-enable').textContent = 'Show YouTube player'; selectTrack(intendedTrack); }
  function stopAllMusic() {
    stopYouTube(); $('#local-player').pause();
    $('#music-status').textContent = 'Music stopped. The story is still here, at your pace.';
  }
  updateTrackOptions();
  onTrackChange = selectTrack;
  $('#track-select').addEventListener('change', e => selectTrack(Number(e.target.value)));
  $('#soundtrack-enable').addEventListener('click', () => {
    $('#local-player').pause(); soundtrackEnabled = true; selectTrack(intendedTrack);
    $('#soundtrack-enable').textContent = 'YouTube player shown';
  });
  $('#stop-music').addEventListener('click', stopAllMusic); dockStop.addEventListener('click', stopYouTube);
  $('#local-audio').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.type.startsWith('audio/')) { $('#music-status').textContent = 'Please choose an audio file.'; return; }
    stopAllMusic(); if (localObjectURL) URL.revokeObjectURL(localObjectURL);
    localObjectURL = URL.createObjectURL(file); const audio = $('#local-player'); audio.src = localObjectURL; audio.hidden = false;
    $('#music-status').textContent = `Local song selected: ${file.name}. Press play below. This file stays on your device and will not change with scenes.`;
  });
  $('#local-player').addEventListener('error', () => {
    $('#music-status').textContent = 'This audio file could not be played. Choose another audio file.';
  });
  $('#local-player').addEventListener('play', stopYouTube);
  window.addEventListener('pagehide', () => { if(localObjectURL) URL.revokeObjectURL(localObjectURL); });
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    fetch('music.json').then(r => { if(!r.ok) throw new Error('Music configuration unavailable'); return r.json(); }).then(config => {
      if (!Array.isArray(config.tracks) || !config.tracks.length || !config.tracks.every(t => typeof t.title === 'string' && typeof t.artist === 'string' && /^[A-Za-z0-9_-]{11}$/.test(t.videoId))) throw new Error('Invalid music configuration');
      tracks = config.tracks; updateTrackOptions(); selectTrack(scenes[scene].track);
    }).catch(() => { $('#music-status').textContent = 'Using the bundled official track configuration. Internet is still needed for YouTube playback.'; });
  }
  $('#music-toggle').addEventListener('click', () => { const panel = $('#music-panel'); if(panel.open) panel.close(); else panel.show(); });
  go(0);
  window.giftV2 = { ready:true, go, getState:() => ({scene, total:scenes.length, name:scenes[scene].name, wished, countdownActive, soundtrackEnabled, intendedTrack:tracks[intendedTrack], localAudioSelected:!!localObjectURL}) };
})();
