// Standing prints for the cloud path. The picture is the object: a frameless slab
// on a low dark base, so nothing competes with it. Plus the textures the slabs
// share (640 far, 1280 close, vector, cutout).
import * as THREE from "three";

// Prints are sized by their longest edge, so a landscape picture is as big as a
// portrait one. Capping width instead made landscapes less than half the height
// of portraits, and they framed quite differently as you stepped between them.
const PHOTO_LONG = 18;
const NEAR_1280 = 26;
const LOAD_640 = 90;

// Deterministic noise, so every slab stands the same way each time.
function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);

export function photoSize(photo) {
  const a = (photo.w || 2) / (photo.h || 3);
  return a >= 1 ? { w: PHOTO_LONG, h: PHOTO_LONG / a } : { w: PHOTO_LONG * a, h: PHOTO_LONG };
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

// Dark stone: it reads only as an edge and a shadow, and lets the environment map
// carry the sheen. Nothing here should draw the eye away from the picture.
const slab = {
  main: new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.35, metalness: 0.15 }),
  base: new THREE.MeshStandardMaterial({ color: 0x141a20, roughness: 0.25, metalness: 0.3 }),
  ghost: new THREE.MeshBasicMaterial({ color: 0x14384a, transparent: true, opacity: 0.35, depthWrite: false }),
};

// One standing print. `variant` is "photo" | "vector" | "gray" | "cutout".
export class Stone {
  constructor(photo, variant, parallel) {
    this.photo = photo;
    this.variant = variant;
    this.parallel = parallel;
    const { w, h } = photoSize(photo);
    this.group = new THREE.Group();
    const seed = hash(photo.id.length, photo.id.charCodeAt(0), photo.id.charCodeAt(3));
    const body = parallel ? slab.ghost : slab.main;
    const foot = parallel ? slab.ghost : slab.base;
    const add = (mat, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(BOX, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.castShadow = !parallel;
      this.group.add(m);
      return m;
    };

    // the print sits at standing-eye height, the slab is barely larger than it
    const picY = 1.15 + h / 2 + seed * 0.25;
    const H = picY + h / 2 + 0.22;
    add(body, w + 0.18, H, 0.16, 0, H / 2, 0);
    add(foot, w + 0.7, 0.22, 0.8, 0, 0.11, 0);

    const opts = { color: 0x14181c, transparent: parallel, opacity: parallel ? 0.85 : 1 };
    const mat = variant === "gray" ? grayMaterial(opts) : new THREE.MeshBasicMaterial(opts);
    this.pic = new THREE.Mesh(PLANE, mat);
    this.pic.scale.set(w, h, 1);
    this.pic.position.set(0, picY, 0.085);
    this.pic.userData.stone = this;
    this.group.add(this.pic);
    this.height = H;
    this.picY = picY;
    this.picH = h;
    this.picW = w;
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
