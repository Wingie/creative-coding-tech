// Walkable gallery: one room per sitter, newest shoot at the entrance.
import * as THREE from "three";
import { buildGallery, roomAt } from "./building.js";
import { Frame, rehang, matches } from "./rehang.js";
import { Loader, placeBillboards } from "./loader.js";
import { Controls } from "./controls.js";
import { Lightbox } from "./lightbox.js";
import { renderGrid } from "./fallback.js";
import { startPath } from "./path.js";
import { environment, makeComposer } from "./look.js";

const LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);
const DATA_URL =
  new URLSearchParams(location.search).get("data") ||
  (LOCAL ? "/gallery-media/gallery.json" : "https://media.creativecodingtech.com/gallery/gallery.json");
const BASE = DATA_URL.slice(0, DATA_URL.lastIndexOf("/") + 1);
// The path is the way in. ?world=rooms walks the rooms instead.
const WORLD = new URLSearchParams(location.search).get("world") === "rooms" ? "rooms" : "path";

const THEMES = [
  ["all", "All"],
  ["light", "Light & projection"],
  ["studio-dark", "Dark studio"],
  ["studio-white", "White studio"],
  ["outdoor", "Outdoor"],
  ["bw", "B&W"],
];
const TREATMENTS = [
  ["photo", "Photo"],
  ["vector", "Vector"],
  ["cutout", "Cutout"],
];

const state = { theme: "all", treatment: "photo", view: "walk" };
const $ = (s) => document.querySelector(s);

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function chips(el, items, current, counts, onPick) {
  el.textContent = "";
  for (const [id, label] of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.id = id;
    b.setAttribute("aria-pressed", String(id === current));
    if (counts && counts[id] === 0) b.disabled = true;
    if (counts && id !== "all" && counts[id] !== undefined) {
      const n = document.createElement("small");
      n.textContent = counts[id];
      b.append(" ", n);
    }
    b.addEventListener("click", () => {
      for (const o of el.children) o.setAttribute("aria-pressed", String(o === b));
      onPick(id);
    });
    el.append(b);
  }
}

async function main() {
  let data;
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    data = await res.json();
  } catch (e) {
    $("#status").textContent = "The gallery could not load. Try again in a minute.";
    return;
  }
  const people = data.people || [];
  if (!people.length) {
    $("#status").textContent = "No rooms are open yet.";
    return;
  }
  let pathData = null;
  if (WORLD === "path") {
    try {
      const res = await fetch(BASE + "path.json", { cache: "no-cache" });
      if (res.ok) pathData = await res.json();
    } catch (e) {
      pathData = null;
    }
  }
  const world = pathData ? "path" : "rooms";
  document.body.dataset.world = world;
  setupWorldToggle(world);
  if (world === "path") {
    $("#hint").textContent = matchMedia("(pointer: coarse)").matches
      ? "Tap any picture to go and stand at it. Drag to look around."
      : "Scroll or press space for the next picture. Click one to go to it. WASD to walk.";
  }
  $("#status").hidden = true;

  const all = pathData ? Object.values(pathData.photos) : people.flatMap((p) => p.photos);
  const themeCounts = Object.fromEntries(THEMES.map(([id]) => [id, all.filter((p) => matches(p, id)).length]));
  const treatCounts = {
    photo: all.length,
    vector: all.filter((p) => p.vector).length,
    cutout: all.filter((p) => p.cutout).length,
  };

  const canWalk = webglOK();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let walk = null;

  const lightbox = new Lightbox(BASE, () => walk && (walk.controls.enabled = true));
  const grid = $("#grid");
  buildRoomList(people, (slug) => {
    if (state.view === "walk" && walk) walk.teleport(slug);
    else document.getElementById("room-" + slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const setView = (v) => {
    state.view = v;
    document.body.dataset.view = v;
    $("#view-toggle").textContent = v === "walk" ? "Grid" : "Walk";
    if (v === "grid") {
      renderGrid(grid, people, BASE, state.theme, lightbox);
      if (walk) walk.controls.unlock();
    } else if (!walk) {
      walk = pathData
        ? startPath($("#scene"), pathData, BASE, lightbox, {
            toast,
            hint: () => $("#hint").classList.add("fade"),
          })
        : startWalk(people, lightbox);
      walk.setTheme(state.theme);
      walk.setTreatment(state.treatment);
    }
  };

  chips($("#themes"), THEMES, state.theme, themeCounts, (id) => {
    state.theme = id;
    if (state.view === "grid") renderGrid(grid, people, BASE, id, lightbox);
    if (walk) walk.setTheme(id);
  });
  chips($("#treatments"), TREATMENTS, state.treatment, treatCounts, (id) => {
    state.treatment = id;
    if (walk) walk.setTreatment(id);
  });

  setupSnapToggle(() => walk);
  const toggle = $("#view-toggle");
  if (!canWalk) toggle.hidden = true;
  toggle.addEventListener("click", () => setView(state.view === "walk" ? "grid" : "walk"));
  setView(canWalk && !reduced ? "walk" : "grid");
}

function setupSnapToggle(getWalk) {
  const b = $("#snap-toggle");
  if (!b) return;
  let panels = true;
  const label = () => (b.textContent = panels ? "Free walk" : "Panels");
  label();
  b.addEventListener("click", () => {
    panels = !panels;
    label();
    const w = getWalk();
    if (w && w.setSnap) w.setSnap(panels);
  });
}

function setupWorldToggle(world) {
  const b = $("#world-toggle");
  if (!b) return;
  b.textContent = world === "path" ? "Rooms" : "Path";
  b.title = world === "path" ? "Walk the rooms, one per sitter" : "Walk the cloud path, sorted by likeness";
  b.addEventListener("click", () => {
    const u = new URL(location.href);
    if (world === "path") u.searchParams.set("world", "rooms");
    else u.searchParams.delete("world");
    location.href = u.toString();
  });
}

function monthYear(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function buildRoomList(people, go) {
  const btn = $("#rooms-btn");
  const panel = $("#rooms-panel");
  const list = panel.querySelector("ol");
  list.textContent = "";
  for (const p of people) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    const name = document.createElement("strong");
    name.textContent = p.name;
    const meta = document.createElement("span");
    meta.textContent = `${p.photos.length} photos · ${monthYear(p.shoot_date)}`;
    b.append(name, meta);
    b.addEventListener("click", () => {
      close();
      go(p.slug);
    });
    li.append(b);
    list.append(li);
  }
  const close = () => {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    btn.setAttribute("aria-expanded", String(!panel.hidden));
  });
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close();
  });
  addEventListener("keydown", (e) => e.key === "Escape" && close());
}

let toastTimer = 0;
function toast(text, ms = 2600) {
  const el = $("#room");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}
function hideToast() {
  clearTimeout(toastTimer);
  $("#room").classList.remove("show");
}

function drawMinimap(canvas, built, camera, yaw) {
  const g = canvas.getContext("2d");
  const dpr = Math.min(devicePixelRatio, 2);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (canvas.width !== W * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const e = built.extent;
  const pad = 8;
  // stretched to fill the map: the building is long and shallow
  const sx = (W - 2 * pad) / (e.maxX - e.minX);
  const sz = (H - 2 * pad) / (e.maxZ - e.minZ);
  const X = (x) => pad + (x - e.minX) * sx;
  const Z = (z) => pad + (z - e.minZ) * sz;
  g.fillStyle = "rgba(233,226,214,0.10)";
  g.fillRect(X(0), Z(-e.corridorHalf), e.maxX * sx, 2 * e.corridorHalf * sz);
  const here = roomAt(built.rooms, camera.position.x, camera.position.z);
  for (const r of built.rooms) {
    const b = r.bounds;
    g.fillStyle = r === here ? "rgba(224,179,106,0.55)" : r.dim ? "rgba(233,226,214,0.07)" : "rgba(233,226,214,0.22)";
    g.fillRect(X(b.x0) + 1, Z(b.z0) + 1, (b.x1 - b.x0) * sx - 2, (b.z1 - b.z0) * sz - 2);
  }
  const px = X(camera.position.x);
  const pz = Z(camera.position.z);
  g.fillStyle = "#e0b36a";
  g.beginPath();
  g.moveTo(px - Math.sin(yaw) * 7, pz - Math.cos(yaw) * 7);
  g.lineTo(px + Math.cos(yaw) * 4, pz - Math.sin(yaw) * 4);
  g.lineTo(px - Math.cos(yaw) * 4, pz + Math.sin(yaw) * 4);
  g.fill();
}

function startWalk(people, lightbox) {
  const canvas = $("#scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The prints are already graded; see path.js.
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x100e0c);
  scene.fog = new THREE.Fog(0x100e0c, 18, 55);
  // the room's own light, pre-filtered: warm off the walls, cool from the skylights
  environment(renderer, scene, [
    [0, "#3b3226"],
    [0.45, "#1a1713"],
    [0.72, "#4a4335"],
    [1, "#0b0a08"],
  ]);
  const key = new THREE.DirectionalLight(0xffe7cc, 1.1);
  key.position.set(4, 10, 3);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
  const built = buildGallery(scene, people, { anisotropy: renderer.capabilities.getMaxAnisotropy() });
  const framesByRoom = new Map();
  const frames = [];
  for (const room of built.rooms) {
    const list = room.photos.map((p) => new Frame(p, room, scene));
    framesByRoom.set(room.id, list);
    frames.push(...list);
  }
  const pickables = () => frames.flatMap((f) => [f.pic, f.vec, f.billboard].filter(Boolean));

  const post = makeComposer(renderer, scene, camera, { strength: 0.26, radius: 0.5, threshold: 0.9, grain: 0.035 });
  const loader = new Loader(BASE, renderer);
  const controls = new Controls(camera, canvas, built.walls, built.start);
  const ray = new THREE.Raycaster();
  const hint = $("#hint");
  const touch = matchMedia("(pointer: coarse)").matches;
  hint.textContent = touch
    ? "Drag to look. Tap the floor to walk. Tap a photo to open it."
    : "WASD to move. Drag to look. Click the floor to walk there, or a photo to open it.";

  controls.onTap = (nx, ny, centre, pointerType) => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = ray.intersectObjects([...pickables().filter((m) => m.visible && m.parent?.visible !== false), built.floor], false)[0];
    if (hit && hit.object.userData.frame && hit.distance < 9) {
      const f = hit.object.userData.frame;
      const list = f.room.photos.filter((p) => matches(p, state.theme));
      controls.enabled = false;
      lightbox.open(f.room.person, list, f.photo);
      return;
    }
    if (centre) return;
    if (hit && hit.object === built.floor) {
      controls.walkTo(hit.point.x, hit.point.z);
      hint.classList.add("fade");
    }
  };

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

  const minimap = $("#minimap");
  const hall = built.rooms.find((r) => r.isHall);
  if (hall) toast("Latest shoot: " + hall.person.name, 3000);
  let lastMap = 0;
  let last = performance.now();
  let lastLoad = 0;
  let currentRoom;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.body.dataset.view === "walk") {
      controls.update(dt);
      for (const f of frames) f.update(now);
      if (now - lastLoad > 250) {
        loader.update(frames, camera.position, scene);
        lastLoad = now;
      }
      placeBillboards(frames, camera.position);
      const r = roomAt(built.rooms, camera.position.x, camera.position.z);
      if (r !== currentRoom) {
        const prev = currentRoom;
        currentRoom = r;
        if (r && !r.isHall) toast(r.person.name);
        else if (prev && prev.isHall) hideToast();
      }
      if (now - lastMap > 100 && minimap.clientWidth > 0) {
        drawMinimap(minimap, built, camera, controls.yaw);
        lastMap = now;
      }
      post.render(now);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function teleport(slug) {
    const r = built.rooms.find((q) => q.id === slug) || (slug === "hall" ? hall : null);
    if (!r) return false;
    controls.teleport(r.door.x, r.door.z, r.door.yaw);
    return true;
  }

  window.__gallery = { controls, rooms: built.rooms, teleport, camera, renderer };

  return {
    controls,
    teleport,
    setTheme(t) {
      const counts = rehang(built.rooms, framesByRoom, t, performance.now());
      for (const r of built.rooms) r.dim = counts[r.id] === 0;
    },
    setTreatment(t) {
      loader.mode = t;
      lastLoad = 0;
    },
  };
}

main();
