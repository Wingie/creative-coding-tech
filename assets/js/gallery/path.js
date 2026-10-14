// The cloud path: a red carpet through the clouds.
//
// By default it walks the wings (wings.js): theme first, then person. From the
// entrance the carpet runs through one wing per theme in a fixed order, and
// inside a wing one hall per person, newest shoot first, each with a plaque.
// A new wing turns a corner under its own title; a new person carries straight
// on. After the last wing it comes back round to the first.
//
// With ?world=likeness it is the older walk instead: a carpet that forks along
// the generated category tree in path.json. Each fork splits the photos into two families of
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

const POST_GEO = new THREE.CylinderGeometry(0.08, 0.1, 3.1, 8);
const POST_MAT = new THREE.MeshStandardMaterial({ color: 0x3a2a22 });

// The wings route: every person-in-a-wing node, in walking order.
function buildRoute(data) {
  const out = [];
  for (const wk of data.nodes[data.root].children || []) {
    const wing = data.nodes[wk];
    (wing.children || []).forEach((pk, j) => {
      const n = data.nodes[pk];
      out.push({ key: pk, wingKey: wk, wingName: wing.name, name: n.name, date: n.dateLabel || "", photos: n.photos, first: j === 0 });
    });
  }
  return out;
}

function entranceLines(route) {
  const lines = [{ text: "The gallery", size: 96, weight: 600 }];
  const seen = new Map();
  for (const r of route) seen.set(r.wingName, (seen.get(r.wingName) || 0) + r.photos.length);
  let k = 1;
  for (const [name, n] of seen) lines.push({ text: k++ + "  " + name + "  \u00b7  " + n, size: 64, color: "#e0c79c" });
  lines.push({ text: "Each wing: one hall per person, newest first", size: 44, color: "#8fb8c8", before: 18 });
  return lines;
}

// A plate of several lines of text, for plaques and the entrance directory.
function boardPlane(lines, { w, h, bg = "rgba(6,12,16,0.9)", fg = "#f1ebe0" }) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * h) / w);
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const fit = (l) => {
    let s = l.size;
    g.font = `${l.weight || 400} ${s}px "Helvetica Neue", Arial, sans-serif`;
    while (g.measureText(l.text).width > c.width - 70 && s > 20) {
      s -= 4;
      g.font = `${l.weight || 400} ${s}px "Helvetica Neue", Arial, sans-serif`;
    }
    return s;
  };
  const shown = lines.filter((l) => l.text);
  const sizes = shown.map(fit);
  const total = sizes.reduce((a, s, i) => a + s * 1.25 + (shown[i].before || 0), 0);
  let y = (c.height - total) / 2;
  shown.forEach((l, i) => {
    y += l.before || 0;
    g.font = `${l.weight || 400} ${sizes[i]}px "Helvetica Neue", Arial, sans-serif`;
    g.fillStyle = l.color || fg;
    g.fillText(l.text, c.width / 2, y + (sizes[i] * 1.25) / 2);
    y += sizes[i] * 1.25;
  });
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

class Segment {
  constructor(world, start, heading, photos, info) {
    this.world = world;
    this.start = start.clone();
    this.heading = heading;
    this.photos = photos;
    this.nodeKey = info.nodeKey || null;
    this.drift = !!info.drift;
    this.label = info.label || "";
    this.route = info.route; // index into the wings route, when walking the wings
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
      if (m.userData.dispose) {
        m.userData.dispose(); // plaques and wing titles own their canvas
        continue;
      }
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

  // The entrance directory: the wings in the order you will walk them.
  // It stands at the right edge of the carpet, opposite the first plaque, so the
  // way ahead stays clear.
  board(lines, at, heading) {
    const b = boardPlane(lines, { w: 9, h: 5.8 });
    const p = at.clone().add(rightOf(heading).multiplyScalar(5.6)).add(fwd(heading).multiplyScalar(3));
    b.position.set(p.x, 4.4, p.y);
    b.rotation.y = heading;
    const post = new THREE.Mesh(POST_GEO, POST_MAT);
    post.position.set(p.x, 1.55, p.y);
    post.userData.dispose = () => {};
    this.world.scene.add(b, post);
    this.objs.push(b, post);
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
    // walking the wings: one section per person per theme, in order
    this.ordered = !!data.ordered;
    this.turnSide = 1;
    this.here = null;
    if (this.ordered) {
      this.route = buildRoute(data);
      this.start = { x: 0, z: 1.2, yaw: 0 };
      this.begin(0);
      return;
    }

    const rootPhotos = this.pick(data.root);
    const first = new Segment(this, new THREE.Vector2(0, 0), 0, rootPhotos, { nodeKey: data.root, label: "Everything" });
    this.segments.push(first);
    this.line.push(first);
    this.joins.push(new Join(this, new THREE.Vector2(0, 0), false));
    this.start = { x: 0, z: 1.2, yaw: 0 };
  }

  // Clear everything and start the wings walk at route[i], from the origin.
  begin(i) {
    this.clear();
    if (!this.route.length) return; // nothing to hang
    const join = new Join(this, new THREE.Vector2(0, 0), false);
    this.joins.push(join);
    if (i === 0) join.board(entranceLines(this.route), new THREE.Vector2(0, 0), 0);
    const first = this.section(i, new THREE.Vector2(0, 0), 0, true);
    this.segments.push(first);
    this.line.push(first);
  }

  clear() {
    for (const s of this.segments) s.dispose();
    for (const j of this.joins) j.dispose();
    this.segments = [];
    this.joins = [];
    this.anchors = [];
    this.line = [];
    this.fork = null;
    this.announced = null;
    this.here = null;
    this.seen.clear();
  }

  // One person's hall within a wing: the photos, a plaque naming them, and at
  // the first hall of a wing the wing's title across the carpet.
  section(i, start, heading, entering) {
    const n = this.route.length;
    const r = this.route[((i % n) + n) % n];
    const photos = r.photos.map((id) => this.photos[id]).filter(Boolean);
    // names can carry commas ("Natalia, lights"), so the parts are split by dots
    const label = (r.first || entering ? r.wingName + " \u2014 " : "") + r.name + (r.date ? " \u00b7 " + r.date : "");
    const seg = new Segment(this, start, heading, photos, { nodeKey: r.key, label, route: i });
    seg.wing = r.wingKey;
    const left = rightOf(heading).multiplyScalar(-4.8);
    const at = seg.point(2.5).add(left);
    const plaque = boardPlane(
      [
        { text: r.name, size: 120, weight: 600 },
        { text: [r.date, photos.length + (photos.length === 1 ? " photo" : " photos")].filter(Boolean).join(" \u00b7 "), size: 66, color: "#e0c79c" },
        { text: r.wingName, size: 56, color: "#8fb8c8" },
      ],
      { w: 6.4, h: 2.6 }
    );
    plaque.position.set(at.x, 4.4, at.y);
    plaque.rotation.y = heading;
    const post = new THREE.Mesh(POST_GEO, POST_MAT);
    post.position.set(at.x, 1.55, at.y);
    post.userData.dispose = () => {}; // shared geometry and material
    this.scene.add(plaque, post);
    seg.meshes.push(plaque, post);
    if (r.first || entering) {
      const mid = seg.point(4);
      const title = textPlane(r.wingName, { w: 13, h: 2.4, size: 150, fg: "#ffd9a0" });
      title.position.set(mid.x, 9.2, mid.y);
      title.rotation.y = heading;
      this.scene.add(title);
      seg.meshes.push(title);
    }
    return seg;
  }

  // The next hall on the wings route. A person after a person carries straight
  // on; a new wing takes a corner, alternating left and right so the carpet
  // zigzags away rather than spiralling back into itself. Either way the hall
  // must run clear of the halls still standing (clearRun), and is never laid
  // back the way you came.
  extendOrdered() {
    const tip = this.tip();
    const endPt = tip.end();
    const i = (tip.route ?? -1) + 1;
    const r = this.route[i % this.route.length];
    let ways;
    if (r.first) {
      this.turnSide = -this.turnSide;
      ways = [tip.heading + this.turnSide * FORK_TURN, tip.heading, tip.heading - this.turnSide * FORK_TURN];
    } else {
      ways = [tip.heading, tip.heading - FORK_TURN, tip.heading + FORK_TURN];
    }
    const runs = ways.map((w) => this.clearRun(endPt, w, tip));
    const h = ways[runs.findIndex((x) => x === Infinity)] ?? ways[runs.indexOf(Math.max(...runs))];
    const start = endPt.clone().add(fwd(h).multiplyScalar(h === tip.heading ? 0.8 : JOIN_R - 0.3));
    // a beacon over the junction where a wing begins
    this.joins.push(new Join(this, endPt, !!r.first));
    const seg = this.section(i, start, h, false);
    this.segments.push(seg);
    this.line.push(seg);
  }

  // Start again from a node the map chose. Everything built so far goes back.
  enterAt(key) {
    if (this.ordered) {
      const i = key === this.data.root ? 0 : this.route.findIndex((r) => r.key === key || r.wingKey === key);
      if (i < 0) return false;
      this.begin(i);
      return true;
    }
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
    if (this.ordered) return this.line.length ? this.extendOrdered() : undefined;
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
    // carry straight on: a drift segment is the same hall continuing, unless that
    // would run into a hall still standing, in which case it takes a corner
    const ways = [tip.heading, tip.heading - FORK_TURN, tip.heading + FORK_TURN];
    const runs = ways.map((w) => this.clearRun(endPt, w, tip));
    const h = ways[runs.findIndex((r) => r === Infinity)] ?? ways[runs.indexOf(Math.max(...runs))];
    // a corner leaves from the far side of the junction room, as a fork does
    const start = endPt.clone().add(fwd(h).multiplyScalar(h === tip.heading ? 0.8 : JOIN_R - 0.3));
    this.joins.push(new Join(this, endPt, false));
    const seg = new Segment(this, start, h, photos, info);
    this.segments.push(seg);
    this.line.push(seg);
  }

  makeFork(tip, at, node) {
    const join = new Join(this, at, true);
    this.joins.push(join);
    const taken = [];
    const branches = node.children.map((key, i) => {
      const side = i === 0 ? -1 : 1; // first child to the left
      // The corner first, then straight on, then the other corner: whichever runs
      // clear of the halls still standing. Never back the way you came: that
      // fallback laid every hall on top of the last, so five halls' prints stood
      // inside each other on the same two walls.
      const ways = [tip.heading - side * FORK_TURN, tip.heading, tip.heading + side * FORK_TURN].filter(
        (h) => !taken.some((t) => Math.abs(Math.sin((h - t) / 2)) < 0.1)
      );
      const runs = ways.map((h) => this.clearRun(at, h, tip));
      const h = ways[runs.findIndex((r) => r === Infinity)] ?? ways[runs.indexOf(Math.max(...runs))];
      taken.push(h);
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
    // the anchor closes the hall straight ahead, so not when a branch goes that way
    if (!taken.includes(tip.heading)) join.anchor(best, tip.heading);
    this.fork = { at, branches, join };
  }

  // How far a hall leaving `at` on heading `h` runs before it meets one that is
  // already there (Infinity if it never does within reach). The hall the fork
  // leaves from is skipped: its prints reach past its own end, so it used to
  // block every corner taken from it.
  clearRun(at, h, from) {
    const f = fwd(h);
    const reach = 90;
    for (let d = JOIN_R + 8; d < reach; d += 14) {
      const q = at.clone().add(f.clone().multiplyScalar(d));
      for (const seg of this.segments) {
        if (seg === from) continue;
        const pr = seg.project(q);
        if (pr.raw > -STONE_OFF && pr.raw < seg.length + STONE_OFF && Math.abs(pr.lat) < STONE_OFF * 1.6) return d;
      }
    }
    return Infinity;
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
    if (!this.line.length) return;
    this.checkFork(p);
    // keep path ahead of the walker until the next fork
    let guard = 0;
    while (!this.fork && this.tip().end().distanceTo(p) < AHEAD && guard++ < 4) this.extend();
    if (this.ordered) {
      // name the hall you are in, wing and person, as you come into it
      const seg = this.line.find((q) => {
        const pr = q.project(p);
        return pr.raw >= 0 && pr.raw <= q.length && Math.abs(pr.lat) < STONE_OFF;
      });
      if (seg && seg !== this.here) {
        this.here = seg;
        if (seg.label) this.onEnter(seg.label);
      }
    }
    // entering a drift or restart segment announces itself
    const tip = this.tip();
    if (!this.ordered && tip !== this.announced && tip.project(p).raw > 1 && Math.abs(tip.project(p).lat) < 2) {
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

  // Left and right go to the next print on that side of the screen, along the
  // same wall, without turning. They used to cross the hall: a 180-degree cut to
  // the facing wall on every press, which spun the screen. A print across the
  // way is still a click away.
  sideways(dir, camera) {
    const here = this.target;
    const list = this.world.panels().filter((st) => st.side === here.side);
    const i = list.indexOf(here);
    if (i < 0) return;
    const f = camera.getWorldDirection(new THREE.Vector3());
    const rx = -f.z;
    const rz = f.x;
    for (const n of [list[i - 1], list[i + 1]]) {
      if (!n) continue;
      const along = (n.group.position.x - here.group.position.x) * rx + (n.group.position.z - here.group.position.z) * rz;
      if (Math.sign(along) === dir) {
        this.target = n;
        return;
      }
    }
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
        if (over) this.sideways(keys.has("ArrowRight") ? 1 : -1, camera);
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
    const m = k;
    controls.eye += (this.target.picY - controls.eye) * m;
    controls.x += (want.x - controls.x) * m;
    controls.z += (want.z - controls.z) * m;
    let d = want.yaw - controls.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    // A corner is taken in one step. Easing through 90 degrees is the swing that
    // made this unpleasant; small corrections still glide.
    controls.yaw += Math.abs(d) > 0.78 ? d : d * k;
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
      lightbox.open({ name: st.photo.room, shoot_date: st.photo.shoot || st.photo.captured }, list, st.photo);
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
      controls.arrowsTaken = snap.enabled && !!snap.target;
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
      post.render();
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
  if (!world.ordered) ui.toast("Everything", 2400);

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
