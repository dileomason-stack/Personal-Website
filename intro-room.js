// The bedroom for the 3D intro: a desk where the laptop is running Claude Code on Hold This
// Thought and the phone, plugged in over USB-C, picks up each build. Plus a car poster and
// car photos taped to the wall, a shelf with a baseball, and a wood floor. Everything is
// placed from screen positions in layout(), so it frames the headline at any window size.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createTerminal, INSTALL_AT } from './intro-terminal.js';

// One real poster, and the rest are Mason's own car photos printed out and taped up.
// at / narrow: [x, y, height] as fractions of the window.
// tape: [x, y, angle] per strip, x/y from -1 to 1 across the print (corners are ±1).
// curl: how far the untaped bottom corners lift off the wall.
const POSTERS = [
  { src: 'intro/car-917.jpg', poster: true, title: 'PORSCHE 917', no: '01', w: 1, h: 1.42, tilt: -0.04, at: [0.13, 0.36, 0.34], narrow: [0.12, 0.24, 0.19],
    tape: [[-1, 1, -0.7], [1, 1, 0.7], [-1, -1, 0.7], [1, -1, -0.7]], curl: 0 },
  { src: 'intro/car-f40.jpg', w: 1.5, h: 1, tilt: 0.06, at: [0.23, 0.12, 0.15], narrow: [0.2, 0.06, 0.08],
    tape: [[0, 1, 1.48]], curl: 1 },
  { src: 'intro/car-heritage-1.jpg', w: 1, h: 1.333, tilt: 0.07, at: [0.87, 0.24, 0.24], narrow: [0.96, 0.18, 0.16],
    tape: [[-1, 1, -0.75], [1, 1, 0.65]], curl: 0.8 },
  { src: 'intro/car-911.jpg', w: 1, h: 1.333, tilt: -0.09, at: [0.81, 0.45, 0.17], narrow: [0.88, 0.4, 0.11],
    tape: [[-1, 1, -0.7], [1, -1, -0.6]], curl: 0 },
];

export function buildRoom(scene, renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // ---------- Floor + baseboard ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 14),
    new THREE.MeshStandardMaterial({ map: plankTexture(maxAniso), roughness: 0.55 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const baseboard = shadowed(new THREE.Mesh(new THREE.BoxGeometry(60, 0.16, 0.04), new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.5 })));
  scene.add(floor, baseboard);

  // ---------- Poster and taped-up photos ----------
  const tapeMat = new THREE.MeshStandardMaterial({ map: tapeTexture(), transparent: true, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const tapeGeo = new THREE.PlaneGeometry(0.27, 0.08);
  const posters = POSTERS.map(p => {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: p.poster ? 0.62 : 0.35 });
    (p.poster ? posterTexture : photoTexture)(p, maxAniso).then(tex => { mat.map = tex; mat.needsUpdate = true; });
    const geo = new THREE.PlaneGeometry(p.w, p.h, 10, 14);
    // Paper that's been on the wall a while: untaped bottom corners lift off a little
    const v = geo.attributes.position;
    for (let i = 0; i < v.count; i++) {
      const nx = v.getX(i) / (p.w / 2), ny = v.getY(i) / (p.h / 2);
      v.setZ(i, 0.006 + p.curl * Math.max(0, -ny) ** 3 * (0.35 + Math.abs(nx) ** 2) * 0.05);
    }
    geo.computeVertexNormals();
    group.add(shadowed(new THREE.Mesh(geo, mat)));
    // Each strip sits across the edge it holds, half on the print and half on the wall
    p.tape.forEach(([tx, ty, angle], i) => {
      const tape = new THREE.Mesh(tapeGeo, tapeMat);
      tape.position.set(tx * (p.w / 2 - 0.02), ty * (p.h / 2 - 0.02), 0.014);
      tape.rotation.z = angle + (i % 2 ? 0.05 : -0.04);
      group.add(tape);
    });
    group.rotation.z = p.tilt;
    scene.add(group);
    return { p, group };
  });

  // ---------- Shelf with a baseball ----------
  const shelf = new THREE.Group();
  const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.42), new THREE.MeshStandardMaterial({ map: woodTexture(maxAniso), roughness: 0.6 })));
  board.position.set(0, -0.035, 0.21);
  shelf.add(board);
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x22201d, roughness: 0.4, metalness: 0.7 });
  for (const x of [-0.32, 0.32]) {
    const arm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.36), bracketMat));
    arm.position.set(x, -0.088, 0.19);
    const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.26, 0.03), bracketMat));
    leg.position.set(x, -0.2, 0.015);
    shelf.add(arm, leg);
  }
  scene.add(shelf);

  // ---------- Desk ----------
  const desk = new THREE.Group();
  const deskTop = shadowed(new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.07, 1.0, 3, 0.02), new THREE.MeshStandardMaterial({ map: woodTexture(maxAniso), roughness: 0.55 })));
  deskTop.position.set(0, -0.035, 0.52);
  desk.add(deskTop);
  const legGeo = new THREE.BoxGeometry(0.05, 1, 0.05).translate(0, -0.5, 0);
  const legs = [[-1.08, 0.1], [1.08, 0.1], [-1.08, 0.94], [1.08, 0.94]].map(([x, z]) => {
    const leg = shadowed(new THREE.Mesh(legGeo, bracketMat));
    leg.position.set(x, -0.07, z);
    desk.add(leg);
    return leg;
  });
  scene.add(desk);

  // ---------- Laptop: Claude Code at work on the app ----------
  const alu = new THREE.MeshStandardMaterial({ color: 0xc3c6cc, roughness: 0.42, metalness: 0.25 });
  const laptop = new THREE.Group();
  laptop.position.set(0, 0, 0.64);
  const base = shadowed(new THREE.Mesh(new RoundedBoxGeometry(1, 0.035, 0.68, 2, 0.012), alu));
  base.position.y = 0.0175;
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.32), new THREE.MeshStandardMaterial({ map: keyboardTexture(maxAniso), roughness: 0.7 }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.0356, -0.1);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.2), new THREE.MeshStandardMaterial({ color: 0xb0b3b9, roughness: 0.3 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.0356, 0.2);
  const lid = new THREE.Group();
  lid.position.set(0, 0.035, -0.33);
  lid.rotation.x = -0.32;
  const shell = shadowed(new THREE.Mesh(new RoundedBoxGeometry(1, 0.66, 0.022, 2, 0.01), alu));
  shell.position.set(0, 0.33, -0.011);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.64), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.25 }));
  bezel.position.set(0, 0.33, 0.002);

  const terminal = createTerminal();
  // Screens sit a few mm proud of the bezel and get a depth offset so they never z-fight with it
  const screenMat = new THREE.MeshBasicMaterial({ map: terminal.texture, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  screenMat.color.setScalar(1.15);
  const SCREEN_W = 0.92, SCREEN_H = 0.5175;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
  screen.position.set(0, 0.345, 0.005);
  // Fades the screen to the site's paper color at the end of the fly-in
  const paperMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f3f0ea'), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  paperMat.color.multiplyScalar(1.15);
  const paper = new THREE.Mesh(screen.geometry, paperMat);
  paper.position.set(0, 0.345, 0.008);
  const screenLight = new THREE.PointLight(0xffe2cc, 0.35, 0, 2);
  screenLight.position.set(0, 0.34, 0.45);
  lid.add(shell, bezel, screen, paper, screenLight);
  const laptopPort = new THREE.Object3D();
  laptopPort.position.set(0.5, 0.017, -0.12);
  laptop.add(base, keys, pad, lid, laptopPort);
  desk.add(laptop);

  // ---------- Phone on a stand, showing the app ----------
  const phoneUI = createPhoneScreen(maxAniso);
  const phone = new THREE.Group();
  phone.position.set(0.74, 0, 0.5);
  phone.rotation.y = -0.3;
  phone.scale.setScalar(0.85);
  const stand = new THREE.Group();
  const standBase = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.025, 0.26, 2, 0.008), bracketMat));
  standBase.position.set(0, 0.0125, 0);
  const lip = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.05, 0.03, 2, 0.008), bracketMat));
  lip.position.set(0, 0.045, 0.07);
  stand.add(standBase, lip);
  const handset = new THREE.Group();
  handset.position.set(0, 0.035, 0.045);
  handset.rotation.x = -0.24;
  const body = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.76, 0.03, 4, 0.05), new THREE.MeshStandardMaterial({ color: 0x2a2b2f, roughness: 0.35, metalness: 0.6 })));
  body.position.set(0, 0.38, 0);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.348, 0.748), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.15 }));
  glass.position.set(0, 0.38, 0.018);
  const phoneScreen = new THREE.Mesh(roundedRectGeometry(0.335, 0.728, 0.04), new THREE.MeshBasicMaterial({ map: phoneUI.texture, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  phoneScreen.material.color.setScalar(1.1);
  phoneScreen.position.set(0, 0.38, 0.021);
  const island = new THREE.Mesh(roundedRectGeometry(0.09, 0.026, 0.013), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  island.position.set(0, 0.38 + 0.728 / 2 - 0.03, 0.024);
  const phonePort = new THREE.Object3D();
  phonePort.position.set(0, 0.0, 0.0);
  handset.add(body, glass, phoneScreen, island, phonePort);
  phone.add(stand, handset);
  desk.add(phone);

  // ---------- USB-C cable from the laptop's side to the phone ----------
  desk.updateMatrixWorld(true);
  const local = obj => desk.worldToLocal(obj.getWorldPosition(new THREE.Vector3()));
  const a = local(laptopPort), b = local(phonePort);
  const cablePath = new THREE.CatmullRomCurve3([
    a,
    a.clone().add(new THREE.Vector3(0.07, -0.006, 0.01)),
    new THREE.Vector3(a.x + 0.12, 0.008, a.z + 0.1),
    new THREE.Vector3((a.x + b.x) / 2, 0.008, Math.max(a.z, b.z) + 0.2),
    new THREE.Vector3(b.x - 0.05, 0.008, b.z + 0.2),
    b.clone().add(new THREE.Vector3(0, -0.02, 0.09)),
    b.clone().add(new THREE.Vector3(0, -0.04, 0.02)),
    b,
  ], false, 'catmullrom', 0.4);
  const cableMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.5 });
  const cable = shadowed(new THREE.Mesh(new THREE.TubeGeometry(cablePath, 120, 0.007, 10, false), cableMat));
  const plugGeo = new RoundedBoxGeometry(0.05, 0.016, 0.026, 2, 0.006);
  const plugA = shadowed(new THREE.Mesh(plugGeo, cableMat));
  plugA.position.copy(a).add(new THREE.Vector3(0.025, 0, 0));
  desk.add(cable, plugA);
  // A pulse of light that runs down the cable while the build installs
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff9a5c, emissiveIntensity: 0 }));
  desk.add(pulse);

  new GLTFLoader().loadAsync('models/baseball_01/baseball_01.gltf').then(g => {
    const ball = normalize(g.scene, 0.2);
    ball.position.set(0, 0, 0.2);
    shelf.add(ball);
  });

  // ---------- Layout ----------
  let scale = 1;
  const switchSpot = { x: 0, y: 0, lidTop: 0, stacked: false };
  function layout({ screenToPlane, toScreen, w, h, pxPerUnit, topLimit }) {
    const v = new THREE.Vector3();
    const narrow = w < 700;
    scale = THREE.MathUtils.clamp(w / h / 1.6, 0.6, 1);

    const floorY = screenToPlane(w / 2, h * 0.97, 0, v).y;
    floor.position.set(0, floorY, 7);
    baseboard.position.set(0, floorY + 0.08, 0.02);

    for (const { p, group } of posters) {
      const [fx, fy, fh] = narrow ? p.narrow : p.at;
      screenToPlane(w * fx, h * fy, 0, v);
      group.position.set(v.x, v.y, 0);
      group.scale.setScalar(h * fh / pxPerUnit / p.h);
    }

    // Desk sized so the laptop screen is a set share of the window, then shrunk if the
    // lid would reach up into the headline (short, wide windows)
    // (phones get a big laptop; split-screen widths a slightly smaller one, so the switch fits beside it)
    const screenPx = w < 520 ? w * 0.42 : narrow ? w * 0.34 : THREE.MathUtils.clamp(Math.min(w * 0.24, h * 0.36), 220, 420);
    let s = screenPx / (SCREEN_W * pxPerUnit * 1.08);
    const lidTop = new THREE.Vector3(), deskEdge = new THREE.Vector3();
    let topY = 0;
    for (let i = 0; i < 3; i++) {
      screenToPlane(w / 2, h * (narrow ? 0.9 : 0.85), 0.5 * s, v);
      desk.position.set(0, v.y, 0);
      desk.scale.setScalar(s);
      desk.updateMatrixWorld(true);
      topY = toScreen(screen.localToWorld(lidTop.set(0, 0.315, 0))).y; // top edge of the lid
      const deskY = toScreen(desk.localToWorld(deskEdge.set(0, 0, 0.5))).y;
      if (!topLimit || topY >= topLimit) break;
      s *= Math.max(0.5, (deskY - topLimit) / (deskY - topY));
    }
    for (const leg of legs) leg.scale.y = Math.max(0.1, (v.y - floorY) / s - 0.07);

    // Light switch: on the wall just left of the laptop, level with its screen. When there's
    // no room for it and its label beside the laptop (phones), it's stacked in the open wall
    // between the headline and the laptop instead, and the caller sets its height there.
    switchSpot.lidTop = topY;
    const left = toScreen(laptop.localToWorld(new THREE.Vector3(-0.5, 0, 0)));
    switchSpot.stacked = left.x < 170;
    if (switchSpot.stacked) switchSpot.x = w / 2;
    else {
      switchSpot.x = Math.max(80, left.x - 90);
      switchSpot.y = toScreen(screen.localToWorld(new THREE.Vector3(0, 0, 0))).y;
    }

    // Draw both screens at their size on the display (with a little headroom for the angle)
    desk.updateMatrixWorld(true);
    const pr = renderer.getPixelRatio(), widthOnScreen = (mesh, half) =>
      Math.abs(toScreen(mesh.localToWorld(new THREE.Vector3(half, 0, 0))).x - toScreen(mesh.localToWorld(new THREE.Vector3(-half, 0, 0))).x);
    terminal.setResolution(widthOnScreen(screen, SCREEN_W / 2) * pr * 1.3);
    phoneUI.setResolution(widthOnScreen(phoneScreen, 0.1675) * pr * 1.3);

    screenToPlane(w * (narrow ? 0.16 : 0.83), h * (narrow ? 0.55 : 0.6), 0, v);
    shelf.position.set(v.x, v.y, 0);
    shelf.scale.setScalar(scale * (narrow ? 0.8 : 1));
  }

  // t: seconds since the coding session started
  function update(t) {
    terminal.update(t);
    phoneUI.update(t - INSTALL_AT);
    const u = (t - (INSTALL_AT - 1.6)) / 1.6;
    pulse.visible = u > 0 && u < 1;
    if (pulse.visible) {
      cablePath.getPoint(u, pulse.position);
      pulse.material.emissiveIntensity = 6 * Math.sin(u * Math.PI);
    }
  }

  // Things in the room that link to parts of the site. Each has two edge points (left, right) where a
  // note's arrow can land, and a preferred side for the note (1 right, -1 left, 0 toward the middle).
  const edge = (obj, x, y) => ({ obj, at: new THREE.Vector3(x, y, 0.03) });
  const hotspots = [
    { obj: laptop, title: 'Projects', sub: 'What I’ve built', target: 'projects', prefer: 1,
      edges: [edge(screen, -SCREEN_W / 2 + 0.06, SCREEN_H / 2 + 0.05), edge(screen, SCREEN_W / 2 - 0.06, SCREEN_H / 2 + 0.05)] },
    { obj: phone, title: 'Hold This Thought', sub: 'My iPhone app', target: 'work', prefer: 1,
      edges: [edge(handset, -0.2, 0.6), edge(handset, 0.2, 0.6)] },
    ...posters.map(({ p, group }) => ({ obj: group, title: 'About me', sub: 'Cars and photos', target: 'cars', prefer: 0,
      edges: [edge(group, -p.w / 2 - 0.02, p.h * 0.15), edge(group, p.w / 2 + 0.02, p.h * 0.15)] })),
  ];

  // Full resolution for the camera's dive into the laptop
  const highRes = () => terminal.setResolution(2048);

  return { layout, update, highRes, screen, screenSize: [SCREEN_W, SCREEN_H], paperMat, switchSpot, hotspots };
}

// Center a loaded model on x/z, sit it on y = 0, and scale its longest side to `size`
function normalize(obj, size) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(obj);
  const dims = box.getSize(new THREE.Vector3());
  const s = size / Math.max(dims.x, dims.y, dims.z);
  const center = box.getCenter(new THREE.Vector3());
  obj.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  obj.scale.setScalar(s);
  const wrap = new THREE.Group();
  wrap.add(obj);
  return wrap;
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A photo printed at home: the picture with a thin white border
async function photoTexture(p, maxAniso) {
  const img = new Image();
  img.src = p.src;
  await img.decode();
  const W = 900, H = Math.round(W * p.h / p.w);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, W, H);
  const m = W * 0.035, aw = W - m * 2, ah = H - m * 2;
  const k = Math.max(aw / img.width, ah / img.height);
  const sw = aw / k, sh = ah / k;
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, m, m, aw, ah);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

// A strip of masking tape: see-through cream with torn ends
function tapeTexture() {
  const c = document.createElement('canvas');
  c.width = 270; c.height = 80;
  const g = c.getContext('2d');
  g.beginPath();
  g.moveTo(8, 0);
  for (let y = 0; y <= 80; y += 8) g.lineTo(4 + Math.random() * 9, y);
  for (let y = 80; y >= 0; y -= 8) g.lineTo(262 - Math.random() * 9, y);
  g.closePath();
  g.fillStyle = 'rgba(233, 222, 188, 0.86)';
  g.fill();
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,235' : '170,150,110'},${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 270, Math.random() * 80, 2 + Math.random() * 30, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A printed poster: the photo, then a title band in the site's own type
async function posterTexture(p, maxAniso) {
  const img = new Image();
  img.src = p.src;
  await Promise.all([img.decode(), document.fonts.load('800 60px Manrope'), document.fonts.load('500 20px "DM Mono"')]);
  const W = 900, H = Math.round(W * p.h / p.w);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, W, H);
  const m = W * 0.045, band = W * 0.2;
  const aw = W - m * 2, ah = H - m - band;
  const k = Math.max(aw / img.width, ah / img.height);
  const sw = aw / k, sh = ah / k;
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, m, m, aw, ah);
  g.fillStyle = '#121a19';
  g.font = `800 ${W * 0.088}px Manrope`;
  g.fillText(p.title, m - 3, H - band * 0.36);
  g.font = `500 ${W * 0.026}px "DM Mono"`;
  g.fillStyle = '#66706e';
  g.fillText(`AFTER HOURS LAB  /  ${p.no}`, m, H - band * 0.13);
  g.fillStyle = '#c4562f';
  g.fillRect(W - m - W * 0.14, H - band * 0.2, W * 0.14, W * 0.012);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

// The Hold This Thought home screen. Before the install the Went off card isn't there yet;
// at the install the app relaunches and the card slides in above Today.
function createPhoneScreen(maxAniso) {
  const W = 828, H = 1800;
  const CUT_TOP = 360, CUT_BOTTOM = 756, ROW_END = 1410, BAR_TOP = 1485;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Drawn at about its size on screen (see setResolution), so no mipmap blur
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  g.imageSmoothingQuality = 'high';
  // The App Store screenshot, with its sample name swapped for Mason
  const img = document.createElement('canvas');
  img.width = W; img.height = H;
  const src = new Image();
  src.src = 'intro/htt-home.jpg';
  let ready = false, lastKey = '';
  Promise.all([src.decode(), document.fonts.ready]).then(() => {
    const p = img.getContext('2d');
    p.drawImage(src, 0, 0);
    const font = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
    p.fillStyle = 'rgb(41,135,61)';
    p.fillRect(154, 198, 128, 46);
    p.fillStyle = '#ffffff';
    p.font = `700 40px ${font}`;
    p.fillText('Mason', 158, 231);
    p.fillStyle = '#ffffff';
    p.beginPath();
    p.arc(87, 198, 24, 0, Math.PI * 2);
    p.fill();
    p.fillStyle = 'rgb(30,119,48)';
    p.font = `600 34px ${font}`;
    p.textAlign = 'center';
    p.fillText('M', 87, 210);
    ready = true;
    lastKey = '';
  });

  // p: 0 = before the feature, 1 = with it
  function draw(p) {
    if (p >= 1) { g.drawImage(img, 0, 0); return; }
    const e = 1 - (1 - p) ** 3, cut = CUT_BOTTOM - CUT_TOP;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.drawImage(img, 0, CUT_BOTTOM, W, ROW_END - CUT_BOTTOM, 0, CUT_TOP + cut * e, W, ROW_END - CUT_BOTTOM);
    if (p > 0) {
      g.globalAlpha = e;
      g.drawImage(img, 0, CUT_TOP, W, cut, 0, CUT_TOP - 30 * (1 - e), W, cut);
      g.globalAlpha = 1;
    }
    g.drawImage(img, 0, 0, W, CUT_TOP, 0, 0, W, CUT_TOP);
    g.fillStyle = '#ffffff';
    g.fillRect(0, CUT_TOP + cut * e + ROW_END - CUT_BOTTOM, W, H);
    g.drawImage(img, 0, BAR_TOP, W, H - BAR_TOP, 0, BAR_TOP, W, H - BAR_TOP);
  }

  // dt: seconds since the install
  function setResolution(px) {
    const w = Math.round(THREE.MathUtils.clamp(px, 240, W));
    if (Math.abs(w - canvas.width) < 6) return;
    canvas.width = w;
    canvas.height = Math.round(w * H / W);
    g.imageSmoothingQuality = 'high';
    texture.dispose();
    lastKey = '';
  }

  function update(dt) {
    if (!ready) return;
    const blank = dt >= 0 && dt < 0.35;
    const p = dt < 0.35 ? 0 : Math.min(1, (dt - 0.5) / 0.6);
    const key = blank ? 'blank' : p.toFixed(3);
    if (key === lastKey) return;
    lastKey = key;
    g.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
    if (blank) {
      // The app relaunching with the new build
      g.fillStyle = '#2e8b47';
      g.fillRect(0, 0, W, H);
    } else draw(Math.max(0, p));
    texture.needsUpdate = true;
  }

  return { texture, update, setResolution };
}

function roundedRectGeometry(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geo = new THREE.ShapeGeometry(s, 6);
  // ShapeGeometry UVs are in shape units; map them to 0..1
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return geo;
}

function keyboardTexture(maxAniso) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 372;
  const g = c.getContext('2d');
  g.fillStyle = '#9fa3aa';
  g.fillRect(0, 0, 1024, 372);
  g.fillStyle = '#1b1c1f';
  const cols = 14, rows = 6, gap = 8, kw = (1024 - gap * (cols + 1)) / cols, kh = (372 - gap * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    if (r === 5) { g.fillRect(gap + (kw + gap) * 4, gap + r * (kh + gap), kw * 6 + gap * 5, kh); continue; }
    for (let i = 0; i < cols; i++) g.fillRect(gap + i * (kw + gap), gap + r * (kh + gap), kw, r === 0 ? kh * 0.6 : kh);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function woodTexture(maxAniso) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8b5d3b';
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '60,35,20' : '170,120,80'},${0.08 + Math.random() * 0.15})`;
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * 128;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(170, y + (Math.random() - 0.5) * 14, 340, y + (Math.random() - 0.5) * 14, 512, y + (Math.random() - 0.5) * 8);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function plankTexture(maxAniso) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const rows = 8, rh = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -Math.random() * 400;
    while (x < 1024) {
      const len = 300 + Math.random() * 400, tone = 95 + Math.random() * 30;
      g.fillStyle = `rgb(${tone + 40},${tone + 8},${tone - 25})`;
      g.fillRect(x, r * rh, len, rh);
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(50,30,15,${Math.random() * 0.12})`;
        g.fillRect(x, r * rh + Math.random() * rh, len, 1 + Math.random() * 2);
      }
      g.fillStyle = 'rgba(30,18,10,.55)';
      g.fillRect(x, r * rh, 3, rh);
      x += len;
    }
    g.fillStyle = 'rgba(30,18,10,.6)';
    g.fillRect(0, r * rh, 1024, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60 / 3.2, 14 / 3.2);
  tex.rotation = Math.PI / 2;
  tex.anisotropy = maxAniso;
  return tex;
}
