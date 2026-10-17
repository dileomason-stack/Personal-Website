// Case studies: clicking "Case study + demo" on a project card opens a full page over the site. With
// View Transitions, the card's video and title morph into the page's hero image and headline (and back
// again when it closes). Each page has a hands-on demo of the project. Loaded on first use.
import { buildLog } from './site-live.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const page = $('#case'), body = $('.case-body', page);
const names = { homeroom: 'Homeroom', whenworks: 'WhenWorks' };
let current = null, opener = null, builds = null;

const transition = (update, cls) => {
  if (!document.startViewTransition || reduce) { update(); return Promise.resolve(); }
  root.classList.add(cls);
  const vt = document.startViewTransition(update);
  return vt.finished.finally(() => root.classList.remove(cls));
};
const name = (el, n) => el && (el.style.viewTransitionName = n || '');

export async function openCase(key, trigger, { push = true } = {}) {
  if (current === key) return;
  const card = document.getElementById(key), tpl = document.getElementById(`case-${key}`);
  if (!card || !tpl) return;
  opener = trigger || null;
  const media = $('.shot video, .shot img', card), title = $('h4', card);
  media?.pause?.();
  name(media, 'case-shot'); name(title, 'case-title');
  if (push) history.pushState({ case: key }, '', `?case=${key}`);
  await transition(() => {
    name(media); name(title);
    body.replaceChildren(tpl.content.cloneNode(true));
    $('.case-crumb', page).textContent = `Projects / ${names[key]}`;
    page.hidden = false;
    page.scrollTop = 0;
    name($('.case-shot', body), 'case-shot'); name($('.case-title', body), 'case-title');
    root.classList.add('case-is-open');
    window.siteLenis?.stop();
  }, 'vt-case-in');
  name($('.case-shot', body)); name($('.case-title', body));
  current = key;
  page.focus({ preventScroll: true });
  // Once it has landed, the hero image becomes the project's demo video (the poster is the same frame)
  const shot = $('.case-shot', body), src = $('.shot video', card)?.getAttribute('src');
  if (shot && src) {
    const video = Object.assign(document.createElement('video'), { className: 'case-shot', src, poster: shot.getAttribute('src'), controls: true, muted: true, playsInline: true, preload: 'none' });
    video.setAttribute('aria-label', shot.alt);
    shot.replaceWith(video);
  }
  setup(key);
}

export async function closeCase({ pop = false } = {}) {
  if (!current) return;
  const key = current, card = document.getElementById(key);
  const media = $('.shot video, .shot img', card), title = $('h4', card);
  name($('.case-shot', body), 'case-shot'); name($('.case-title', body), 'case-title');
  current = null;
  if (!pop && history.state?.case) history.back();
  // The card has to be on screen for the morph to land on it
  card.scrollIntoView({ block: 'center' });
  window.siteLenis?.scrollTo(card, { immediate: true, offset: -innerHeight / 2 + card.offsetHeight / 2, force: true });
  await transition(() => {
    name($('.case-shot', body)); name($('.case-title', body));
    page.hidden = true;
    body.replaceChildren();
    root.classList.remove('case-is-open');
    window.siteLenis?.start();
    name(media, 'case-shot'); name(title, 'case-title');
  }, 'vt-case-out');
  name(media); name(title);
  (opener || $('.case-open', card))?.focus({ preventScroll: true });
}

$('.case-back', page).addEventListener('click', () => closeCase());
$('.case-x', page).addEventListener('click', () => closeCase());
page.addEventListener('keydown', e => { if (e.key === 'Escape') closeCase(); });
addEventListener('popstate', () => {
  const key = new URLSearchParams(location.search).get('case');
  if (key) openCase(key, null, { push: false }); else closeCase({ pop: true });
});

async function setup(key) {
  try { builds ??= await (await fetch('data/builds.json')).json(); } catch (e) { builds = {}; }
  const log = $('.build[data-build]', body);
  if (log && builds[key]) buildLog(log, builds[key]);
  const demo = $('[data-demo]', body);
  if (demo) (key === 'homeroom' ? homeroomDemo : whenworksDemo)(demo, $('.case-reset', body));
}

// ---------- Homeroom: a tiny dashboard. Drag cards by their top bar, resize from the corner; the rest
// move out of the way and float back up (the same vertical packing react-grid-layout does in the app). ----------
function homeroomDemo(el, reset) {
  const CARDS = {
    todo: ['To-do', '#d4471f', `<ul>${['Finish STAT 217 homework', 'Email advisor', 'Groceries', 'Call home'].map((t, i) => `<li><label><input type="checkbox"${i === 2 ? ' checked' : ''}> ${t}</label></li>`).join('')}</ul>`],
    canvas: ['Canvas', '#e1442c', '<ul><li>Case write-up<span class="due">Tue</span></li><li>Homework 5<span class="due">Wed</span></li><li>Lab 3 report<span class="due">Fri</span></li><li class="dim">Midterm review<span class="due">Mon</span></li></ul>'],
    music: ['Spotify', '#1db954', '<div class="hr-music"><span class="hr-art"></span><span><b>Study Session</b><span class="dim">Lo-fi beats · playlist</span></span></div>'],
    cal: ['Calendar', '#4285f4', '<span class="dim">Next up</span><div class="big">10:10</div><span>Statistics, Bldg 38</span>'],
    notes: ['Notes', '#e9b949', '<textarea aria-label="Notes">Ideas: group project plan\n- meet Thu after class\n- split the slides</textarea>'],
  };
  const DEFAULTS = {
    4: { todo: [0, 0, 1, 3], canvas: [1, 0, 2, 2], music: [3, 0, 1, 2], cal: [1, 2, 1, 2], notes: [2, 2, 2, 2] },
    2: { canvas: [0, 0, 2, 2], todo: [0, 2, 1, 3], music: [1, 2, 1, 2], cal: [1, 4, 1, 2], notes: [0, 5, 2, 2] },
  };
  const cols = el.clientWidth < 480 ? 2 : 4, KEY = `mdl-homeroom-demo-${cols}`;
  el.style.setProperty('--cols', cols);
  let layout;
  try { layout = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!layout || Object.keys(layout).length !== 5) layout = structuredClone(DEFAULTS[cols]);
  el.innerHTML = Object.entries(CARDS).map(([id, [t, c, html]]) =>
    `<div class="hr-card" data-id="${id}" style="--c:${c}"><div class="hr-top"><i></i>${t}</div><div class="hr-in">${html}</div><span class="hr-size" aria-hidden="true"></span></div>`).join('') + '<div class="hr-ghost" hidden></div>';
  const ghost = $('.hr-ghost', el);
  const metrics = () => {
    const cs = getComputedStyle(el), gap = parseFloat(cs.getPropertyValue('--gap')), row = parseFloat(cs.getPropertyValue('--row'));
    return { gap, row, col: (el.clientWidth - gap * (cols - 1)) / cols };
  };
  const box = ([x, y, w, h], m) => ({ left: x * (m.col + m.gap), top: y * (m.row + m.gap), width: w * m.col + (w - 1) * m.gap, height: h * m.row + (h - 1) * m.gap });
  const hits = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  // Push anything the moved card overlaps below it, then float everything up as far as it can go
  function settle(l, moving) {
    const out = structuredClone(l), queue = moving ? [moving] : [];
    while (queue.length) {
      const id = queue.shift();
      for (const other of Object.keys(out)) {
        if (other !== id && other !== moving && hits(out[id], out[other])) { out[other][1] = out[id][1] + out[id][3]; queue.push(other); }
      }
    }
    const order = Object.keys(out).sort((a, b) => out[a][1] - out[b][1] || out[a][0] - out[b][0]);
    const placed = [];
    for (const id of order) {
      if (id !== moving) while (out[id][1] > 0 && !placed.some(p => hits([out[id][0], out[id][1] - 1, out[id][2], out[id][3]], out[p]))) out[id][1]--;
      placed.push(id);
    }
    return out;
  }
  function draw(l, skip) {
    const m = metrics();
    for (const card of $$('.hr-card', el)) {
      if (card.dataset.id === skip) continue;
      Object.assign(card.style, Object.fromEntries(Object.entries(box(l[card.dataset.id], m)).map(([k, v]) => [k, `${v}px`])));
    }
    el.style.setProperty('--rows', Math.max(5, ...Object.values(l).map(r => r[1] + r[3])) + (skip ? 1 : 0));
  }
  layout = settle(layout, null);
  draw(layout);
  new ResizeObserver(() => draw(layout)).observe(el);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch (e) {} };
  reset?.addEventListener('click', () => { layout = structuredClone(DEFAULTS[cols]); draw(layout); save(); });

  el.addEventListener('pointerdown', e => {
    const card = e.target.closest('.hr-card'), resizing = e.target.classList.contains('hr-size');
    if (!card || (!resizing && !e.target.closest('.hr-top'))) return;
    e.preventDefault();
    const id = card.dataset.id, m = metrics(), start = layout[id].slice(), rect = el.getBoundingClientRect();
    const b0 = box(start, m), ox = e.clientX - rect.left - b0.left, oy = e.clientY - rect.top - b0.top;
    card.setPointerCapture(e.pointerId);
    card.classList.add('moving');
    ghost.hidden = false;
    let next = layout;
    const move = ev => {
      const px = ev.clientX - rect.left, py = ev.clientY - rect.top, r = start.slice();
      if (resizing) {
        const w = Math.max(b0.width + px - (e.clientX - rect.left), m.col * 0.6), h = Math.max(b0.height + py - (e.clientY - rect.top), m.row * 0.6);
        Object.assign(card.style, { width: `${w}px`, height: `${h}px` });
        r[2] = Math.min(cols - r[0], Math.max(1, Math.round((w + m.gap) / (m.col + m.gap))));
        r[3] = Math.min(6, Math.max(1, Math.round((h + m.gap) / (m.row + m.gap))));
      } else {
        const left = px - ox, top = py - oy;
        Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
        r[0] = Math.min(cols - r[2], Math.max(0, Math.round(left / (m.col + m.gap))));
        r[1] = Math.max(0, Math.round(top / (m.row + m.gap)));
      }
      next = settle({ ...layout, [id]: r }, id);
      Object.assign(ghost.style, Object.fromEntries(Object.entries(box(next[id], m)).map(([k, v]) => [k, `${v}px`])));
      draw(next, id);
    };
    const up = () => {
      card.removeEventListener('pointermove', move);
      card.classList.remove('moving');
      ghost.hidden = true;
      layout = settle(next, null);
      draw(layout);
      save();
    };
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerup', up, { once: true });
    card.addEventListener('pointercancel', up, { once: true });
  });
}

// ---------- WhenWorks: three classmates' busy times. Drag a block to another day or hour; the green is
// every hour all of them are free. ----------
function whenworksDemo(el, reset) {
  const START = 9, HOURS = 9, DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const PEOPLE = [['Alex', '#60a5fa'], ['Jordan', '#fbbf24'], ['Sam', '#c084fc']];
  // [person, day, start hour, hours]
  const DEFAULT = [
    [0, 0, 9, 2], [0, 2, 9, 2], [0, 4, 9, 2], [0, 1, 13, 2], [0, 3, 13, 2],
    [1, 0, 13, 3], [1, 1, 10, 2], [1, 3, 10, 2], [1, 2, 14, 3], [1, 4, 15, 2],
    [2, 0, 11, 2], [2, 2, 11, 2], [2, 4, 12, 3], [2, 1, 15, 2], [2, 3, 15, 2],
  ];
  let blocks = structuredClone(DEFAULT);
  const on = [true, true, true];
  const hourLabel = h => `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`;
  el.innerHTML = `<div class="ww-people">${PEOPLE.map(([n, c], i) => `<button type="button" aria-pressed="true" data-p="${i}" style="--c:${c}"><i></i>${n}</button>`).join('')}<span class="ww-sum"></span></div>
    <div class="ww-grid" style="--hours:${HOURS}"><span></span>${DAYS.map(d => `<span class="ww-day">${d}</span>`).join('')}
    ${Array.from({ length: HOURS }, (_, h) => `<span class="ww-hour">${hourLabel(START + h)}</span>${DAYS.map((d, k) => `<span class="ww-cell" data-d="${k}" data-h="${START + h}"></span>`).join('')}`).join('')}</div>
    <p class="ww-best" aria-live="polite"></p>`;
  const grid = $('.ww-grid', el), cells = $$('.ww-cell', el), sum = $('.ww-sum', el), best = $('.ww-best', el);
  const els = blocks.map((b, i) => {
    const div = document.createElement('div');
    div.className = 'ww-block';
    div.dataset.i = i;
    div.style.setProperty('--c', PEOPLE[b[0]][1]);
    div.textContent = PEOPLE[b[0]][0][0];
    div.setAttribute('aria-label', `${PEOPLE[b[0]][0]} busy`);
    grid.appendChild(div);
    return div;
  });
  const geo = () => {
    const first = cells[0], r = grid.getBoundingClientRect(), c = first.getBoundingClientRect();
    return { x0: c.left - r.left, y0: c.top - r.top, w: c.width, h: c.height };
  };
  function place(i, g = geo()) {
    const [p, d, s, len] = blocks[i], lane = (g.w - 6) / 3;
    Object.assign(els[i].style, { left: `${g.x0 + d * g.w + 3 + p * lane}px`, top: `${g.y0 + (s - START) * g.h + 1}px`, width: `${lane - 2}px`, height: `${len * g.h - 2}px` });
    els[i].classList.toggle('off', !on[p]);
  }
  function update() {
    const g = geo();
    blocks.forEach((_, i) => place(i, g));
    const busy = new Set();
    blocks.forEach(([p, d, s, len]) => { if (on[p]) for (let h = s; h < s + len; h++) busy.add(`${d}-${h}`); });
    let free = 0;
    cells.forEach(c => { const f = !busy.has(`${c.dataset.d}-${c.dataset.h}`); c.classList.toggle('free', f); free += f; });
    const n = on.filter(Boolean).length;
    sum.textContent = `${free} free hours`;
    // The longest stretch everyone's free, earliest first
    let top = null;
    DAYS.forEach((day, d) => {
      let run = 0;
      for (let h = START; h <= START + HOURS; h++) {
        if (h < START + HOURS && !busy.has(`${d}-${h}`)) run++;
        else { if (run && (!top || run > top.run)) top = { d, end: h, run }; run = 0; }
      }
    });
    best.innerHTML = !n ? 'Add someone’s schedule to find a time.'
      : top ? `Best time: <b>${DAYS[top.d]} ${hourLabel(top.end - top.run)} to ${hourLabel(top.end)}</b>, ${top.run} hour${top.run > 1 ? 's' : ''} when ${n === 1 ? 'they’re' : n === 2 ? 'both are' : 'all three are'} free.`
      : 'No hour works for everyone. Try moving a block.';
  }
  update();
  new ResizeObserver(() => update()).observe(grid);
  $$('.ww-people button', el).forEach(b => b.addEventListener('click', () => {
    on[b.dataset.p] = !on[b.dataset.p];
    b.setAttribute('aria-pressed', String(on[b.dataset.p]));
    update();
  }));
  reset?.addEventListener('click', () => { blocks = structuredClone(DEFAULT); on.fill(true); $$('.ww-people button', el).forEach(b => b.setAttribute('aria-pressed', 'true')); update(); });
  grid.addEventListener('pointerdown', e => {
    const blk = e.target.closest('.ww-block');
    if (!blk) return;
    e.preventDefault();
    const i = +blk.dataset.i, g = geo(), r = grid.getBoundingClientRect();
    const ox = e.clientX - r.left - parseFloat(blk.style.left), oy = e.clientY - r.top - parseFloat(blk.style.top);
    blk.setPointerCapture(e.pointerId);
    blk.classList.add('moving');
    const move = ev => {
      const x = ev.clientX - r.left - ox, y = ev.clientY - r.top - oy;
      blk.style.left = `${x}px`; blk.style.top = `${y}px`;
      const d = Math.min(4, Math.max(0, Math.floor((x - g.x0 + g.w / 6) / g.w)));
      const s = Math.min(START + HOURS - blocks[i][3], Math.max(START, START + Math.round((y - g.y0) / g.h)));
      if (d !== blocks[i][1] || s !== blocks[i][2]) {
        blocks[i][1] = d; blocks[i][2] = s;
        const keep = [blk.style.left, blk.style.top];
        update();
        blk.style.left = keep[0]; blk.style.top = keep[1];
      }
    };
    const up = () => { blk.removeEventListener('pointermove', move); blk.classList.remove('moving'); update(); };
    blk.addEventListener('pointermove', move);
    blk.addEventListener('pointerup', up, { once: true });
    blk.addEventListener('pointercancel', up, { once: true });
  });
}
