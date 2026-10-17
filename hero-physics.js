// The hero headline as physical letters: grab one and drag or fling it, and it knocks into the
// others; every letter is on a spring to its place in the word, so they all settle back.
// Matter.js does the physics (only downloaded when someone first hovers the headline); the letters
// stay real text, moved with transforms. Desktop only, and never with reduced motion.
const KEY = 'mdl-grabbed';

export function initHeadline(h2) {
  // One span per letter, keeping the <br>s and the colored <em>
  h2.setAttribute('aria-label', h2.textContent.replace(/\s+/g, ' ').trim());
  const split = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const ch of child.textContent) {
          if (/\s/.test(ch)) { frag.append(ch); continue; }
          frag.append(Object.assign(document.createElement('span'), { className: 'ch', textContent: ch, ariaHidden: 'true' }));
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') split(child);
    }
  };
  split(h2);
  const chars = [...h2.querySelectorAll('.ch')];
  h2.classList.add('grabbable');
  const note = hint(h2, chars);

  let Matter = null, loading = null;
  const load = () => (loading ??= import('matter-js').then(m => (Matter = m.default || m)));
  h2.addEventListener('pointerenter', load, { once: true });

  let engine, bodies, homes, drag = null, raf = 0, still = 0, last = 0;

  // Bodies sized to each letter's box, at its place in the word; walls at the edges of the hero
  function build() {
    const { Engine, Bodies, Constraint, Composite, Events, Body } = Matter;
    const origin = h2.getBoundingClientRect();
    engine = Engine.create({ gravity: { x: 0, y: 0 } });
    homes = chars.map(c => {
      const r = c.getBoundingClientRect();
      return { x: r.left - origin.left + r.width / 2, y: r.top - origin.top + r.height / 2, w: r.width, h: r.height };
    });
    bodies = homes.map(h => Bodies.rectangle(h.x, h.y, h.w * 0.9, h.h * 0.7, { chamfer: { radius: Math.min(8, h.w * 0.12) }, frictionAir: 0.045, restitution: 0.35, friction: 0.1, density: 0.0016 }));
    const springs = bodies.map((b, i) => Constraint.create({ pointA: { x: homes[i].x, y: homes[i].y }, bodyB: b, length: 0, stiffness: 0.008, damping: 0.06 }));
    const hero = h2.closest('.hero').getBoundingClientRect(), bar = document.querySelector('.bar').getBoundingClientRect();
    const L = hero.left - origin.left, R = hero.right - origin.left, T = Math.max(hero.top, bar.bottom) - origin.top, B = Math.min(hero.bottom, innerHeight) - origin.top, t = 400;
    const walls = [
      Bodies.rectangle((L + R) / 2, T - t / 2, R - L + 2 * t, t, { isStatic: true }),
      Bodies.rectangle((L + R) / 2, B + t / 2, R - L + 2 * t, t, { isStatic: true }),
      Bodies.rectangle(L - t / 2, (T + B) / 2, t, B - T + 2 * t, { isStatic: true }),
      Bodies.rectangle(R + t / 2, (T + B) / 2, t, B - T + 2 * t, { isStatic: true }),
    ];
    Composite.add(engine.world, [...bodies, ...springs, ...walls]);
    // Letters also turn back upright
    Events.on(engine, 'beforeUpdate', () => {
      for (const b of bodies) if (b !== drag?.bodyB) Body.setAngularVelocity(b, b.angularVelocity * 0.9 - b.angle * 0.012);
    });
  }

  const local = e => { const r = h2.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function frame(now) {
    const dt = Math.min(1000 / 30, now - (last || now - 16.7));
    last = now;
    Matter.Engine.update(engine, dt);
    let moving = !!drag;
    bodies.forEach((b, i) => {
      const dx = b.position.x - homes[i].x, dy = b.position.y - homes[i].y;
      chars[i].style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) rotate(${b.angle.toFixed(4)}rad)`;
      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4 || Math.abs(b.angle) > 0.004 || b.speed > 0.05) moving = true;
    });
    // Once everything is home and still for a moment, snap exactly into place and stop
    still = moving ? 0 : still + 1;
    if (still > 20) {
      bodies.forEach((b, i) => {
        Matter.Body.setPosition(b, homes[i]); Matter.Body.setAngle(b, 0);
        Matter.Body.setVelocity(b, { x: 0, y: 0 }); Matter.Body.setAngularVelocity(b, 0);
      });
      chars.forEach(c => (c.style.transform = ''));
      h2.classList.remove('live');
      raf = 0; last = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  h2.addEventListener('pointerdown', async e => {
    const ch = e.target.closest('.ch');
    if (!ch || e.button !== 0) return;
    e.preventDefault();
    h2.setPointerCapture(e.pointerId);
    await load();
    // Measured fresh each time it starts from rest, so a resize or font swap can't misplace anything
    if (!raf) { engine && Matter.Engine.clear(engine); build(); }
    const body = bodies[chars.indexOf(ch)], p = local(e);
    const offset = Matter.Vector.rotate({ x: p.x - body.position.x, y: p.y - body.position.y }, -body.angle);
    if (drag) Matter.Composite.remove(engine.world, drag);
    drag = Matter.Constraint.create({ pointA: p, bodyB: body, pointB: offset, length: 0, stiffness: 0.2, damping: 0.1 });
    Matter.Composite.add(engine.world, drag);
    chars.forEach(c => c.classList.toggle('held', c === ch));
    h2.classList.add('live');
    if (!raf) raf = requestAnimationFrame(frame);
    if (note) { note.classList.remove('on'); try { localStorage.setItem(KEY, '1'); } catch (err) {} }
  });
  h2.addEventListener('pointermove', e => { if (drag) drag.pointA = local(e); });
  const release = () => {
    if (!drag) return;
    Matter.Composite.remove(engine.world, drag);
    drag = null;
    chars.forEach(c => c.classList.remove('held'));
  };
  h2.addEventListener('pointerup', release);
  h2.addEventListener('pointercancel', release);
  h2.addEventListener('lostpointercapture', release);
}

// A hand-drawn note beside "BY" (the short line has room to its right), shown until the first grab
function hint(h2, chars) {
  try { if (localStorage.getItem(KEY)) return null; } catch (e) {}
  const by = chars.find((c, i) => c.textContent === 'Y' && chars[i - 1]?.textContent === 'B');
  if (!by) return null;
  const note = document.createElement('div');
  note.className = 'grab-note';
  note.setAttribute('aria-hidden', 'true');
  note.innerHTML = '<svg viewBox="0 0 80 44"><path class="shaft" pathLength="1" d="M78 6C56 4 28 10 8 30"/><path class="head" pathLength="1" d="M5 18L8 30L20 29"/></svg><span><b>Go ahead, grab a letter</b><small class="mo">They spring back</small></span>';
  h2.parentElement.appendChild(note);
  const place = () => {
    const col = h2.parentElement.getBoundingClientRect(), r = by.getBoundingClientRect();
    note.style.left = `${r.right - col.left + 18}px`;
    note.style.top = `${r.top - col.top + r.height * 0.55}px`;
  };
  place();
  addEventListener('resize', place);
  requestAnimationFrame(() => note.classList.add('on'));
  return note;
}
