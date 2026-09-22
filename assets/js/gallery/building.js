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

function labelTexture(lines, { width = 1024, height = 512, bg = "#14120f", fg = "#e9e2d6" } = {}) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);
  let y = 90;
  for (const line of lines) {
    g.fillStyle = line.color || fg;
    g.font = `${line.weight || 400} ${line.size || 44}px "Helvetica Neue", Arial, sans-serif`;
    for (const part of wrap(g, line.text, width - 120)) {
      g.fillText(part, 60, y);
      y += (line.size || 44) * 1.35;
    }
    y += line.after || 10;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
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

export function buildGallery(scene, people) {
  const walls = []; // segments for collision: {x1,z1,x2,z2}
  const rooms = [];
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x24211e });
  const hallWallMat = new THREE.MeshLambertMaterial({ color: 0x2a2622 });
  const group = new THREE.Group();
  scene.add(group);

  function wall(x1, z1, x2, z2, mat = wallMat) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.01) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, WALL_H, T), mat);
    m.position.set((x1 + x2) / 2, WALL_H / 2, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    group.add(m);
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
      runs: [run(-HALL_W + T / 2, HALL_HALF, -HALL_W + T / 2, -HALL_HALF, 1, 0)],
      bounds: { x0: -HALL_W, x1: 0, z0: -HALL_HALF, z1: HALL_HALF },
    });
    // Plaque on the north wall, near the feature wall.
    const tex = labelTexture([
      { text: "Latest shoot", size: 34, color: "#b8a98f", after: 6 },
      { text: newest.name, size: 72, weight: 600, after: 4 },
      { text: formatDate(newest.shoot_date), size: 40, color: "#b8a98f", after: 24 },
      { text: newest.blurb || "", size: 36 },
    ]);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: tex }));
    plaque.position.set(-HALL_W + 2.2, 1.55, -HALL_HALF + T / 2 + 0.02);
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
        { text: person.name, size: 96, weight: 600, after: 0 },
        { text: formatDate(person.shoot_date), size: 44, color: "#b8a98f" },
      ],
      { width: 1024, height: 300 }
    );
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.53),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    sign.position.set(x0 + w / 2, 2.85, zNear - side * (half + 0.02));
    sign.rotation.y = side < 0 ? 0 : Math.PI;
    group.add(sign);

    rooms.push({
      id: person.slug,
      person,
      photos: person.photos,
      scale: 1,
      runs,
      sign,
      bounds: { x0, x1, z0: Math.min(zNear, zFar), z1: Math.max(zNear, zFar) },
    });
  }

  // floor and ceiling spanning everything
  const minX = -HALL_W - 1;
  const maxX = corridorLen + 1;
  const span = CORRIDOR_HALF + ROOM_D + 1;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, span * 2),
    new THREE.MeshStandardMaterial({ color: 0x2b241d, roughness: 0.55, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((minX + maxX) / 2, 0, 0);
  floor.name = "floor";
  group.add(floor);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, span * 2),
    new THREE.MeshBasicMaterial({ color: 0x0c0b0a })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((minX + maxX) / 2, WALL_H, 0);
  group.add(ceiling);

  return { rooms, walls, floor, start: { x: -2, z: 0, yaw: Math.PI / 2 } };
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
