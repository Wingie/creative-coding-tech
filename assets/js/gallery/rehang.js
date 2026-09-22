// Frames on the walls, and the live re-hang when the theme filter changes.
// Matching frames slide along their wall to close gaps; frames that move to
// another wall fade out and back in; frames that no longer match fade away.
import * as THREE from "three";
import { frameSize, FRAME_GAP } from "./building.js";

const SLIDE_MS = 600;
const FADE_MS = 280;
const PLACEHOLDER = 0x2b2825;

let glowTexture = null;
function glow() {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 110, 10, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,214,160,0.55)");
  grad.addColorStop(0.55, "rgba(255,190,130,0.18)");
  grad.addColorStop(1, "rgba(255,180,120,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const lampGeo = new THREE.CylinderGeometry(0.035, 0.06, 0.22, 12);
const lampMat = new THREE.MeshLambertMaterial({ color: 0x1a1816 });

export class Frame {
  constructor(photo, room, scene) {
    this.photo = photo;
    this.room = room;
    const { w, h } = frameSize(photo, room.scale);
    this.w = w;
    this.h = h;
    this.group = new THREE.Group();
    this.group.visible = false;

    this.body = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0x0e0d0c, transparent: true }));
    this.body.scale.set(w + 0.08, h + 0.08, 0.04);

    this.pic = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: PLACEHOLDER, transparent: true }));
    this.pic.scale.set(w, h, 1);
    this.pic.position.z = 0.021;
    this.pic.userData.frame = this;

    this.vec = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    this.vec.scale.set(w, h, 1);
    this.vec.position.z = 0.022;
    this.vec.visible = false;
    this.vec.userData.frame = this;

    this.glow = new THREE.Mesh(
      unitPlane,
      new THREE.MeshBasicMaterial({
        map: glow(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.glow.scale.set(w + 1.4, h + 1.6, 1);
    this.glow.position.set(0, 0.25, -0.02);

    this.lamp = new THREE.Mesh(lampGeo, lampMat);
    this.lamp.rotation.x = Math.PI / 3;
    this.lamp.position.set(0, h / 2 + 0.55, 0.28);

    this.group.add(this.glow, this.body, this.pic, this.vec, this.lamp);
    scene.add(this.group);

    this.opacity = 0;
    this.vecMix = 0; // 1 = vector fully shown over the photo
    this.target = null;
    this.anim = null;
    this.runIndex = -1;
  }

  setOpacity(o) {
    this.opacity = o;
    this.body.material.opacity = o;
    this.pic.material.opacity = o;
    this.glow.material.opacity = o;
    this.vec.material.opacity = o * this.vecMix;
    this.group.visible = o > 0.001;
  }

  place(t) {
    this.group.position.set(t.x, t.y, t.z);
    this.group.rotation.y = t.rot;
  }

  // t: {x,y,z,rot,run} or null to hide
  setTarget(t, now) {
    const prev = this.target;
    this.target = t;
    if (!t) {
      if (this.opacity > 0) this.anim = { kind: "out", t0: now, from: this.opacity };
      return;
    }
    if (!prev || this.opacity < 0.01) {
      this.place(t);
      this.anim = { kind: "in", t0: now, from: this.opacity };
    } else if (prev.run === t.run) {
      this.anim = { kind: "slide", t0: now, from: { ...this.group.position }, to: t };
    } else {
      this.anim = { kind: "swap", t0: now, from: this.opacity };
    }
  }

  update(now) {
    const a = this.anim;
    if (!a) return;
    const k = (ms) => Math.min(1, (now - a.t0) / ms);
    if (a.kind === "in") {
      const p = k(FADE_MS);
      this.setOpacity(a.from + (1 - a.from) * p);
      if (p >= 1) this.anim = null;
    } else if (a.kind === "out") {
      const p = k(FADE_MS);
      this.setOpacity(a.from * (1 - p));
      if (p >= 1) this.anim = null;
    } else if (a.kind === "slide") {
      const p = ease(k(SLIDE_MS));
      this.group.position.set(
        a.from.x + (a.to.x - a.from.x) * p,
        a.from.y + (a.to.y - a.from.y) * p,
        a.from.z + (a.to.z - a.from.z) * p
      );
      if (this.opacity < 1) this.setOpacity(Math.min(1, this.opacity + 0.1));
      if (p >= 1) this.anim = null;
    } else if (a.kind === "swap") {
      const p = k(FADE_MS);
      this.setOpacity(a.from * (1 - p));
      if (p >= 1) {
        this.place(this.target);
        this.anim = { kind: "in", t0: now, from: 0 };
      }
    }
  }

  get busy() {
    return this.anim !== null;
  }
}

function ease(p) {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

// Positions for the given photos on a room's walls, in order.
export function layout(room, photos) {
  const out = new Map();
  const queue = photos.slice();
  const y = room.isHall ? 1.8 : 1.6;
  room.runs.forEach((r, runIndex) => {
    const placed = [];
    let cursor = 0;
    while (queue.length) {
      const { w } = frameSize(queue[0], room.scale);
      if (cursor + w > r.len) break;
      placed.push({ photo: queue.shift(), w, at: cursor });
      cursor += w + FRAME_GAP;
    }
    const used = placed.length ? cursor - FRAME_GAP : 0;
    const offset = (r.len - used) / 2;
    for (const p of placed) {
      const s = offset + p.at + p.w / 2;
      out.set(p.photo.id, {
        x: r.ax + r.dx * s + r.nx * 0.05,
        y,
        z: r.az + r.dz * s + r.nz * 0.05,
        rot: Math.atan2(r.nx, r.nz),
        run: runIndex,
      });
    }
  });
  return out;
}

export function matches(photo, theme) {
  return theme === "all" || (photo.themes || []).includes(theme);
}

// Re-hang every room for a theme. Returns how many photos match per room.
export function rehang(rooms, framesByRoom, theme, now) {
  const counts = {};
  for (const room of rooms) {
    const active = room.photos.filter((p) => matches(p, theme));
    const spots = layout(room, active);
    for (const f of framesByRoom.get(room.id)) f.setTarget(spots.get(f.photo.id) || null, now);
    counts[room.id] = spots.size;
    if (room.sign) room.sign.material.opacity = spots.size ? 1 : 0.22;
  }
  return counts;
}
