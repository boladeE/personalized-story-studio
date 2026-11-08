(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const dialog = $('#brief-dialog');
  const form = $('#brief-form');
  const status = $('#brief-status');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Hero: a short fictional "quick moment" that reveals line by line. */
  const moment = $('#moment');
  const lines = $$('.moment-lines li');
  let timers = [];
  function playMoment() {
    timers.forEach(clearTimeout);
    timers = [];
    lines.forEach(line => line.classList.remove('shown'));
    moment.dataset.state = 'playing';
    if (reduceMotion.matches) {
      lines.forEach(line => line.classList.add('shown'));
      moment.dataset.state = 'done';
      return;
    }
    lines.forEach((line, i) => timers.push(setTimeout(() => line.classList.add('shown'), 450 + i * 850)));
    timers.push(setTimeout(() => { moment.dataset.state = 'done'; }, 450 + lines.length * 850 + 250));
  }
  $('#replay').addEventListener('click', playMoment);
  playMoment();

  /* Occasions: examples drawn from the proposed product offering. */
  const occasions = {
    Romance: {phrase: 'a romantic moment', examples: ['Asking someone out', 'A proposal', 'An anniversary', 'Valentine’s Day', 'Saying sorry', 'A long-distance surprise']},
    Birthdays: {phrase: 'a birthday', examples: ['A midnight surprise', 'A memory-lane timeline', 'A birthday letter with the photos they forgot you took']},
    Weddings: {phrase: 'a wedding', examples: ['Your how-we-met story', 'An invitation page', 'A memory page after the day']},
    'Life milestones': {phrase: 'a milestone', examples: ['A graduation', 'A new job', 'A retirement', 'A pregnancy announcement', 'A gender reveal']},
    Family: {phrase: 'family', examples: ['Mother’s Day', 'Father’s Day', 'Children celebrating their parents’ anniversary']},
    'Just because': {phrase: 'a just-because moment', examples: ['Reasons I love you', 'Open-when letters', 'For a best friend', 'After a rough week', 'Before an exam or interview', 'Thank you to a parent or mentor', 'For someone far away']}
  };
  let selectedOccasion = 'Birthdays';
  const examples = $('#occasion-examples');
  const occasionCta = $('#occasion-cta');
  $$('[data-occasion]').forEach(button => {
    button.addEventListener('click', () => {
      selectedOccasion = button.dataset.occasion;
      $$('[data-occasion]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      const info = occasions[selectedOccasion];
      examples.replaceChildren(...info.examples.map(text => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }));
      occasionCta.textContent = `Start a brief for ${info.phrase}`;
    });
  });

  /* Mobile navigation */
  const menu = $('.menu-toggle');
  const nav = $('#nav');
  function closeMenu() {
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open navigation');
    nav.classList.remove('open');
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    nav.classList.toggle('open', open);
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      closeMenu();
      menu.focus();
    }
  });

  /* Brief dialog: local-only text download */
  let opener = null;
  function openBrief({size, format} = {}) {
    form.elements.occasion.value = selectedOccasion;
    if (size) form.elements.size.value = size;
    if (format) form.elements.format.value = format;
    status.textContent = '';
    closeMenu();
    opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
    dialog.scrollTop = 0;
  }
  $$('a[href="#brief"]').forEach(a => a.addEventListener('click', event => {
    event.preventDefault();
    openBrief({size: a.dataset.size, format: a.dataset.format});
  }));
  $('#start-brief').addEventListener('click', () => openBrief());
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (opener && document.contains(opener) && opener.offsetParent !== null) opener.focus();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const get = name => String(data.get(name) || '').trim();
    const text = [
      'LITTLE THINGS DIGITAL: DRAFT GIFT BRIEF',
      '',
      'Local draft only. This is not a submitted order or booking.',
      '',
      `From: ${get('sender')}`,
      `Email: ${get('email')}`,
      `For: ${get('recipient')}`,
      `Occasion: ${get('occasion')}`,
      `Size: ${get('size')}`,
      `Format: ${get('format')}`,
      `Date in mind: ${get('date') || 'To discuss'}`,
      '', 'THE LITTLE THINGS', get('story'), '',
      'TO AGREE BEFORE ANY WORK STARTS',
      'Story and style, photos and clips, music permissions, price, date, review rounds, privacy, and hosting or delivery.',
      '', 'Saved from littlethingsdigital.com. This file has not been sent to anyone.'
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], {type: 'text/plain;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Little-Things-Digital-Brief.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    status.textContent = 'Your brief is saved to your device.';
  });
})();
