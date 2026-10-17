// The parts of the site that are live rather than animated: the local-time status in the nav,
// the Hold This Thought demo, the GitHub activity grid, and the version history scrubber.
// Loaded for everyone (reduced motion included); nothing here depends on GSAP.
import { parseThought } from './thought-parser.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
