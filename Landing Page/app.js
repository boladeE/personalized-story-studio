(() => {
  'use strict';
  const dialog = document.querySelector('#brief-dialog');
  const form = document.querySelector('#brief-form');
  const status = document.querySelector('#brief-status');
  let selectedOccasion = 'Birthday';
  const descriptions = {
    Birthday: 'A birthday gift that sounds like you, not a greeting card.',
    Anniversary: 'The big milestones. And the ordinary days that got you there.',
    Proposal: 'A story only the two of you share. One very big question.',
    'Just because': 'No special date needed. Just someone worth celebrating.'
  };
  document.querySelectorAll('[data-occasion]').forEach(button => {
    button.addEventListener('click', () => {
      selectedOccasion = button.dataset.occasion;
      document.querySelectorAll('[data-occasion]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      document.querySelector('.occasion-response').textContent = descriptions[selectedOccasion];
      form.elements.occasion.value = selectedOccasion;
    });
  });
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#nav');
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
    if (event.key === 'Escape') closeMenu();
  });
  function openBrief(format) {
    form.elements.occasion.value = selectedOccasion;
    if (format) form.elements.format.value = format;
    status.textContent = '';
    closeMenu();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
    dialog.scrollTop = 0;
  }
  document.querySelectorAll('a[href="#brief"]').forEach(a => a.addEventListener('click', event => {
    event.preventDefault();
    openBrief(a.dataset.format);
  }));
  document.querySelector('#start-brief').addEventListener('click', () => openBrief());
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
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
      'LITTLE THINGS — DRAFT GIFT BRIEF',
      '',
      'Local draft only. This is not a submitted order or booking.',
      '',
      `From: ${get('sender')}`,
      `Email: ${get('email')}`,
      `For: ${get('recipient')}`,
      `Occasion: ${get('occasion')}`,
      `Format: ${get('format')}`,
      `Preferred date: ${get('date') || 'To discuss'}`,
      '', 'THE LITTLE THINGS', get('story'), '',
      'TO AGREE BEFORE PRODUCTION',
      'Story and style, available photos/clips, music permissions, quote, timeline, revisions, privacy, and hosting or delivery.',
      '', 'Nothing has been sent or uploaded from this preview.'
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], {type: 'text/plain;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Little-Things-Gift-Brief.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    status.textContent = 'Your draft is ready to keep. Nothing has been sent or booked.';
  });
})();
