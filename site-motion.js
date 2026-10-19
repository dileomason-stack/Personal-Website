// Motion for the portfolio itself (everything after the intro): Lenis smooth scrolling driven by
// GSAP's ticker, and ScrollTrigger animation tied to it. Only transforms, opacity and clip-path
// are animated. Not loaded at all for prefers-reduced-motion, where the CSS reveals take over.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText.js';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
const root = document.documentElement;
const intro = document.getElementById('intro');
const finePointer = matchMedia('(pointer: fine)').matches;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
root.classList.add('motion');

// ---------- Smooth scroll ----------
const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -72 } });
window.siteLenis = lenis;
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
// Hold still behind the intro, then start from the top
if (!intro.classList.contains('done')) {
  lenis.stop();
  addEventListener('intro:done', () => {
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.start();
    ScrollTrigger.refresh();
    heroEntrance();
  }, { once: true });
}
(window.fontsReady || document.fonts.ready).then(() => ScrollTrigger.refresh());
$('#experience')?.addEventListener('toggle', () => ScrollTrigger.refresh());

// ---------- Nav: reading progress, and an ink pill that slides to the active section ----------
gsap.to('.bar-progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
const nav = $('.nav'), pill = $('.nav-pill');
function movePill() {
  const a = $('a.active', nav);
  if (!a) return gsap.to(pill, { opacity: 0, duration: 0.25 });
  if (gsap.getProperty(pill, 'opacity') < 0.05) gsap.set(pill, { x: a.offsetLeft, width: a.offsetWidth });
  gsap.to(pill, { x: a.offsetLeft, width: a.offsetWidth, opacity: 1, duration: 0.55, ease: 'power3.out' });
}
new MutationObserver(movePill).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });

// ---------- Hero: the copy drifts up slower than the page, the readout card lags and tilts ----------
const hero = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
gsap.to('.hero > div', { yPercent: -14, ease: 'none', scrollTrigger: hero });
// (wide screens only: on a phone the card sits mid-screen, where the tilt just looks crooked)
gsap.matchMedia().add('(min-width: 701px)', () => { gsap.to('.quick', { y: -70, rotate: -2, ease: 'none', scrollTrigger: hero }); });
gsap.to('.scroll-cue', { autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=140', scrub: true } });

// ---------- Hero entrance: one choreographed timeline, each piece arriving in its own way ----------
// Plays right after the intro (or on load for returning visitors). The grid draws outward, the
// eyebrow decodes, the headline's letters rise, the paragraph rises
// line by line, the buttons spring up, the readout card boots like an instrument, and the scroll
// cue arrives last.
function heroEntrance() {
  const hero = $('.hero'), eyebrow = $('.eyebrow', hero), h2 = $('h2', hero), lead = $('.lead', hero);
  const buttons = $$('.hero-actions .btn', hero), card = $('.quick'), rows = $$('dl > div', card), cue = $('.scroll-cue');
  const letters = SplitText.create(h2, { type: 'lines,chars', mask: 'lines' });
  const lines = SplitText.create(lead, { type: 'lines', mask: 'lines' });
  // Starting states go on before the hero is shown, so nothing is visible early for even a frame
  gsap.set(eyebrow, { autoAlpha: 0 });
  // The arrows have a CSS hover transition on transform, which would fight the tween (GSAP would read
  // a mid-transition value as their resting place), so it's off until they've arrived
  const arrows = buttons.map(b => $('.arr', b));
  gsap.set(arrows, { transition: 'none' });
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.fromTo(hero, { '--grid-size': '0%' }, { '--grid-size': '80%', duration: 2, ease: 'power2.out' }, 0)
    .add(() => decode(eyebrow, 0.9), 0.05)
    .from(letters.chars, { yPercent: 115, rotate: 6, transformOrigin: '0% 100%', duration: 1.1, stagger: 0.028 }, 0.15)
    .add(() => letters.revert(), 2.1)
    .from(lines.lines, { yPercent: 105, duration: 1, stagger: 0.08 }, 0.55)
    .add(() => lines.revert(), 1.8)
    .from(buttons, { y: 26, autoAlpha: 0, scale: 0.92, duration: 0.9, ease: 'back.out(1.8)', stagger: 0.08 }, 0.85)
    .from(arrows, { x: -8, y: 8, autoAlpha: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08, clearProps: 'transform,transition,opacity,visibility' }, 1.15)
    // The readout card wipes open from the right, then lights up row by row
    .fromTo(card, { clipPath: 'inset(0% 0% 0% 100% round 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 1.1, ease: 'expo.inOut' }, 0.45)
    .set(card, { clearProps: 'clipPath' })
    .from($('.status', card), { autoAlpha: 0, duration: 0.08, repeat: 4, yoyo: true, ease: 'none' }, 1.15)
    .fromTo(rows, { '--rule': 0 }, { '--rule': 1, duration: 0.7, ease: 'power2.inOut', stagger: 0.1 }, 1.05)
    .from(rows.flatMap(r => [...r.children]), { autoAlpha: 0, y: 6, duration: 0.45, ease: 'power2.out', stagger: 0.05 }, 1.15)
    .add(scrambleReadout, 1.2)
    .from(cue, { autoAlpha: 0, y: -12, duration: 0.8, ease: 'power3.out' }, 1.9);
  // Once the letters have landed, they become grabbable (desktop)
  if (finePointer) tl.add(() => import('./hero-physics.js').then(m => m.initHeadline(h2)), 2.2);
  root.classList.remove('hero-wait');
}

// Mono text types itself out, with a short run of scrambled characters ahead of what's settled
function decode(el, seconds) {
  const text = el.textContent, glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+';
  el.setAttribute('aria-label', text);
  gsap.set(el, { autoAlpha: 1 });
  const state = { p: 0 };
  gsap.to(state, {
    p: 1, duration: seconds, ease: 'power1.inOut',
    onUpdate: () => {
      const n = Math.floor(state.p * text.length);
      const ahead = text.slice(n, n + 7).replace(/[^ ]/g, () => glyphs[(Math.random() * glyphs.length) | 0]);
      el.textContent = text.slice(0, n) + ahead;
    },
    onComplete: () => { el.textContent = text; el.removeAttribute('aria-label'); },
  });
}

// The readout's numbers flicker through digits before settling, like an instrument powering on
function scrambleReadout() {
  $$('.quick dd').forEach((dd, i) => {
    const final = dd.textContent;
    let n = 0;
    setTimeout(() => {
      const id = setInterval(() => {
        dd.textContent = ++n > 10 ? final : final.replace(/\d/g, () => (Math.random() * 10) | 0);
        if (n > 10) clearInterval(id);
      }, 45);
    }, i * 110);
  });
}
if (root.classList.contains('hero-wait')) (window.fontsReady || document.fonts.ready).then(heroEntrance);

// ---------- Section headings: each line rises out of its own mask ----------
// On desktop the letters also react to the cursor: Manrope is a variable font, so letters near the
// pointer thin out (800 down to 300) like a lens passing over them, and fill back in behind it.
const lensed = [];
$$('.display').forEach(el => {
  let first = true;
  SplitText.create(el, {
    type: 'lines,chars', mask: 'lines', autoSplit: true,
    onSplit: self => {
      const entry = lensed.find(l => l.el === el) || (lensed.push({ el, chars: [] }), lensed.at(-1));
      entry.chars = self.chars.map(c => ({ c, w: 800 }));
      if (!first) return;
      first = false;
      return gsap.from(self.lines, {
        yPercent: 115, duration: 1.15, ease: 'expo.out', stagger: 0.09,
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    },
  });
});
if (finePointer) {
  const R = 150, MIN = 300, MAX = 800;
  let px = -1e4, py = -1e4, raf = 0;
  const step = () => {
    raf = 0;
    let moving = false;
    for (const { el, chars } of lensed) {
      const box = el.getBoundingClientRect();
      const near = px > box.left - R && px < box.right + R && py > box.top - R && py < box.bottom + R;
      for (const ch of chars) {
        let target = MAX;
        if (near) {
          const r = ch.c.getBoundingClientRect(), d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
          if (d < R) target = MAX - (MAX - MIN) * (1 - d / R) ** 2;
        }
        const w = ch.w + (target - ch.w) * 0.18;
        if (Math.abs(w - ch.w) > 0.5) { ch.w = w; ch.c.style.fontWeight = Math.round(w); moving = true; }
        else if (ch.w !== target) { ch.w = target; ch.c.style.fontWeight = target === MAX ? '' : target; }
      }
    }
    if (moving) raf = requestAnimationFrame(step);
  };
  addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(step); }, { passive: true });
  // Scrolling moves the letters under a still cursor too
  lenis.on('scroll', () => { if (px > -1e4 && !raf) raf = requestAnimationFrame(step); });
  document.addEventListener('pointerleave', () => { px = py = -1e4; if (!raf) raf = requestAnimationFrame(step); });
}
// The short rule before each section number draws itself in
ScrollTrigger.batch('.num', { start: 'top 92%', once: true, onEnter: batch => batch.forEach(n => n.classList.add('drawn')) });

// ---------- Everything else marked .reveal: rise and fade in, staggered as they arrive together ----------
const special = '.hero .reveal, .feature, .proj, .gallery-wrap';
const generic = $$('.reveal').filter(el => !el.matches(special));
gsap.set(generic, { autoAlpha: 0, y: 40 });
ScrollTrigger.batch(generic, {
  start: 'top 88%', once: true,
  onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1, overwrite: true }),
});
const pills = $$('.pill').filter(p => !p.closest('.hero'));
gsap.set(pills, { autoAlpha: 0, y: 12 });
ScrollTrigger.batch(pills, {
  start: 'top 94%', once: true,
  onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.035, overwrite: true }),
});

// ---------- Work: the dark panel opens out to full width as it arrives ----------
gsap.fromTo('.work', { clipPath: 'inset(0% 3.5% 0% 3.5% round 36px)' }, {
  clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
  scrollTrigger: { trigger: '.work', start: 'top bottom', end: 'top 20%', scrub: true },
});

// ---------- Hold This Thought: the card rises in; on desktop the phone tilts toward the cursor ----------
// (the step tabs themselves live in the page script, so they work without this file)
const showcase = $('.showcase'), phone = $('.phone-tilt'), phone3d = $('.phone-3d'), glare = $('.phone-glare');
gsap.from(showcase, { y: 70, autoAlpha: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: showcase, start: 'top 85%', once: true } });
// The phone arrives turned away (its back and edge showing) and turns to face you as the section scrolls in,
// the light sliding across its glass as it goes
// (On phones the phone sits at the top of the section, so it finishes turning by mid-screen)
const narrowPhone = innerWidth <= 900;
gsap.fromTo(phone3d, { rotationY: narrowPhone ? -130 : -160, y: 50 }, {
  rotationY: 0, y: 0, ease: 'none',
  scrollTrigger: { trigger: phone3d, start: narrowPhone ? 'top 100%' : 'top 95%', end: narrowPhone ? 'top 45%' : 'top 20%', scrub: 0.8, onUpdate: st => glare.style.setProperty('--glare', `${100 - st.progress * 100}%`) },
});
if (finePointer) {
  const tiltY = gsap.quickTo(phone, 'rotateY', { duration: 0.8, ease: 'power3' }), tiltX = gsap.quickTo(phone, 'rotateX', { duration: 0.8, ease: 'power3' });
  showcase.addEventListener('pointermove', e => {
    const r = showcase.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    tiltY(x * 18); tiltX(-y * 10);
    glare.style.setProperty('--glare', `${50 - x * 60}%`);
  });
  showcase.addEventListener('pointerleave', () => { tiltY(-6); tiltX(3); });
}

// ---------- Projects: the card lands, its screen wipes open, the copy follows ----------
$$('.proj').forEach(card => {
  const shot = $('.shot', card), media = $('video, img', shot);
  card.style.transition = 'none';
  gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 82%', once: true }, onComplete: () => { card.style.transition = ''; } })
    .from(card, { y: 80, autoAlpha: 0, duration: 1.1, ease: 'power3.out' })
    .from(shot, { clipPath: 'inset(100% 0% 0% 0% round 14px)', duration: 1.3, ease: 'expo.out' }, 0.15)
    .from($('.proj-body', card).children, { y: 26, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.07 }, 0.3);
  if (media) gsap.fromTo(media, { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'center center', scrub: true } });
});

// ---------- Education: the logo for whichever school card is in view lights up (desktop, where it's sticky) ----------
gsap.matchMedia().add('(min-width: 901px)', () => {
  const marks = $('.marks'), logos = $$('.mark', marks);
  marks.classList.add('linked');
  const light = i => logos.forEach((m, k) => m.classList.toggle('on', k === i));
  const cards = $$('.school');
  // The card whose middle is closest to the middle of the window is the one being read
  const pick = () => {
    const mid = innerHeight / 2;
    const dist = cards.map(c => { const r = c.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - mid); });
    light(dist.indexOf(Math.min(...dist)));
  };
  const st = ScrollTrigger.create({ trigger: '.education', start: 'top bottom', end: 'bottom top', onUpdate: pick, onRefresh: pick });
  return () => { st.kill(); marks.classList.remove('linked'); logos.forEach(m => m.classList.remove('on')); };
});

// ---------- Galleries: settle up to full size as they come into view ----------
$$('.gallery-wrap').forEach(g => {
  gsap.fromTo(g, { scale: 0.9, y: 60 }, { scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: 'top 35%', scrub: true } });
});


// ---------- Buttons lean toward the cursor, then spring back ----------
if (finePointer) {
  $$('.btn').forEach(b => {
    const toX = gsap.quickTo(b, 'x', { duration: 0.45, ease: 'power3' }), toY = gsap.quickTo(b, 'y', { duration: 0.45, ease: 'power3' });
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      toX((e.clientX - r.left - r.width / 2) * 0.25);
      toY((e.clientY - r.top - r.height / 2) * 0.4);
    });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }));
  });
}
