// The smart cursor (desktop, with a mouse, motion allowed): the pointer becomes a small accent dot
// that grows into a labeled pill over the things you can play with, so visitors can tell what's
// interactive without any instructions. Plain links and buttons get a ring; text fields keep the
// normal text cursor. site-live.js loads it only where it applies.
const LABELS = [
  ['.grabbable .ch', () => 'Drag'],
  ['.pol:last-child', () => 'Drag'],
  ['video.demo', v => (v.paused ? 'Play' : 'Pause')],
  ['.case-open', () => 'Open'],
  ['.room-switch, .switch', () => 'Flip'],
  ['.room-ball', () => 'Knock'],
  ['a[target="_blank"]', () => 'Visit'],
];
const TEXT = 'input, textarea, select, [contenteditable="true"]';
const CLICKABLE = 'a, button, summary, label, [role="button"]';

export function init() {
  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  dot.innerHTML = '<span></span>';
  const label = dot.firstChild;
  document.body.append(dot);
  document.documentElement.classList.add('smart-cursor');

  let x = -100, y = -100, cx = x, cy = y, raf = 0, held = false, over = null;
  const frame = () => {
    raf = 0;
    // Close to the real pointer (so clicking stays precise), with just a little follow-through
    cx += (x - cx) * 0.5; cy += (y - cy) * 0.5;
    dot.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
    if (Math.abs(x - cx) + Math.abs(y - cy) > 0.2) raf = requestAnimationFrame(frame);
  };
  const look = el => {
    if (held) return; // keep the label while dragging, even if the letter or photo slips out from under it
    over = el;
    if (!el || el.closest(TEXT)) return set('hide');
    for (const [sel, text] of LABELS) { const hit = el.closest(sel); if (hit) return set('label', text(hit)); }
    set(el.closest(CLICKABLE) ? 'ring' : '');
  };
  const set = (mode, text = '') => {
    dot.dataset.mode = mode;
    if (text) label.textContent = text;
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    dot.classList.add('on');
    if (e.target !== over) look(e.target);
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { held = dot.dataset.mode === 'label'; dot.classList.add('down'); } });
  addEventListener('pointerup', e => { held = false; dot.classList.remove('down'); look(document.elementFromPoint(e.clientX, e.clientY)); });
  document.addEventListener('mouseleave', () => dot.classList.remove('on'));
  // A video's label flips between Play and Pause
  document.addEventListener('play', () => look(over), true);
  document.addEventListener('pause', () => look(over), true);
}
