// 3D "lights off" intro: a dark room lit by a flashlight that follows the cursor.
// Flipping the switch flickers the bulb on, floods the room, and flies the camera into
// the laptop screen on the desk, which becomes the site. If anything here fails, the CSS intro still works.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { buildRoom } from './intro-room.js';
import { INSTALL_AT } from './intro-terminal.js';
import { SplitText } from 'gsap/SplitText.js';

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
    new THREE.MeshStandardMaterial({ map: gridTexture(renderer), bumpMap: plasterTexture(), bumpScale: 0.35, roughness: 0.92 })
  );
  wall.receiveShadow = true;
  scene.add(wall);
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
    const r = sw.getBoundingClientRect();
    const c = screenToPlane(r.left + r.width / 2, r.top + r.height / 2, 0, new THREE.Vector3());
    const top = screenToPlane(r.left + r.width / 2, r.top, 0, new THREE.Vector3());
    sw3.position.copy(c);
    sw3.scale.setScalar((top.y - c.y) * 2 * 0.92);
    const b = screenToPlane(w / 2, h * 0.11, 1.2, new THREE.Vector3());
    pendant.position.set(b.x, b.y + CORD + 0.34, 1.2);
    pxPerUnit = h / (2 * CAM.z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    room.layout({ screenToPlane, w, h, pxPerUnit });
  }
  layout();
  addEventListener('resize', layout);

  // ---------- Pointer ----------
  let pointerSeen = false, px = innerWidth / 2, py = innerHeight * 0.4;
  intro.addEventListener('pointermove', e => { pointerSeen = true; px = e.clientX; py = e.clientY; });
  intro.addEventListener('pointerdown', e => { pointerSeen = true; px = e.clientX; py = e.clientY; });
  intro.addEventListener('pointerleave', () => { pointerSeen = false; });

  // ---------- Animated state ----------
  const S = { bulb: 0, room: 0, torch: 0, swing: 0.035, led: 1, fly: 0, paper: 0 };
  // The coding session on the laptop runs in real time until the switch is flipped
  const session = { t: 0, auto: true };
  const flight = { curve: null, lookFrom: new THREE.Vector3(), lookTo: new THREE.Vector3() };
  const shake = new THREE.Vector3(), par = new THREE.Vector2(), look = new THREE.Vector3();
  const aim = new THREE.Vector3(0, 0.6, 0), aimTarget = new THREE.Vector3(), proj = new THREE.Vector3();
  gsap.to(S, { torch: 1, duration: 1.8, delay: 0.5, ease: 'power2.inOut' });

  const clock = new THREE.Clock();
  let running = true;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    draw(dt, clock.elapsedTime);
  }
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
    for (const el of lit) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--x', (sx - r.left).toFixed(1) + 'px');
      el.style.setProperty('--y', (sy - r.top).toFixed(1) + 'px');
    }

    // Lights
    pendant.rotation.z = Math.sin(t * 1.3) * S.swing;
    pendant.rotation.x = Math.cos(t * 0.9) * S.swing * 0.4;
    torch.intensity = S.torch * 11;
    ambient.intensity = 0.02 + S.room * 0.75;
    hemi.intensity = 0.03 + S.room * 0.5;
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

    composer.render(dt);
  }
  frame();

  // ---------- Hero headline: letters rise in after the intro ----------
  const heroH = document.querySelector('.hero h2');
  let split = null, entered = false;
  document.fonts.ready.then(() => {
    if (entered) return;
    heroH.classList.remove('reveal', 'd1');
    split = SplitText.create(heroH, { type: 'lines,chars', mask: 'lines' });
    gsap.set(split.chars, { yPercent: 115, rotate: 6, transformOrigin: '0% 100%' });
  });

  // ---------- Switch ----------
  sw.addEventListener('pointerenter', () => { if (!entered) gsap.to(leverPivot.rotation, { x: OFF - 0.12, duration: 0.3, ease: 'power2.out' }); });
  sw.addEventListener('pointerleave', () => { if (!entered) gsap.to(leverPivot.rotation, { x: OFF, duration: 0.4, ease: 'power2.out' }); });
  sw.addEventListener('click', () => {
    if (entered) return;
    entered = true;
    label.textContent = 'Lights / on';
    gsap.set(switchbox, { animation: 'none', opacity: 1 });

    // Time-lapse the rest of the session so the phone gets the build before the camera dives in
    session.auto = false;
    if (session.t < INSTALL_AT + 1.2) gsap.to(session, { t: INSTALL_AT + 1.2, duration: 1.6, ease: 'power1.inOut' });

    const tl = gsap.timeline();
    tl.to(leverPivot.rotation, { x: ON, duration: 0.3, ease: 'back.out(3)' }, 0)
      .to(shake, { keyframes: [{ y: -0.035 }, { y: 0.015 }, { y: 0 }], duration: 0.3 }, 0.04)
      .to(S, { swing: 0.13, duration: 0.25, ease: 'power2.out' }, 0.1)
      .to(S, { swing: 0.03, duration: 3, ease: 'power2.inOut' }, 0.35)
      .set(S, { led: 0 }, 0.18);

    // A fluorescent-style stutter before it catches
    [[0.18, 1], [0.22, 0], [0.34, 0.8], [0.37, 0.05], [0.62, 1], [0.66, 0.2], [0.72, 0.9], [0.78, 0.35]]
      .forEach(([at, v]) => tl.set(S, { bulb: v, room: v * 0.3 }, at));

    tl.to(S, { bulb: 1, room: 1, torch: 0, duration: 1, ease: 'power2.out' }, 0.85)
      .to(copy, { '--hi': '#121a19', '--base': '#121a19', duration: 0.8 }, 0.9)
      .to(label, { color: '#121a19', duration: 0.8 }, 0.9)
      // Into the laptop
      .to(copy, { y: -innerHeight * 0.25, opacity: 0, filter: 'blur(6px)', duration: 0.9, ease: 'power2.in' }, 1.7)
      .to(switchbox, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 1.7)
      .to(S, { fly: 1, duration: 2.1, ease: 'power3.inOut' }, 1.75)
      .to(S, { paper: 1, duration: 0.45, ease: 'power1.in' }, 3.35)
      .to(wash, { opacity: 1, duration: 0.15 }, 3.8)
      .add(finish, 3.95);
  });

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
  }

  function finish() {
    if (split) gsap.to(split.chars, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.035, delay: 0.2, onComplete: () => split.revert() });
    window.siteIntro.finish();
    setTimeout(() => {
      running = false;
      removeEventListener('resize', layout);
      composer.dispose();
      renderer.dispose();
      canvas.remove();
    }, 1200);
  }

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

// The same faint grid as the CSS intro, painted on the wall
function gridTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#e4dfd3';
  for (let i = 0; i < 512; i += 128) { g.fillRect(i, 0, 2, 512); g.fillRect(0, i, 512, 2); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60 / (4 * 0.42), 40 / (4 * 0.42));
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
