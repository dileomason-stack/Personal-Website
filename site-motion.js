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
    scrambleReadout();
  }, { once: true });
}
document.fonts.ready.then(() => ScrollTrigger.refresh());
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
gsap.to('.quick', { y: -70, rotate: -2, ease: 'none', scrollTrigger: hero });
gsap.to('.scroll-cue', { autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=140', scrub: true } });

// The readout's numbers flicker through digits before settling, like an instrument powering on
function scrambleReadout() {
  $$('.quick dd').forEach((dd, i) => {
    const final = dd.textContent;
    let n = 0;
    setTimeout(() => {
      const id = setInterval(() => {
        dd.textContent = ++n > 12 ? final : final.replace(/\d/g, () => (Math.random() * 10) | 0);
        if (n > 12) clearInterval(id);
      }, 45);
    }, 500 + i * 120);
  });
}
if (intro.classList.contains('done')) scrambleReadout();

// ---------- Section headings: each line rises out of its own mask ----------
$$('.display').forEach(el => {
  SplitText.create(el, {
    type: 'lines', mask: 'lines', autoSplit: true,
    onSplit: self => gsap.from(self.lines, {
      yPercent: 115, duration: 1.15, ease: 'expo.out', stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
    }),
  });
});
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
const showcase = $('.showcase'), phone = $('.phone-frame');
gsap.from(showcase, { y: 70, autoAlpha: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: showcase, start: 'top 85%', once: true } });
if (finePointer) {
  const tiltY = gsap.quickTo(phone, 'rotateY', { duration: 0.8, ease: 'power3' }), tiltX = gsap.quickTo(phone, 'rotateX', { duration: 0.8, ease: 'power3' });
  showcase.addEventListener('pointermove', e => {
    const r = showcase.getBoundingClientRect();
    tiltY(((e.clientX - r.left) / r.width - 0.5) * 18);
    tiltX(-((e.clientY - r.top) / r.height - 0.5) * 10);
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

// ---------- Galleries: settle up to full size as they come into view ----------
$$('.gallery-wrap').forEach(g => {
  gsap.fromTo(g, { scale: 0.9, y: 60 }, { scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: 'top 35%', scrub: true } });
});

// ---------- Contact: the headline fills in letter by letter as you scroll to it ----------
const ask = $('.contact h3');
if (ask) {
  const split = SplitText.create(ask, { type: 'words,chars' });
  gsap.fromTo(split.chars, { opacity: 0.12 }, {
    opacity: 1, ease: 'none', stagger: 0.06,
    scrollTrigger: { trigger: ask, start: 'top 85%', end: 'top 35%', scrub: true },
  });
}

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
