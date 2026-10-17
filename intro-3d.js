// 3D "lights off" intro: a dark room lit by a flashlight that follows the cursor.
// Flipping the switch flickers the bulb on, floods the room, and flies the camera into the
// laptop screen, which by then is showing a snapshot of the real homepage, so the camera lands
// on the site itself (a match cut). Objects in the room are links. If WebGL fails or the GPU
// is lost, the CSS intro takes over.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { buildRoom } from './intro-room.js';
import { INSTALL_AT } from './intro-terminal.js';
import { SplitText } from 'gsap/SplitText.js';
import { createSound } from './intro-sound.js';

const root = document.documentElement;
const intro = document.getElementById('intro');
const sw = document.getElementById('switch');

if (!root.classList.contains('intro-3d-pending') || intro.classList.contains('on') || intro.classList.contains('done')) {
  root.classList.remove('intro-3d-pending');
} else {
  try { start(); } catch (err) {
    console.error('3D intro failed, using the CSS one', err);
    root.classList.remove('intro-3d-pending', 'intro-3d');
  }
}

function start() {
  // Set first so the switch is already in its 3D-mode spot when layout() measures it
  root.classList.add('intro-3d');
  gsap.registerPlugin(SplitText);
  const copy = intro.querySelector('.intro-copy');
  const lit = [...intro.querySelectorAll('.lit')];
  const switchbox = intro.querySelector('.switchbox');
  const label = intro.querySelector('.switch-label');
  const note = intro.querySelector('.intro-note');
  const sound = createSound(intro.querySelector('.intro-sound'));

  // ---------- Renderer ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070a0a');
  const FOV = 45;
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 100);
  const CAM = new THREE.Vector3(0, 0.2, 7);

  // ---------- Wall ----------
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40),
    new THREE.MeshStandardMaterial({ map: paintTexture(renderer), bumpMap: plasterTexture(), bumpScale: 0.35, roughness: 0.92 })
  );
  wall.receiveShadow = true;
  scene.add(wall);
  // A soft studio environment for reflections on the laptop, phone and screws; it brightens with the room
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0;
  const room = buildRoom(scene, renderer);

  // ---------- Light switch ----------
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf1ebdd, roughness: 0.42 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xcfc8b6, roughness: 0.35, metalness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3b3833, roughness: 0.6 });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x1a1d12, emissive: 0xd8f07a, emissiveIntensity: 0 });

  const sw3 = new THREE.Group();
  const plate = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.64, 1, 0.07, 4, 0.035), plateMat));
  plate.position.z = 0.035;
  const recess = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.36, 0.02, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0xb7ae9b, roughness: 0.6 }));
  recess.position.z = 0.066;
  const leverPivot = new THREE.Group();
  leverPivot.position.z = 0.07;
  const lever = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.11, 0.26, 3, 0.035), plateMat));
  lever.position.z = 0.11;
  leverPivot.add(lever);
  const OFF = 0.5, ON = -0.5;
  leverPivot.rotation.x = OFF;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), ledMat);
  led.position.set(0, -0.27, 0.07);
  sw3.add(plate, recess, leverPivot, led);
  for (const y of [0.38, -0.38]) {
    const screw = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 20), metalMat));
    screw.rotation.x = Math.PI / 2;
    screw.position.set(0, y, 0.074);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.008, 0.004), darkMat);
    slot.position.set(0, y, 0.081);
    slot.rotation.z = 0.6 + y;
    sw3.add(screw, slot);
  }
  scene.add(sw3);

  // ---------- Hanging bulb ----------
  const CORD = 4;
  const pendant = new THREE.Group();
  const cord = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, CORD, 8), darkMat));
  cord.position.y = -CORD / 2;
  const socket = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x23211e, roughness: 0.3, metalness: 0.8 })));
  socket.position.y = -CORD - 0.1;
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.12, transparent: true, opacity: 0.6, emissive: 0xffc98a, emissiveIntensity: 0 });
  const bulb = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 24), bulbMat));
  bulb.scale.y = 1.12;
  bulb.position.y = -CORD - 0.34;
  const filamentMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa040, emissiveIntensity: 0 });
  const filament = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 8, 24), filamentMat);
  filament.position.y = bulb.position.y;
  const bulbLight = new THREE.PointLight(0xffd7a0, 0, 0, 2);
  bulbLight.position.y = bulb.position.y - 0.25;
  bulbLight.castShadow = true;
  bulbLight.shadow.mapSize.set(512, 512);
  bulbLight.shadow.bias = -0.002;
  bulbLight.shadow.radius = 4;
  pendant.add(cord, socket, bulb, filament, bulbLight);
  scene.add(pendant);

  // ---------- Lights ----------
  const ambient = new THREE.AmbientLight(0xfff6e8, 0);
  const hemi = new THREE.HemisphereLight(0xfff3dc, 0x2a2622, 0);
  const torch = new THREE.SpotLight(0xfff1d6, 0, 0, 0.21, 0.55, 1.6);
  torch.position.set(0.5, 0.9, 6.6);
  torch.castShadow = true;
  torch.shadow.mapSize.set(1024, 1024);
  torch.shadow.bias = -0.0004;
  torch.shadow.camera.near = 1;
  torch.shadow.camera.far = 12;
  scene.add(ambient, hemi, torch, torch.target);

  // ---------- Dust in the flashlight beam ----------
  const N = 700;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 7;
    pos[i * 3 + 2] = 0.3 + Math.random() * 5.2;
    seed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uPower: { value: 0 }, uPR: { value: renderer.getPixelRatio() },
      uOrigin: { value: torch.position }, uDir: { value: new THREE.Vector3(0, 0, -1) }, uCos: { value: Math.cos(torch.angle) },
    },
    vertexShader: `
      attribute float seed;
      uniform float uTime, uPower, uPR, uCos;
      uniform vec3 uOrigin, uDir;
      varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * .15 + seed * 6.28) * .25;
        p.y += sin(uTime * .11 + seed * 12.) * .3 + cos(uTime * .07 + seed * 3.) * .15;
        p.z += cos(uTime * .13 + seed * 9.) * .2;
        float beam = smoothstep(uCos, uCos + .03, dot(normalize(p - uOrigin), uDir));
        vA = beam * uPower * (.35 + .65 * fract(seed * 7.3));
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = (1.2 + 2.2 * fract(seed * 3.1)) * uPR * (4. / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float a = smoothstep(.5, 0., length(gl_PointCoord - .5)) * vA;
        gl_FragColor = vec4(1., .95, .85, a);
      }`,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // ---------- Post ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 1.3);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // Film finish: warm shadows, a gentle S-curve, vignette and grain. Fades out for the match cut.
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime, uAmount;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec3 g = c.rgb;
        float l = dot(g, vec3(.299, .587, .114));
        g += mix(vec3(.02, .009, -.006), vec3(-.006, 0., .008), smoothstep(.2, .8, l));
        g = mix(g, g * g * (3. - 2. * g), .16);
        g *= mix(1., smoothstep(1.2, .35, length(vUv - .5) * 1.3), .5);
        g += (hash(gl_FragCoord.xy + fract(uTime * 13.) * 91.) - .5) * .04;
        gl_FragColor = vec4(mix(c.rgb, g, uAmount), c.a);
      }`,
  });
  composer.addPass(grade);

  // ---------- Layout: the 3D switch sits exactly under the real <button> ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function screenToPlane(x, y, z, out) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -z;
    return ray.ray.intersectPlane(plane, out);
  }
  let pxPerUnit = 1;
  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.position.copy(CAM);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    pxPerUnit = h / (2 * CAM.z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    // The desk keeps clear of the headline. The switch sits on the wall beside the laptop, or on
    // phones between the headline and the laptop, where the desk leaves room for the whole
    // switch block (switch and label) so the label never lands on the screen.
    const copyBottom = copy.getBoundingClientRect().bottom, boxH = switchbox.offsetHeight;
    const roomArgs = { screenToPlane, toScreen, w, h, pxPerUnit, topLimit: copyBottom + 28 };
    room.layout(roomArgs);
    const spot = room.switchSpot, stacked = spot.stacked;
    if (stacked) room.layout({ ...roomArgs, topLimit: copyBottom + boxH + 56 });
    switchbox.style.setProperty('--swx', (stacked ? w / 2 : spot.x) + 'px');
    const boxTop = stacked ? copyBottom + Math.max(16, (spot.lidTop - copyBottom - boxH) / 2) : spot.y - sw.offsetHeight / 2;
    switchbox.style.setProperty('--swy', boxTop + 'px');
    const r = sw.getBoundingClientRect();
    const c = screenToPlane(r.left + r.width / 2, r.top + r.height / 2, 0, new THREE.Vector3());
    const top = screenToPlane(r.left + r.width / 2, r.top, 0, new THREE.Vector3());
    sw3.position.copy(c);
    sw3.scale.setScalar((top.y - c.y) * 2 * 0.92);
    const b = screenToPlane(w / 2, h * 0.11, 1.2, new THREE.Vector3());
    pendant.position.set(b.x, b.y + CORD + 0.34, 1.2);
  }
  function toScreen(world) {
    const p = world.clone().project(camera);
    return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
  }
  layout();
  addEventListener('resize', layout);
  addEventListener('resize', () => { litRects = null; });

  // ---------- Pointer ----------
  let pointerSeen = false, px = innerWidth / 2, py = innerHeight * 0.4;
  intro.addEventListener('pointermove', e => { pointerSeen = true; px = e.clientX; py = e.clientY; });
  intro.addEventListener('pointerdown', e => { pointerSeen = true; px = e.clientX; py = e.clientY; });
  intro.addEventListener('pointerleave', () => { pointerSeen = false; });
  let hovered = null, destination = null;
  const hotspots = room.hotspots.map(h => h.obj);
  function pick(x, y) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hotspots, true)[0];
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) {
      const h = room.hotspots.find(h => h.obj === o);
      if (h) return h;
    }
    return null;
  }
  // The note sits on whichever side of the object has room, preferring the object's own side
  const noteEdge = new THREE.Vector3();
  let noteFor = null, noteSide = 1, noteWidth = 0;
  function edgeOnScreen(e) { return toScreen(e.obj.localToWorld(noteEdge.copy(e.at))); }
  function showNote(h) {
    note.classList.remove('on');
    noteFor = h;
    if (!h) return;
    note.querySelector('b').textContent = h.title;
    note.querySelector('small').textContent = h.sub + ' →';
    noteWidth = note.querySelector('.intro-note-text').offsetWidth + 92;
    const left = edgeOnScreen(h.edges[0]).x, right = edgeOnScreen(h.edges[1]).x;
    const roomR = innerWidth - right, roomL = left;
    let side = h.prefer || ((left + right) / 2 < innerWidth / 2 ? 1 : -1);
    if (side > 0 && roomR < noteWidth && roomL > roomR) side = -1;
    else if (side < 0 && roomL < noteWidth && roomR > roomL) side = 1;
    noteSide = side;
    note.classList.toggle('left', side < 0);
    placeNote();
    void note.offsetWidth; // restart the draw-in animation
    note.classList.add('on');
  }
  function placeNote() {
    if (!noteFor) return;
    const p = edgeOnScreen(noteFor.edges[noteSide < 0 ? 0 : 1]);
    note.style.left = p.x.toFixed(1) + 'px';
    note.style.top = p.y.toFixed(1) + 'px';
    // If even the roomier side is too tight, slide the words back inside the window
    const over = noteSide > 0 ? p.x + noteWidth - (innerWidth - 12) : 12 - (p.x - noteWidth);
    note.style.setProperty('--nudge', (over > 0 ? -noteSide * over : 0).toFixed(1) + 'px');
  }

  // Clicking an object flips the lights like the switch does, then lands on that part of the site
  intro.addEventListener('click', e => {
    if (entered || e.target.closest('button')) return;
    const h = pick(e.clientX, e.clientY);
    if (!h) return;
    destination = h.target;
    sw.click();
  });

  // ---------- Animated state ----------
  const S = { bulb: 0, room: 0, torch: 0, swing: 0.035, led: 1, fly: 0, paper: 0 };
  let entered = false, litRects = null;
  // The match cut: a snapshot of the homepage, and how much of the laptop screen the window shows at the end
  const snap = { image: null, frac: null, texture: null };
  // The coding session on the laptop runs in real time until the switch is flipped
  const session = { t: 0, auto: true };
  const flight = { curve: null, lookFrom: new THREE.Vector3(), lookTo: new THREE.Vector3() };
  const shake = new THREE.Vector3(), par = new THREE.Vector2(), look = new THREE.Vector3();
  const aim = new THREE.Vector3(0, 0.6, 0), aimTarget = new THREE.Vector3(), proj = new THREE.Vector3();
  gsap.to(S, { torch: 1, duration: 1.8, delay: 0.5, ease: 'power2.inOut' });

  const clock = new THREE.Clock();
  let running = true;
  // Adaptive quality: if the first seconds run under ~45fps, step down resolution, then shadows and bloom
  const perf = { frames: 0, time: 0, level: 0 };
  function degrade() {
    perf.level++;
    const pr = perf.level === 1 ? Math.min(devicePixelRatio, 1.25) : 1;
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    dustMat.uniforms.uPR.value = pr;
    bulbLight.castShadow = false;
    if (perf.level === 2) { torch.castShadow = false; bloom.enabled = false; }
    layout();
  }
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
    if (perf.level < 2 && !entered && clock.elapsedTime > 1.5 && !document.hidden) {
      perf.frames++;
      perf.time += raw;
      if (perf.frames === 60) {
        if (perf.frames / perf.time < 45) degrade();
        perf.frames = perf.time = 0;
      }
    }
    // On the slowest devices, draw every other frame (30fps) to leave the main thread some room
    if (perf.level === 2 && (skipFrame = !skipFrame)) return;
    draw(dt, clock.elapsedTime);
  }
  let skipFrame = false;
  function draw(dt, t) {
    const k = 1 - Math.exp(-dt * 5);

    // Camera: gentle parallax, then the flight into the laptop screen
    const mx = pointerSeen ? px / innerWidth - 0.5 : Math.sin(t * 0.3) * 0.15;
    const my = pointerSeen ? py / innerHeight - 0.5 : 0;
    par.x += (mx * 0.3 - par.x) * k;
    par.y += (-my * 0.18 - par.y) * k;
    if (S.fly > 0 && !flight.curve) planFlight();
    if (flight.curve) {
      flight.curve.getPoint(S.fly, camera.position).add(shake);
      look.lerpVectors(flight.lookFrom, flight.lookTo, 1 - (1 - S.fly) ** 3);
    } else {
      camera.position.set(CAM.x + par.x, CAM.y + par.y, CAM.z).add(shake);
      look.set(0, 0, 0);
    }
    camera.lookAt(look);
    camera.updateMatrixWorld();

    // Room objects under the cursor get a note pinned beside them, and act as links
    if (pointerSeen && !entered) {
      const h = pick(px, py);
      if (h !== hovered) {
        hovered = h;
        showNote(h);
        intro.style.cursor = h ? 'pointer' : '';
      }
    }
    placeNote();

    // Flashlight follows the cursor, or wanders around the headline
    if (pointerSeen) screenToPlane(px, py, 0, aimTarget);
    else aimTarget.set(Math.sin(t * 0.45) * 1.8, 0.55 + Math.sin(t * 0.7) * 0.5, 0);
    aim.lerp(aimTarget, 1 - Math.exp(-dt * 7));
    torch.position.set(0.5 + aim.x * 0.15, 0.9 + aim.y * 0.1, 6.6);
    torch.target.position.copy(aim);
    dustMat.uniforms.uDir.value.subVectors(aim, torch.position).normalize();

    // Light the HTML headline in the same spot
    proj.copy(aim).project(camera);
    const sx = (proj.x + 1) / 2 * innerWidth, sy = (1 - proj.y) / 2 * innerHeight;
    const radius = Math.tan(torch.angle) * torch.position.distanceTo(aim) * pxPerUnit * 1.15 * S.torch;
    copy.style.setProperty('--r', Math.max(1, radius).toFixed(1) + 'px');
    // (the headline only moves while it rises in or on resize, so its boxes are re-measured only then)
    if (t < 2.5 || !litRects) litRects = lit.map(el => el.getBoundingClientRect());
    lit.forEach((el, i) => {
      el.style.setProperty('--x', (sx - litRects[i].left).toFixed(1) + 'px');
      el.style.setProperty('--y', (sy - litRects[i].top).toFixed(1) + 'px');
    });

    // Lights
    pendant.rotation.z = Math.sin(t * 1.3) * S.swing;
    pendant.rotation.x = Math.cos(t * 0.9) * S.swing * 0.4;
    torch.intensity = S.torch * 11;
    ambient.intensity = 0.02 + S.room * 0.5;
    hemi.intensity = 0.03 + S.room * 0.3;
    scene.environmentIntensity = 0.01 + S.room * 0.12;
    bulbLight.intensity = S.bulb * 6;
    bulbMat.emissiveIntensity = S.bulb * 5;
    filamentMat.emissiveIntensity = S.bulb * 14;
    ledMat.emissiveIntensity = S.led * (1.6 + Math.sin(t * 2.4) * 1.2);
    bloom.strength = 0.6 + S.bulb * 0.4;
    dustMat.uniforms.uTime.value = t;
    dustMat.uniforms.uPower.value = S.torch;
    room.paperMat.opacity = S.paper;
    if (session.auto) session.t = Math.max(0, t - 1.2);
    room.update(session.t);
    sound.hum(S.bulb * (S.room < 0.95 ? 1 : 0.2) * (1 - S.fly));
    // On the last frames the screen fills the window: drop tone mapping and the film finish so the
    // snapshot shows in its true colors and hands off to the real page without a shift
    const landed = snap.texture && S.fly > 0.999 && S.paper > 0.999;
    renderer.toneMapping = landed ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    if (snap.texture) room.paperMat.color.setScalar(landed ? 1 : 1.15);
    grade.uniforms.uAmount.value = 1 - S.paper;
    grade.uniforms.uTime.value = t;

    composer.render(dt);
  }
  frame();

  // ---------- Hero headline: letters rise in after the intro ----------
  const heroH = document.querySelector('.hero h2');
  let split = null;
  document.fonts.ready.then(() => {
    if (entered) return;
    heroH.classList.remove('reveal', 'd1');
    split = SplitText.create(heroH, { type: 'lines,chars', mask: 'lines' });
    gsap.set(split.chars, { yPercent: 115, rotate: 6, transformOrigin: '0% 100%' });
  });

  // ---------- Switch ----------
  sw.addEventListener('pointerenter', () => { if (!entered) gsap.to(leverPivot.rotation, { x: OFF - 0.12, duration: 0.3, ease: 'power2.out' }); });
  sw.addEventListener('pointerleave', () => { if (!entered) gsap.to(leverPivot.rotation, { x: OFF, duration: 0.4, ease: 'power2.out' }); });
  let tl = null;
  sw.addEventListener('click', () => {
    if (entered) return;
    entered = true;
    label.textContent = 'Lights / on';
    showNote(null);
    intro.style.cursor = '';
    gsap.set([switchbox, intro.querySelector('.intro-tools')], { animation: 'none', opacity: 1 });
    sound.click();
    takeSnapshot();

    // Time-lapse the rest of the session so the phone gets the build before the camera dives in
    session.auto = false;
    if (session.t < INSTALL_AT + 1.2) gsap.to(session, { t: INSTALL_AT + 1.2, duration: 1.25, ease: 'power1.inOut' });

    tl = gsap.timeline();
    tl.to(leverPivot.rotation, { x: ON, duration: 0.3, ease: 'back.out(3)' }, 0)
      .to(shake, { keyframes: [{ y: -0.035 }, { y: 0.015 }, { y: 0 }], duration: 0.3 }, 0.04)
      .to(S, { swing: 0.13, duration: 0.25, ease: 'power2.out' }, 0.1)
      .to(S, { swing: 0.03, duration: 3, ease: 'power2.inOut' }, 0.35)
      .set(S, { led: 0 }, 0.14);

    // A fluorescent-style stutter before it catches
    [[0.14, 1], [0.17, 0], [0.26, 0.8], [0.29, 0.05], [0.46, 1], [0.5, 0.2], [0.54, 0.9], [0.58, 0.35]]
      .forEach(([at, v]) => tl.set(S, { bulb: v, room: v * 0.3 }, at));

    tl.to(S, { bulb: 1, room: 1, torch: 0, duration: 0.8, ease: 'power2.out' }, 0.62)
      .to(copy, { '--hi': '#121a19', '--base': '#121a19', duration: 0.6 }, 0.64)
      .to(label, { color: '#121a19', duration: 0.6 }, 0.64)
      // Into the laptop, which switches from the terminal to the homepage on the way in
      .to(copy, { y: -innerHeight * 0.25, opacity: 0, filter: 'blur(6px)', duration: 0.8, ease: 'power2.in' }, 1.3)
      .to([switchbox, intro.querySelector('.intro-tools')], { opacity: 0, duration: 0.45, ease: 'power2.in' }, 1.3)
      .add(() => sound.whoosh(2), 1.4)
      .to(S, { fly: 1, duration: 2, ease: 'power3.inOut' }, 1.4)
      .to(S, { paper: 1, duration: 0.6, ease: 'power1.inOut' }, 2.3)
      .add(() => { if (!snap.texture) gsap.to(wash, { opacity: 1, duration: 0.15 }); }, 3.25)
      .add(finish, 3.45);
  });

  // Snapshot of the homepage as it looks once the intro is gone, to put on the laptop screen
  async function takeSnapshot() {
    try {
      const { default: html2canvas } = await import('html2canvas');
      root.classList.add('snap');
      document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('in'));
      snap.image = await html2canvas(document.body, {
        x: 0, y: 0, width: innerWidth, height: innerHeight, windowWidth: innerWidth, windowHeight: innerHeight,
        scrollX: 0, scrollY: 0, scale: Math.min(devicePixelRatio, 2), backgroundColor: '#f4f1ea', logging: false,
        ignoreElements: el => el.id === 'intro',
        onclone: doc => {
          const bar = doc.getElementById('bar');
          bar.style.background = 'rgba(244,241,234,.82)';
          bar.style.backdropFilter = 'none';
          // The headline letters rise in after the cut, so the snapshot leaves them out
          doc.querySelector('.hero h2').style.visibility = 'hidden';
          // html2canvas can't do the hero's masked grid or soft radial glow (it draws a muddy blob), so the
          // snapshot leaves those decorations to the real page, which fades them in right after the cut
          doc.querySelectorAll('.hero > html2canvaspseudoelement').forEach(el => { el.style.display = 'none'; });
        },
      });
      composeSnapshot();
    } catch (err) {
      console.warn('Homepage snapshot failed; the intro ends on a plain fade', err);
    } finally {
      root.classList.remove('snap');
    }
  }
  // Lay the snapshot on a screen-shaped canvas, sized to exactly the part of the screen the window will show
  function composeSnapshot() {
    if (!snap.image || !snap.frac || snap.texture) return;
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1152;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, c.width, c.height);
    const w = c.width * snap.frac[0], h = c.height * snap.frac[1];
    g.drawImage(snap.image, (c.width - w) / 2, (c.height - h) / 2, w, h);
    snap.texture = new THREE.CanvasTexture(c);
    snap.texture.colorSpace = THREE.SRGBColorSpace;
    snap.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    room.paperMat.map = snap.texture;
    room.paperMat.needsUpdate = true;
  }

  // Fly from where the camera is now to square in front of the screen, close enough to fill the window
  function planFlight() {
    const center = room.screen.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(room.screen.matrixWorld);
    const s = room.screen.getWorldScale(new THREE.Vector3()).x;
    const [sw0, sh0] = room.screenSize;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const d = Math.min((sh0 * s / 2) / tan, (sw0 * s / 2) / (tan * camera.aspect)) * 0.92;
    const from = camera.position.clone().sub(shake);
    const to = center.clone().addScaledVector(normal, d);
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.35, 0.6));
    flight.curve = new THREE.CatmullRomCurve3([from, mid, to]);
    flight.lookFrom.copy(look);
    flight.lookTo.copy(center);
    const visH = 2 * d * tan;
    snap.frac = [visH * camera.aspect / (sw0 * s), visH / (sh0 * s)];
    composeSnapshot();
  }

  function finish() {
    if (split) gsap.to(split.chars, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.035, delay: 0.2, onComplete: () => split.revert() });
    window.siteIntro.finish();
    sound.stop();
    if (destination) setTimeout(() => document.getElementById(destination)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 900);
    setTimeout(teardown, 1200);
  }
  function teardown() {
    if (!running) return;
    running = false;
    removeEventListener('resize', layout);
    tl?.kill();
    composer.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
  }
  function restoreHeadline() {
    if (split) { split.revert(); split = null; }
    heroH.classList.add('reveal', 'd1', 'in');
  }
  // Skip button, Esc, or a returning visitor
  addEventListener('intro:skip', () => {
    entered = true;
    sound.stop();
    restoreHeadline();
    teardown();
  });
  // If the GPU drops the context, hand over to the CSS intro (or just finish, if already on the way out)
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    if (entered) { restoreHeadline(); window.siteIntro.finish(); teardown(); return; }
    entered = true;
    sound.stop();
    restoreHeadline();
    teardown();
    root.classList.remove('intro-3d');
    delete intro.dataset.mode;
    copy.removeAttribute('style');
    switchbox.removeAttribute('style');
  });

  // ---------- Go ----------
  const wash = document.createElement('div');
  wash.className = 'intro-wash';
  intro.prepend(canvas);
  intro.append(wash);
  intro.dataset.mode = '3d';
  root.classList.remove('intro-3d-pending');
  requestAnimationFrame(() => canvas.classList.add('in'));
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Warm painted wall: soft mottling and faint vertical roller marks
function paintTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#e7dfd1';
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024, r = 80 + Math.random() * 260;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = Math.random() < 0.5 ? '255,250,240' : '205,192,170';
    grad.addColorStop(0, `rgba(${tone},${0.05 + Math.random() * 0.05})`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,252,245' : '190,178,155'},${Math.random() * 0.035})`;
    g.fillRect(Math.random() * 1024, 0, 6 + Math.random() * 40, 1024);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// Plaster grain so the flashlight rakes across a real surface
function plasterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 16);
  return tex;
}
