// The nav car, live: the same 3D model the pictures were rendered from (car/car.glb, CC BY: see
// car/CREDITS.txt), drawn by three.js in a tiny canvas. Its wheels roll with the distance, the body
// squats and lifts with how fast you scroll, and at the very end it swings its nose toward you and
// parks. Only draws while something is moving. site-motion.js loads it for ?car=3d.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function mount(el) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('car/car.glb', document.baseURI).href);
  const canvas = document.createElement('canvas');
  canvas.className = 'car-3d';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-3, 6, 2);
  scene.add(sun);

  // The model sits on the ground at the origin, nose toward +z (screen right, seen from -x)
  const car = gltf.scene, rig = new THREE.Group();
  const box = new THREE.Box3().setFromObject(car), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  car.position.set(-c.x, -box.min.y, -c.z);
  rig.add(car);
  scene.add(rig);

  // Wheels turn about their own hubs (each wheel node sits at its hub); the brake calipers stay put
  const wheels = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'].map(n => car.getObjectByName(n)).filter(Boolean);
  wheels.forEach(w => { w.children.filter(o => /BrakePad/.test(o.name)).forEach(o => w.parent.attach(o)); w.userData.base = w.quaternion.clone(); });
  const wheelR = (() => { const b = new THREE.Box3().setFromObject(wheels[0]); return (b.max.y - b.min.y) / 2; })();
  const spin = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);

  // Side-on camera, a touch above; the view is wider than the car so it has room to turn at the end
  const camera = new THREE.PerspectiveCamera(16, 1, 0.1, 100);
  let viewH = 1, pxPerUnit = 1;
  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    viewH = size.z * 1.3 / camera.aspect;
    const dist = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(-dist, viewH * 0.62, 0);
    camera.lookAt(0, viewH * 0.47, 0);
    camera.updateProjectionMatrix();
    pxPerUnit = h / viewH;
    draw();
  };

  // Motion state: where it is (px), how fast it's going, the body's pitch, and the parking turn
  let x = null, lastX = 0, lastT = performance.now(), speed = 0, pitch = 0, pitchV = 0, yaw = 0, park = 0, raf = 0;
  const draw = () => renderer.render(scene, camera);
  const frame = now => {
    raf = 0;
    const dt = Math.min(64, now - lastT) / 1000 || 0.016;
    lastT = now;
    // Speed in px/s, smoothed; the body tips back when it speeds up and dives when it slows
    const v = (x - lastX) / dt;
    lastX = x;
    const prev = speed;
    speed += (v - speed) * Math.min(1, dt * 8);
    const accel = (speed - prev) / dt;
    const target = THREE.MathUtils.clamp(-accel / 60000, -0.07, 0.07);
    pitchV += ((target - pitch) * 140 - pitchV * 14) * dt; // a little spring, so it settles with a bounce
    pitch += pitchV * dt;
    yaw += (park * -0.62 - yaw) * Math.min(1, dt * 5);
    rig.rotation.set(pitch, yaw, 0, 'YXZ');
    const angle = x / (wheelR * pxPerUnit);
    wheels.forEach(w => w.quaternion.copy(w.userData.base).multiply(spin.setFromAxisAngle(X, angle)));
    draw();
    const moving = Math.abs(speed) > 0.5 || Math.abs(pitch) > 0.0005 || Math.abs(pitchV) > 0.001 || Math.abs(park * -0.62 - yaw) > 0.002;
    if (moving && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } };

  el.prepend(canvas);
  el.classList.add('live');
  new ResizeObserver(resize).observe(el);
  resize();
  return {
    update(p, px) { if (x === null) lastX = px; x = px; park = p > 0.985 ? 1 : 0; kick(); },
  };
}
