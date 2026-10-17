// Case studies: clicking "Case study + demo" on a project card opens a full page over the site. With
// View Transitions, the card's video and title morph into the page's hero image and headline (and back
// again when it closes). Each page has a hands-on demo of the project. Loaded on first use.
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const page = $('#case'), body = $('.case-body', page);
const names = { homeroom: 'Homeroom', whenworks: 'WhenWorks' };
let current = null, opener = null;

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

function setup(key) {
  const demo = $('[data-demo]', body);
  if (demo) (key === 'homeroom' ? homeroomDemo : whenworksDemo)(demo, $('.case-reset', body));
}

// ---------- Homeroom: a small copy of its workspace, built the way the real one is (src/lib/grid.js):
// a fine grid (48 columns, 8px rows) so cards move almost free-form; the card you drag stays exactly
// where you drop it; any card it lands on is pushed straight down (and springs back once it's clear,
// since pushes are worked out from where cards started); nothing floats up to fill gaps. Resize from
// any edge or corner. Cards move with transforms, so dragging stays smooth. ----------
function homeroomDemo(el, reset) {
  const COLS = 48, ROW = 8, GAP = 4, MIN_W = 8, MIN_H = 8;
  const CARDS = {
    todo: ['To-do', '#e8710a', `<ul>${['Finish STAT 217 homework', 'Email advisor', 'Groceries', 'Call home'].map((t, i) => `<li><label><input type="checkbox"${i === 2 ? ' checked' : ''}> ${t}</label></li>`).join('')}</ul>`],
    canvas: ['Canvas', '#e1442c', '<p class="dim">Due soon</p><ul><li>Case write-up<span class="due">Tue</span></li><li>Homework 5<span class="due">Wed</span></li><li>Lab 3 report<span class="due">Fri</span></li></ul>'],
    music: ['Spotify', '#1db954', '<div class="hr-music"><span class="hr-art"></span><span><b>Study Session</b><span class="dim">Lo-fi beats</span></span></div>'],
    cal: ['Calendar', '#2f6fed', '<span class="dim">Next up</span><div class="big">10:10 AM</div><span>Statistics, Bldg 38</span>'],
    notes: ['Notes', '#e9b949', '<textarea aria-label="Notes">Group project plan\n- meet Thu after class\n- split the slides</textarea>'],
  };
  // [x, y, w, h] in grid units
  const DEFAULTS = {
    wide: { todo: [0, 0, 13, 22], canvas: [13, 0, 21, 16], music: [34, 0, 14, 16], cal: [13, 16, 13, 16], notes: [26, 16, 22, 16] },
    narrow: { canvas: [0, 0, 48, 16], todo: [0, 16, 24, 21], music: [24, 16, 24, 11], cal: [24, 27, 24, 14], notes: [0, 41, 48, 15] },
  };
  const mode = el.clientWidth < 520 ? 'narrow' : 'wide', KEY = `mdl-homeroom-demo-${mode}`;
  const narrow = mode === 'narrow';
  let layout;
  try { layout = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!layout || Object.keys(layout).length !== 5) layout = structuredClone(DEFAULTS[mode]);
  const HANDLES = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];
  el.innerHTML = Object.entries(CARDS).map(([id, [t, c, html]]) =>
    `<div class="hr-item" data-id="${id}"><div class="hr-card" style="--c:${c}"><div class="hr-top"><i></i><span>${t}</span></div><div class="hr-in">${html}</div></div>${HANDLES.map(h => `<span class="hr-h hr-${h}" data-dir="${h}"></span>`).join('')}</div>`).join('')
    + '<div class="hr-place" hidden></div>';
  const items = Object.fromEntries($$('.hr-item', el).map(n => [n.dataset.id, n]));
  const place = $('.hr-place', el);
  let col = (el.clientWidth) / COLS;
  const px = ([x, y, w, h]) => ({ x: x * col, y: y * ROW, w: w * col, h: h * ROW });
  const put = (node, r) => {
    const b = px(r);
    node.style.transform = `translate3d(${b.x}px,${b.y}px,0)`;
    node.style.width = `${b.w}px`;
    node.style.height = `${b.h}px`;
  };
  const height = l => { el.style.height = `${(Math.max(...Object.values(l).map(r => r[1] + r[3])) + 6) * ROW}px`; };
  const draw = (l, skip) => { for (const [id, node] of Object.entries(items)) if (id !== skip) put(node, l[id]); height(l); };
  const hits = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  // The active card stays put; everything else, from where it started, is pushed down past anything it hits
  const pushDown = (start, id, r) => {
    const out = { [id]: r }, placed = [r];
    for (const k of Object.keys(start).filter(k => k !== id).sort((a, b) => start[a][1] - start[b][1] || start[a][0] - start[b][0])) {
      const next = start[k].slice();
      let hit;
      while ((hit = placed.find(p => hits(p, next)))) next[1] = hit[1] + hit[3];
      out[k] = next; placed.push(next);
    }
    return out;
  };
  draw(layout);
  requestAnimationFrame(() => el.classList.add('ready'));
  // Only a change of width matters (the height follows the cards, and changes during a drag)
  let width = el.clientWidth;
  new ResizeObserver(() => {
    if (el.clientWidth === width || el.classList.contains('active')) return;
    width = el.clientWidth; col = width / COLS;
    el.classList.remove('ready'); draw(layout); requestAnimationFrame(() => el.classList.add('ready'));
  }).observe(el);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch (e) {} };
  reset?.addEventListener('click', () => { layout = structuredClone(DEFAULTS[mode]); draw(layout); save(); });

  el.addEventListener('pointerdown', e => {
    const item = e.target.closest('.hr-item');
    if (!item || e.button > 0) return;
    const dir = e.target.dataset.dir;
    // Grab a card anywhere but its checkboxes and note (on phones, by its top strip, so the page still scrolls)
    if (!dir && (e.target.closest('input, label, textarea') || (narrow && !e.target.closest('.hr-top')))) return;
    e.preventDefault();
    const id = item.dataset.id, start = structuredClone(layout), r0 = start[id], b0 = px(r0);
    const sx = e.clientX, sy = e.clientY;
    item.setPointerCapture(e.pointerId);
    item.classList.add(dir ? 'resizing' : 'dragging');
    el.classList.add('active');
    place.hidden = false;
    put(place, r0);
    let target = r0.slice(), frame = 0, last = e;
    const update = () => {
      frame = 0;
      const dx = last.clientX - sx, dy = last.clientY - sy;
      let { x, y, w, h } = b0;
      if (!dir) { x += dx; y += dy; } else {
        if (dir.includes('e')) w = Math.max(MIN_W * col, w + dx);
        if (dir.includes('s')) h = Math.max(MIN_H * ROW, h + dy);
        if (dir.includes('w')) { const nw = Math.max(MIN_W * col, w - dx); x += w - nw; w = nw; }
        if (dir.includes('n')) { const nh = Math.max(MIN_H * ROW, h - dy); y += h - nh; h = nh; }
      }
      // The card follows the pointer exactly; the placeholder shows where it will land
      x = Math.max(0, Math.min(el.clientWidth - w, x)); y = Math.max(0, y);
      item.style.transform = `translate3d(${x}px,${y}px,0)`;
      item.style.width = `${w}px`; item.style.height = `${h}px`;
      const next = [Math.round(x / col), Math.round(y / ROW), Math.round(w / col), Math.round(h / ROW)];
      next[2] = Math.min(COLS, next[2]); next[0] = Math.min(COLS - next[2], next[0]);
      if (next.join() === target.join()) return;
      target = next;
      put(place, target);
      const l = pushDown(start, id, target);
      draw(l, id);
      layout = l;
    };
    const move = ev => { last = ev; if (!frame) frame = requestAnimationFrame(update); };
    const up = () => {
      cancelAnimationFrame(frame);
      item.removeEventListener('pointermove', move);
      item.classList.remove('dragging', 'resizing');
      el.classList.remove('active');
      place.hidden = true;
      draw(layout);
      save();
    };
    item.addEventListener('pointermove', move);
    item.addEventListener('pointerup', up, { once: true });
    item.addEventListener('pointercancel', up, { once: true });
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
