// Texture levels by distance: nothing far away, 640px nearby, 1280px up close.
// Also handles the vector crossfade and cutout billboards.
import * as THREE from "three";

const NEAR_1280 = 3;
const DROP_1280 = 6;
const LOAD_640 = 22;
const DROP_ALL = 32;
const VECTOR_FULL = 4; // vector fully shown beyond this distance
const VECTOR_GONE = 1.6; // photo fully shown inside this distance
const MAX_PARALLEL = 6;

export class Loader {
  constructor(base, renderer) {
    this.base = base;
    this.tl = new THREE.TextureLoader();
    this.tl.setCrossOrigin("anonymous");
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.inflight = 0;
    this.queue = [];
    this.pending = new Set();
    this.mode = "photo";
  }

  url(rel) {
    return this.base + rel;
  }

  request(key, rel, done) {
    if (this.pending.has(key)) return;
    this.pending.add(key);
    this.queue.push({ key, rel, done });
    this.pump();
  }

  pump() {
    while (this.inflight < MAX_PARALLEL && this.queue.length) {
      const job = this.queue.shift();
      this.inflight++;
      this.tl.load(
        this.url(job.rel),
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = this.aniso;
          this.finish(job);
          job.done(tex);
        },
        undefined,
        () => this.finish(job)
      );
    }
  }

  finish(job) {
    this.inflight--;
    this.pending.delete(job.key);
    this.pump();
  }

  // Treatment in effect for one frame: the global toggle, or the curator's choice in Photo mode.
  treatmentFor(photo) {
    const t = this.mode === "photo" ? photo.treatment || "photo" : this.mode;
    if (t === "vector" && !photo.vector) return "photo";
    if (t === "cutout" && !photo.cutout) return "photo";
    return t;
  }

  update(frames, camPos, scene) {
    // nearest first, so what you look at loads before the far end of the corridor
    const sorted = frames
      .map((f) => ({ f, d: f.group.position.distanceTo(camPos) }))
      .sort((a, b) => a.d - b.d);
    for (const { f, d } of sorted) {
      const live = f.target !== null;
      const tr = this.treatmentFor(f.photo);
      f.tex = f.tex || {};

      if (live && d < LOAD_640 && !f.tex.t640) {
        this.request(f.photo.id + ":640", f.photo.src640, (t) => {
          f.tex.t640 = t;
          if (!f.tex.t1280) setMap(f.pic, t);
        });
      }
      if (live && d < NEAR_1280 && !f.tex.t1280) {
        this.request(f.photo.id + ":1280", f.photo.src1280, (t) => {
          f.tex.t1280 = t;
          setMap(f.pic, t);
        });
      }
      if (f.tex.t1280 && d > DROP_1280) {
        f.tex.t1280.dispose();
        f.tex.t1280 = null;
        if (f.tex.t640) setMap(f.pic, f.tex.t640);
      }
      if (d > DROP_ALL) {
        for (const k of ["t640", "t1280", "vec", "cut"]) {
          if (f.tex[k]) {
            f.tex[k].dispose();
            f.tex[k] = null;
          }
        }
        setMap(f.pic, null);
        f.vec.visible = false;
        if (f.billboard) f.billboard.visible = false;
      }

      // vector: shown from afar, resolving into the photo as you walk up
      if (tr === "vector" && live && d < LOAD_640) {
        if (!f.tex.vec) {
          this.request(f.photo.id + ":vec", f.photo.vector, (t) => {
            f.tex.vec = t;
            f.vec.material.map = t;
            f.vec.material.needsUpdate = true;
          });
        }
        f.vec.visible = !!f.tex.vec;
        f.vecMix = clamp01((d - VECTOR_GONE) / (VECTOR_FULL - VECTOR_GONE));
      } else {
        f.vec.visible = false;
        f.vecMix = 0;
      }
      f.vec.material.opacity = f.opacity * f.vecMix;

      // cutout: the sitter stands in front of their print
      if (tr === "cutout" && live && d < LOAD_640) {
        if (!f.billboard) f.billboard = makeBillboard(f, scene);
        if (!f.tex.cut) {
          this.request(f.photo.id + ":cut", f.photo.cutout, (t) => {
            f.tex.cut = t;
            f.billboard.material.map = t;
            f.billboard.material.needsUpdate = true;
            const a = t.image.width / t.image.height;
            f.billboard.scale.set(1.75 * a, 1.75, 1);
          });
        }
        f.billboard.visible = !!f.tex.cut && f.opacity > 0.05;
        f.billboard.material.opacity = f.opacity;
      } else if (f.billboard) {
        f.billboard.visible = false;
      }
    }
  }
}

function makeBillboard(f, scene) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05 })
  );
  m.visible = false;
  m.userData.frame = f;
  m.userData.billboard = true;
  scene.add(m);
  return m;
}

// Keep billboards standing in front of their frame and turned toward the viewer.
export function placeBillboards(frames, camPos) {
  for (const f of frames) {
    const b = f.billboard;
    if (!b || !b.visible) continue;
    const g = f.group;
    const nx = Math.sin(g.rotation.y);
    const nz = Math.cos(g.rotation.y);
    b.position.set(g.position.x + nx * 1.3, b.scale.y / 2, g.position.z + nz * 1.3);
    b.rotation.y = Math.atan2(camPos.x - b.position.x, camPos.z - b.position.z);
  }
}

function setMap(mesh, tex) {
  mesh.material.map = tex;
  mesh.material.color.set(tex ? 0xffffff : 0x2b2825);
  mesh.material.needsUpdate = true;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
