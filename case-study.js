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
// any edge or corner, add widgets from the same "+ Add widget" panel, remove them with ×. The widgets
// are working fakes with made-up data. Cards move with transforms, so dragging stays smooth. ----------
const pad = n => String(n).padStart(2, '0');
const WIDGETS = {
  spotify: {
    title: 'Spotify', group: 'Apps & links', description: 'A playlist, album, or podcast player', color: '#1db954', size: [16, 16],
    html: () => `<div class="sp"><div class="sp-art"><b>Late Night<br>Study</b></div><div class="sp-main"><b class="sp-song">Coffee Shop Rain</b><span class="sp-artist">Lo-fi Study Beats</span>
      <div class="sp-bar"><i></i></div>
      <div class="sp-ctrl"><span class="sp-t">0:00</span><button type="button" data-sp="prev" aria-label="Previous">⏮</button><button type="button" class="sp-play" data-sp="play" aria-label="Pause">❚❚</button><button type="button" data-sp="next" aria-label="Next">⏭</button><span class="sp-t">2:48</span></div></div></div>`,
    init(card) {
      const songs = [['Coffee Shop Rain', 'Lo-fi Study Beats', 168], ['Window Seat', 'Chillhop Days', 154], ['Finals Week', 'Quiet Hours', 191]];
      let k = 0, t = 47, playing = true;
      const bar = card.querySelector('.sp-bar i'), times = card.querySelectorAll('.sp-t'), play = card.querySelector('.sp-play');
      const show = () => {
        const [song, artist, len] = songs[k];
        card.querySelector('.sp-song').textContent = song; card.querySelector('.sp-artist').textContent = artist;
        bar.style.width = `${(t / len) * 100}%`;
        times[0].textContent = `${Math.floor(t / 60)}:${pad(t % 60)}`; times[1].textContent = `${Math.floor(len / 60)}:${pad(len % 60)}`;
        play.textContent = playing ? '❚❚' : '▶'; play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      };
      card.addEventListener('click', e => {
        const b = e.target.closest('[data-sp]');
        if (!b) return;
        if (b.dataset.sp === 'play') playing = !playing;
        else { k = (k + (b.dataset.sp === 'next' ? 1 : songs.length - 1)) % songs.length; t = 0; }
        show();
      });
      const id = setInterval(() => { if (!card.isConnected) return clearInterval(id); if (!playing) return; if (++t >= songs[k][2]) { k = (k + 1) % songs.length; t = 0; } show(); }, 1000);
      show();
    },
  },
  calendar: {
    title: 'Google Calendar', group: 'School', description: 'Your calendar, or a sample week', color: '#1a73e8', size: [14, 30],
    html: () => {
      const d = new Date(), START = 8, END = 17;
      const ev = [[9.17, 10, 'STAT 217', 'Bldg 38', '#039be5'], [10.17, 11.5, 'BUS 212 Lecture', 'Bldg 3', '#33b679'], [12, 13, 'Lunch w/ Sam', '', '#f6bf26'], [14, 15, 'Office hours', 'Bldg 25', '#8e24aa'], [15.5, 16.5, 'Gym', '', '#e67c73']];
      const hour = h => `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`;
      const now = d.getHours() + d.getMinutes() / 60, pct = h => ((h - START) / (END - START)) * 100;
      return `<div class="gc"><div class="gc-head"><b>${d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</b><span class="gc-day">${d.getDate()}</span></div>
        <div class="gc-body">${Array.from({ length: END - START }, (_, i) => `<div class="gc-h" style="top:${pct(START + i)}%"><span>${hour(START + i)}</span></div>`).join('')}
        ${ev.map(([a, z, t, where, c]) => `<div class="gc-ev" style="top:${pct(a)}%;height:calc(${pct(z) - pct(a)}% - 2px);--c:${c}"><b>${t}</b>${where ? `<span>${where}</span>` : ''}</div>`).join('')}
        ${now > START && now < END ? `<i class="gc-now" style="top:${pct(now)}%"></i>` : ''}</div></div>`;
    },
  },
  canvas: {
    title: 'Canvas assignments', group: 'School', description: 'What’s due next across your classes', color: '#e4412b', size: [17, 18],
    html: () => {
      const day = n => new Date(Date.now() + n * 864e5).toLocaleDateString('en-US', { weekday: 'short' });
      return `<ul class="cv">${[['BUS 212', '#e8710a', 'Case write-up', `${day(1)} 11:59 PM`, '20 pts'], ['STAT 217', '#1a73e8', 'Homework 5', `${day(2)} 11:59 PM`, '10 pts'], ['ECON 222', '#188038', 'Reading quiz 4', `${day(3)} 9:00 AM`, '5 pts'], ['BUS 212', '#e8710a', 'Midterm review', `${day(6)} 11:59 PM`, '0 pts']]
        .map(([c, col, t, due, pts]) => `<li><span class="cv-c" style="--c:${col}">${c}</span><b>${t}</b><span class="cv-due">Due ${due} · ${pts}</span></li>`).join('')}</ul>`;
    },
  },
  todo: {
    title: 'To-do', group: 'School', description: 'A checklist saved in this browser', color: '#e8710a', size: [16, 18],
    html: () => `<ul class="td">${['Finish STAT 217 homework', 'Email advisor about spring classes', 'Groceries', 'Call home'].map((t, i) => `<li><label><input type="checkbox"${i === 2 ? ' checked' : ''}><span>${t}</span></label></li>`).join('')}</ul>
      <form class="td-add"><input placeholder="Add a task…" aria-label="Add a task"></form>`,
    init(card) {
      card.querySelector('.td-add').addEventListener('submit', e => {
        e.preventDefault();
        const input = e.target.querySelector('input'), text = input.value.trim();
        if (!text) return;
        const li = document.createElement('li');
        li.innerHTML = '<label><input type="checkbox"><span></span></label>';
        li.querySelector('span').textContent = text;
        card.querySelector('.td').appendChild(li);
        input.value = '';
      });
    },
  },
  notes: {
    title: 'Notes', group: 'School', description: 'A scratchpad with a live word count', color: '#e9b949', size: [17, 14],
    html: () => '<textarea class="nt" aria-label="Notes">Group project plan\n- meet Thu after class\n- split the slides\n- practice run Sunday</textarea><span class="nt-count"></span>',
    init(card) {
      const ta = card.querySelector('textarea'), count = card.querySelector('.nt-count');
      const update = () => { const n = ta.value.trim().split(/\s+/).filter(Boolean).length; count.textContent = `${n} word${n === 1 ? '' : 's'}`; };
      ta.addEventListener('input', update); update();
    },
  },
  search: {
    title: 'Google Search', group: 'Apps & links', description: 'Real Google results right in the card', color: '#4285f4', size: [16, 10],
    html: () => '<form class="gs"><b class="gs-logo"><i style="color:#4285f4">G</i><i style="color:#ea4335">o</i><i style="color:#fbbc05">o</i><i style="color:#4285f4">g</i><i style="color:#34a853">l</i><i style="color:#ea4335">e</i></b><input placeholder="Search Google" aria-label="Search Google"></form>',
    init(card) { card.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const q = e.target.querySelector('input').value.trim(); if (q) window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener'); }); },
  },
  claude: {
    title: 'Claude', group: 'Apps & links', description: 'Ask Claude; opens with your question filled in', color: '#d97757', size: [16, 12],
    html: () => '<form class="cl"><span class="cl-hi">✳ How can I help you today?</span><input placeholder="Ask Claude…" aria-label="Ask Claude"></form>',
    init(card) { card.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const q = e.target.querySelector('input').value.trim(); if (q) window.open(`https://claude.ai/new?q=${encodeURIComponent(q)}`, '_blank', 'noopener'); }); },
  },
  inbox: {
    title: 'Mail', group: 'Apps & links', description: 'Open Gmail, compose, or search your mail', color: '#ea4335', size: [17, 16],
    html: () => `<ul class="ml">${[['Prof. Kim', 'Lab 3: extension until Friday', '9:41 AM', 1], ['Career Services', 'Internship fair is next Thursday', '8:15 AM', 1], ['Sam', 'Re: group project slides', 'Yesterday', 0], ['Mustang Rec', 'Your class pass renews soon', 'Yesterday', 0]]
      .map(([f, t, when, unread]) => `<li class="${unread ? 'un' : ''}"><b>${f}</b><span>${t}</span><time>${when}</time></li>`).join('')}</ul>`,
  },
  scores: {
    title: 'Sports scores', group: 'News & sports', description: 'Live scores; your teams first', color: '#fd5a1e', size: [14, 14],
    html: () => `<p class="sc-note">Sample scores</p><ul class="scr">${[['SF Giants', 5, 'LA Dodgers', 3, 'Final'], ['49ers', 24, 'Seahawks', 17, 'Final'], ['Warriors', 61, 'Lakers', 58, 'Q3 4:12']]
      .map(([a, x, b, y, st]) => `<li><span><b>${a}</b><b>${b}</b></span><span class="n"><b>${x}</b><b>${y}</b></span><em>${st}</em></li>`).join('')}</ul>`,
  },
  news: {
    title: 'News headlines', group: 'News & sports', description: 'Latest headlines from NPR, Mustang News, and more', color: '#5f6368', size: [17, 15],
    html: () => `<p class="sc-note">Sample headlines</p><ul class="nw">${['Library extends its hours for finals week', 'Farmers market returns downtown on Thursday', 'New bike lanes open on campus this fall', 'Rec center adds evening yoga classes']
      .map(t => `<li>${t}</li>`).join('')}</ul>`,
  },
};
const GROUPS = ['School', 'Apps & links', 'News & sports'];

function homeroomDemo(el, reset) {
  const COLS = 48, ROW = 8, MIN_W = 8, MIN_H = 8;
  const DEFAULTS = {
    wide: { calendar: [0, 0, 14, 40], spotify: [14, 0, 17, 16], canvas: [31, 0, 17, 21], todo: [14, 16, 17, 23], notes: [31, 21, 17, 18] },
    narrow: { spotify: [0, 0, 48, 16], calendar: [0, 16, 24, 40], canvas: [24, 16, 24, 22], todo: [24, 38, 24, 18] },
  };
  el.innerHTML = `<div class="hr-bar"><span class="hr-tab">My dashboard</span><div class="hr-addwrap"><button type="button" class="hr-add" aria-expanded="false">+ Add widget</button>
    <div class="hr-menu" hidden><input class="hr-search" placeholder="Search widgets…" aria-label="Search widgets"><div class="hr-sections"></div></div></div></div>
    <div class="hr-ws"><div class="hr-place" hidden></div></div><p class="hr-toast" aria-live="polite"></p>`;
  const ws = $('.hr-ws', el), place = $('.hr-place', el), menu = $('.hr-menu', el), addBtn = $('.hr-add', el), search = $('.hr-search', el), toast = $('.hr-toast', el);
  const mode = ws.clientWidth < 520 ? 'narrow' : 'wide', narrow = mode === 'narrow', KEY = `mdl-homeroom-demo-v3-${mode}`;
  const MAX = narrow ? 78 : 62; // rows the workspace holds
  ws.style.height = `${MAX * ROW}px`;
  let layout;
  try { layout = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!layout || !Object.keys(layout).length || Object.keys(layout).some(k => !WIDGETS[k.split('-')[0]])) layout = structuredClone(DEFAULTS[mode]);
  let col = ws.clientWidth / COLS;
  const items = {};
  const HANDLES = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];
  const px = ([x, y, w, h]) => ({ x: x * col, y: y * ROW, w: w * col, h: h * ROW });
  const put = (node, r) => { const b = px(r); node.style.transform = `translate3d(${b.x}px,${b.y}px,0)`; node.style.width = `${b.w}px`; node.style.height = `${b.h}px`; };
  const draw = (l, skip) => { for (const [id, node] of Object.entries(items)) if (id !== skip && l[id]) put(node, l[id]); };
  const hits = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch (e) {} };
  function mount(id) {
    const w = WIDGETS[id.split('-')[0]];
    const node = document.createElement('div');
    node.className = 'hr-item';
    node.dataset.id = id;
    node.innerHTML = `<div class="hr-card" style="--c:${w.color}"><div class="hr-top"><i></i><span>${w.title}</span><button type="button" class="hr-x" aria-label="Remove ${w.title}">×</button></div><div class="hr-in">${w.html()}</div></div>${HANDLES.map(h => `<span class="hr-h hr-${h}" data-dir="${h}"></span>`).join('')}`;
    ws.appendChild(node);
    items[id] = node;
    w.init?.(node);
    return node;
  }
  Object.keys(layout).forEach(mount);
  draw(layout);
  requestAnimationFrame(() => ws.classList.add('ready'));
  let width = ws.clientWidth;
  new ResizeObserver(() => {
    if (ws.clientWidth === width || ws.classList.contains('active')) return;
    width = ws.clientWidth; col = width / COLS;
    ws.classList.remove('ready'); draw(layout); requestAnimationFrame(() => ws.classList.add('ready'));
  }).observe(ws);
  const say = t => { toast.textContent = t; toast.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('on'), 2600); };
  reset?.addEventListener('click', () => {
    Object.values(items).forEach(n => n.remove());
    for (const k in items) delete items[k];
    layout = structuredClone(DEFAULTS[mode]);
    Object.keys(layout).forEach(mount); draw(layout); save();
  });

  // + Add widget: Homeroom's panel (search, grouped tiles); new cards go in the first empty spot
  const renderMenu = () => {
    const q = search.value.trim().toLowerCase();
    $('.hr-sections', menu).innerHTML = GROUPS.map(g => {
      const types = Object.keys(WIDGETS).filter(t => WIDGETS[t].group === g && `${WIDGETS[t].title} ${WIDGETS[t].description}`.toLowerCase().includes(q));
      return types.length ? `<div class="hr-group"><h4>${g}</h4><div class="hr-tiles">${types.map(t => `<button type="button" data-add="${t}"><span><i style="--c:${WIDGETS[t].color}"></i>${WIDGETS[t].title}</span><small>${WIDGETS[t].description}</small></button>`).join('')}</div></div>` : '';
    }).join('') || `<p class="hr-empty">No widgets match “${q.replace(/[<>&"]/g, '')}”.</p>`;
  };
  const toggleMenu = on => { menu.hidden = !on; addBtn.setAttribute('aria-expanded', String(on)); if (on) { search.value = ''; renderMenu(); search.focus({ preventScroll: true }); } };
  addBtn.addEventListener('click', () => toggleMenu(menu.hidden));
  search.addEventListener('input', renderMenu);
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('.hr-addwrap')) toggleMenu(false); });
  el.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); toggleMenu(false); addBtn.focus(); } });
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const type = b.dataset.add, [w, h] = narrow ? [24, WIDGETS[type].size[1]] : WIDGETS[type].size;
    let spot = null;
    for (let y = 0; y + h <= MAX && !spot; y++) for (let x = 0; x + w <= COLS && !spot; x++) if (!Object.values(layout).some(r => hits(r, [x, y, w, h]))) spot = [x, y, w, h];
    toggleMenu(false);
    if (!spot) { say('No room for that card. Remove one with × or make one smaller.'); return; }
    let id = type, n = 2;
    while (layout[id]) id = `${type}-${n++}`;
    layout[id] = spot;
    const node = mount(id);
    put(node, spot);
    node.animate([{ opacity: 0, transform: `${node.style.transform} scale(.94)` }, { opacity: 1, transform: node.style.transform }], { duration: 260, easing: 'ease-out' });
    save();
  });
  ws.addEventListener('click', e => {
    const x = e.target.closest('.hr-x');
    if (!x) return;
    const node = x.closest('.hr-item'), id = node.dataset.id;
    delete layout[id]; delete items[id];
    node.animate([{ opacity: 1 }, { opacity: 0, transform: `${node.style.transform} scale(.94)` }], { duration: 180, easing: 'ease-in' }).finished.then(() => node.remove());
    save();
  });

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
  ws.addEventListener('pointerdown', e => {
    const item = e.target.closest('.hr-item');
    if (!item || e.button > 0 || e.target.closest('.hr-x')) return;
    const dir = e.target.dataset.dir;
    // Grab a card anywhere but its controls (on phones, by its top strip, so the page still scrolls)
    if (!dir && (e.target.closest('input, label, textarea, button, a, form') || (narrow && !e.target.closest('.hr-top')))) return;
    e.preventDefault();
    const id = item.dataset.id, start = structuredClone(layout), r0 = start[id], b0 = px(r0);
    const sx = e.clientX, sy = e.clientY, H = MAX * ROW;
    item.setPointerCapture(e.pointerId);
    item.classList.add(dir ? 'resizing' : 'dragging');
    ws.classList.add('active');
    place.hidden = false;
    put(place, r0);
    let target = r0.slice(), frame = 0, last = e;
    const update = () => {
      frame = 0;
      const dx = last.clientX - sx, dy = last.clientY - sy;
      let { x, y, w, h } = b0;
      if (!dir) { x += dx; y += dy; } else {
        if (dir.includes('e')) w = Math.max(MIN_W * col, Math.min(ws.clientWidth - x, w + dx));
        if (dir.includes('s')) h = Math.max(MIN_H * ROW, Math.min(H - y, h + dy));
        if (dir.includes('w')) { const nw = Math.max(MIN_W * col, Math.min(x + w, w - dx)); x += w - nw; w = nw; }
        if (dir.includes('n')) { const nh = Math.max(MIN_H * ROW, Math.min(y + h, h - dy)); y += h - nh; h = nh; }
      }
      // Stays inside the workspace; the card follows the pointer and the placeholder shows where it lands
      x = Math.max(0, Math.min(ws.clientWidth - w, x)); y = Math.max(0, Math.min(H - h, y));
      item.style.transform = `translate3d(${x}px,${y}px,0)`;
      item.style.width = `${w}px`; item.style.height = `${h}px`;
      const next = [Math.round(x / col), Math.round(y / ROW), Math.round(w / col), Math.round(h / ROW)];
      next[2] = Math.min(COLS, next[2]); next[0] = Math.min(COLS - next[2], next[0]);
      next[3] = Math.min(MAX, next[3]); next[1] = Math.min(MAX - next[3], next[1]);
      if (next.join() === target.join()) return;
      const l = pushDown(start, id, next);
      // A drop that would push a card off the bottom isn't allowed: the placeholder stays at the last good spot
      if (Object.values(l).some(r => r[1] + r[3] > MAX)) return;
      target = next;
      put(place, target);
      draw(l, id);
      layout = l;
    };
    const move = ev => { last = ev; if (!frame) frame = requestAnimationFrame(update); };
    const up = () => {
      cancelAnimationFrame(frame);
      item.removeEventListener('pointermove', move);
      item.classList.remove('dragging', 'resizing');
      ws.classList.remove('active');
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
