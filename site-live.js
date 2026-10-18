// The parts of the site that are live rather than animated: the local-time status in the nav,
// the Hold This Thought demo, the GitHub activity grid, and the version history scrubber.
// Loaded for everyone (reduced motion included); nothing here depends on GSAP.
import { parseThought } from './thought-parser.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- For whoever opens DevTools ----------
console.log(
  '%c MASON DI LEO %c Learning by building\n\n%cHey, you opened the console. I like you.\n\n' +
  'This site is hand-built, no framework or template: three.js for the room, GSAP and Lenis for the motion, ' +
  'Matter.js for the letters, View Transitions for the case studies, and a JavaScript port of my iOS app\'s ' +
  'reminder parser. Built with Claude Code.\n\n' +
  'Source:  https://github.com/dileomason-stack/Personal-Website\n' +
  'Email:   dileomason@gmail.com\n\n' +
  'Psst: press ` (backtick) anywhere on the page.',
  'background:#d4471f;color:#fff;font:800 13px Manrope,system-ui,sans-serif;padding:6px 10px;border-radius:4px 0 0 4px',
  'background:#151513;color:#f3f0ea;font:500 12px "DM Mono",monospace;padding:7px 10px;border-radius:0 4px 4px 0',
  'color:inherit;font:13px/1.6 system-ui,sans-serif',
);

// ---------- Visitor stats (GoatCounter): off until the page's <meta name="goatcounter"> has a code ----------
// Page views come from GoatCounter's script; these events add what people do here.
const statsCode = document.querySelector('meta[name="goatcounter"]')?.content.trim();
if (statsCode) {
  const s = Object.assign(document.createElement('script'), { async: true, src: 'https://gc.zgo.at/count.js' });
  s.dataset.goatcounter = `https://${statsCode}.goatcounter.com/count`;
  document.head.appendChild(s);
}
const sent = new Set();
// Once per page view per event, e.g. track('case/homeroom', 'Opened the Homeroom case study')
export function track(path, title) {
  if (!statsCode || sent.has(path)) return;
  sent.add(path);
  const send = () => window.goatcounter?.count?.({ path, title, event: true });
  window.goatcounter?.count ? send() : addEventListener('load', () => setTimeout(send, 500), { once: true });
}
addEventListener('intro:skip', () => track('intro/skipped', 'Skipped the intro'));
addEventListener('intro:done', () => setTimeout(() => sent.has('intro/skipped') || track('intro/watched', 'Watched the intro'), 0));

// ---------- Nav: Mason's time in San Luis Obispo, then what he's probably up to ----------
// Edit the moods here. Hours are Pacific time; `days` limits a row to weekdays (1-5) or weekends.
const MOODS = [
  { from: 0, to: 2, text: 'Up late, building', mood: 'late' },
  { from: 2, to: 7, text: 'Asleep', mood: 'asleep' },
  { from: 7, to: 9, text: 'Starting the day' },
  { from: 9, to: 17, days: [1, 2, 3, 4, 5], text: 'In class or office hours' },
  { from: 9, to: 17, text: 'Weekend' },
  { from: 17, to: 19, text: 'Probably at the gym' },
  { from: 19, to: 24, text: 'After hours, building', mood: 'late' },
];
const now = $('#now');
if (now) {
  const roll = $('.now-roll', now), a = $('.now-a', now), b = $('.now-b', now);
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23', weekday: 'short' });
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const update = () => {
    const d = new Date(), p = Object.fromEntries(parts.formatToParts(d).map(x => [x.type, x.value]));
    const hour = +p.hour % 24, day = days[p.weekday];
    const m = MOODS.find(r => hour >= r.from && hour < r.to && (!r.days || r.days.includes(day)));
    a.textContent = `${clock.format(d)} in SLO`;
    b.textContent = m.text;
    now.dataset.mood = m.mood || 'awake';
    now.setAttribute('aria-label', `${clock.format(d)} in San Luis Obispo. ${m.text}.`);
  };
  update();
  setInterval(update, 15000);
  // Rolls between the time and the mood every few seconds (holds on the time with reduced motion)
  if (!reduce) setInterval(() => roll.classList.toggle('flip'), 4500);
}

// ---------- Hold This Thought: type a thought and the app's own parser reads it ----------
// Mirrors the app (CaptureView.swift): typing opens the "New thought" sheet over the home screen, the
// "Remind me" choice follows the words as they're typed, and Save closes the sheet and shows the lime
// "Reminder set" banner with the same wording as MemoryStore.confirmSaved. On phones, where the mockup
// has scrolled away, a summary card also shows under the field.
const showcase = $('.showcase');
if (showcase) {
  const form = $('.sc-try', showcase), input = $('#htt-input', form), clear = $('.try-clear', form), inline = $('.try-result', form);
  const screen = $('.phone-screen', showcase), sheet = $('.htt-sheet', screen), field = $('.htt-text', sheet);
  const chipEls = $$('.htt-chips span', sheet), detail = $('.htt-detail', sheet), saveBtn = $('.htt-save', sheet);
  const banner = $('.htt-banner', screen), bannerText = $('.htt-banner-text', banner);
  const chips = $$('.try-chips button', form);
  const EXAMPLES = ['What do you want to remember?', 'Try “gym every Tue and Thu at 6”', 'Try “buy batteries next time I’m at Target”', 'Try “call mom after work”', 'Try “pay rent on the 1st of every month”'];
  const ICON = {
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/>',
    pin: '<path d="M20 4 4 10.6l6.6 2.7L13.4 20z"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    when: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8"/>',
    none: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  };
  const svg = (d, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const timeOf = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  // "Reminder set · Tomorrow 5:00 PM", "Reminder set · Every Mon, Wed, Fri · 8:00 AM", "Reminder set · At Costco"
  function confirmation(r) {
    if (r.when) {
      const d = r.when.date, now = new Date(), tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const day = sameDay(d, now) ? 'Today' : sameDay(d, tomorrow) ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `Reminder set · ${r.repeat ? `${r.repeat} · ${timeOf(d)}` : `${day} ${timeOf(d)}`}`;
    }
    if (r.place) return `Reminder set · At ${r.place}`;
    return 'Saved · no reminder';
  }

  let example = 0, bannerTimer = 0, lastDetail = '';
  setInterval(() => { if (!input.value) { example = (example + 1) % EXAMPLES.length; field.dataset.placeholder = EXAMPLES[example]; } }, 3500);
  field.dataset.placeholder = EXAMPLES[0];
  const open = on => screen.classList.toggle('typing', on);

  function read() {
    const text = input.value.trim();
    clear.hidden = !input.value;
    field.textContent = input.value;
    saveBtn.classList.toggle('off', !text);
    chips.forEach(c => c.classList.toggle('on', c.textContent.replace(/’/g, "'") === input.value.replace(/’/g, "'")));
    if (!text) { chipEls.forEach((c, i) => c.classList.toggle('on', i === 0)); detail.innerHTML = lastDetail = ''; inline.innerHTML = ''; return null; }
    const r = parseThought(text);
    // The "Remind me" choice follows the words: Time, Place, or No reminder
    const pick = r.when ? 1 : r.place ? 2 : 0;
    chipEls.forEach((c, i) => c.classList.toggle('on', i === pick));
    let html = '';
    if (pick === 1) {
      const d = r.when.date;
      html = `<div class="htt-row"><span class="htt-tile">${svg(ICON.clock)}</span><span class="htt-pills"><span>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span><span>${timeOf(d)}</span></span></div>`
        + (r.repeat ? `<div class="htt-repeat">${svg(ICON.repeat)}${esc(r.repeat)}</div>` : '');
    } else if (pick === 2) {
      html = `<div class="htt-row"><span class="htt-tile" style="--c:#ff7300">${svg(ICON.pin)}</span><span class="htt-label">${esc(r.place)}</span><span class="chev">›</span></div>`;
    }
    if (html !== lastDetail) detail.innerHTML = lastDetail = html;
    // Phones: a summary under the field
    const rows = [];
    if (r.when) rows.push([r.repeat ? 'repeat' : 'when', r.repeat ? `${r.repeat} · ${timeOf(r.when.date)}` : confirmation({ when: r.when }).replace('Reminder set · ', '')]);
    else if (r.place) rows.push(['pin', r.place === 'Home' ? 'When you get home' : `When you get to ${r.place}`]);
    else rows.push(['none', 'No reminder yet. Saved for later']);
    inline.innerHTML = `<div class="htt-title">${esc(r.title)}</div><ul class="htt-rows">${rows.map(([i, t]) => `<li>${svg(ICON[i])}<span>${esc(t)}</span></li>`).join('')}</ul>`;
    return r;
  }

  function save() {
    const r = read();
    if (!r) return;
    track('demo/hold-this-thought', 'Saved a thought in the app demo');
    // Like the app: the sheet goes away, then the banner comes up from the bottom for five seconds
    open(false);
    input.value = '';
    read();
    inline.innerHTML = `<div class="htt-saved">${svg('<circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5" stroke="#9eeb1a" stroke-width="2.2" fill="none" stroke-linecap="round"/>')}<span>${esc(confirmation(r))}</span></div>`;
    clearTimeout(bannerTimer);
    banner.classList.remove('on');
    bannerText.textContent = confirmation(r);
    setTimeout(() => banner.classList.add('on'), reduce ? 0 : 380);
    bannerTimer = setTimeout(() => { banner.classList.remove('on'); inline.innerHTML = ''; }, 5400);
  }

  // The phone has to be on its home screen (the sheet opens over it); stop the tabs advancing
  const goHome = () => { const tab = $('.sc-step', showcase); if (!tab.classList.contains('is-active') || !showcase.classList.contains('manual')) tab.click(); };
  let typing = 0;
  input.addEventListener('focus', () => { goHome(); open(true); banner.classList.remove('on'); });
  input.addEventListener('blur', () => setTimeout(() => { if (!input.value && document.activeElement !== input) open(false); }, 150));
  input.addEventListener('input', () => { typing++; open(true); banner.classList.remove('on'); read(); });
  form.addEventListener('submit', e => { e.preventDefault(); typing++; save(); });
  saveBtn.addEventListener('click', () => { typing++; save(); });
  $('.htt-cancel', sheet).addEventListener('click', () => { typing++; input.value = ''; read(); open(false); });
  clear.addEventListener('click', () => { typing++; input.value = ''; read(); input.focus(); });
  chips.forEach(chip => chip.addEventListener('click', () => {
    goHome();
    const text = chip.textContent, run = ++typing;
    banner.classList.remove('on');
    open(true);
    if (reduce) { input.value = text; read(); setTimeout(() => run === typing && save(), 900); return; }
    // Typed out a letter at a time, then saved, so the whole flow plays
    input.value = '';
    let i = 0;
    const tick = () => {
      if (run !== typing) return;
      input.value = text.slice(0, ++i);
      read();
      if (i < text.length) setTimeout(tick, 30 + Math.random() * 35);
      else setTimeout(() => run === typing && save(), 1100);
    };
    setTimeout(tick, 380);
  }));
  read();
}

// Runs `fn` once, when `el` comes within a screen or so of view
const whenNear = (el, fn, margin = '600px') => {
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: `${margin} 0px` });
  io.observe(el);
};
const whenSeen = (el, fn) => {
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.35 });
  io.observe(el);
};

// ---------- GitHub activity: total commits and a bar per day (data/activity.json, baked at deploy) ----------
const activity = $('#activity');
if (activity) whenNear(activity, async () => {
  let data;
  try { data = await (await fetch('data/activity.json')).json(); } catch (e) { activity.hidden = true; return; }
  const sum = repos => Object.values(repos || {}).reduce((a, b) => a + b, 0);
  const keys = Object.keys(data.days).sort(), total = keys.reduce((n, k) => n + sum(data.days[k]), 0);
  const label = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const first = new Date(keys[0] + 'T00:00:00Z');
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) + 'T00:00:00Z');
  const days = [];
  for (let d = first; d <= today; d = new Date(+d + 864e5)) days.push([d, sum(data.days[d.toISOString().slice(0, 10)])]);
  const max = Math.max(...days.map(d => d[1]));
  const bars = $('.act-bars', activity), tip = $('.act-tip', activity), counter = $('.act-total b', activity);
  bars.innerHTML = days.map(([d, n]) => `<i class="${n ? '' : 'zero'}" style="--h:${Math.max(12, Math.sqrt(n / max) * 100)}%" data-tip="${label(d)} · ${n} commit${n === 1 ? '' : 's'}"></i>`).join('');
  $('.act-since', activity).textContent = label(first);
  activity.setAttribute('aria-label', `${total} commits on GitHub since ${label(first)}. Open GitHub profile.`);
  bars.addEventListener('pointerover', e => { if (e.target.dataset.tip) tip.textContent = e.target.dataset.tip; });
  if (reduce) { counter.textContent = total; return; }
  const cells = $$('i', bars);
  cells.forEach(c => (c.style.transform = 'scaleY(0)'));
  whenSeen(activity, () => {
    cells.forEach((c, i) => {
      c.style.transform = '';
      c.animate({ transform: ['scaleY(0)', 'scaleY(1)'] }, { duration: 600, delay: i * 18, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    });
    const t0 = performance.now(), length = cells.length * 18 + 500;
    const step = now => {
      const p = Math.min(1, (now - t0) / length);
      counter.textContent = Math.round(total * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
});

// ---------- Case studies (case-study.js, fetched when a visitor first reaches for one) ----------
const cases = () => import('./case-study.js');
$$('.case-open').forEach(btn => {
  btn.addEventListener('pointerenter', cases, { once: true });
  btn.addEventListener('click', () => cases().then(m => m.openCase(btn.dataset.case, btn)));
});
// A shared link to a case study (?case=whenworks) opens it once the site is showing
const linked = new URLSearchParams(location.search).get('case');
if (linked) {
  const go = () => cases().then(m => { history.replaceState(null, '', location.pathname); m.openCase(linked, null); });
  if (document.getElementById('intro')?.classList.contains('done') || document.documentElement.classList.contains('intro-returning')) setTimeout(go, 300);
  else addEventListener('intro:done', () => setTimeout(go, 600), { once: true });
}

// ---------- Photos: a pile of polaroids on the desk ----------
// The top photo can be dragged; flick it far or fast enough and it flies off, then tucks back in at the
// bottom of the pile. Arrow buttons and the keyboard do the same. Photos load as they near the top.
$$('.gallery-wrap').forEach(wrap => {
  const data = JSON.parse(wrap.dataset.slides);
  const title = wrap.closest('section')?.querySelector('.display')?.textContent.replace(/\s+/g, ' ').trim() || 'Photos';
  wrap.innerHTML = `<div class="pile" tabindex="0" role="group" aria-roledescription="photo pile" aria-label="${title} photos. Use the arrow keys to flip through."></div>
    <div class="pile-side"><p class="cap" aria-live="polite"></p><p class="count mo"></p>
    <div class="pile-btns"><button type="button" class="prev" aria-label="Previous photo">←</button><button type="button" class="next" aria-label="Next photo">→</button></div>
    <p class="pile-hint">Drag or flick the top photo.</p></div>`;
  const pile = $('.pile', wrap), cap = $('.cap', wrap), count = $('.count', wrap);
  // Random but stable scatter for each photo
  const rand = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const scatter = (card, i, spin = 0) => {
    card.style.setProperty('--r', `${(rand(i, 1 + spin) - 0.5) * 14}deg`);
    card.style.setProperty('--x', `${(rand(i, 2 + spin) - 0.5) * 36}px`);
    card.style.setProperty('--y', `${(rand(i, 3 + spin) - 0.5) * 24}px`);
  };
  const cards = data.map(([src, alt, label, w, h], i) => {
    const f = document.createElement('figure');
    f.className = `pol ${w > h ? 'wide' : 'tall'}`;
    f.style.setProperty('--ar', `${w} / ${h}`);
    f.innerHTML = `<img alt="${alt}" width="${w}" height="${h}" decoding="async" draggable="false"><figcaption>${label}</figcaption>`;
    f.dataset.src = src;
    scatter(f, i);
    return f;
  });
  // order: indexes from the bottom of the pile to the top
  let order = data.map((_, i) => i).reverse(), near = false, spins = 0;
  const load = i => { const img = cards[i].querySelector('img'); if (!img.src) img.src = cards[i].dataset.src; };
  function sync() {
    order.forEach(i => pile.appendChild(cards[i]));
    const top = order.at(-1);
    cap.textContent = data[top][2];
    count.textContent = `${String(top + 1).padStart(2, '0')} / ${String(data.length).padStart(2, '0')}`;
    if (near) order.slice(-3).forEach(load);
  }
  sync();
  new IntersectionObserver(([en], io) => { if (en.isIntersecting) { near = true; sync(); io.disconnect(); } }, { rootMargin: '800px 0px' }).observe(pile);
  // Each polaroid as big as fits in the pile (with room for its tilt): the photo, a 3.2% border, and the caption
  const fit = () => {
    const W = pile.clientWidth, H = pile.clientHeight, capH = Math.min(Math.max(innerWidth * 0.02, 20), 28) * 1.6;
    cards.forEach((c, i) => {
      const ar = data[i][3] / data[i][4];
      c.style.width = `${Math.min(W * 0.84, 600, (H * 0.86 - capH) / (0.936 / ar + 0.032))}px`;
    });
  };
  fit();
  new ResizeObserver(fit).observe(pile);

  const off = (card, dir, vy = 0) => `translate(-50%,-50%) translate(${dir * (innerWidth * 0.7)}px, ${vy}px) rotate(${dir * 28}deg)`;
  let busy = false;
  // The top photo flies off, then slides back in at the bottom
  function next(dir = 1, vy = 0) {
    if (busy) return;
    busy = true;
    const card = cards[order.at(-1)];
    card.style.transform = off(card, dir, vy);
    setTimeout(() => {
      card.style.transition = 'none';
      order.unshift(order.pop());
      scatter(card, order[0], ++spins);
      for (const p of ['--dx', '--dy', '--dr']) card.style.removeProperty(p);
      sync();
      card.offsetWidth;
      card.style.transition = '';
      card.style.transform = '';
      busy = false;
    }, reduce ? 0 : 380);
  }
  // The bottom photo comes back from the side onto the top
  function prev() {
    if (busy) return;
    busy = true;
    const card = cards[order[0]];
    card.style.transition = 'none';
    card.style.transform = off(card, -1);
    order.push(order.shift());
    sync();
    card.offsetWidth;
    card.style.transition = '';
    card.style.transform = '';
    setTimeout(() => (busy = false), reduce ? 0 : 400);
  }
  $('.next', wrap).addEventListener('click', () => next(1));
  $('.prev', wrap).addEventListener('click', prev);
  pile.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });

  pile.addEventListener('pointerdown', e => {
    const card = e.target.closest('.pol');
    if (busy || !card || card !== pile.lastElementChild || e.button > 0) return;
    const sx = e.clientX, sy = e.clientY;
    let dx = 0, dy = 0, vx = 0, vy = 0, lx = sx, ly = sy, lt = performance.now(), dragging = false;
    card.setPointerCapture(e.pointerId);
    const move = ev => {
      dx = ev.clientX - sx; dy = ev.clientY - sy;
      // On touch screens, mostly-vertical moves are left to scrolling
      if (!dragging && Math.hypot(dx, dy) > 6) dragging = true;
      if (!dragging) return;
      const now = performance.now(), dt = Math.max(1, now - lt);
      vx = (ev.clientX - lx) / dt; vy = (ev.clientY - ly) / dt; lx = ev.clientX; ly = ev.clientY; lt = now;
      card.classList.add('held');
      card.style.setProperty('--dx', `${dx}px`); card.style.setProperty('--dy', `${dy}px`); card.style.setProperty('--dr', `${dx * 0.06}deg`);
    };
    const up = () => {
      card.removeEventListener('pointermove', move);
      card.classList.remove('held');
      if (Math.abs(dx) > pile.clientWidth * 0.22 || Math.abs(vx) > 0.6) {
        track(`photos/${wrap.closest('section').id}`, 'Flicked through the photos');
        next(Math.sign(dx || vx), dy + vy * 200);
      } else for (const p of ['--dx', '--dy', '--dr']) card.style.removeProperty(p);
    };
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerup', up, { once: true });
    card.addEventListener('pointercancel', up, { once: true });
  });
});

// ---------- Contact: the room from the intro, dark until the bulb flickers on ----------
// The render's light switch and baseball work: a button sits over each, placed to match the image
// (it's scaled to cover the section, pinned to the top). Positions come from the 3D scene that made it.
const room = $('.contact .room-dark');
if (room) {
  const section = room.parentElement, sw = $('.room-switch', section), ball = $('.room-ball', section), ballImg = $('img', ball);
  const SPOTS = {
    desk: { img: [2400, 1270], sw: [808, 833, 130, 200], ball: [1987, 718, 58, 53], floor: 1254 },
    phone: { img: [780, 1280], sw: [335, 745, 110, 150], ball: [106, 680, 30, 30], floor: 1260 },
  };
  let spot, scale, dx, ballOnFloor = false;
  const place = () => {
    spot = SPOTS[innerWidth <= 700 ? 'phone' : 'desk'];
    const W = section.clientWidth, H = section.clientHeight;
    // Desktop: the image covers the section, pinned to the top. Phones: full width, pinned to the bottom.
    let dy = 0;
    if (spot === SPOTS.phone) { scale = W / spot.img[0]; dx = 0; dy = H - spot.img[1] * scale; }
    else { scale = Math.max(W / spot.img[0], H / spot.img[1]); dx = (W - spot.img[0] * scale) / 2; }
    const box = (el, [x, y, w, h]) => Object.assign(el.style, { left: `${dx + x * scale}px`, top: `${dy + y * scale}px`, width: `${w * scale}px`, height: `${h * scale}px` });
    box(sw, spot.sw);
    box(ball, spot.ball);
    ballImg.src = `room/ball-${spot === SPOTS.desk ? 'desk' : 'phone'}.webp`;
    if (ballOnFloor) ball.style.transform = landed();
  };
  new ResizeObserver(place).observe(section);
  place();

  // A small synthesized sound (no audio files), only after a click
  let audio;
  const sound = (freq, length, gain) => {
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime, src = audio.createBufferSource(), b = audio.createBuffer(1, audio.sampleRate * length, audio.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const f = audio.createBiquadFilter(), g = audio.createGain();
      f.type = 'bandpass'; f.frequency.value = freq;
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      src.buffer = b; src.connect(f).connect(g).connect(audio.destination); src.start(t);
    } catch (e) {}
  };

  let lit = false, flicker;
  const lightsOn = () => {
    lit = true;
    sw.setAttribute('aria-pressed', 'true');
    section.style.setProperty('--wash', 1);
    if (reduce) { room.style.opacity = 0; return; }
    // The same uneven flicker as the intro's bulb, then steady
    flicker = room.animate([
      { opacity: 0.94 }, { opacity: 0.94, offset: 0.12 }, { opacity: 0.3, offset: 0.16 }, { opacity: 0.9, offset: 0.24 },
      { opacity: 0.85, offset: 0.4 }, { opacity: 0.15, offset: 0.45 }, { opacity: 0.7, offset: 0.52 }, { opacity: 0.05, offset: 0.62 }, { opacity: 0 },
    ], { duration: 1700, easing: 'linear', fill: 'forwards' });
  };
  const lightsOff = () => {
    lit = false;
    sw.setAttribute('aria-pressed', 'false');
    flicker?.cancel();
    room.style.opacity = 0.94;
    section.style.setProperty('--wash', 0);
  };
  // On phones the lights come on as soon as the room starts to show, so it never sits there looking broken
  new IntersectionObserver(([en], io) => { if (en.isIntersecting) { io.disconnect(); setTimeout(() => { lightsOn(); track('contact/lights', 'Reached the contact room'); }, 250); } }, { threshold: innerWidth <= 700 ? 0.2 : 0.45 }).observe(section);
  sw.addEventListener('click', () => {
    sound(3200, 0.03, 0.5); setTimeout(() => sound(700, 0.07, 0.35), 35);
    lit ? lightsOff() : lightsOn();
    track('egg/switch', 'Flipped the light switch');
  });

  // The baseball rolls off the shelf, drops to the floor and bounces to a stop; click it there and it
  // hops back up. Distances are in image pixels, scaled like the image.
  const landed = () => `translate(${-120 * scale}px, ${(spot.floor - spot.ball[1] - spot.ball[3]) * scale}px) rotate(-540deg)`;
  ball.addEventListener('click', () => {
    track('egg/baseball', 'Knocked the baseball off the shelf');
    const fall = (spot.floor - spot.ball[1] - spot.ball[3]) * scale, s = scale;
    if (reduce) { ballOnFloor = !ballOnFloor; ball.style.transform = ballOnFloor ? landed() : ''; return; }
    if (!ballOnFloor) {
      ball.animate([
        { transform: 'none', easing: 'ease-in' },
        { transform: `translate(${-34 * s}px, 0) rotate(-120deg)`, offset: 0.2, easing: 'cubic-bezier(.5,0,1,.6)' },
        { transform: `translate(${-70 * s}px, ${fall}px) rotate(-300deg)`, offset: 0.55, easing: 'cubic-bezier(0,.4,.5,1)' },
        { transform: `translate(${-92 * s}px, ${fall - 60 * s}px) rotate(-400deg)`, offset: 0.7, easing: 'cubic-bezier(.5,0,1,.6)' },
        { transform: `translate(${-108 * s}px, ${fall}px) rotate(-480deg)`, offset: 0.83, easing: 'ease-out' },
        { transform: landed() },
      ], { duration: 1500, fill: 'forwards' });
      setTimeout(() => sound(160, 0.12, 0.9), 820);
      setTimeout(() => sound(160, 0.08, 0.4), 1240);
    } else {
      ball.animate([
        { transform: landed(), easing: 'cubic-bezier(0,.5,.4,1)' },
        { transform: `translate(${-40 * s}px, ${-50 * s}px) rotate(-200deg)`, offset: 0.6, easing: 'cubic-bezier(.6,0,1,1)' },
        { transform: 'none' },
      ], { duration: 900, fill: 'forwards' });
      setTimeout(() => sound(900, 0.05, 0.3), 880);
    }
    ballOnFloor = !ballOnFloor;
  });
}

// ---------- A hidden terminal: press ` anywhere (or the >_ link in the footer) ----------
const terminal = () => import('./terminal.js').then(m => m.openTerminal());
addEventListener('keydown', e => {
  if (e.key !== '`' || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [contenteditable]')) return;
  e.preventDefault();
  terminal();
});
$('.foot-term')?.addEventListener('click', terminal);
