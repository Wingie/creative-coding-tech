/**
 * Neural Network Three.js Background
 * Wingston Sharon Wilson — creativecodingtech.com
 *
 * 80 nodes in 3D space with glowing edges, sinusoidal pulse animation,
 * and mouse parallax. Runs as fixed background canvas.
 */

import * as THREE from 'three';

const NODE_COUNT = 80;
const EDGE_DISTANCE = 28;
const BG_COLOR = 0x0a0a0f;
const NODE_COLOR = 0x00d4ff;
const EDGE_COLOR_R = 0;
const EDGE_COLOR_G = 0.83;
const EDGE_COLOR_B = 1.0;
const EDGE_OPACITY = 0.18;
const SPREAD = 120;

let scene, camera, renderer;
let nodes = [];
let nodePhases = [];
let edgeMesh;
let mouse = { x: 0, y: 0 };
let animId;
let canvas;

export function initNeuralNetwork(canvasEl) {
  canvas = canvasEl;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 100;

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Create nodes
  const nodeGeo = new THREE.SphereGeometry(0.55, 8, 8);
  const nodeMat = new THREE.MeshBasicMaterial({ color: NODE_COLOR });

  for (let i = 0; i < NODE_COUNT; i++) {
    const mesh = new THREE.Mesh(nodeGeo, nodeMat.clone());
    const x = (Math.random() - 0.5) * SPREAD;
    const y = (Math.random() - 0.5) * SPREAD;
    const z = (Math.random() - 0.5) * SPREAD * 0.6;
    mesh.position.set(x, y, z);
    mesh.userData.basePos = { x, y, z };
    mesh.userData.amplitude = 0.4 + Math.random() * 0.6;
    mesh.userData.speed = 0.4 + Math.random() * 0.6;
    scene.add(mesh);
    nodes.push(mesh);
    nodePhases.push(Math.random() * Math.PI * 2);
  }

  // Create edges geometry (pre-allocate max possible edges)
  const maxEdges = NODE_COUNT * 10;
  const positions = new Float32Array(maxEdges * 2 * 3);
  const colors = new Float32Array(maxEdges * 2 * 3);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  edgeGeo.setDrawRange(0, 0);

  const edgeMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: EDGE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
  scene.add(edgeMesh);

  // Mouse parallax
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('resize', onResize);

  animate();
}

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateEdges() {
  const posAttr = edgeMesh.geometry.attributes.position;
  const colAttr = edgeMesh.geometry.attributes.color;
  const posArr = posAttr.array;
  const colArr = colAttr.array;
  let idx = 0;

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i].position;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j].position;
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < EDGE_DISTANCE) {
        const alpha = 1 - dist / EDGE_DISTANCE;

        posArr[idx * 6 + 0] = a.x;
        posArr[idx * 6 + 1] = a.y;
        posArr[idx * 6 + 2] = a.z;
        posArr[idx * 6 + 3] = b.x;
        posArr[idx * 6 + 4] = b.y;
        posArr[idx * 6 + 5] = b.z;

        colArr[idx * 6 + 0] = EDGE_COLOR_R * alpha;
        colArr[idx * 6 + 1] = EDGE_COLOR_G * alpha;
        colArr[idx * 6 + 2] = EDGE_COLOR_B * alpha;
        colArr[idx * 6 + 3] = EDGE_COLOR_R * alpha;
        colArr[idx * 6 + 4] = EDGE_COLOR_G * alpha;
        colArr[idx * 6 + 5] = EDGE_COLOR_B * alpha;

        idx++;
        if (idx * 6 >= posArr.length) break;
      }
    }
    if (idx * 6 >= posArr.length) break;
  }

  edgeMesh.geometry.setDrawRange(0, idx * 2);
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
}

let clock = new THREE.Clock();

function animate() {
  animId = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Animate nodes
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const base = n.userData.basePos;
    const amp = n.userData.amplitude;
    const spd = n.userData.speed;
    const phase = nodePhases[i];

    n.position.x = base.x + Math.sin(t * spd + phase) * amp;
    n.position.y = base.y + Math.cos(t * spd * 0.7 + phase) * amp;
    n.position.z = base.z + Math.sin(t * spd * 0.5 + phase * 0.5) * amp * 0.5;

    // Pulse brightness via scale
    const scale = 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t * spd * 1.2 + phase));
    n.scale.setScalar(scale);
  }

  updateEdges();

  // Camera parallax
  camera.position.x += (mouse.x * 8 - camera.position.x) * 0.03;
  camera.position.y += (mouse.y * 5 - camera.position.y) * 0.03;
  camera.lookAt(scene.position);

  renderer.render(scene, camera);
}

export function destroyNeuralNetwork() {
  cancelAnimationFrame(animId);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}
