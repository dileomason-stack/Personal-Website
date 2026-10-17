// Blueprint mode (loaded by site-motion.js, so not for reduced motion). The page turns into its own
// blueprint: every key element outlined with its size and type or box settings read live from the
// computed CSS, plus red redlines measuring the space between elements, the way a designer checks a
// build. Click the Blueprint chip for the whole page (it opens from the chip as a scan and the
// outlines draw themselves in; scroll the whole site like that; Esc or the chip closes it). Hold
// Shift for a quick lens at the cursor instead.
import { gsap } from 'gsap';

const root = document.documentElement;
const intro = document.getElementById('intro');
const finePointer = matchMedia('(pointer: fine)').matches;
const ready = fn => (intro.classList.contains('done') ? fn() : addEventListener('intro:done', fn, { once: true }));
let px = innerWidth / 2, py = innerHeight / 2, pointerIn = false;
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; pointerIn = true; }, { passive: true });
document.addEventListener('pointerleave', () => { pointerIn = false; });

const NOTED = ['.bar', '.eyebrow', '.hero h2', '.lead', '.hero-actions .btn', '.quick', '.display', '.num', '.feature h4',
  '.phone-frame', '.sc-step', '.proj', '.proj h4', '.school', '.mark', '.details h4', '.looking', '.gallery', '.contact h3',
  '.contact .btn', 'footer'].join(',');
const TEXTY = /^(H1|H2|H3|H4|P|A|BUTTON|DD|SPAN|B)$/;
// State and helper classes that say nothing about what an element is
const UTILITY = new Set(['reveal', 'in', 'd1', 'd2', 'd3', 'mo', 'is-active', 'drawn', 'on', 'active', 'ghost']);

const make = (tag, className, html = '') => Object.assign(document.createElement(tag), { className, innerHTML: html });
const sheet = make('div', 'bp', '<div class="bp-notes"></div>');
const ring = make('div', 'bp-ring', '<span>Blueprint</span><b></b>');
const tip = make('div', 'bp-tip');
const chip = make('button', 'bp-chip', 'Blueprint');
for (const el of [sheet, ring, tip]) el.setAttribute('aria-hidden', 'true');
chip.type = 'button';
chip.setAttribute('aria-pressed', 'false');
chip.title = finePointer ? 'See the whole page as a blueprint (or hold Shift to peek)' : 'See the page as a blueprint';
document.body.append(sheet, ring, tip, chip);
const notesEl = sheet.firstChild, ringOut = ring.querySelector('b');

// mode: 'off', 'peek' (Shift lens at the cursor) or 'full' (the whole page, opened from the chip)
const bp = { mode: 'off', r: 0, x: px, y: py, shown: false };
let notes = [], gaps = [];

// What a developer would want to know about an element, read from its computed style
function describe(el) {
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  const cls = [...el.classList].find(c => !UTILITY.has(c));
  const name = el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  const size = parseFloat(cs.fontSize);
  let spec;
  if (TEXTY.test(el.tagName) && el.textContent.trim()) {
    const lh = cs.lineHeight === 'normal' ? 'normal' : (parseFloat(cs.lineHeight) / size).toFixed(2);
    const ls = parseFloat(cs.letterSpacing) ? (parseFloat(cs.letterSpacing) / size).toFixed(3) + 'em' : '0';
    spec = `${cs.fontFamily.split(',')[0].replace(/"/g, '')} ${cs.fontWeight} · ${Math.round(size)}px / ${lh} · ${ls}`;
  } else {
    const pad = [cs.paddingTop, cs.paddingRight].map(v => Math.round(parseFloat(v))).join(' ');
    spec = `radius ${Math.round(parseFloat(cs.borderTopLeftRadius))} · padding ${pad}`;
  }
  return { name, spec, dims: `${Math.round(r.width)} × ${Math.round(r.height)}` };
}

// Outline every noted element, and pair each with the nearest element below it in the same column
// to measure the gap between them (the redlines)
function build() {
  notesEl.textContent = '';
  const els = [...document.querySelectorAll(NOTED)].filter(el => el.getClientRects().length);
  notes = els.map(el => {
    const d = describe(el), n = make('div', 'bp-note', `<i>${d.name}</i><em>${d.dims}</em><small>${d.spec}</small>`);
    notesEl.append(n);
    return { el, n };
  });
  const box = el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right }; };
  const boxes = els.map(box);
  gaps = [];
  els.forEach((a, i) => {
    let best = null;
    els.forEach((b, j) => {
      if (i === j || a.contains(b) || b.contains(a)) return;
      const A = boxes[i], B = boxes[j], gap = B.top - A.bottom;
      const overlap = Math.min(A.right, B.right) - Math.max(A.left, B.left);
      if (gap < 6 || gap > 240 || overlap < 40) return;
      if (!best || gap < best.gap) best = { b, gap };
    });
    if (!best) return;
    const g = make('div', 'bp-gap', '<span></span>');
    notesEl.append(g);
    gaps.push({ a, b: best.b, g, label: g.firstChild });
  });
}

function place() {
  for (const { el, n } of notes) {
    const r = el.getBoundingClientRect();
    const show = r.bottom > -40 && r.top < innerHeight + 40;
    n.style.display = show ? '' : 'none';
    if (!show) continue;
    n.style.left = r.left + 'px';
    n.style.top = r.top + 'px';
    n.style.width = r.width + 'px';
    n.style.height = r.height + 'px';
    // Draw in (in the full blueprint): one frame laid out undrawn, then drawn, so the transition runs;
    // notes higher on the screen draw first, following the scan
    if (bp.mode === 'full' && !n.dataset.drawn) {
      if (!n.dataset.seen) n.dataset.seen = '1';
      else {
        n.dataset.drawn = '1';
        n.style.transitionDelay = (0.15 + Math.max(0, r.top) / innerHeight * 0.55).toFixed(2) + 's';
      }
    }
  }
  for (const { a, b, g, label } of gaps) {
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    const show = B.top > -40 && A.bottom < innerHeight + 40;
    g.style.display = show ? '' : 'none';
    if (!show) continue;
    const x = (Math.max(A.left, B.left) + Math.min(A.right, B.right)) / 2;
    g.style.left = x + 'px';
    g.style.top = A.bottom + 'px';
    g.style.height = Math.max(0, B.top - A.bottom) + 'px';
    label.textContent = Math.round(B.top - A.bottom);
  }
}

// The element under a point, for the inspector readouts
let under = null;
function inspect(x, y, out) {
  const hit = document.elementsFromPoint(x, y).find(el => !el.closest('.bp, .bp-ring, .bp-tip, .bp-chip') && el.closest(NOTED));
  const el = hit && hit.closest(NOTED);
  if (el === under) return;
  under = el;
  out.innerHTML = el ? (d => `<i>${d.name}</i> ${d.spec} · ${d.dims}`)(describe(el)) : '';
}

function chipCenter() {
  const r = chip.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

function open(mode) {
  if (bp.mode === mode) return;
  const was = bp.mode;
  bp.mode = mode;
  root.classList.toggle('bp-on', mode !== 'off');
  root.classList.toggle('bp-full', mode === 'full');
  chip.setAttribute('aria-pressed', String(mode === 'full'));
  chip.textContent = mode === 'full' ? 'Close blueprint' : 'Blueprint';
  if (mode === 'off') {
    under = null;
    sheet.classList.remove('scan');
    gsap.to(bp, { r: 0, duration: was === 'full' ? 0.6 : 0.3, ease: was === 'full' ? 'expo.inOut' : 'power2.in' });
    return;
  }
  if (was === 'off') build();
  if (mode === 'full') {
    [bp.x, bp.y] = chipCenter();
    notes.forEach(({ n }) => { delete n.dataset.drawn; delete n.dataset.seen; n.style.transitionDelay = ''; });
    sheet.classList.remove('scan');
    void sheet.offsetWidth;
    sheet.classList.add('scan');
    gsap.fromTo(bp, { r: was === 'peek' ? bp.r : 0 }, { r: Math.hypot(innerWidth, innerHeight) * 1.05, duration: 0.9, ease: 'expo.inOut' });
  } else {
    bp.x = px; bp.y = py;
    gsap.to(bp, { r: 170, duration: 0.45, ease: 'expo.out' });
  }
}

function tick() {
  if (bp.mode === 'off' && bp.r < 0.5) {
    if (bp.shown) {
      bp.shown = false;
      sheet.style.clipPath = 'circle(0px at 0 0)';
      ring.style.opacity = tip.style.opacity = '0';
      ringOut.textContent = tip.textContent = '';
    }
    return;
  }
  bp.shown = true;
  if (bp.mode === 'peek') {
    bp.x += ((finePointer ? px : innerWidth / 2) - bp.x) * 0.35;
    bp.y += ((finePointer ? py : innerHeight / 2) - bp.y) * 0.35;
  }
  sheet.style.clipPath = `circle(${bp.r.toFixed(1)}px at ${bp.x.toFixed(1)}px ${bp.y.toFixed(1)}px)`;
  const peeking = bp.mode === 'peek' && finePointer && bp.r > 4;
  ring.style.cssText = `width:${bp.r * 2}px;height:${bp.r * 2}px;transform:translate(${bp.x - bp.r}px,${bp.y - bp.r}px);opacity:${peeking ? 1 : 0}`;
  if (peeking) inspect(bp.x, bp.y, ringOut);
  // In the full blueprint, a small inspector follows the cursor
  const tipping = bp.mode === 'full' && finePointer && pointerIn;
  if (tipping) {
    inspect(px, py, tip);
    tip.style.transform = `translate(${Math.min(px + 16, innerWidth - tip.offsetWidth - 12)}px,${py + 20}px)`;
  }
  tip.style.opacity = tipping && tip.textContent ? '1' : '0';
  place();
}

ready(() => {
  root.classList.add('bp-ready');
  addEventListener('keydown', e => {
    if (e.key === 'Shift' && !e.repeat && bp.mode === 'off') open('peek');
    if (e.key === 'Escape' && bp.mode === 'full') open('off');
  });
  addEventListener('keyup', e => { if (e.key === 'Shift' && bp.mode === 'peek') open('off'); });
  addEventListener('blur', () => { if (bp.mode === 'peek') open('off'); });
  chip.addEventListener('click', () => open(bp.mode === 'full' ? 'off' : 'full'));
  addEventListener('resize', () => {
    if (bp.mode === 'off') return;
    build();
    if (bp.mode === 'full') { [bp.x, bp.y] = chipCenter(); gsap.set(bp, { r: Math.hypot(innerWidth, innerHeight) * 1.05 }); }
  });
});

gsap.ticker.add(tick);
