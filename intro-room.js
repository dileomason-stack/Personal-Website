// The bedroom for the 3D intro: a desk where the laptop is running Claude Code on Hold This
// Thought and the phone, plugged in over USB-C, picks up each build. Plus car posters,
// a shelf with a football and a baseball, a bat in the corner, and a wood floor. Everything
// is placed from screen positions in layout(), so it frames the headline at any window size.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createTerminal, INSTALL_AT } from './intro-terminal.js';

// at / narrow: [x, y, height] as fractions of the window
const POSTERS = [
  { src: 'car-917.jpeg', title: 'PORSCHE 917', no: '01', w: 1, h: 1.42, tilt: -0.04, at: [0.13, 0.36, 0.32], narrow: [0.04, 0.2, 0.2] },
  { src: 'car-f40.jpeg', title: 'FERRARI F40', no: '02', w: 1.36, h: 1.08, tilt: 0.035, at: [0.23, 0.12, 0.2], narrow: [0.1, 0.06, 0.1] },
  { src: 'car-heritage-1.jpeg', title: 'PORSCHE 962', no: '03', w: 1, h: 1.42, tilt: 0.05, at: [0.87, 0.24, 0.3], narrow: [0.96, 0.18, 0.2] },
  { src: 'car-911.jpeg', title: 'PORSCHE 911', no: '04', w: 1, h: 1.42, tilt: -0.06, at: [0.75, 0.42, 0.19], narrow: [0.88, 0.4, 0.12] },
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

  // ---------- Posters ----------
  const posters = POSTERS.map(p => {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 });
    posterTexture(p, maxAniso).then(tex => { mat.map = tex; mat.needsUpdate = true; });
    const geo = new THREE.PlaneGeometry(p.w, p.h, 10, 14);
    // Paper that's been on the wall a while: the bottom corners lift off a little
    const v = geo.attributes.position;
    for (let i = 0; i < v.count; i++) {
      const nx = v.getX(i) / (p.w / 2), ny = v.getY(i) / (p.h / 2);
      v.setZ(i, 0.006 + Math.max(0, -ny) ** 3 * (0.35 + Math.abs(nx) ** 2) * 0.05);
    }
    geo.computeVertexNormals();
    const sheet = shadowed(new THREE.Mesh(geo, mat));
    group.add(sheet);
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0xefe6c6, roughness: 0.8, transparent: true, opacity: 0.82 });
    for (const sx of [-1, 1]) {
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.065), tapeMat);
      tape.position.set(sx * (p.w / 2 - 0.03), p.h / 2 - 0.02, 0.012);
      tape.rotation.z = sx * -0.62;
      group.add(tape);
    }
    group.rotation.z = p.tilt;
    scene.add(group);
    return { p, group };
  });

  // ---------- Shelf with the football and baseball ----------
  const shelf = new THREE.Group();
  const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.42), new THREE.MeshStandardMaterial({ map: woodTexture(maxAniso), roughness: 0.6 })));
  board.position.set(0, -0.035, 0.21);
  shelf.add(board);
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x22201d, roughness: 0.4, metalness: 0.7 });
  for (const x of [-0.55, 0.55]) {
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
  const paperMat = new THREE.MeshBasicMaterial({ color: 0xf4f1ea, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
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
  phone.position.set(0.76, 0, 0.5);
  phone.rotation.y = -0.3;
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

  // ---------- Bat leaning on the wall ----------
  const batHolder = new THREE.Group();
  scene.add(batHolder);

  const loader = new GLTFLoader();
  const load = (name, size) => loader.loadAsync(`models/${name}/${name}.gltf`).then(g => normalize(g.scene, size));
  load('american_football', 0.62).then(ball => {
    ball.rotation.set(0, 0.5, 0);
    ball.position.set(-0.3, 0, 0.22);
    shelf.add(ball);
  });
  load('baseball_01', 0.2).then(ball => {
    ball.position.set(0.42, 0, 0.2);
    shelf.add(ball);
  });
  load('baseball_bat', 1.9).then(bat => {
    // Stand it up along its longest axis, then lean the top against the wall
    const box = new THREE.Box3().setFromObject(bat), size = box.getSize(new THREE.Vector3());
    const upright = new THREE.Group();
    if (size.x >= size.y && size.x >= size.z) bat.rotation.z = Math.PI / 2;
    else if (size.z >= size.y) bat.rotation.x = Math.PI / 2;
    upright.add(bat);
    const b2 = new THREE.Box3().setFromObject(upright);
    bat.position.y -= b2.min.y;
    upright.rotation.set(-0.16, 0.3, 0.13);
    batHolder.add(upright);
  });

  // ---------- Layout ----------
  let scale = 1;
  function layout({ screenToPlane, w, h, pxPerUnit }) {
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

    // Desk sized so the laptop screen is a set share of the window
    const screenPx = narrow ? w * 0.42 : THREE.MathUtils.clamp(w * 0.27, 240, 460);
    const s = screenPx / (SCREEN_W * pxPerUnit * 1.08);
    screenToPlane(w / 2, h * (narrow ? 0.84 : 0.81), 0.5 * s, v);
    desk.position.set(0, v.y, 0);
    desk.scale.setScalar(s);
    for (const leg of legs) leg.scale.y = Math.max(0.1, (v.y - floorY) / s - 0.07);

    screenToPlane(w * (narrow ? 0.84 : 0.83), h * (narrow ? 0.6 : 0.6), 0, v);
    shelf.position.set(v.x, v.y, 0);
    shelf.scale.setScalar(scale * (narrow ? 0.8 : 1));

    screenToPlane(w * (narrow ? 0.93 : 0.94), h * 0.5, 0, v);
    batHolder.position.set(v.x, floorY, 0.32 * scale);
    batHolder.scale.setScalar(scale);
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

  return { layout, update, screen, screenSize: [SCREEN_W, SCREEN_H], paperMat };
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
  texture.anisotropy = maxAniso;
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
  function update(dt) {
    if (!ready) return;
    const blank = dt >= 0 && dt < 0.35;
    const p = dt < 0.35 ? 0 : Math.min(1, (dt - 0.5) / 0.6);
    const key = blank ? 'blank' : p.toFixed(3);
    if (key === lastKey) return;
    lastKey = key;
    if (blank) {
      // The app relaunching with the new build
      g.fillStyle = '#2e8b47';
      g.fillRect(0, 0, W, H);
    } else draw(Math.max(0, p));
    texture.needsUpdate = true;
  }

  return { texture, update };
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
