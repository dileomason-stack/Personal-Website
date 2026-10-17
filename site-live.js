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

// ---------- Hold This Thought: type a thought on the phone and the app's parser reads it ----------
const showcase = $('.showcase');
if (showcase) {
  const input = $('#htt-input', showcase), form = $('.htt-try', showcase), card = $('.htt-card', showcase);
  const state = $('.htt-state', card), ms = $('.htt-ms', card), title = $('.htt-title', card), rows = $('.htt-rows', card);
  const chips = $$('.try-chips button', showcase);
  const icons = {
    when: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8"/>',
    timer: '<path d="M12 9v4l2 1"/><circle cx="12" cy="13" r="7"/><path d="M10 3h4"/>',
    where: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    none: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  };
  const row = (kind, text, cls = '') => `<li class="${cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[kind]}</svg><span>${text}</span></li>`;
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const timeOf = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  function whenText({ date, timer }) {
    const now = new Date(), mins = Math.round((date - now) / 60000);
    if (timer && mins < 24 * 60) {
      const span = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr${mins % 60 ? ` ${mins % 60} min` : ''}`;
      return `In ${span} · ${timeOf(date)}`;
    }
    const days = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days < 7 ? date.toLocaleDateString('en-US', { weekday: 'long' })
      : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    return `${day} · ${timeOf(date)}`;
  }

  function read(saved) {
    const text = input.value.trim();
    chips.forEach(c => c.classList.toggle('on', c.textContent.replace(/’/g, "'") === input.value.replace(/’/g, "'")));
    if (!text) { card.hidden = true; return; }
    const t0 = performance.now(), r = parseThought(text), took = performance.now() - t0;
    const list = [];
    if (r.when) list.push(row(r.when.timer ? 'timer' : 'when', whenText(r.when)));
    if (r.repeat) list.push(row('repeat', r.repeat));
    if (r.place) list.push(row('where', r.place === 'Home' ? 'When you get home' : `When you get to ${esc(r.place)}`));
    if (r.nearby) list.push(row('where', `Offers a reminder at ${esc(r.nearby)}`, 'nearby'));
    if (!list.length) list.push(row('none', 'No time or place yet. Saved for later', 'none'));
    if (card.hidden) { card.hidden = false; card.style.animation = 'none'; card.offsetWidth; card.style.animation = ''; }
    title.textContent = r.title;
    // Only re-render the rows when they change, so they animate in once rather than on every key
    const html = list.join('');
    if (rows.dataset.html !== html) { rows.innerHTML = html; rows.dataset.html = html; }
    ms.textContent = `${took < 1 ? took.toFixed(2) : took.toFixed(1)} ms`;
    card.classList.toggle('saved', !!saved);
    state.textContent = saved ? 'Saved' : 'Reading as you type';
  }

  // Typing on the phone goes to the home screen first (the bar is only on that screenshot)
  const goHome = () => { const tab = $('.sc-step', showcase); if (!tab.classList.contains('is-active') || !showcase.classList.contains('manual')) tab.click(); };
  input.addEventListener('focus', goHome);
  input.addEventListener('input', () => read(false));
  form.addEventListener('submit', e => { e.preventDefault(); read(true); });

  let typing = 0;
  chips.forEach(chip => chip.addEventListener('click', () => {
    goHome();
    const text = chip.textContent, run = ++typing;
    // Bring the phone into view on small screens, where it sits above the chips
    const phone = $('.phone-frame', showcase).getBoundingClientRect();
    if (phone.top < 60 || phone.bottom > innerHeight) {
      const y = scrollY + phone.top - 90;
      window.siteLenis ? window.siteLenis.scrollTo(y, { duration: 0.8 }) : scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
    if (reduce) { input.value = text; read(true); return; }
    // Typed out a letter at a time, so you see it read the thought as it grows
    input.value = '';
    let i = 0;
    const tick = () => {
      if (run !== typing) return;
      input.value = text.slice(0, ++i);
      input.scrollLeft = input.scrollWidth;
      read(false);
      if (i < text.length) setTimeout(tick, 28 + Math.random() * 40);
      else setTimeout(() => run === typing && read(true), 250);
    };
    setTimeout(tick, 350);
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

// ---------- GitHub activity: commits per day across every repo (data/activity.json, baked at deploy) ----------
const activity = $('#activity');
if (activity) whenNear(activity, async () => {
  let data;
  try { data = await (await fetch('data/activity.json')).json(); } catch (e) { activity.hidden = true; return; }
  const grid = $('.act-grid', activity), months = $('.act-months', activity), tip = $('.act-tip', activity), legend = $('.act-legend', activity);
  const key = d => d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const label = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const dayKeys = Object.keys(data.days).sort();
  const total = Object.values(data.days).reduce((sum, d) => sum + Object.values(d).reduce((a, b) => a + b, 0), 0);
  // From the Sunday on or before the first commit, through today
  const first = new Date(dayKeys[0] + 'T00:00:00Z'), today = new Date(key(new Date()) + 'T00:00:00Z');
  const start = new Date(+first - first.getUTCDay() * 864e5);
  const cells = [];
  let lastMonth = -1;
  for (let d = new Date(start), i = 0; d <= today || d.getUTCDay() !== 0; d = new Date(+d + 864e5), i++) {
    const k = d.toISOString().slice(0, 10), repos = data.days[k] || {}, n = Object.values(repos).reduce((a, b) => a + b, 0);
    const cell = document.createElement('i');
    if (d > today) cell.className = 'future';
    else if (d >= first) {
      cell.dataset.n = n;
      cell.dataset.day = label(d);
      cell.dataset.repos = Object.entries(repos).sort((a, b) => b[1] - a[1]).map(([r, c]) => `${r} ${c}`).join(', ');
      cell.className = n === 0 ? '' : n <= 2 ? 'l1' : n <= 5 ? 'l2' : n <= 10 ? 'l3' : 'l4';
    } else cell.style.visibility = 'hidden';
    cells.push(cell);
    // Month names over the first column of each month
    // (going by the week's first day with commits on the grid, so the hidden days before Sep 4 don't count)
    const shown = new Date(Math.max(+d, +first));
    if (d.getUTCDay() === 0 && shown - d < 7 * 864e5 && shown.getUTCMonth() !== lastMonth) {
      lastMonth = shown.getUTCMonth();
      const m = document.createElement('span');
      m.textContent = shown.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      m.style.gridColumn = `${Math.floor(i / 7) + 1}`;
      months.appendChild(m);
    }
  }
  grid.append(...cells);
  const chart = $('.act-chart', activity), weeks = Math.ceil(cells.length / 7);
  const fit = () => {
    const gap = innerWidth < 640 ? 4 : 6, cell = Math.max(10, Math.min(44, Math.floor((chart.clientWidth - gap * (weeks - 1)) / weeks)));
    chart.style.setProperty('--cell', `${cell}px`);
    chart.style.setProperty('--gap', `${gap}px`);
  };
  fit();
  new ResizeObserver(fit).observe(chart);
  grid.setAttribute('aria-label', `${total} commits since ${label(first)}, most on ${(() => { const [k, v] = Object.entries(data.days).map(([k, v]) => [k, Object.values(v).reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1])[0]; return `${label(new Date(k + 'T00:00:00Z'))} (${v})`; })()}`);
  $('.act-since', activity).textContent = label(first);
  $('.act-repos', activity).textContent = data.repos.filter(r => r.count).length;
  legend.innerHTML = data.repos.filter(r => r.count).map((r, i) => `<li data-repo="${r.name}" tabindex="0"><i style="--c:var(--heat-${Math.max(1, 3 - Math.min(i, 2))})"></i>${r.name}<span>${r.count}</span></li>`).join('');
  $$('li', legend).forEach((li, i) => { if (i === 0) li.querySelector('i').style.setProperty('--c', 'var(--accent)'); });

  // Hover a day for its count; hover a project to see only its days
  const show = cell => {
    if (!cell?.dataset.day) { tip.textContent = 'Hover a day'; return; }
    const n = +cell.dataset.n;
    tip.innerHTML = `<b>${cell.dataset.day}</b> · ${n} commit${n === 1 ? '' : 's'}${n ? ` · ${cell.dataset.repos}` : ''}`;
  };
  grid.addEventListener('pointerover', e => show(e.target.closest('i')));
  grid.addEventListener('pointerleave', () => show(null));
  const focusRepo = name => {
    cells.forEach(c => c.classList.toggle('fade', !!name && !!c.dataset.day && !(c.dataset.repos || '').split(', ').some(r => r.startsWith(name + ' '))));
    $$('li', legend).forEach(li => li.classList.toggle('dim', !!name && li.dataset.repo !== name));
  };
  $$('li', legend).forEach(li => {
    li.addEventListener('pointerenter', () => focusRepo(li.dataset.repo));
    li.addEventListener('focus', () => focusRepo(li.dataset.repo));
    li.addEventListener('pointerleave', () => focusRepo(null));
    li.addEventListener('blur', () => focusRepo(null));
  });

  // Fills in a week at a time while the total counts up
  const counter = $('.act-total b', activity);
  if (reduce) { counter.textContent = total; return; }
  cells.forEach(c => (c.style.opacity = 0));
  whenSeen(activity, () => {
    cells.forEach((c, i) => {
      c.style.opacity = '';
      c.animate({ opacity: [0, 1], transform: ['scale(.3)', 'none'] }, { duration: 500, delay: Math.floor(i / 7) * 90 + (i % 7) * 25, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    });
    const t0 = performance.now(), length = Math.floor(cells.length / 7) * 90 + 600;
    const step = now => {
      const p = Math.min(1, (now - t0) / length);
      counter.textContent = Math.round(total * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
});

// ---------- Versions: drag through the site's git history ----------
// Screenshots made from these commits with scripts/shoot-versions.mjs
const VERSIONS = [
  ['cd7673d', 'Sep 4', 'Day one: a class starter page'],
  ['04782ad', 'Sep 4', 'First draft: a car dashboard'],
  ['3f762f2', 'Sep 4', 'Second draft: analog gauges'],
  ['33ee777', 'Sep 5', 'Third draft: a spec sheet'],
  ['8e3619c', 'Sep 6', 'A sports-broadcast detour'],
  ['d7fce65', 'Sep 6', 'Iron Man: drag the arc reactor to the suit'],
  ['0934997', 'Sep 8', 'Going light: “I build useful things.”'],
  ['bae5aa9', 'Sep 29', 'Redesign: polish and a projects section'],
  ['6d76a22', 'Oct 16', 'A 3D bedroom intro'],
  ['d65fa83', 'Oct 17', 'Learning by building (today)'],
];
const versions = $('#versions');
if (versions) {
  const shots = $('.ver-shots', versions), range = $('.ver-range', versions), ticks = $('.ver-ticks', versions);
  const date = $('.ver-date', versions), sha = $('.ver-sha', versions), msg = $('.ver-msg', versions);
  const last = VERSIONS.length - 1;
  range.max = last;
  range.value = last;
  const imgs = VERSIONS.map(([id, , text]) => Object.assign(document.createElement('img'), { alt: `The site at commit ${id}: ${text}`, width: 1200, height: 750, decoding: 'async' }));
  shots.append(...imgs);
  ticks.innerHTML = VERSIONS.map((v, i) => `<span style="left:${(i / last) * 100}%"></span>`).join('')
    + `<b style="left:0;translate:0 0">${VERSIONS[0][1]}</b><b style="left:100%;translate:-100% 0">Today</b>`;
  const marks = $$('span', ticks);
  let shown = -1;
  // Between two versions, the two screenshots cross-fade, so dragging feels like scrubbing video
  const render = v => {
    const i = Math.floor(v), f = v - i;
    imgs.forEach((img, k) => (img.style.opacity = k === i ? 1 : k === i + 1 ? f : 0));
    const near = Math.round(v);
    if (near === shown) return;
    shown = near;
    const [id, day, text] = VERSIONS[near];
    date.textContent = `${day}, 2026`;
    sha.textContent = id;
    msg.textContent = text;
    marks.forEach((m, k) => m.classList.toggle('on', k === near));
    range.setAttribute('aria-valuetext', `${day}: ${text}`);
  };
  render(last);
  let auto = null;
  range.addEventListener('input', () => { cancelAnimationFrame(auto); render(+range.value); });
  // Let go and it settles on the nearest real version
  const settle = () => {
    const from = +range.value, to = Math.round(from), t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / 220), v = from + (to - from) * (1 - (1 - p) ** 3);
      range.value = v; render(v);
      if (p < 1) auto = requestAnimationFrame(step);
    };
    auto = requestAnimationFrame(step);
  };
  range.addEventListener('change', settle);
  range.addEventListener('keydown', e => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    cancelAnimationFrame(auto);
    range.value = Math.max(0, Math.min(last, Math.round(+range.value) + d));
    render(+range.value);
  });
  whenNear(versions, () => imgs.forEach((img, i) => (img.src = `versions/${VERSIONS[i][0]}.webp`)), '1000px');
  // The first time it's seen, it plays the whole history once, from day one to today
  if (!reduce) whenSeen(versions, () => {
    let cancelled = false;
    const stop = () => { cancelled = true; };
    range.addEventListener('pointerdown', stop, { once: true });
    range.addEventListener('keydown', stop, { once: true });
    Promise.all(imgs.map(img => img.decode().catch(() => {}))).then(() => {
      if (cancelled) return;
      const t0 = performance.now(), length = 5200;
      const step = now => {
        if (cancelled) return;
        const p = Math.min(1, (now - t0) / length);
        // Holds briefly on each version rather than sliding evenly
        const raw = p * last, i = Math.floor(raw), f = raw - i, eased = i + (f < 0.55 ? 0 : (f - 0.55) / 0.45) ** 2 * (3 - 2 * ((f - 0.55) / 0.45));
        const v = Math.min(last, eased);
        range.value = v; render(v);
        if (p < 1) auto = requestAnimationFrame(step);
      };
      range.value = 0; render(0);
      auto = requestAnimationFrame(step);
    });
  });
}
