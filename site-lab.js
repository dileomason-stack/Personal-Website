// Three small experiments layered on the site (loaded by site-motion.js, so not for reduced motion):
//  1. Blueprint lens: hold Shift (or tap the Blueprint chip) and the cursor becomes a lens that
//     X-rays the page, showing each element's box, type settings and size, read live from the CSS.
//  2. Flashlight: with the lights off (Night theme), the cursor carries the intro's flashlight.
//  3. Speed blur: the car photos streak with motion blur and a slight color split as you scroll
//     fast, like a long exposure of a moving car, and snap sharp when you stop.
import { gsap } from 'gsap';

const root = document.documentElement;
const intro = document.getElementById('intro');
const finePointer = matchMedia('(pointer: fine)').matches;
const ready = fn => (intro.classList.contains('done') ? fn() : addEventListener('intro:done', fn, { once: true }));
let px = innerWidth / 2, py = innerHeight / 2, pointerIn = false;
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; pointerIn = true; }, { passive: true });
document.addEventListener('pointerleave', () => { pointerIn = false; });

// ---------- 1. Blueprint lens ----------
const NOTED = ['.bar', '.eyebrow', '.hero h2', '.lead', '.hero-actions .btn', '.quick', '.display', '.num', '.feature h4',
  '.phone-frame', '.sc-step', '.proj', '.proj h4', '.school', '.mark', '.details h4', '.looking', '.gallery', '.contact h3',
  '.contact .btn', 'footer'].join(',');
const TEXTY = /^(H1|H2|H3|H4|P|A|BUTTON|DD|SPAN|B)$/;
// State and helper classes that say nothing about what an element is
const UTILITY = new Set(['reveal', 'in', 'd1', 'd2', 'd3', 'mo', 'is-active', 'drawn', 'on', 'active', 'ghost']);

const lens = Object.assign(document.createElement('div'), { className: 'bp', ariaHidden: 'true' });
lens.innerHTML = '<div class="bp-notes"></div>';
const ring = Object.assign(document.createElement('div'), { className: 'bp-ring', ariaHidden: 'true' });
ring.innerHTML = '<span>Blueprint</span><b></b>';
const readout = ring.querySelector('b');
const chip = Object.assign(document.createElement('button'), { className: 'bp-chip', type: 'button' });
chip.setAttribute('aria-pressed', 'false');
chip.innerHTML = finePointer ? 'Blueprint <kbd>hold ⇧</kbd>' : 'Blueprint';
document.body.append(lens, ring, chip);
const notesEl = lens.firstChild;

const bp = { r: 0, open: false, pinned: false, x: px, y: py };
const R = () => (finePointer ? 170 : Math.hypot(innerWidth, innerHeight));
let notes = [];

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

function buildNotes() {
  notesEl.textContent = '';
  notes = [...document.querySelectorAll(NOTED)].filter(el => el.offsetParent !== null || el.tagName === 'FOOTER').map(el => {
    const d = describe(el), n = document.createElement('div');
    n.className = 'bp-note';
    n.innerHTML = `<i>${d.name}</i><em>${d.dims}</em><small>${d.spec}</small>`;
    notesEl.append(n);
    return { el, n };
  });
}

function placeNotes() {
  for (const { el, n } of notes) {
    const r = el.getBoundingClientRect();
    const show = r.bottom > -40 && r.top < innerHeight + 40 && r.width > 0;
    n.style.display = show ? '' : 'none';
    if (!show) continue;
    n.style.left = r.left + 'px';
    n.style.top = r.top + 'px';
    n.style.width = r.width + 'px';
    n.style.height = r.height + 'px';
  }
}

function setOpen(open) {
  if (open === bp.open) return;
  bp.open = open;
  if (open) { buildNotes(); bp.x = px; bp.y = py; }
  root.classList.toggle('bp-on', open);
  gsap.to(bp, { r: open ? R() : 0, duration: open ? 0.45 : 0.3, ease: open ? 'expo.out' : 'power2.in' });
}

// The element under the lens's center, described in the readout under the ring
let underLens = null;
function readUnder() {
  const hit = document.elementsFromPoint(bp.x, bp.y).find(el => !el.closest('.bp, .bp-ring, .torch') && el.closest(NOTED));
  const el = hit && hit.closest(NOTED);
  if (el === underLens) return;
  underLens = el;
  if (!el) { readout.textContent = ''; return; }
  const d = describe(el);
  readout.innerHTML = `<i>${d.name}</i> ${d.spec} · ${d.dims}`;
}

let lensShown = false;
function tickLens() {
  if (bp.r < 0.5 && !bp.open) {
    // Closed: clear everything once, then stay idle
    if (lensShown) {
      lensShown = false;
      lens.style.clipPath = 'circle(0px at 0 0)';
      ring.style.opacity = '0';
      readout.textContent = '';
      underLens = null;
    }
    return;
  }
  lensShown = true;
  const k = finePointer ? 0.35 : 1;
  bp.x += ((finePointer ? px : innerWidth / 2) - bp.x) * k;
  bp.y += ((finePointer ? py : innerHeight / 2) - bp.y) * k;
  lens.style.clipPath = `circle(${bp.r.toFixed(1)}px at ${bp.x.toFixed(1)}px ${bp.y.toFixed(1)}px)`;
  ring.style.cssText = `width:${bp.r * 2}px;height:${bp.r * 2}px;transform:translate(${bp.x - bp.r}px,${bp.y - bp.r}px);opacity:${finePointer && bp.r > 4 ? 1 : 0}`;
  placeNotes();
  if (finePointer) readUnder();
}

ready(() => {
  root.classList.add('bp-ready');
  addEventListener('keydown', e => { if (e.key === 'Shift' && !e.repeat) setOpen(true); });
  addEventListener('keyup', e => { if (e.key === 'Shift' && !bp.pinned) setOpen(false); });
  addEventListener('blur', () => { if (!bp.pinned) setOpen(false); });
  chip.addEventListener('click', () => {
    bp.pinned = !bp.pinned;
    chip.setAttribute('aria-pressed', String(bp.pinned));
    setOpen(bp.pinned);
  });
  addEventListener('resize', () => { if (bp.open) { buildNotes(); gsap.set(bp, { r: R() }); } });
});

// ---------- 2. Flashlight in the dark theme ----------
const torch = Object.assign(document.createElement('div'), { className: 'torch', ariaHidden: 'true' });
document.body.append(torch);
const tp = { x: px, y: py, a: 0 };
function tickTorch() {
  const dark = root.dataset.theme === 'night' && finePointer;
  tp.a += ((dark && pointerIn ? 1 : 0) - tp.a) * 0.08;
  if (tp.a < 0.01 && !dark) { torch.style.opacity = '0'; return; }
  tp.x += (px - tp.x) * 0.18;
  tp.y += (py - tp.y) * 0.18;
  torch.style.opacity = tp.a.toFixed(3);
  torch.style.setProperty('--tx', tp.x.toFixed(1) + 'px');
  torch.style.setProperty('--ty', tp.y.toFixed(1) + 'px');
}

// ---------- 3. Speed blur on the car photos ----------
const NS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('aria-hidden', 'true');
svg.style.cssText = 'position:absolute;width:0;height:0';
// Blur along the scroll direction only, then pull the red and blue channels apart a little
svg.innerHTML = `<filter id="speed" x="-5%" y="-15%" width="110%" height="130%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceGraphic" stdDeviation="0 0" result="b"/>
  <feColorMatrix in="b" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>
  <feOffset in="r" dy="0" result="ro"/>
  <feColorMatrix in="b" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
  <feColorMatrix in="b" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="bl"/>
  <feOffset in="bl" dy="0" result="bo"/>
  <feBlend in="ro" in2="g" mode="screen" result="rg"/>
  <feBlend in="rg" in2="bo" mode="screen"/>
</filter>`;
document.body.append(svg);
const [blurEl, , redOff, , , blueOff] = svg.querySelectorAll('feGaussianBlur, feColorMatrix, feOffset');
const carGallery = document.querySelector('#cars .gallery-wrap');
const speed = { v: 0, on: false };
function tickSpeed() {
  if (!finePointer || !carGallery || !window.siteLenis) return;
  const r = carGallery.getBoundingClientRect();
  const visible = r.bottom > 0 && r.top < innerHeight;
  const target = visible ? Math.min(22, Math.abs(window.siteLenis.velocity) * 0.9) : 0;
  speed.v += (target - speed.v) * 0.25;
  const on = speed.v > 0.4;
  if (on !== speed.on) {
    speed.on = on;
    carGallery.classList.toggle('speeding', on);
  }
  if (!on) return;
  const dir = Math.sign(window.siteLenis.velocity) || 1;
  blurEl.setAttribute('stdDeviation', `0 ${speed.v.toFixed(2)}`);
  redOff.setAttribute('dy', (-dir * speed.v * 0.35).toFixed(2));
  blueOff.setAttribute('dy', (dir * speed.v * 0.35).toFixed(2));
}

gsap.ticker.add(() => { tickLens(); tickTorch(); tickSpeed(); });
