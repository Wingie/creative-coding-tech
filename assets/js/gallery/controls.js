// Walking: WASD to move, drag to look, arrow keys to turn, click the floor to walk there.
// Movement eases in and out so it glides. No pointer lock anywhere.
import { COLLIDE_T } from "./building.js";

export const EYE = 1.62;
const SPEED = 6.5;
const EASE = 3.2; // how fast the walker reaches full speed
const RADIUS = 0.35;
const LOOK = 0.0022;
const DRAG_LOOK = 0.005;
const TAP_MS = 280;
const TAP_PX = 8;

export class Controls {
  constructor(camera, dom, walls, start) {
    this.camera = camera;
    this.dom = dom;
    this.walls = walls;
    this.x = start.x;
    this.z = start.z;
    this.yaw = start.yaw;
    this.pitch = 0;
    this.keys = new Set();
    this.walkTarget = null;
    this.locked = false; // kept false: pointer lock is not used
    this.vx = 0;
    this.vz = 0;
    this.eye = EYE; // a print can lift the viewer to its own height
    this.onTap = null; // (ndcX, ndcY, centre) => void
    this.enabled = true;

    addEventListener("keydown", (e) => {
      if (!this.enabled || e.target.closest?.("input,textarea,button")) return;
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());

    let down = null;
    dom.addEventListener("pointerdown", (e) => {
      if (!this.enabled) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY, moved: false };
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        // some synthetic pointers cannot be captured; dragging still works
      }
    });
    dom.addEventListener("pointermove", (e) => {
      if (!down || this.locked) return;
      const dx = e.clientX - down.lx;
      const dy = e.clientY - down.ly;
      down.lx = e.clientX;
      down.ly = e.clientY;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_PX) down.moved = true;
      if (down.moved) {
        this.turn(-dx * DRAG_LOOK * (e.pointerType === "mouse" ? -1 : 1), -dy * DRAG_LOOK * (e.pointerType === "mouse" ? -1 : 1));
        this.walkTarget = null;
      }
    });
    dom.addEventListener("pointerup", (e) => {
      if (!down) return;
      const tap = !down.moved && performance.now() - down.t < TAP_MS * 3;
      down = null;
      if (!tap || !this.onTap) return;
      if (this.locked) {
        this.onTap(0, 0, true, e.pointerType);
      } else {
        const r = dom.getBoundingClientRect();
        this.onTap(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, false, e.pointerType);
      }
    });
  }

  lock() {}

  unlock() {}

  turn(dYaw, dPitch) {
    this.yaw -= dYaw;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - dPitch));
  }

  teleport(x, z, yaw) {
    this.vx = 0;
    this.vz = 0;
    this.eye = EYE;
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.pitch = 0;
    this.walkTarget = null;
    this.keys.clear();
  }

  walkTo(x, z) {
    this.walkTarget = { x, z };
  }

  update(dt) {
    let fx = 0;
    let fz = 0;
    const k = this.keys;
    if (k.has("KeyW") || k.has("ArrowUp")) fz += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) fz -= 1;
    if (k.has("KeyA")) fx -= 1;
    if (k.has("KeyD")) fx += 1;
    if (k.has("ArrowLeft")) this.yaw += 1.8 * dt;
    if (k.has("ArrowRight")) this.yaw -= 1.8 * dt;
    const speed = SPEED * (k.has("ShiftLeft") || k.has("ShiftRight") ? 2.2 : 1);

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wx = 0;
    let wz = 0;
    if (fx || fz) {
      this.walkTarget = null;
      const len = Math.hypot(fx, fz);
      // forward is (-sin, -cos), right is (cos, -sin)
      wx = ((-sin * fz + cos * fx) / len) * speed;
      wz = ((-cos * fz - sin * fx) / len) * speed;
    } else if (this.walkTarget) {
      const dx = this.walkTarget.x - this.x;
      const dz = this.walkTarget.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) this.walkTarget = null;
      else {
        wx = (dx / d) * Math.min(speed, d * 1.6);
        wz = (dz / d) * Math.min(speed, d * 1.6);
      }
    }
    // ease towards the wanted velocity so starting and stopping glide
    const ease = Math.min(1, EASE * dt);
    this.vx += (wx - this.vx) * ease;
    this.vz += (wz - this.vz) * ease;
    if (Math.hypot(this.vx, this.vz) < 0.008) {
      this.vx = 0;
      this.vz = 0;
    }
    const mx = this.vx * dt;
    const mz = this.vz * dt;
    if (mx || mz) {
      const bx = this.x;
      const bz = this.z;
      this.x += mx;
      this.z += mz;
      this.collide();
      // stuck against a wall while walking to a tap target: give up
      if (this.walkTarget && Math.hypot(this.x - bx, this.z - bz) < Math.hypot(mx, mz) * 0.2) this.walkTarget = null;
    }

    this.camera.position.set(this.x, this.eye, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  collide() {
    const r = RADIUS + COLLIDE_T / 2;
    for (let pass = 0; pass < 2; pass++) {
      for (const w of this.walls) {
        const vx = w.x2 - w.x1;
        const vz = w.z2 - w.z1;
        const len2 = vx * vx + vz * vz;
        let t = ((this.x - w.x1) * vx + (this.z - w.z1) * vz) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = w.x1 + vx * t;
        const pz = w.z1 + vz * t;
        const dx = this.x - px;
        const dz = this.z - pz;
        const d = Math.hypot(dx, dz);
        if (d < r && d > 1e-6) {
          this.x = px + (dx / d) * r;
          this.z = pz + (dz / d) * r;
        }
      }
    }
  }
}
