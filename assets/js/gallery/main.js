// Walkable gallery: one room per sitter, newest shoot at the entrance.
import * as THREE from "three";
import { buildGallery, roomAt } from "./building.js";
import { Frame, rehang, matches } from "./rehang.js";
import { Loader, placeBillboards } from "./loader.js";
import { Controls } from "./controls.js";
import { Lightbox } from "./lightbox.js";
import { renderGrid } from "./fallback.js";

const LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);
const DATA_URL =
  new URLSearchParams(location.search).get("data") ||
  (LOCAL ? "/gallery-media/gallery.json" : "https://media.creativecodingtech.com/gallery/gallery.json");
const BASE = DATA_URL.slice(0, DATA_URL.lastIndexOf("/") + 1);

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
  $("#status").hidden = true;

  const all = people.flatMap((p) => p.photos);
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

  const setView = (v) => {
    state.view = v;
    document.body.dataset.view = v;
    $("#view-toggle").textContent = v === "walk" ? "Grid" : "Walk";
    if (v === "grid") {
      renderGrid(grid, people, BASE, state.theme, lightbox);
      if (walk) walk.controls.unlock();
    } else if (!walk) {
      walk = startWalk(people, lightbox);
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

  const toggle = $("#view-toggle");
  if (!canWalk) toggle.hidden = true;
  toggle.addEventListener("click", () => setView(state.view === "walk" ? "grid" : "walk"));
  setView(canWalk && !reduced ? "walk" : "grid");
}

function startWalk(people, lightbox) {
  const canvas = $("#scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a09);
  scene.fog = new THREE.Fog(0x0b0a09, 10, 34);
  scene.add(new THREE.HemisphereLight(0xfff1dd, 0x1a140f, 0.9));
  const key = new THREE.DirectionalLight(0xffe2c0, 0.35);
  key.position.set(4, 10, 3);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.05, 80);
  const built = buildGallery(scene, people);
  const framesByRoom = new Map();
  const frames = [];
  for (const room of built.rooms) {
    const list = room.photos.map((p) => new Frame(p, room, scene));
    framesByRoom.set(room.id, list);
    frames.push(...list);
  }
  const pickables = () => frames.flatMap((f) => [f.pic, f.vec, f.billboard].filter(Boolean));

  const loader = new Loader(BASE, renderer);
  const controls = new Controls(camera, canvas, built.walls, built.start);
  const ray = new THREE.Raycaster();
  const hint = $("#hint");
  const touch = matchMedia("(pointer: coarse)").matches;
  hint.textContent = touch
    ? "Drag to look. Tap the floor to walk. Tap a photo to open it."
    : "Click to walk. WASD to move, mouse to look. Click a photo to open it. Esc to stop.";

  controls.onTap = (nx, ny, centre, pointerType) => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = ray.intersectObjects([...pickables().filter((m) => m.visible && m.parent?.visible !== false), built.floor], false)[0];
    if (hit && hit.object.userData.frame && hit.distance < 9) {
      const f = hit.object.userData.frame;
      const list = f.room.photos.filter((p) => matches(p, state.theme));
      controls.unlock();
      controls.enabled = false;
      lightbox.open(f.room.person, list, f.photo);
      return;
    }
    if (centre) return;
    if (pointerType === "mouse") {
      controls.lock();
      hint.classList.add("fade");
    } else if (hit && hit.object === built.floor) {
      controls.walkTo(hit.point.x, hit.point.z);
      hint.classList.add("fade");
    }
  };

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  const roomLabel = $("#room");
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
        currentRoom = r;
        roomLabel.textContent = r ? (r.isHall ? "Latest: " + r.person.name : r.person.name) : "";
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    controls,
    setTheme(t) {
      rehang(built.rooms, framesByRoom, t, performance.now());
    },
    setTreatment(t) {
      loader.mode = t;
      lastLoad = 0;
    },
  };
}

main();
