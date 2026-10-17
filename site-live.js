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
// The field sits beside the phone; the phone's "Hold a thought…" bar mirrors what you type and a card
// shows what the app understood. On phones the card also shows right under the field.
const showcase = $('.showcase');
if (showcase) {
  const form = $('.sc-try', showcase), input = $('#htt-input', form), clear = $('.try-clear', form), inline = $('.try-result', form);
  const bar = $('.htt-bar', showcase), typed = $('.htt-typed', bar), card = $('.htt-card', showcase);
  const chips = $$('.try-chips button', form);
  const icons = {
    when: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8"/>',
    timer: '<path d="M12 9v4l2 1"/><circle cx="12" cy="13" r="7"/><path d="M10 3h4"/>',
    where: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    none: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  };
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const row = (icon, key, text, cls = '') => `<li class="${cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[icon]}</svg><span class="k">${key}</span><span>${text}</span></li>`;
  const timeOf = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  function whenText({ date, timer }) {
    const now = new Date(), mins = Math.round((date - now) / 60000);
    if (timer && mins < 24 * 60) return `In ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr${mins % 60 ? ` ${mins % 60} min` : ''}`} (${timeOf(date)})`;
    const days = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days < 7 ? date.toLocaleDateString('en-US', { weekday: 'long' })
      : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    return `${day}, ${timeOf(date)}`;
  }

  let lastRows = '';
  function read(saved) {
    const text = input.value.trim();
    clear.hidden = !input.value;
    typed.textContent = input.value;
    bar.classList.toggle('on', !!input.value);
    bar.classList.toggle('over', typed.offsetWidth > bar.clientWidth - 10);
    chips.forEach(c => c.classList.toggle('on', c.textContent.replace(/’/g, "'") === input.value.replace(/’/g, "'")));
    if (!text) { card.hidden = true; inline.innerHTML = ''; lastRows = ''; return; }
    const t0 = performance.now(), r = parseThought(text), took = performance.now() - t0;
    const list = [];
    if (r.when) list.push(row(r.when.timer ? 'timer' : 'when', 'When', whenText(r.when)));
    if (r.repeat) list.push(row('repeat', 'Repeats', r.repeat));
    if (r.place) list.push(row('where', 'Where', r.place === 'Home' ? 'When you get home' : `When you get to ${esc(r.place)}`));
    if (r.nearby) list.push(row('where', 'Offers', `A reminder at ${esc(r.nearby)}`, 'nearby'));
    if (!list.length) list.push(row('none', 'When', 'Not said yet, so it’s saved for later', 'none'));
    const rows = list.join('');
    const html = `<div class="htt-head"><span class="htt-state">${saved ? 'Saved' : 'Reading as you type'}</span><span>${took < 1 ? took.toFixed(2) : took.toFixed(1)} ms</span></div>
      <div class="htt-title">${esc(r.title)}</div><ul class="htt-rows">${rows}</ul>`;
    // The rows only re-render (and animate in) when what was understood changes, not on every key
    const fresh = rows !== lastRows || card.hidden;
    lastRows = rows;
    for (const el of [card, inline]) {
      if (fresh || !el.firstChild) el.innerHTML = html;
      else {
        $('.htt-state', el).textContent = saved ? 'Saved' : 'Reading as you type';
        $('.htt-head span:last-child', el).textContent = `${took < 1 ? took.toFixed(2) : took.toFixed(1)} ms`;
        $('.htt-title', el).textContent = r.title;
      }
      el.classList.toggle('saved', !!saved);
    }
    if (card.hidden) { card.hidden = false; card.style.animation = 'none'; card.offsetWidth; card.style.animation = ''; }
  }

  // The phone has to be on its home screen (the bar is part of that screenshot); stop the tabs advancing
  const goHome = () => { const tab = $('.sc-step', showcase); if (!tab.classList.contains('is-active') || !showcase.classList.contains('manual')) tab.click(); };
  let typing = 0;
  input.addEventListener('focus', goHome);
  input.addEventListener('input', () => { typing++; read(false); });
  form.addEventListener('submit', e => { e.preventDefault(); read(true); });
  clear.addEventListener('click', () => { typing++; input.value = ''; read(false); input.focus(); });
  bar.addEventListener('click', () => input.focus());
  chips.forEach(chip => chip.addEventListener('click', () => {
    goHome();
    const text = chip.textContent, run = ++typing;
    if (reduce) { input.value = text; read(true); return; }
    // Typed out a letter at a time, so you can watch it read the thought as it grows
    input.value = '';
    let i = 0;
    const tick = () => {
      if (run !== typing) return;
      input.value = text.slice(0, ++i);
      read(false);
      if (i < text.length) setTimeout(tick, 22 + Math.random() * 30);
      else setTimeout(() => run === typing && read(true), 300);
    };
    tick();
  }));
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

// ---------- Build logs: each project's commits as ticks, from data/builds.json ----------
// Work happens in sessions (an evening, a weekend), so gaps of more than four hours are squeezed to a
// fixed sliver; within a session, ticks sit at their real times. Scrolling it into view plays it back.
const pacific = (iso, opts) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
export function buildLog(el, commits) {
  const times = commits.map(c => +new Date(c[0])), GAP = 4 * 3600e3;
  const sessions = [];
  times.forEach((t, i) => { if (!i || t - times[i - 1] > GAP) sessions.push([i]); else sessions.at(-1).push(i); });
  // Width: each session by its length (with a floor, so a burst isn't a single line), plus a fixed gap between
  const spans = sessions.map(s => Math.max(times[s.at(-1)] - times[s[0]], 40 * 60e3));
  const gapW = 0.035, inner = 1 - gapW * (sessions.length - 1), totalSpan = spans.reduce((a, b) => a + b, 0);
  const pos = [], starts = [];
  let x = 0;
  sessions.forEach((s, k) => {
    starts.push(x);
    const w = (spans[k] / totalSpan) * inner, first = times[s[0]];
    s.forEach(i => pos.push(x + (s.length === 1 ? w / 2 : ((times[i] - first) / spans[k]) * w)));
    x += w + gapW;
  });
  const longest = sessions.reduce((a, b) => (b.length > a.length ? b : a));
  const hours = (times[longest.at(-1)] - times[longest[0]]) / 3600e3;
  const days = new Set(commits.map(c => pacific(c[0], { month: 'short', day: 'numeric' }))).size;
  el.innerHTML = `<div class="build-head mo"><span>Build log</span><span><b>${commits.length}</b> commits · ${days} days</span></div>
    <div class="build-track">${pos.map(p => `<i style="left:${(p * 100).toFixed(2)}%"></i>`).join('')}${sessions.slice(1).map((s, k) => `<s style="left:${((starts[k + 1] - gapW) * 100).toFixed(2)}%;width:${(gapW * 100).toFixed(2)}%"></s>`).join('')}</div>
    <div class="build-days"></div>
    <p class="build-msg"></p>`;
  const ticks = $$('.build-track i', el), msg = $('.build-msg', el), track = $('.build-track', el), dayRow = $('.build-days', el);
  // Day labels under the first session of each day, skipping any that would collide
  let lastDay = '', lastX = -1;
  sessions.forEach((s, k) => {
    const day = pacific(commits[s[0]][0], { month: 'short', day: 'numeric' });
    if (day === lastDay || starts[k] - lastX < 0.14) return;
    lastDay = day; lastX = starts[k];
    dayRow.insertAdjacentHTML('beforeend', `<span style="left:${(starts[k] * 100).toFixed(2)}%">${day}</span>`);
  });
  const summary = `Busiest session: ${longest.length} commits in ${hours < 1 ? `${Math.round(hours * 60)} minutes` : `${hours.toFixed(1).replace('.0', '')} hours`}, ${pacific(commits[longest[0]][0], { weekday: 'short', month: 'short', day: 'numeric' })}, ${pacific(commits[longest[0]][0], { hour: 'numeric', minute: '2-digit' })} to ${pacific(commits[longest.at(-1)][0], { hour: 'numeric', minute: '2-digit' })}.`;
  const show = i => {
    ticks.forEach((t, k) => t.classList.toggle('on', k === i));
    if (i < 0) { msg.textContent = summary; return; }
    msg.innerHTML = `<time>${pacific(commits[i][0], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · commit ${i + 1} of ${commits.length}</time>`;
    msg.append(commits[i][1]);
  };
  show(-1);
  let playing = false;
  const nearest = e => {
    const r = track.getBoundingClientRect(), p = (e.clientX - r.left) / r.width;
    let best = 0;
    pos.forEach((q, k) => { if (Math.abs(q - p) < Math.abs(pos[best] - p)) best = k; });
    return best;
  };
  track.addEventListener('pointermove', e => { if (!playing) show(nearest(e)); });
  track.addEventListener('pointerdown', e => { if (!playing) show(nearest(e)); });
  track.addEventListener('pointerleave', () => { if (!playing) show(-1); });
  if (reduce) { ticks.forEach(t => t.classList.add('done')); return; }
  // Playback: a playhead runs through the history, each commit's message flashing as it lands
  whenSeen(el, () => {
    playing = true;
    const t0 = performance.now(), length = 2600;
    let shown = -1;
    const step = now => {
      const p = Math.min(1, (now - t0) / length), upto = Math.floor(p * (ticks.length - 1));
      for (let k = shown + 1; k <= upto; k++) ticks[k].classList.add('done');
      if (upto !== shown) { shown = upto; show(upto); }
      if (p < 1) requestAnimationFrame(step);
      else setTimeout(() => { playing = false; show(-1); }, 900);
    };
    requestAnimationFrame(step);
  });
}
const buildEls = $$('.build[data-build]');
if (buildEls.length) whenNear(buildEls[0], async () => {
  try {
    const data = await (await fetch('data/builds.json')).json();
    buildEls.forEach(el => data[el.dataset.build] && buildLog(el, data[el.dataset.build]));
  } catch (e) { buildEls.forEach(el => (el.hidden = true)); }
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
