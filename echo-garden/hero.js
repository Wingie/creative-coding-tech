// Echo Garden hero scene.
// A potted plant (Poly Haven "Potted Plant 02", CC0; a primitive plant if it
// fails to load), the Pocket Scion box with one clip on a leaf and one probe
// in the soil, and a Rotrics DexArm built from primitives. The arm visits a
// leaf, rests its tool on it (the circuit closes: the Scion light and cables
// glow, notes rise, echo rings spread), lifts away, and moves to the next leaf.
//
// Units are centimetres. The table top is y = 0. The pot stands at the origin.
//
// URL switches (for testing and for the README):
//   ?t=8         freeze the loop at 8 s (a contact), no animation
//   ?capture=1   also load assets/capture/garden.splat (Kinect capture) and
//                show a "capture / model" toggle. Off by default.

import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// ---------------------------------------------------------------- timing ----
// One visit = CYCLE seconds. Each phase is [start, end] inside the visit.
// Change these to retime the loop; the contact effects follow CONTACT.
export const TIMING = {
  CYCLE: 20,
  TRAVEL_OUT: [1.5, 5.0],   // home -> above the leaf
  LOWER: [5.0, 6.5],        // above the leaf -> resting on it
  CONTACT: [6.5, 13.0],     // tool on the leaf, circuit closed
  LIFT: [13.0, 14.5],       // back up above the leaf
  TRAVEL_BACK: [14.5, 18.0],// above the leaf -> home
  NOTE_EVERY: 0.55,         // mean seconds between notes while in contact
  RING_EVERY: 1.6,          // seconds between echo rings while the echo is up
  ECHO_DECAY: 6.0,          // seconds for the echo to fall to 1/e after a lift
};

// ------------------------------------------------------------- DexArm -------
// Real-ish proportions (cm). DexArm: 150 mm upper arm, 150 mm forearm,
// about 320 mm reach from the base axis, 4 axes (base yaw, shoulder, elbow, tool).
const ARM = {
  base: new THREE.Vector3(30, 0, -2), // where the arm stands on the table
  baseR: 7.5, baseH: 3.0,
  shoulderH: 11.5,     // shoulder axis height above the table
  shoulderX: 1.5,      // shoulder axis sits a little forward of the yaw axis
  L1: 15, L2: 15,      // link lengths
  wristOff: 2.0,       // horizontal offset from the forearm end to the tool axis
  toolLen: 6.5,        // tool flange to tip
};

const PLANT_HEIGHT = 30;   // the glTF plant is scaled to about this many cm

// ---------------------------------------------------------------- helpers ---
const params = new URLSearchParams(location.search);
const FROZEN_T = params.has('t') ? parseFloat(params.get('t')) : null;
const WANT_CAPTURE = params.get('capture') === '1';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarse = window.matchMedia('(pointer: coarse)').matches;
const small = Math.min(window.innerWidth, window.innerHeight) < 600;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const phase = (t, [a, b]) => (t - a) / (b - a);
const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

// --------------------------------------------------------------- textures ---
function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c99a6a';
  g.fillRect(0, 0, 256, 256);
  const rnd = mulberry32(7);
  for (let i = 0; i < 60; i++) {
    const y = rnd() * 256;
    g.strokeStyle = `rgba(${120 + rnd() * 30},${80 + rnd() * 20},${45},${0.06 + rnd() * 0.08})`;
    g.lineWidth = 1 + rnd() * 3;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}

function noteTexture(glyph) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 48px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText(glyph, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ plant ---
// Both plant builders return the same shape:
//   { group, leafPoints: Vector3[] (world), potTopY, potRadius, soilY }

async function loadPolyHavenPlant() {
  const gltf = await new GLTFLoader().loadAsync('assets/potted_plant_02/potted_plant_02_1k.gltf');
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  const s = PLANT_HEIGHT / (box.max.y - box.min.y);
  root.scale.setScalar(s);
  root.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
  const group = new THREE.Group();
  group.add(root);
  group.updateMatrixWorld(true);

  let leaves = null, pot = null, dirt = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const n = (o.name + ' ' + (o.parent ? o.parent.name : '')).toLowerCase();
    if (n.includes('leaves')) leaves = o;
    else if (n.includes('dirt')) dirt = o;
    else if (n.includes('pot')) pot = o;
  });
  if (!leaves || !pot) throw new Error('unexpected plant model layout');
  // Leaves are alpha-tested cards in some exports; keep both faces visible.
  [].concat(leaves.material).forEach((m) => { m.side = THREE.DoubleSide; });

  const potBox = new THREE.Box3().setFromObject(pot);
  const soilBox = dirt ? new THREE.Box3().setFromObject(dirt) : potBox;
  const pos = leaves.geometry.attributes.position;
  const v = new THREE.Vector3();
  const leafPoints = [];
  const step = Math.max(1, Math.floor(pos.count / 4000));
  for (let i = 0; i < pos.count; i += step) {
    v.fromBufferAttribute(pos, i).applyMatrix4(leaves.matrixWorld);
    leafPoints.push(v.clone());
  }
  return {
    group, leafPoints,
    potTopY: potBox.max.y,
    potRadius: (potBox.max.x - potBox.min.x) / 2,
    soilY: soilBox.max.y,
    source: 'polyhaven',
  };
}

function buildPrimitivePlant() {
  const group = new THREE.Group();
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xc0623b, roughness: 0.9 });
  const prof = [[0, 0], [5.5, 0], [6.2, 10.5], [7.6, 11], [7.6, 13.5], [6.8, 13.5], [6.6, 12.5]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), terracotta);
  pot.castShadow = pot.receiveShadow = true;
  group.add(pot);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(6.7, 24),
    new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 12.6;
  group.add(soil);

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5f8a3a, roughness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5da443, roughness: 0.7, side: THREE.DoubleSide });
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(2.5, 2.8, 7, 2.6, 10, 0);
  shape.bezierCurveTo(7, -2.6, 2.5, -2.8, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(shape, 8);
  leafGeo.rotateX(-Math.PI / 2);
  const p = leafGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, -0.012 * x * x + 0.12 * Math.abs(z));
  }
  leafGeo.computeVertexNormals();

  const stemTop = new THREE.Vector3(0, 30, 0);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 12.6, 0), new THREE.Vector3(0.6, 20, 0.3), stemTop]), 12, 0.45, 6), stemMat);
  group.add(stem);
  const leaves = [[17, 0.2], [19, 2.3], [21, -0.7], [23, 3.8], [24.5, 1.0], [26, -2.2], [28, 4.9], [29.5, 2.6]];
  const leafPoints = [];
  leaves.forEach(([h, az]) => {
    const from = new THREE.Vector3(0.3, h, 0);
    const dir = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    const to = from.clone().addScaledVector(dir, 5).add(new THREE.Vector3(0, 2, 0));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      from, from.clone().addScaledVector(dir, 2.5).add(new THREE.Vector3(0, 1.6, 0)), to]), 6, 0.22, 5), stemMat));
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.copy(to);
    leaf.rotation.set(0, az, 0.12);
    leaf.castShadow = true;
    group.add(leaf);
    leaf.updateMatrixWorld(true);
    for (let x = 2; x <= 9; x += 1) {
      leafPoints.push(leaf.localToWorld(new THREE.Vector3(x, -0.012 * x * x, 0)));
    }
  });
  return { group, leafPoints, potTopY: 13.5, potRadius: 7.6, soilY: 12.6, source: 'primitive' };
}

// ------------------------------------------------------------ arm targets ---
function armLocal(world) {
  const dx = world.x - ARM.base.x, dz = world.z - ARM.base.z;
  return { yaw: Math.atan2(-dz, dx), r: Math.hypot(dx, dz), y: world.y };
}
function reachable({ r, y }) {
  const wx = r - ARM.wristOff - ARM.shoulderX;
  const wy = y + ARM.toolLen - ARM.shoulderH;
  const d = Math.hypot(wx, wy);
  return d < ARM.L1 + ARM.L2 - 1.5 && d > 8 && r > 11;
}

function pickTargets(plant, n = 3) {
  const toPlant = Math.atan2(ARM.base.z, -ARM.base.x); // yaw that faces the pot
  const cands = plant.leafPoints.filter((p) => {
    if (p.y < plant.potTopY + 3) return false;
    const L = armLocal(p);
    let dyaw = L.yaw - toPlant;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    return Math.abs(dyaw) < 1.1 && reachable(L);
  }).filter((p) => !plant.leafPoints.some((q) => // nothing of the plant right above it
    q.y > p.y + 1.5 && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 1.8 * 1.8));
  if (cands.length === 0) return [];
  // Highest points first (the tool comes from above); keep picks at least
  // MIN_APART cm from each other so the arm visits different leaves.
  const MIN_APART = 6;
  const sorted = cands.slice().sort((a, b) => b.y - a.y);
  const out = [];
  for (const p of sorted) {
    if (out.every((q) => q.distanceTo(p) >= MIN_APART)) out.push(p);
    if (out.length === n) break;
  }
  // Pull each pick a little toward its neighbours so the tool lands on the
  // leaf blade, not its very edge.
  out.forEach((p, i) => {
    const near = cands.filter((q) => q.distanceTo(p) < 2.5);
    const c = near.reduce((acc, q) => acc.add(q), new THREE.Vector3()).multiplyScalar(1 / near.length);
    out[i] = p.clone().lerp(c, 0.6);
  });
  out.sort((a, b) => armLocal(a).yaw - armLocal(b).yaw);
  return out.length === 3 ? [out[1], out[0], out[2]] : out;
}

// -------------------------------------------------------------- the arm -----
function buildArm(mats) {
  const root = new THREE.Group();
  root.position.copy(ARM.base);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(ARM.baseR, ARM.baseR + 0.4, ARM.baseH, 32), mats.body);
  base.position.y = ARM.baseH / 2;
  root.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ARM.baseR - 0.2, 0.18, 6, 40), mats.accent);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = ARM.baseH + 0.05;
  root.add(ring);

  const turret = new THREE.Group();
  turret.position.y = ARM.baseH;
  root.add(turret);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1.6, 32), mats.light);
  disc.position.y = 0.8;
  turret.add(disc);
  const towerH = ARM.shoulderH - ARM.baseH - 1.2;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(7.5, towerH, 8), mats.body);
  tower.position.set(-0.8, 1.6 + towerH / 2 - 0.4, 0);
  turret.add(tower);

  const jointGeo = new THREE.CylinderGeometry(2.3, 2.3, 9, 20);
  const shoulder = new THREE.Mesh(jointGeo, mats.light);
  shoulder.rotation.x = Math.PI / 2;
  turret.add(shoulder);
  const elbow = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 6.4, 18), mats.light);
  elbow.rotation.x = Math.PI / 2;
  turret.add(elbow);

  // Upper arm: two side plates like the DexArm's parallel links.
  const upper = new THREE.Group();
  [-2.6, 2.6].forEach((z) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 1.2), mats.body);
    plate.position.z = z;
    upper.add(plate);
  });
  turret.add(upper);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1, 3.2), mats.body);
  turret.add(fore);

  const wrist = new THREE.Mesh(new THREE.BoxGeometry(ARM.wristOff + 2.4, 2.4, 3.4), mats.body);
  turret.add(wrist);
  const tool = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.5, ARM.toolLen - 2, 20), mats.light);
  turret.add(tool);
  const tipLight = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, emissive: 0x000000, roughness: 0.4, metalness: 0.4 });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2, 14), tipLight);
  tip.rotation.z = Math.PI;
  turret.add(tip);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const S = new THREE.Vector2(ARM.shoulderX, ARM.shoulderH - ARM.baseH);
  shoulder.position.set(S.x, S.y, 0);

  function placeLink(obj, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    obj.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
    obj.rotation.z = Math.atan2(dy, dx);
    obj.scale.set(1, 1, 1);
    const len = Math.hypot(dx, dy);
    obj.children.length ? obj.children.forEach((c) => (c.scale.x = len / 3.4)) : (obj.scale.x = len / 2.8);
  }

  // Move the tool tip to a world point. Returns the clamped tip actually reached.
  function setTip(world) {
    const L = armLocal(world);
    turret.rotation.y = L.yaw;
    const W = new THREE.Vector2(L.r - ARM.wristOff, world.y + ARM.toolLen - ARM.baseH);
    const v = W.clone().sub(S);
    let d = v.length();
    const dc = THREE.MathUtils.clamp(d, Math.abs(ARM.L1 - ARM.L2) + 2, ARM.L1 + ARM.L2 - 0.05);
    const a = Math.atan2(v.y, v.x);
    if (dc !== d) { W.copy(S).add(new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(dc)); d = dc; }
    const b = Math.acos(THREE.MathUtils.clamp((ARM.L1 ** 2 + d * d - ARM.L2 ** 2) / (2 * ARM.L1 * d), -1, 1));
    const th1 = a + b; // elbow up
    const E = new THREE.Vector2(S.x + ARM.L1 * Math.cos(th1), S.y + ARM.L1 * Math.sin(th1));
    placeLink(upper, S, E);
    placeLink(fore, E, W);
    elbow.position.set(E.x, E.y, 0);
    const F = new THREE.Vector2(W.x + ARM.wristOff, W.y);
    wrist.position.set((W.x + F.x) / 2, W.y, 0);
    tool.position.set(F.x, F.y - (ARM.toolLen - 2) / 2 - 1.0, 0);
    tip.position.set(F.x, F.y - ARM.toolLen + 1.0, 0);
  }

  return { root, setTip, tipMaterial: tipLight, turret };
}

// ------------------------------------------------------------ Pocket Scion --
function buildScion(plant, mats) {
  const group = new THREE.Group();
  const boxPos = new THREE.Vector3(-plant.potRadius - 9, 0, plant.potRadius * 0.55 + 5);
  const body = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6, 2, 1, 2), mats.scion);
  body.position.copy(boxPos).add(new THREE.Vector3(0, 1.6, 0));
  body.rotation.y = 0.5;
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0x000000, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), ledMat);
  led.position.set(2.6, 1.65, -1.4);
  body.add(led);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.6, 14), mats.light);
  knob.position.set(-2.4, 1.8, -1.0);
  body.add(knob);
  body.updateMatrixWorld(true);

  // Leaf clip: a leaf point on the Scion's side of the plant, mid height.
  const toBox = new THREE.Vector2(boxPos.x, boxPos.z).normalize();
  let best = null, bestScore = -Infinity;
  const midY = (plant.potTopY + PLANT_HEIGHT) / 2;
  plant.leafPoints.forEach((p) => {
    if (p.y < plant.potTopY + 2) return;
    const h = new THREE.Vector2(p.x, p.z);
    const score = h.dot(toBox) - Math.abs(p.y - midY) * 0.6;
    if (score > bestScore) { bestScore = score; best = p; }
  });
  const clipAt = best ? best.clone() : new THREE.Vector3(-8, plant.potTopY + 6, 4);
  const soilAt = new THREE.Vector3(toBox.x * plant.potRadius * 0.45, plant.soilY, toBox.y * plant.potRadius * 0.45);

  const portA = body.localToWorld(new THREE.Vector3(4.5, 0.6, 1.2));
  const portB = body.localToWorld(new THREE.Vector3(4.5, -0.2, 2.0));
  const cableMats = [];
  function cable(from, to, colour, lift) {
    const mid1 = from.clone().lerp(to, 0.33);
    mid1.y = Math.max(from.y, 0.4) + lift * 0.4;
    const mid2 = from.clone().lerp(to, 0.7);
    mid2.y = to.y + lift;
    const curve = new THREE.CatmullRomCurve3([from, mid1, mid2, to]);
    const m = new THREE.MeshStandardMaterial({ color: colour, emissive: 0x000000, roughness: 0.6 });
    cableMats.push(m);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, small ? 24 : 48, 0.22, 6), m);
    tube.castShadow = true;
    group.add(tube);
    return m;
  }
  cable(portA, clipAt.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xb8402e, 4);
  cable(portB, soilAt.clone().add(new THREE.Vector3(0, 2.5, 0)), 0x2d2a26, 3);

  // Clip on the leaf (two jaws) and a probe in the soil.
  const clip = new THREE.Group();
  const jaw = new THREE.BoxGeometry(2.2, 0.35, 0.9);
  const j1 = new THREE.Mesh(jaw, mats.metal); j1.position.y = 0.35;
  const j2 = new THREE.Mesh(jaw, mats.metal); j2.position.y = -0.25;
  clip.add(j1, j2);
  clip.position.copy(clipAt);
  clip.lookAt(clipAt.x * 2, clipAt.y, clipAt.z * 2);
  group.add(clip);
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 8), mats.metal);
  probe.position.copy(soilAt).add(new THREE.Vector3(0, 0.6, 0));
  group.add(probe);

  return { group, body, ledMat, cableMats, clipAt };
}

// ----------------------------------------------------------------- scene ----
async function main() {
  const wrap = document.getElementById('hero-stage');
  const canvas = document.getElementById('hero-canvas');
  const fallback = document.getElementById('hero-fallback');
  if (!wrap || !canvas) return;
  if (!hasWebGL()) { wrap.classList.add('no-webgl'); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    wrap.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.minDistance = 55;
  controls.maxDistance = 230;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.42;
  const lookAt = new THREE.Vector3(13, 12, 2);
  controls.target.copy(lookAt);
  if (coarse) canvas.style.touchAction = 'pan-y'; // let phones scroll past the hero

  // Light: a synthwave night. Violet sky light, a low orange sun behind the plant as a rim,
  // a cyan fill from the front left and a magenta kicker from the right.
  scene.add(new THREE.HemisphereLight(0xc8a8ff, 0x2a0a40, 1.25));
  const sun = new THREE.DirectionalLight(0xffb070, 2.4);
  sun.position.set(-20, 70, -80);
  sun.target.position.copy(lookAt);
  scene.add(sun, sun.target);
  const key = new THREE.DirectionalLight(0xfff0ff, 1.5);
  key.position.set(-30, 90, 60);
  key.target.position.copy(lookAt);
  scene.add(key, key.target);
  if (renderer.shadowMap.enabled) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -60, right: 70, top: 60, bottom: -50, near: 10, far: 220 });
    key.shadow.bias = -0.0008;
    key.shadow.radius = 4;
  }
  const cyanFill = new THREE.DirectionalLight(0x22e6ff, 0.9);
  cyanFill.position.set(-70, 25, 80);
  scene.add(cyanFill);
  const magKick = new THREE.DirectionalLight(0xff2bd6, 1.1);
  magKick.position.set(90, 20, 10);
  scene.add(magKick);
  scene.fog = new THREE.Fog(0x2a0a52, 160, 420);

  // Floor: a dark disc the rig stands on, rimmed in neon, on an endless magenta grid.
  const table = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 3, small ? 40 : 72),
    new THREE.MeshStandardMaterial({ color: 0x1b0a3c, roughness: 0.7, metalness: 0.1 }));
  table.position.set(12, -1.5, 2);
  table.receiveShadow = true;
  scene.add(table);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(52, 0.45, 8, small ? 64 : 128),
    new THREE.MeshBasicMaterial({ color: 0xff2bd6 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(12, 0, 2);
  scene.add(rim);
  const grid = new THREE.GridHelper(900, 60, 0xff2bd6, 0xb0179a);
  grid.position.set(12, -3.1, 2);
  grid.material.transparent = true;
  grid.material.opacity = 0.75;
  scene.add(grid);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: 0x12052b }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(12, -3.2, 2);
  scene.add(ground);

  // The striped synthwave sun, far behind the plant, always facing the camera.
  const sunCv = document.createElement('canvas');
  sunCv.width = sunCv.height = 256;
  const sg = sunCv.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ffd84a'); grad.addColorStop(0.5, '#ffb238'); grad.addColorStop(1, '#ff4f8a');
  sg.fillStyle = grad;
  sg.beginPath(); sg.arc(128, 128, 126, 0, Math.PI * 2); sg.fill();
  sg.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 7; k++) { const y = 150 + k * 16, h = 3 + k * 1.6; sg.fillRect(0, y, 256, h); }
  const sunTex = new THREE.CanvasTexture(sunCv);
  sunTex.colorSpace = THREE.SRGBColorSpace;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false }));
  sunSprite.scale.set(150, 150, 1);
  sunSprite.position.set(120, 22, -330);
  sunSprite.renderOrder = -1;
  scene.add(sunSprite);

  const mats = {
    body: new THREE.MeshStandardMaterial({ color: 0x34363b, roughness: 0.55, metalness: 0.2 }),
    light: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.45, metalness: 0.3 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x2f7fb8, emissive: 0x1a4f78, emissiveIntensity: 0.8 }),
    scion: new THREE.MeshStandardMaterial({ color: 0x23201d, roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.35, metalness: 0.8 }),
  };

  const model = new THREE.Group();   // everything that the capture toggle hides
  scene.add(model);

  let plant;
  try {
    plant = await loadPolyHavenPlant();
  } catch (e) {
    console.warn('Echo Garden: plant model did not load, using the primitive plant.', e);
    plant = buildPrimitivePlant();
  }
  model.add(plant.group);
  wrap.dataset.plant = plant.source;

  const arm = buildArm(mats);
  model.add(arm.root);
  const scion = buildScion(plant, mats);
  model.add(scion.group);

  let targets = pickTargets(plant, 3);
  if (targets.length === 0) {
    targets = [new THREE.Vector3(10, plant.potTopY + 8, -2)];
  }
  wrap.dataset.targets = String(targets.length);
  if (params.get('debug') === '1') {
    targets.forEach((v) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false }));
      m.position.copy(v);
      m.renderOrder = 10;
      model.add(m);
    });
  }
  const toPlantYaw = Math.atan2(ARM.base.z, -ARM.base.x);
  const homeL = { yaw: toPlantYaw + 0.9, r: 17, y: 16 };

  // Notes and echo rings.
  const noteTex = [noteTexture('♪'), noteTexture('♫')];
  const noteColour = new THREE.Color(cssVar('--note-3d', '#f2c14e'));
  const notes = Array.from({ length: small ? 14 : 24 }, (_, i) => {
    const m = new THREE.SpriteMaterial({ map: noteTex[i % 2], color: noteColour, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(3.4);
    s.visible = false;
    s.userData = { age: 0, life: 4, from: new THREE.Vector3(), sway: 0 };
    model.add(s);
    return s;
  });
  const ringGeo = new THREE.RingGeometry(0.94, 1, small ? 48 : 96);
  ringGeo.rotateX(-Math.PI / 2);
  const ringColour = new THREE.Color(cssVar('--ring-3d', '#6f9e4f'));
  const rings = Array.from({ length: 6 }, () => {
    const m = new THREE.MeshBasicMaterial({ color: ringColour, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const r = new THREE.Mesh(ringGeo, m);
    r.position.set(0, 0.08, 0);
    r.visible = false;
    r.userData = { age: 0, life: 7, amp: 1 };
    model.add(r);
    return r;
  });

  // Captions that follow the models on screen.
  const captionLayer = document.getElementById('hero-captions');
  const captions = [
    { text: 'Plant', at: () => new THREE.Vector3(-6, PLANT_HEIGHT + 2, 0) },
    { text: 'Pocket Scion', at: () => scion.body.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 4.5, 0)) },
    { text: 'Robot arm', at: () => ARM.base.clone().add(new THREE.Vector3(3, 0, 9)) },
  ].map((c) => {
    const el = document.createElement('span');
    el.className = 'hero-caption';
    el.textContent = c.text;
    captionLayer && captionLayer.appendChild(el);
    return { ...c, el };
  });

  // ------------------------------------------------------------- the loop --
  const rnd = mulberry32(42);
  let echo = 0;
  let nextNote = 0, nextRing = 0;
  const tmp = new THREE.Vector3();

  function tipAt(t) {
    const visit = Math.floor(t / TIMING.CYCLE);
    const u = t - visit * TIMING.CYCLE;
    const T = targets[visit % targets.length];
    const TL = armLocal(T);
    const V = { yaw: TL.yaw, r: TL.r, y: T.y + 7 };
    const lerpL = (A, B, k, arc) => {
      let dy = B.yaw - A.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      return { yaw: A.yaw + dy * k, r: A.r + (B.r - A.r) * k, y: A.y + (B.y - A.y) * k + arc * Math.sin(Math.PI * k) };
    };
    let L, contact = 0;
    if (u < TIMING.TRAVEL_OUT[0]) L = homeL;
    else if (u < TIMING.TRAVEL_OUT[1]) L = lerpL(homeL, V, ease(phase(u, TIMING.TRAVEL_OUT)), 4);
    else if (u < TIMING.LOWER[1]) L = lerpL(V, TL, ease(phase(u, TIMING.LOWER)), 0);
    else if (u < TIMING.CONTACT[1]) {
      L = { ...TL, y: TL.y - 0.15 * Math.sin((u - TIMING.CONTACT[0]) * 1.3) ** 2 };
      contact = Math.min(1, (u - TIMING.CONTACT[0]) / 0.4);
    } else if (u < TIMING.LIFT[1]) {
      L = lerpL(TL, V, ease(phase(u, TIMING.LIFT)), 0);
      contact = Math.max(0, 1 - (u - TIMING.LIFT[0]) / 0.3);
    } else if (u < TIMING.TRAVEL_BACK[1]) L = lerpL(V, homeL, ease(phase(u, TIMING.TRAVEL_BACK)), 4);
    else L = homeL;
    const p = new THREE.Vector3(ARM.base.x + L.r * Math.cos(L.yaw), L.y, ARM.base.z - L.r * Math.sin(L.yaw));
    return { p, contact, target: T };
  }

  function spawnNote(origin) {
    const s = notes.find((n) => !n.visible);
    if (!s) return;
    s.visible = true;
    s.userData.age = 0;
    s.userData.life = 3.5 + rnd() * 1.5;
    s.userData.from.copy(origin).add(tmp.set((rnd() - 0.5) * 10, rnd() * 3, (rnd() - 0.5) * 10));
    s.userData.sway = rnd() * Math.PI * 2;
    s.material.map = noteTex[rnd() < 0.5 ? 0 : 1];
  }
  function spawnRing(amp) {
    const r = rings.find((n) => !n.visible) || rings.reduce((a, b) => (a.userData.age > b.userData.age ? a : b));
    r.visible = true;
    r.userData.age = 0;
    r.userData.amp = amp;
  }

  const ledOn = new THREE.Color(0x7dff8a), cableGlow = new THREE.Color(0xffc861), tipGlow = new THREE.Color(0x9cff9a);
  let simT = 0;

  function step(t, dt) {
    const { p, contact } = tipAt(t);
    arm.setTip(p);
    scion.ledMat.emissive.copy(ledOn).multiplyScalar(contact * 2.2);
    scion.cableMats.forEach((m) => m.emissive.copy(cableGlow).multiplyScalar(contact * 0.55));
    arm.tipMaterial.emissive.copy(tipGlow).multiplyScalar(contact * 1.2);

    // The echo follows the contact up quickly and falls slowly, like the loop.
    echo = contact > echo ? echo + (contact - echo) * Math.min(1, dt * 3) : echo * Math.exp(-dt / TIMING.ECHO_DECAY);

    if (contact > 0.5 && t >= nextNote) {
      const top = targets[0];
      spawnNote(new THREE.Vector3(0, (plant.potTopY + PLANT_HEIGHT) / 2 + 4, 0).lerp(top, 0.15));
      nextNote = t + TIMING.NOTE_EVERY * (0.4 + rnd() * 1.4);
    }
    if (echo > 0.05 && t >= nextRing) {
      spawnRing(echo);
      nextRing = t + TIMING.RING_EVERY;
    }
    notes.forEach((s) => {
      if (!s.visible) return;
      const d = s.userData;
      d.age += dt;
      const k = d.age / d.life;
      if (k >= 1) { s.visible = false; s.material.opacity = 0; return; }
      s.position.copy(d.from).add(tmp.set(Math.sin(d.sway + d.age * 1.4) * 1.6, d.age * 4.2, Math.cos(d.sway + d.age) * 0.8));
      s.material.opacity = Math.min(1, k * 6) * (1 - k);
    });
    rings.forEach((r) => {
      if (!r.visible) return;
      const d = r.userData;
      d.age += dt;
      const k = d.age / d.life;
      if (k >= 1) { r.visible = false; return; }
      r.scale.setScalar(plant.potRadius + 1 + k * 34);
      r.material.opacity = 0.8 * d.amp * (1 - k) * Math.min(1, k * 8);
    });
  }

  // Bring the scene to time t from t - warm (so particles and rings exist).
  function warmTo(t) {
    const from = Math.max(0, t - 9);
    simT = from;
    while (simT < t) { step(simT, 1 / 30); simT += 1 / 30; }
    step(t, 0);
  }

  // ------------------------------------------------------ capture (splat) --
  let capture = null;
  async function loadCapture() {
    const GS = await import('./vendor/gaussian-splats-3d.module.js');
    const viewer = new GS.DropInViewer({
      sharedMemoryForWorkers: false, gpuAcceleratedSort: false, dynamicScene: false,
      sphericalHarmonicsDegree: 0, logLevel: GS.LogLevel.None,
    });
    await viewer.addSplatScene('assets/capture/garden.splat', {
      showLoadingUI: false, splatAlphaRemovalThreshold: 5,
      position: [12, 0, 0], scale: [28, 28, 28],
    });
    scene.add(viewer);
    return viewer;
  }
  const toggle = document.getElementById('hero-toggle');
  if (WANT_CAPTURE && toggle) {
    toggle.hidden = false;
    let showCapture = false;
    toggle.addEventListener('click', async () => {
      showCapture = !showCapture;
      toggle.disabled = true;
      try {
        if (showCapture && !capture) capture = await loadCapture();
        if (capture) capture.visible = showCapture;
        model.visible = !showCapture;
        captionLayer && (captionLayer.hidden = showCapture);
        toggle.textContent = showCapture ? 'Show the model' : 'Show the 3D scan';
        wrap.dataset.view = showCapture ? 'capture' : 'model';
      } catch (e) {
        console.warn('Echo Garden: capture did not load.', e);
        showCapture = false;
        model.visible = true;
        toggle.textContent = 'Capture unavailable';
      }
      toggle.disabled = false;
      requestRender();
    });
  }

  // ---------------------------------------------------------- framing ------
  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function frame() {
    const aspect = camera.aspect || 1.6;
    const dist = 100 * Math.max(1, 1.45 / aspect) ** 0.85;
    const dir = new THREE.Vector3(-0.32, 0.26, 1).normalize();
    camera.position.copy(lookAt).addScaledVector(dir, dist);
    controls.maxDistance = Math.max(230, dist * 1.6);
    controls.update();
  }
  resize();
  frame();
  new ResizeObserver(() => { resize(); requestRender(); }).observe(wrap);

  function placeCaptions() {
    if (!captionLayer || captionLayer.hidden) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    captions.forEach((c) => {
      const v = c.at().project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      c.el.style.opacity = vis ? '' : '0';
      c.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
    });
  }

  // ------------------------------------------------------------ run loop ---
  let running = false, needRender = true, visible = true, last = 0, t = 0;
  const still = FROZEN_T !== null || reduceMotion.matches;
  function requestRender() { needRender = true; if (!running) tick(performance.now()); }
  let lastChange = 0;
  controls.addEventListener('change', () => { needRender = true; lastChange = performance.now(); });
  controls.addEventListener('start', () => { lastChange = performance.now(); requestRender(); });

  if (still) warmTo(FROZEN_T !== null ? FROZEN_T : 8);
  else warmTo(0);

  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    const animate = !still && !reduceMotion.matches && visible && !document.hidden;
    if (animate) { t += dt; step(t, dt); needRender = true; }
    controls.update();
    if (needRender) {
      renderer.render(scene, camera);
      placeCaptions();
      needRender = false;
    }
    running = animate || now - lastChange < 1500;
    if (running && visible && !document.hidden) requestAnimationFrame(tick);
    else running = false;
  }
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) requestRender();
  }).observe(wrap);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });
  reduceMotion.addEventListener?.('change', () => requestRender());

  wrap.classList.add('ready');
  window.__echoGarden = {
    ready: true, plant: plant.source, targets: targets.map((v) => v.toArray().map((n) => +n.toFixed(1))),
    setTime(x) { warmTo(x); needRender = true; renderer.render(scene, camera); placeCaptions(); },
  };
  requestRender();
}

main().catch((e) => {
  console.error('Echo Garden hero failed', e);
  document.getElementById('hero-stage')?.classList.add('no-webgl');
});
