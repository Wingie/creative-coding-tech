// The cloud path: a red carpet through the clouds that forks along the generated
// category tree in path.json. Each fork splits the photos into two families of
// look-alike pictures. At the end of a branch the carpet keeps going photo by
// photo to the nearest one not seen yet, and when those run out it forks again
// from the top of the tree. Segments behind the walker are recycled.
import * as THREE from "three";
import { Stone, Textures, textPlane, photoSize } from "./stones.js";
import { Sky } from "./sky.js";
import { parallelCopies, Ghosts } from "./parallel.js";
import { Controls, EYE } from "./controls.js";
import { matches } from "./rehang.js";
import { PALETTE, makeComposer } from "./look.js";

const HALF_W = 7.5; // carpet half width
const WALK_HALF = 7.0; // how far from the centre line the walker may go
const STONE_OFF = 19; // prints stand this far from the centre line
const GAP = 1.2; // the join between one print and the next on the same side
const PER_NODE = 9; // a longer hall means fewer corners
const DRIFT_LEN = 6;
const AHEAD = 120;
const BEHIND = 170;
const JOIN_R = 15; // the junction room, wide enough to be a room
const FORK_TURN = Math.PI / 2; // a corner is a right angle or it is nothing

const carpetMat = new THREE.MeshStandardMaterial({ color: PALETTE.carpet, roughness: 0.82, metalness: 0 });
// one warm hairline so the carpet reads against the black sea; nothing else competes
const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffb066 });
const ghostCarpet = new THREE.MeshBasicMaterial({ color: 0x0e3a4e, transparent: true, opacity: 0.22, depthWrite: false });
const joinGeo = new THREE.CircleGeometry(JOIN_R, 32).rotateX(-Math.PI / 2);
const POOL_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const beaconMat = new THREE.MeshBasicMaterial({
  color: 0xffd9a0,
  transparent: true,
  opacity: 0.55,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,226,180,1)");
  grad.addColorStop(0.3, "rgba(255,170,90,0.45)");
  grad.addColorStop(1, "rgba(255,140,60,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

const fwd = (h) => new THREE.Vector2(-Math.sin(h), -Math.cos(h));
const rightOf = (h) => new THREE.Vector2(Math.cos(h), -Math.sin(h));

class Segment {
  constructor(world, start, heading, photos, info) {
    this.world = world;
    this.start = start.clone();
    this.heading = heading;
    this.photos = photos;
    this.nodeKey = info.nodeKey || null;
    this.drift = !!info.drift;
    this.label = info.label || "";
    // Pack each side edge to edge: pictures next to each other make a wall you
    // move along, rather than islands with nothing in between.
    this.places = [];
    const cursor = { "-1": 5, "1": 5 };
    photos.forEach((p, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const { w } = photoSize(p);
      this.places.push({ side, s: cursor[side] + w / 2 });
      cursor[side] += w + GAP;
    });
    this.length = Math.max(34, cursor["-1"], cursor["1"]) + 6;
    this.stones = [];
    this.copyStones = [];
    this.meshes = [];
    this.build();
  }

  point(s) {
    return this.start.clone().add(fwd(this.heading).multiplyScalar(s));
  }

  end() {
    return this.point(this.length);
  }

  build() {
    const w = this.world;
    const mid = this.point(this.length / 2);
    const make = (mat, width, dx, y, copy) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(width, this.length).rotateX(-Math.PI / 2), mat);
      const r = rightOf(this.heading).multiplyScalar(dx);
      m.position.set(mid.x + r.x + (copy ? copy.offset.x : 0), y + (copy ? copy.offset.y : 0), mid.y + r.y + (copy ? copy.offset.z : 0));
      m.rotation.y = this.heading;
      w.scene.add(m);
      this.meshes.push(m);
      return m;
    };
    this.carpet = make(carpetMat, HALF_W * 2, 0, 0);
    this.carpet.userData.carpet = true;
    this.carpet.receiveShadow = true;
    make(edgeMat, 0.07, HALF_W, 0.03);
    make(edgeMat, 0.07, -HALF_W, 0.03);
    for (const c of w.copies) make(ghostCarpet, HALF_W * 2, 0, 0, c);

    this.photos.forEach((p, i) => {
      const { side, s } = this.places[i];
      const at = this.point(s).add(rightOf(this.heading).multiplyScalar(side * STONE_OFF));
      // face the carpet: local +z points toward the centre line. No jitter now
      // that the prints touch — a crooked one would overlap its neighbour.
      const face = rightOf(this.heading).multiplyScalar(-side);
      const yaw = Math.atan2(face.x, face.y);
      const place = (stone, copy) => {
        stone.group.position.set(at.x + (copy ? copy.offset.x : 0), copy ? copy.offset.y : 0, at.y + (copy ? copy.offset.z : 0));
        stone.group.rotation.y = yaw;
        w.scene.add(stone.group);
      };
      const main = new Stone(p, "photo", false);
      main.segment = this;
      main.side = side; // which wall, so stepping can stay on one of them
      place(main);
      // a pool of light lying on the ground in front of the print, not a sprite
      // facing the camera: it stays put as you walk past, the way a floor lamp does
      const brazier = new THREE.Mesh(
        POOL_GEO,
        new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff9a44, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      const lampAt = at.clone().add(rightOf(this.heading).multiplyScalar(-side * 1.6));
      const pool = photoSize(p).w * 0.8;
      brazier.scale.set(pool, pool, 1);
      brazier.position.set(lampAt.x, 0.08, lampAt.y);
      w.scene.add(brazier);
      this.meshes.push(brazier);
      main.brazier = brazier;
      main.setDim(!matches(p, w.theme));
      this.stones.push(main);
      w.tex.use(p.id);
      for (const c of w.copies) {
        const st = new Stone(p, c.variant, true);
        place(st, c);
        this.copyStones.push({ st, main });
      }
    });
  }

  // Distance from a 2D point to the centre line, and the position along it.
  project(p) {
    const f = fwd(this.heading);
    const d = p.clone().sub(this.start);
    const s = THREE.MathUtils.clamp(d.dot(f), 0, this.length);
    const lat = d.dot(rightOf(this.heading));
    const foot = this.point(s);
    return { s, lat, dist: foot.distanceTo(p), foot, raw: d.dot(f) };
  }

  dispose() {
    const w = this.world;
    for (const m of this.meshes) {
      w.scene.remove(m);
      // POOL_GEO is shared by every light pool, so only the per-segment carpet
      // planes are disposed here; the pools own their materials instead.
      if (m.geometry === POOL_GEO) m.material.dispose();
      else m.geometry.dispose();
    }
    for (const st of this.stones) {
      w.scene.remove(st.group);
      st.dispose();
      w.tex.release(st.photo.id);
    }
    for (const { st } of this.copyStones) {
      w.scene.remove(st.group);
      st.dispose();
    }
    this.stones = [];
    this.copyStones = [];
  }
}

// A join (disc of carpet) where segments meet; forks also get a beacon and signs.
class Join {
  constructor(world, at, fork) {
    this.world = world;
    this.at = at.clone();
    this.objs = [];
    const add = (o) => {
      world.scene.add(o);
      this.objs.push(o);
    };
    const disc = new THREE.Mesh(joinGeo, carpetMat);
    disc.position.set(at.x, -0.02, at.y);
    add(disc);
    for (const c of world.copies) {
      const d = new THREE.Mesh(joinGeo, ghostCarpet);
      d.position.set(at.x + c.offset.x, c.offset.y - 0.02, at.y + c.offset.z);
      add(d);
    }
    if (fork) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 26, 10, 1, true), beaconMat);
      beam.position.set(at.x, 13, at.y);
      add(beam);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      glow.scale.set(12, 12, 1);
      glow.position.set(at.x, 5.5, at.y);
      add(glow);
      this.glow = glow;
    }
  }

  // The print that closes the hall: straight ahead past the junction, facing back
  // the way you came. A corridor wants something at the end of it.
  anchor(photo, heading) {
    if (!photo) return;
    const st = new Stone(photo, "photo", false);
    const at = this.at.clone().add(fwd(heading).multiplyScalar(JOIN_R + 6));
    st.group.position.set(at.x, 0, at.y);
    st.group.rotation.y = heading + Math.PI;
    st.side = 0;
    st.isAnchor = true;
    this.world.scene.add(st.group);
    this.world.tex.use(photo.id);
    this.world.anchors.push(st);
    this.anchorStone = st;
  }

  sign(text, at, heading, side) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.4, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a22 }));
    const base = at.clone().add(rightOf(heading).multiplyScalar(side * 4.6));
    post.position.set(base.x, 2.7, base.y);
    const plate = textPlane(side < 0 ? "← " + text : text + " →", { w: 7.2, h: 1.7, size: 130 });
    plate.position.set(base.x, 5.9, base.y);
    plate.rotation.y = heading;
    this.world.scene.add(post, plate);
    this.objs.push(post, plate);
  }

  dispose() {
    if (this.anchorStone) {
      const w = this.world;
      w.scene.remove(this.anchorStone.group);
      w.tex.release(this.anchorStone.photo.id);
      this.anchorStone.dispose();
      const i = w.anchors.indexOf(this.anchorStone);
      if (i >= 0) w.anchors.splice(i, 1);
      this.anchorStone = null;
    }
    for (const o of this.objs) {
      this.world.scene.remove(o);
      if (o.userData.dispose) o.userData.dispose();
      else if (o.geometry && o.geometry !== joinGeo) o.geometry.dispose();
    }
    this.objs = [];
  }
}

export class PathWorld {
  constructor(scene, data, base, renderer, opts) {
    this.scene = scene;
    this.data = data;
    this.nodes = data.nodes;
    this.photos = data.photos;
    for (const [id, p] of Object.entries(this.photos)) p.id = id;
    this.neighbours = data.neighbours || {};
    this.tex = new Textures(base, renderer);
    this.copies = opts.copies;
    this.theme = "all";
    this.mode = "photo";
    this.onEnter = opts.onEnter || (() => {});
    this.seen = new Set();
    this.segments = [];
    this.joins = [];
    this.anchors = [];
    this.line = []; // segments on the chosen route, in order
    this.fork = null;
    this.seed = 7;

    const rootPhotos = this.pick(data.root);
    const first = new Segment(this, new THREE.Vector2(0, 0), 0, rootPhotos, { nodeKey: data.root, label: "Everything" });
    this.segments.push(first);
    this.line.push(first);
    this.joins.push(new Join(this, new THREE.Vector2(0, 0), false));
    this.start = { x: 0, z: 1.2, yaw: 0 };
  }

  // Start again from a node the map chose. Everything built so far goes back.
  enterAt(key) {
    if (!this.nodes[key]) return false;
    for (const s of this.segments) s.dispose();
    for (const j of this.joins) j.dispose();
    this.segments = [];
    this.joins = [];
    this.anchors = [];
    this.line = [];
    this.fork = null;
    this.announced = null;
    this.seen.clear();
    const first = new Segment(this, new THREE.Vector2(0, 0), 0, this.pick(key), {
      nodeKey: key,
      label: this.nodes[key].name || "",
    });
    this.segments.push(first);
    this.line.push(first);
    this.joins.push(new Join(this, new THREE.Vector2(0, 0), false));
    return true;
  }

  // Hang a given set of photos as a fresh hall. Choosing an outfit should take
  // you to it, not dim the hall you happen to be standing in.
  enterPhotos(ids, label) {
    const photos = ids.map((i) => this.photos[i]).filter(Boolean);
    if (!photos.length) return false;
    for (const s of this.segments) s.dispose();
    for (const j of this.joins) j.dispose();
    this.segments = [];
    this.joins = [];
    this.anchors = [];
    this.line = [];
    this.fork = null;
    this.announced = null;
    for (const p of photos) this.seen.add(p.id);
    this.lastPhoto = photos[photos.length - 1].id;
    const first = new Segment(this, new THREE.Vector2(0, 0), 0, photos.slice(0, 14), { label: label || "", drift: true });
    this.segments.push(first);
    this.line.push(first);
    this.joins.push(new Join(this, new THREE.Vector2(0, 0), false));
    return true;
  }

  rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  // Up to PER_NODE unseen photos from a node, best first.
  pick(key) {
    const all = this.nodes[key].photos.map((id) => this.photos[id]).filter(Boolean);
    const byScore = (a, b) => (b.score || 0) - (a.score || 0);
    let fresh = all.filter((p) => !this.seen.has(p.id)).sort(byScore);
    if (fresh.length < 2) fresh = all.sort(byScore);
    const out = fresh.slice(0, PER_NODE);
    for (const p of out) this.seen.add(p.id);
    this.lastPhoto = out.length ? out[out.length - 1].id : this.lastPhoto;
    return out;
  }

  // Photo by photo to the nearest one not seen yet.
  driftFrom(id) {
    const out = [];
    let cur = id;
    while (out.length < DRIFT_LEN) {
      const next = (this.neighbours[cur] || []).find((n) => !this.seen.has(n) && this.photos[n]);
      if (!next) break;
      this.seen.add(next);
      out.push(this.photos[next]);
      cur = next;
    }
    if (out.length) this.lastPhoto = cur;
    return out;
  }

  tip() {
    return this.line[this.line.length - 1];
  }

  extend() {
    const tip = this.tip();
    const node = tip.nodeKey && !tip.drift ? this.nodes[tip.nodeKey] : null;
    const endPt = tip.end();
    if (node && node.children && node.children.length === 2) {
      this.makeFork(tip, endPt, node);
      return;
    }
    let photos = this.driftFrom(this.lastPhoto);
    let info = { drift: true, label: "Walking by likeness" };
    if (!photos.length) {
      // nothing similar left nearby: jump to the best photo not seen yet and carry on
      const fresh = Object.values(this.photos)
        .filter((q) => !this.seen.has(q.id))
        .sort((a, b) => (b.score || 0) - (a.score || 0))[0];
      if (fresh) {
        this.seen.add(fresh.id);
        this.lastPhoto = fresh.id;
        photos = [fresh, ...this.driftFrom(fresh.id)];
      }
    }
    if (!photos.length) {
      // nothing unseen nearby: fork again from the top of the tree
      if (this.seen.size >= Object.keys(this.photos).length - 2) this.seen.clear();
      photos = this.pick(this.data.root);
      info = { nodeKey: this.data.root, label: "Back to everything" };
    }
    // carry straight on: a drift segment is the same hall continuing
    const h = tip.heading;
    const start = endPt.clone().add(fwd(h).multiplyScalar(0.8));
    this.joins.push(new Join(this, endPt, false));
    const seg = new Segment(this, start, h, photos, info);
    this.segments.push(seg);
    this.line.push(seg);
  }

  makeFork(tip, at, node) {
    const join = new Join(this, at, true);
    this.joins.push(join);
    const branches = node.children.map((key, i) => {
      const side = i === 0 ? -1 : 1; // first child to the left
      let h = tip.heading - side * FORK_TURN;
      // if that corner would run into a hall still standing, take the straight on
      if (this.blocked(at, h)) h = this.blocked(at, tip.heading) ? tip.heading + Math.PI : tip.heading;
      const start = at.clone().add(fwd(h).multiplyScalar(JOIN_R - 0.3));
      const name = this.nodes[key].name || "";
      const seg = new Segment(this, start, h, this.pick(key), { nodeKey: key, label: name });
      this.segments.push(seg);
      join.sign(name, start, h, side);
      return seg;
    });
    const best = node.photos
      .map((id) => this.photos[id])
      .filter(Boolean)
      .sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    join.anchor(best, tip.heading);
    this.fork = { at, branches, join };
  }

  // Would a hall leaving `at` on heading `h` cross one that is already there?
  blocked(at, h) {
    const f = fwd(h);
    const reach = 90;
    for (let d = JOIN_R + 8; d < reach; d += 14) {
      const q = at.clone().add(f.clone().multiplyScalar(d));
      for (const seg of this.segments) {
        const pr = seg.project(q);
        if (pr.raw > -STONE_OFF && pr.raw < seg.length + STONE_OFF && Math.abs(pr.lat) < STONE_OFF * 1.6) return true;
      }
    }
    return false;
  }

  // Walking into a branch past its first stones commits to it.
  checkFork(p) {
    if (!this.fork) return;
    for (const b of this.fork.branches) {
      const pr = b.project(p);
      if (pr.raw > 3 && Math.abs(pr.lat) < HALF_W + 0.3) {
        for (const o of this.fork.branches) {
          if (o !== b) {
            o.dispose();
            this.segments.splice(this.segments.indexOf(o), 1);
          }
        }
        this.line.push(b);
        this.fork = null;
        this.onEnter(b.label);
        return;
      }
    }
  }

  // Keep the walker on the carpet (segments plus the discs where they meet).
  clamp(p) {
    let best = null;
    for (const seg of this.segments) {
      const pr = seg.project(p);
      if (pr.raw >= -0.2 && pr.raw <= seg.length + 0.2 && Math.abs(pr.lat) <= WALK_HALF) return p;
      const lat = THREE.MathUtils.clamp(pr.lat, -WALK_HALF, WALK_HALF);
      const q = seg.point(pr.s).add(rightOf(seg.heading).multiplyScalar(lat));
      const d = q.distanceTo(p);
      if (!best || d < best.d) best = { d, q };
    }
    for (const j of this.joins) {
      const d = p.distanceTo(j.at);
      if (d <= JOIN_R - 0.4) return p;
      const q = j.at.clone().add(p.clone().sub(j.at).setLength(JOIN_R - 0.4));
      const dq = q.distanceTo(p);
      if (!best || dq < best.d) best = { d: dq, q };
    }
    return best ? best.q : p;
  }

  update(p) {
    this.lastX = p.x;
    this.lastZ = p.y;
    this.checkFork(p);
    // keep path ahead of the walker until the next fork
    let guard = 0;
    while (!this.fork && this.tip().end().distanceTo(p) < AHEAD && guard++ < 4) this.extend();
    // entering a drift or restart segment announces itself
    const tip = this.tip();
    if (tip !== this.announced && tip.project(p).raw > 1 && Math.abs(tip.project(p).lat) < 2) {
      if (this.announced && (tip.drift || tip.label === "Back to everything")) this.onEnter(tip.label);
      this.announced = tip;
    }
    // recycle what is far behind
    const keep = new Set([this.line[this.line.length - 1], this.line[this.line.length - 2]]);
    if (this.fork) for (const b of this.fork.branches) keep.add(b);
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const s = this.segments[i];
      if (!keep.has(s) && s.project(p).dist > BEHIND) {
        s.dispose();
        this.segments.splice(i, 1);
        const li = this.line.indexOf(s);
        if (li >= 0) this.line.splice(li, 1);
      }
    }
    for (let i = this.joins.length - 1; i >= 0; i--) {
      if (this.joins[i].at.distanceTo(p) > BEHIND + 10) {
        this.joins[i].dispose();
        this.joins.splice(i, 1);
      }
    }
  }

  loadTextures(cam) {
    for (const seg of this.segments) {
      for (const st of seg.stones) st.update(this.tex, st.group.position.distanceTo(cam), this.mode);
      for (const { st, main } of seg.copyStones) st.update(this.tex, main.group.position.distanceTo(cam), this.mode);
    }
    for (const st of this.anchors) st.update(this.tex, st.group.position.distanceTo(cam), this.mode);
  }

  setTheme(t) {
    this.theme = t;
    for (const seg of this.segments) for (const st of seg.stones) st.setDim(!matches(st.photo, t));
  }

  setMode(m) {
    this.mode = m;
    for (const seg of this.segments) for (const st of seg.stones) st.shown = null;
  }

  // Every stele on the route, in the order you walk past them.
  panels() {
    const out = [];
    for (const seg of this.line) for (const st of seg.stones) out.push(st);
    if (this.fork) for (const b of this.fork.branches) for (const st of b.stones) out.push(st);
    return out;
  }

  pickables() {
    return this.segments
      .flatMap((s) => s.stones.map((st) => st.pic))
      .concat(this.anchors.map((st) => st.pic))
      .concat(this.segments.map((s) => s.carpet));
  }
}

// How much of the view height a print should fill when you are standing at it.
const FILL = 0.82;
const SNAP_RANGE = 46;
const GLIDE = 7.5; // how fast the camera travels between prints
const SETTLE = 250; // after walking, how long before a print claims you again

// Stops you square on in front of a print, and steps print by print. Stepping is
// how you get through the gallery; walking is there if you want it.
class PanelSnap {
  constructor(world) {
    this.world = world;
    this.enabled = true;
    this.target = null;
    this.released = 0;
    this.arrow = false;
    this.aim = 0;
    this.cut = false; // next move lands in one frame rather than gliding
    this.vfov = Math.PI * 70 / 180; // set from the camera once it exists
    this.dist = 10;
  }

  // The print you are nearest, so a step has somewhere to start from.
  nearest(x, z) {
    let best = null;
    for (const st of this.world.panels()) {
      const d = Math.hypot(st.group.position.x - x, st.group.position.z - z);
      if (!best || d < best.d) best = { st, d };
    }
    return best && best.st;
  }

  standFor(st) {
    // Back off by this print's own height, so a landscape and a portrait both
    // fill the frame instead of one looking half the size of the other.
    const d = (st.picH || 8) / 2 / Math.tan((this.vfov / 2) * FILL);
    this.dist = d;
    this.aim = 0; // the viewer rises to the picture, so the view stays level
    const yaw = st.group.rotation.y;
    const dir = new THREE.Vector2(Math.sin(yaw), Math.cos(yaw));
    const at = new THREE.Vector2(st.group.position.x, st.group.position.z).add(dir.multiplyScalar(d));
    return { x: at.x, z: at.y, yaw: Math.atan2(dir.x, dir.y) };
  }

  // Along the wall you are already facing. Alternating sides on every step swung
  // the camera through 180 degrees each time, which is what made this unusable.
  step(dir) {
    const side = this.target ? this.target.side : -1;
    const list = this.world.panels().filter((st) => st.side === side);
    const i = list.indexOf(this.target);
    const next = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i) + dir))];
    if (next) this.target = next;
  }

  // Across to the facing wall, to whichever print is nearest where you stand.
  // Measured from the live camera: world.lastX only updates every 120ms and is
  // unset before the first world update, which made the distance NaN and sent
  // you to an arbitrary print instead of the one opposite.
  cross() {
    const here = this.target;
    if (!here || !here.segment) return;
    // Stay inside the hall you are standing in. `side` is relative to the
    // segment's heading, so the nearest stone with the opposite side anywhere in
    // the world could belong to another hall that the path has looped back past
    // — which is how crossing used to land you on the wall you were already
    // facing, having changed target but not moved.
    const want = -here.side;
    let best = null;
    for (const st of here.segment.stones) {
      if (st.side !== want) continue;
      const d = st.group.position.distanceTo(here.group.position);
      if (!best || d < best.d) best = { st, d };
    }
    if (!best) return;
    this.target = best.st;
    // Turning 180 degrees while sliding 38m across the hall is the glitch. Take
    // the whole move in one frame instead: a cut, like looking over your shoulder.
    this.cut = true;
  }

  update(dt, controls, camera, now) {
    const keys = controls.keys;
    const moving = ["KeyW", "KeyS", "KeyA", "KeyD"].some((k) => keys.has(k));
    if (moving || keys.has("Escape") || !this.enabled) {
      if (this.target) this.released = now;
      this.target = null;
      if (!this.enabled) return false;
    }
    const back = keys.has("ArrowUp");
    const fwd = keys.has("ArrowDown") || keys.has("Space");
    const over = keys.has("ArrowLeft") || keys.has("ArrowRight");
    if (this.target && (back || fwd || over)) {
      if (!this.arrow) {
        if (over) this.cross();
        else this.step(back ? -1 : 1);
      }
      this.arrow = true;
    } else if (!back && !fwd && !over) {
      this.arrow = false;
    }
    if (!this.target && !moving && now - this.released > SETTLE) {
      let best = null;
      for (const st of this.world.panels()) {
        const d = Math.hypot(st.group.position.x - controls.x, st.group.position.z - controls.z);
        if (d < SNAP_RANGE && (!best || d < best.d)) best = { st, d };
      }
      if (best) this.target = best.st;
    }
    const k = Math.min(1, dt * GLIDE);
    if (!this.target) {
      controls.eye += (EYE - controls.eye) * k;
      return false;
    }
    const want = this.standFor(this.target);
    // a cross is a cut: position, height and heading all land together
    const cut = this.cut;
    this.cut = false;
    const m = cut ? 1 : k;
    controls.eye += (this.target.picY - controls.eye) * m;
    controls.x += (want.x - controls.x) * m;
    controls.z += (want.z - controls.z) * m;
    let d = want.yaw - controls.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    // A corner is taken in one step. Easing through 90 degrees is the swing that
    // made this unpleasant; small corrections still glide.
    controls.yaw += cut || Math.abs(d) > 0.78 ? d : d * k;
    controls.pitch += (this.aim - controls.pitch) * m;
    controls.vx = 0;
    controls.vz = 0;
    controls.walkTarget = null;
    return true;
  }
}

export function startPath(canvas, data, base, lightbox, ui) {
  const outfits = ui.outfits || { outfits: {}, of: {} };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const small = matchMedia("(max-width: 700px), (pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The prints are already graded. Tone mapping them again desaturates the work,
  // so the renderer leaves them exactly as the photographer finished them.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 520);
  const sky = new Sky(scene, renderer, { clouds: small ? 14 : 26 });
  const post = makeComposer(renderer, scene, camera, {
    strength: small ? 0.2 : 0.3,
    radius: 0.7,
    threshold: 0.95,
    grain: 0.05,
  });
  const copies = parallelCopies(small);
  const world = new PathWorld(scene, data, base, renderer, { copies, onEnter: ui.toast });
  const ghosts = new Ghosts(scene, copies);
  const controls = new Controls(camera, canvas, [], world.start);
  const snap = new PanelSnap(world);
  snap.vfov = (camera.fov * Math.PI) / 180;
  const ray = new THREE.Raycaster();
  // three pooled braziers light the steles nearest the walker
  const lamps = [0, 1, 2].map(() => {
    const l = new THREE.PointLight(0xffb060, 90, 46, 2);
    scene.add(l);
    return l;
  });

  controls.onTap = (nx, ny, centre, pointerType) => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = ray.intersectObjects(world.pickables(), false)[0];
    if (hit && hit.object.userData.stone) {
      const st = hit.object.userData.stone;
      // a print across the way: go and stand in front of it. The one you are
      // already standing at: open it full size.
      if (hit.distance > 15 || st !== snap.target) {
        snap.target = st;
        snap.released = 0;
        ui.hint();
        return;
      }
      controls.enabled = false;
      const list = st.segment ? st.segment.photos : [st.photo];
      lightbox.open({ name: st.photo.room, shoot_date: st.photo.captured }, list, st.photo);
      return;
    }
    if (centre) return;
    if (hit && hit.object.userData.carpet) {
      controls.walkTo(hit.point.x, hit.point.z);
      ui.hint();
    }
  };

  let wheelAt = 0;
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!snap.enabled) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt < 240) return;
      wheelAt = now;
      if (!snap.target) snap.target = snap.nearest(controls.x, controls.z);
      snap.step(e.deltaY > 0 ? 1 : -1);
      ui.hint();
    },
    { passive: false }
  );

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  let last = performance.now();
  let lastLoad = 0;
  let lastWorld = 0;
  const p2 = new THREE.Vector2();
  const fps = { frames: 0, since: performance.now(), value: 0 };
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.body.dataset.view === "walk") {
      const bx = controls.x;
      const bz = controls.z;
      controls.update(dt);
      const snapped = snap.update(dt, controls, camera, now);
      if (!snapped) {
        // only hold the walker to the carpet when they are actually walking;
        // standing at a print is the print's business, not the carpet's
        p2.set(controls.x, controls.z);
        const q = world.clamp(p2);
        controls.x = q.x;
        controls.z = q.y;
      }
      camera.position.set(controls.x, camera.position.y, controls.z);
      const moving = Math.hypot(controls.x - bx, controls.z - bz) > 1e-4;
      if (now - lastWorld > 120) {
        world.update(new THREE.Vector2(controls.x, controls.z));
        lastWorld = now;
      }
      if (now - lastLoad > 250) {
        world.loadTextures(camera.position);
        lastLoad = now;
      }
      // braziers follow the nearest steles
      const near = world
        .panels()
        .map((st) => ({ st, d: st.group.position.distanceTo(camera.position) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, lamps.length);
      lamps.forEach((l, i) => {
        if (near[i]) {
          l.position.set(near[i].st.group.position.x, 1.9, near[i].st.group.position.z);
          l.intensity = 90;
        } else {
          l.intensity = 0;
        }
      });
      ghosts.update(dt, controls.x, controls.z, controls.yaw, moving);
      sky.update(dt, camera.position);
      post.render(now);
      fps.frames++;
      if (now - fps.since > 1000) {
        fps.value = (fps.frames * 1000) / (now - fps.since);
        fps.frames = 0;
        fps.since = now;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  ui.toast("Everything", 2400);

  // While you are standing at a print, offer the rest of that outfit. Another
  // sitter in the same clothes is preferred where one exists, but within a shoot
  // is the usual case and still worth having.
  const sameEl = document.getElementById("same-outfit");
  let shownFor = null;
  function updateSameOutfit() {
    if (!sameEl) return;
    const st = snap.target;
    if (!st || document.body.dataset.view !== "walk") {
      sameEl.hidden = true;
      shownFor = null;
      return;
    }
    if (st.photo.id === shownFor) return;
    shownFor = st.photo.id;
    const key = outfits.of[st.photo.id];
    const group = key && outfits.outfits[key];
    if (!group || group.photos.length < 2) {
      sameEl.hidden = true;
      return;
    }
    const here = st.photo.room;
    const others = group.photos.filter((id) => id !== st.photo.id);
    const elsewhere = others.find((id) => (world.photos[id] || {}).room !== here);
    const go = elsewhere || others[0];
    const room = (world.photos[go] || {}).room;
    sameEl.textContent = "";
    sameEl.append(group.name + " \u00b7 ");
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = elsewhere ? "also on " + room : "more of this outfit";
    b.addEventListener("click", () => {
      const found = world.panels().find((q) => q.photo.id === go);
      if (found) {
        snap.target = found;
        snap.released = 0;
      } else {
        lightbox.open({ name: room }, group.photos.map((id) => world.photos[id]).filter(Boolean), world.photos[go]);
      }
    });
    sameEl.append(b);
    sameEl.hidden = false;
  }
  setInterval(updateSameOutfit, 400);

  window.__gallery = { world: "path", controls, camera, renderer, path: world, fps, snap };
  return {
    controls,
    snap,
    setSnap(on) {
      snap.enabled = on;
      if (!on) snap.target = null;
    },
    teleport() {
      return false;
    },
    enterPhotos(ids, label) {
      if (!world.enterPhotos(ids, label)) return false;
      controls.teleport(0, 1.2, 0);
      snap.target = null;
      snap.released = 0;
      return true;
    },
    enterAt(key) {
      if (!world.enterAt(key)) return false;
      controls.teleport(0, 1.2, 0);
      snap.target = null;
      snap.released = 0;
      return true;
    },
    setTheme: (t) => world.setTheme(t),
    setTreatment: (t) => world.setMode(t),
  };
}
