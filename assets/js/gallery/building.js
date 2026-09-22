// Builds the gallery architecture from gallery.json:
// an entrance hall for the newest shoot, then a corridor with one room per sitter,
// rooms alternating north and south, newest first.
import * as THREE from "three";

export const WALL_H = 3.6;
const T = 0.15; // wall thickness
const CORRIDOR_HALF = 2; // corridor runs along +x, z in [-2, 2]
const ROOM_D = 7; // room depth away from the corridor
const DOOR_W = 2.2;
const HALL_W = 10;
const HALL_HALF = 5;
const ROOM_GAP = 0.5;
export const FRAME_GAP = 0.6;
const RUN_MARGIN = 0.5;

// Frame size for a photo on a normal wall. The hall uses a larger scale.
export function frameSize(photo, scale = 1) {
  const a = (photo.w || 2) / (photo.h || 3);
  if (a < 1) return { w: 1.25 * a * scale, h: 1.25 * scale };
  return { w: 1.5 * scale, h: (1.5 / a) * scale };
}

function run(ax, az, bx, bz, nx, nz) {
  const len = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / len;
  const dz = (bz - az) / len;
  // Pull the usable part in from the corners.
  return {
    ax: ax + dx * RUN_MARGIN,
    az: az + dz * RUN_MARGIN,
    dx,
    dz,
    nx,
    nz,
    len: len - 2 * RUN_MARGIN,
  };
}

// Length of wall a room of width w offers for hanging.
function capacity(w) {
  const doorSide = Math.max(0, (w - DOOR_W) / 2 - 2 * RUN_MARGIN);
  const usableDoorSide = doorSide >= 1.6 ? doorSide * 2 : 0;
  return w - 2 * RUN_MARGIN + 2 * (ROOM_D - 2 * RUN_MARGIN) + usableDoorSide;
}

function roomWidthFor(photos) {
  const needed = photos.reduce((s, p) => s + frameSize(p).w + FRAME_GAP, 0);
  let w = 7;
  while (capacity(w) < needed && w < 30) w += 0.5;
  return w;
}

let maxAniso = 1;

function labelTexture(lines, { width = 2048, height = 1024, bg = "#1b1815", fg = "#f1ebe0", pad = 110 } = {}) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);
  g.textBaseline = "alphabetic";
  let y = pad; // top of the next line
  for (const line of lines) {
    if (!line.text) continue;
    const size = line.size || 88;
    g.fillStyle = line.color || fg;
    g.font = `${line.weight || 400} ${size}px "Helvetica Neue", Arial, sans-serif`;
    for (const part of wrap(g, line.text, width - 2 * pad)) {
      g.fillText(part, pad, y + size * 0.82);
      y += size * 1.22;
    }
    y += line.after || 20;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function wrap(g, text, maxW) {
  const words = (text || "").split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (g.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function buildGallery(scene, people, { anisotropy = 8 } = {}) {
  maxAniso = anisotropy;
  const walls = []; // segments for collision: {x1,z1,x2,z2}
  const rooms = [];
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8c8479 });
  const hallWallMat = new THREE.MeshLambertMaterial({ color: 0x958d81 });
  const skirtMat = new THREE.MeshLambertMaterial({ color: 0x1c1a17 });
  const group = new THREE.Group();
  scene.add(group);

  function wall(x1, z1, x2, z2, mat = wallMat) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.01) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, WALL_H, T), mat);
    m.position.set((x1 + x2) / 2, WALL_H / 2, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    group.add(m);
    // dark skirting so the wall meets the floor with a clear edge
    const k = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, T + 0.03), skirtMat);
    k.position.set(m.position.x, 0.06, m.position.z);
    k.rotation.y = m.rotation.y;
    group.add(k);
    walls.push({ x1, z1, x2, z2 });
  }

  // ---- entrance hall: x in [-HALL_W, 0], z in [-HALL_HALF, HALL_HALF]
  wall(-HALL_W, -HALL_HALF, -HALL_W, HALL_HALF, hallWallMat);
  wall(-HALL_W, -HALL_HALF, 0, -HALL_HALF, hallWallMat);
  wall(-HALL_W, HALL_HALF, 0, HALL_HALF, hallWallMat);
  wall(0, -HALL_HALF, 0, -CORRIDOR_HALF, hallWallMat);
  wall(0, CORRIDOR_HALF, 0, HALL_HALF, hallWallMat);

  const newest = people[0];
  if (newest) {
    rooms.push({
      id: "hall",
      person: newest,
      isHall: true,
      photos: newest.photos.slice(0, 6),
      scale: 1.45,
      door: { x: -2.5, z: 0, yaw: Math.PI / 2 },
      runs: [run(-HALL_W + T / 2, HALL_HALF, -HALL_W + T / 2, -HALL_HALF, 1, 0)],
      bounds: { x0: -HALL_W, x1: 0, z0: -HALL_HALF, z1: HALL_HALF },
    });
    // Plaque on the north wall, near the feature wall.
    const tex = labelTexture([
      { text: "Latest shoot", size: 120, color: "#c9b99c", after: 10 },
      { text: newest.name, size: 280, weight: 600, after: 0 },
      { text: formatDate(newest.shoot_date), size: 130, color: "#c9b99c", after: 40 },
      { text: newest.blurb || "", size: 90 },
    ]);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshBasicMaterial({ map: tex }));
    plaque.position.set(-HALL_W + 2.6, 1.55, -HALL_HALF + T / 2 + 0.02);
    group.add(plaque);
  }

  // ---- rooms along the corridor
  let north = 1;
  let south = 1;
  const corridorRooms = people.map((person, i) => {
    const w = roomWidthFor(person.photos);
    const side = i % 2 === 0 ? -1 : 1; // -1 north (z<0), +1 south
    const x0 = side < 0 ? north : south;
    if (side < 0) north += w + ROOM_GAP;
    else south += w + ROOM_GAP;
    return { person, w, side, x0 };
  });
  const corridorLen = Math.max(north, south) + 1;

  // corridor walls with door gaps
  for (const side of [-1, 1]) {
    const z = side * CORRIDOR_HALF;
    const doors = corridorRooms
      .filter((r) => r.side === side)
      .map((r) => [r.x0 + r.w / 2 - DOOR_W / 2, r.x0 + r.w / 2 + DOOR_W / 2]);
    let x = 0;
    for (const [a, b] of doors) {
      wall(x, z, a, z);
      x = b;
    }
    wall(x, z, corridorLen, z);
  }
  wall(corridorLen, -CORRIDOR_HALF, corridorLen, CORRIDOR_HALF);

  for (const r of corridorRooms) {
    const { person, w, side, x0 } = r;
    const x1 = x0 + w;
    const zNear = side * CORRIDOR_HALF;
    const zFar = side * (CORRIDOR_HALF + ROOM_D);
    wall(x0, zNear, x0, zFar);
    wall(x1, zNear, x1, zFar);
    wall(x0, zFar, x1, zFar);

    const inward = -side; // normal of the back wall points back toward the corridor
    const half = T / 2;
    const runs = [];
    // back wall first: it faces the door, so the strongest photos land there
    // (run direction chosen so frames read left to right when facing the wall)
    const zb = zFar + inward * half;
    runs.push(side < 0 ? run(x0, zb, x1, zb, 0, inward) : run(x1, zb, x0, zb, 0, inward));
    // side walls
    runs.push(run(x1 - half, zFar, x1 - half, zNear, -1, 0));
    runs.push(run(x0 + half, zNear, x0 + half, zFar, 1, 0));
    // door wall, both sides of the door
    const doorA = x0 + w / 2 - DOOR_W / 2;
    const doorB = x0 + w / 2 + DOOR_W / 2;
    const zd = zNear - inward * half;
    const segA = run(x0, zd, doorA, zd, 0, side);
    const segB = run(doorB, zd, x1, zd, 0, side);
    if (segA.len >= 1.6) runs.push(segA);
    if (segB.len >= 1.6) runs.push(segB);

    // name sign above the door, on the corridor side
    const tex = labelTexture(
      [
        { text: person.name, size: 230, weight: 600, after: 10 },
        { text: formatDate(person.shoot_date) + "  ·  " + person.photos.length + " photos", size: 110, color: "#c9b99c" },
      ],
      { width: 2048, height: 560, pad: 70 }
    );
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.66),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    sign.position.set(x0 + w / 2, 2.95, zNear - side * (half + 0.02));
    sign.rotation.y = side < 0 ? 0 : Math.PI;
    group.add(sign);

    rooms.push({
      id: person.slug,
      person,
      photos: person.photos,
      scale: 1,
      runs,
      sign,
      side,
      // just inside the doorway, facing into the room (forward is (-sin yaw, -cos yaw))
      door: { x: x0 + w / 2, z: zNear + side * 1.3, yaw: side < 0 ? 0 : Math.PI },
      bounds: { x0, x1, z0: Math.min(zNear, zFar), z1: Math.max(zNear, zFar) },
    });
  }

  // floor and ceiling spanning everything
  const minX = -HALL_W - 1;
  const maxX = corridorLen + 1;
  const span = CORRIDOR_HALF + ROOM_D + 1;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, span * 2),
    new THREE.MeshStandardMaterial({ color: 0x6b5f52, roughness: 0.42, metalness: 0.08 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((minX + maxX) / 2, 0, 0);
  floor.name = "floor";
  group.add(floor);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, span * 2),
    new THREE.MeshBasicMaterial({ color: 0x3b3732 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((minX + maxX) / 2, WALL_H, 0);
  group.add(ceiling);

  // A runner from the feature wall through the doorway and down the corridor,
  // so the way on is readable from anywhere in the hall.
  const runnerMat = new THREE.MeshStandardMaterial({ color: 0x6a3a2f, roughness: 0.9 });
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(corridorLen + HALL_W - 1.5, 1.3), runnerMat);
  runner.rotation.x = -Math.PI / 2;
  runner.position.set((-HALL_W + 1.5 + corridorLen) / 2, 0.005, 0);
  group.add(runner);

  // Lit doorway into the corridor: a warm glowing frame plus a light just beyond it.
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a6 });
  const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.0, 0.2), glowMat);
  jambL.position.set(0, 1.5, -CORRIDOR_HALF + 0.05);
  const jambR = jambL.clone();
  jambR.position.z = CORRIDOR_HALF - 0.05;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, CORRIDOR_HALF * 2), glowMat);
  lintel.position.set(0, 3.0, 0);
  group.add(jambL, jambR, lintel);
  const doorLight = new THREE.PointLight(0xffc98f, 6, 14, 1.6);
  doorLight.position.set(2, 2.8, 0);
  group.add(doorLight);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.42),
    new THREE.MeshBasicMaterial({
      map: labelTexture([{ text: "Rooms", size: 170, weight: 600 }], { width: 2048, height: 450, bg: "#1b1815", pad: 120 }),
    })
  );
  sign.position.set(-0.1, 3.33, 0);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);

  return {
    rooms,
    walls,
    floor,
    extent: { minX: -HALL_W, maxX: corridorLen, minZ: -(CORRIDOR_HALF + ROOM_D), maxZ: CORRIDOR_HALF + ROOM_D, corridorHalf: CORRIDOR_HALF },
    start: { x: -2.5, z: 0, yaw: Math.PI / 2 },
  };
}

// Which room contains a point (null in the corridor).
export function roomAt(rooms, x, z) {
  for (const r of rooms) {
    const b = r.bounds;
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return r;
  }
  return null;
}

export const COLLIDE_T = T;
