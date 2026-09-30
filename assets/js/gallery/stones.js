// Marble steles for the cloud path: a fluted shaft with a pediment, the photo set
// into a carved border with a neon rim, and the textures they share
// (640 far, 1280 close, vector, cutout).
import * as THREE from "three";

const PHOTO_MAX_W = 6.0;
const PHOTO_MAX_H = 7.5;
const NEAR_1280 = 26;
const LOAD_640 = 90;

// Deterministic noise, so every stele weathers the same way each time.
function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// Weathered marble: a box with the surface nudged about, front face left flat.
function shaftGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 6, 2).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = hash(Math.round(x * 8), Math.round(y * 8), Math.round(z * 8)) - 0.5;
    const amp = z > 0.49 ? 0.006 : 0.025;
    p.setXYZ(i, x + n * amp, y, z + n * amp);
  }
  g.computeVertexNormals();
  return g;
}

// A low triangular pediment, like the top of a temple front.
function pedimentGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(-0.5, 0);
  sh.lineTo(0.5, 0);
  sh.lineTo(0, 0.42);
  sh.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
}

export const SHAFT_GEO = shaftGeometry();
const PEDIMENT_GEO = pedimentGeometry();
const FLUTE_GEO = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false, 0, Math.PI);
const PLANE = new THREE.PlaneGeometry(1, 1);

export function photoSize(photo) {
  const a = (photo.w || 2) / (photo.h || 3);
  if (a < PHOTO_MAX_W / PHOTO_MAX_H) return { w: PHOTO_MAX_H * a, h: PHOTO_MAX_H };
  return { w: PHOTO_MAX_W, h: PHOTO_MAX_W / a };
}

// Grayscale variant of MeshBasicMaterial for the B&W parallel path.
function grayMaterial(opts) {
  const m = new THREE.MeshBasicMaterial(opts);
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\n diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));"
    );
  };
  m.customProgramCacheKey = () => "gray";
  return m;
}

// Shared texture cache. Each photo id holds its textures while any stone uses it.
export class Textures {
  constructor(base, renderer) {
    this.base = base;
    this.tl = new THREE.TextureLoader();
    this.tl.setCrossOrigin("anonymous");
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.cache = new Map(); // id -> {t640, t1280, vec, cut, users, waiting:{}}
    this.inflight = 0;
    this.queue = [];
  }

  entry(id) {
    let e = this.cache.get(id);
    if (!e) {
      e = { users: 0, waiting: {} };
      this.cache.set(id, e);
    }
    return e;
  }

  want(photo, kind, rel, done) {
    const e = this.entry(photo.id);
    if (e[kind]) return done(e[kind]);
    if (!rel) return;
    if (e.waiting[kind]) {
      e.waiting[kind].push(done);
      return;
    }
    e.waiting[kind] = [done];
    this.queue.push({ e, kind, rel });
    this.pump();
  }

  pump() {
    while (this.inflight < 6 && this.queue.length) {
      const { e, kind, rel } = this.queue.shift();
      this.inflight++;
      const finish = (tex) => {
        this.inflight--;
        if (tex) {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = this.aniso;
          e[kind] = tex;
        }
        const cbs = e.waiting[kind] || [];
        delete e.waiting[kind];
        if (tex) for (const cb of cbs) cb(tex);
        this.pump();
      };
      this.tl.load(this.base + rel, finish, undefined, () => finish(null));
    }
  }

  use(id) {
    this.entry(id).users++;
  }

  release(id) {
    const e = this.cache.get(id);
    if (!e) return;
    e.users--;
    if (e.users <= 0) {
      for (const k of ["t640", "t1280", "vec", "cut"]) if (e[k]) e[k].dispose();
      this.cache.delete(id);
    }
  }

  dropSharp(id) {
    const e = this.cache.get(id);
    if (e && e.t1280) {
      e.t1280.dispose();
      e.t1280 = null;
    }
  }
}

const marble = {
  main: new THREE.MeshStandardMaterial({ color: 0xe6e1d2, roughness: 0.6, metalness: 0.02, emissive: 0x0d1a22 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xd2ccba, roughness: 0.5, metalness: 0.05, emissive: 0x0c161d }),
  ghost: new THREE.MeshStandardMaterial({
    color: 0x9fc6d8,
    roughness: 0.6,
    transparent: true,
    opacity: 0.5,
  }),
};
// Neon rim where the grid light catches the marble.
const neon = {
  main: new THREE.MeshBasicMaterial({ color: 0x4fe3ff }),
  ghost: new THREE.MeshBasicMaterial({ color: 0x3fc0ff, transparent: true, opacity: 0.4 }),
};

// One stone with its photo. `variant` is "photo" | "vector" | "gray" | "cutout".
export class Stone {
  constructor(photo, variant, parallel) {
    this.photo = photo;
    this.variant = variant;
    this.parallel = parallel;
    const { w, h } = photoSize(photo);
    this.group = new THREE.Group();
    const seed = hash(photo.id.length, photo.id.charCodeAt(0), photo.id.charCodeAt(3));
    const bodyW = w + 1.8;
    const H = h + 4.1 + seed * 0.8; // room for the plinth below and the border above
    const stone = parallel ? marble.ghost : marble.main;
    const trim = parallel ? marble.ghost : marble.trim;
    const rim = parallel ? neon.ghost : neon.main;
    const add = (geo, mat, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };

    this.rock = add(SHAFT_GEO, stone, bodyW, H, 1.2, 0, H / 2, 0);
    add(SHAFT_GEO, trim, bodyW + 0.9, 0.5, 1.7, 0, 0.25, 0); // plinth
    add(SHAFT_GEO, trim, bodyW + 0.66, 0.4, 1.6, 0, H + 0.2, 0); // capital
    add(PEDIMENT_GEO, trim, bodyW + 0.66, 2.6, 1.6, 0, H + 0.4, 0); // pediment
    // fluted edges
    for (const side of [-1, 1]) {
      add(FLUTE_GEO, trim, 0.42, H - 0.3, 0.42, side * (bodyW / 2 - 0.08), H / 2, 0.48);
    }

    const picY = 2.1 + h / 2 + seed * 0.3;
    // carved border, then the neon rim just outside it
    const bw = w + 0.75;
    const bh = h + 0.75;
    add(SHAFT_GEO, trim, bw + 0.4, bh + 0.4, 0.2, 0, picY, 0.6);
    for (const [sx, sy, dx, dy] of [
      [bw + 0.5, 0.09, 0, bh / 2 + 0.22],
      [bw + 0.5, 0.09, 0, -bh / 2 - 0.22],
      [0.09, bh + 0.5, bw / 2 + 0.22, 0],
      [0.09, bh + 0.5, -bw / 2 - 0.22, 0],
    ]) {
      add(SHAFT_GEO, rim, sx, sy, 0.14, dx, picY + dy, 0.7);
    }

    const opts = { color: 0x14181c, transparent: parallel, opacity: parallel ? 0.85 : 1 };
    const mat = variant === "gray" ? grayMaterial(opts) : new THREE.MeshBasicMaterial(opts);
    this.pic = new THREE.Mesh(PLANE, mat);
    this.pic.scale.set(w, h, 1);
    this.pic.position.set(0, picY, 0.72);
    this.pic.userData.stone = this;
    this.group.add(this.pic);
    this.height = H;
    this.picY = picY;
    this.sharp = false;
    this.dim = false;
  }

  setMap(tex) {
    const m = this.pic.material;
    m.map = tex;
    m.color.set(tex ? (this.dim ? 0x39423f : 0xffffff) : 0x14181c);
    m.needsUpdate = true;
  }

  setDim(dim) {
    this.dim = dim;
    this.pic.material.color.set(this.pic.material.map ? (dim ? 0x39423f : 0xffffff) : 0x14181c);
  }

  // Load what this stone needs for its distance to the walker.
  update(tex, d, mode) {
    const p = this.photo;
    let kind = this.variant;
    if (!this.parallel) {
      const t = mode === "photo" ? p.treatment || "photo" : mode;
      kind = (t === "vector" && p.vector) || (t === "cutout" && p.cutout) ? t : "photo";
    }
    if (kind === "vector" && !p.vector) kind = "photo";
    if (kind === "cutout" && !p.cutout) kind = "photo";
    if (d > LOAD_640) return;
    if (kind === "vector") {
      if (this.shown !== "vec") tex.want(p, "vec", p.vector, (t) => ((this.shown = "vec"), this.setMap(t)));
      return;
    }
    if (kind === "cutout") {
      if (this.shown !== "cut") tex.want(p, "cut", p.cutout, (t) => ((this.shown = "cut"), this.setMap(t)));
      return;
    }
    if (!this.shown || this.shown === "vec" || this.shown === "cut") {
      tex.want(p, "t640", p.src640, (t) => {
        if (this.shown !== "t1280") {
          this.shown = "t640";
          this.setMap(t);
        }
      });
    }
    if (!this.parallel && d < NEAR_1280 && this.shown !== "t1280") {
      tex.want(p, "t1280", p.src1280, (t) => ((this.shown = "t1280"), this.setMap(t)));
    } else if (this.shown === "t1280" && d > NEAR_1280 * 2.5) {
      tex.want(p, "t640", p.src640, (t) => ((this.shown = "t640"), this.setMap(t)));
    }
  }

  dispose() {
    this.pic.material.dispose();
  }
}

// Canvas text on a plane, for fork signs.
export function textPlane(text, { w = 2.4, h = 0.6, size = 110, bg = "rgba(6,12,16,0.88)", fg = "#a9f0ff" } = {}) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * h) / w);
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let s = size;
  g.font = `600 ${s}px "Helvetica Neue", Arial, sans-serif`;
  while (g.measureText(text).width > c.width - 60 && s > 30) {
    s -= 6;
    g.font = `600 ${s}px "Helvetica Neue", Arial, sans-serif`;
  }
  g.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  m.userData.dispose = () => {
    t.dispose();
    m.material.dispose();
    m.geometry.dispose();
  };
  return m;
}
