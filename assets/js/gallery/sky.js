// Night sky for the cloud path: a gradient dome, soft stars, a black mirror sea,
// and a few very large clouds. Few and big, not many and small.
import * as THREE from "three";
import { PALETTE, environment } from "./look.js";

// One soft round dot, used for every star.
function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(210,240,255,0.55)");
  grad.addColorStop(1, "rgba(160,210,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  for (const [x, y, r, a] of [
    [256, 280, 200, 0.5],
    [150, 300, 140, 0.4],
    [360, 296, 150, 0.4],
    [210, 220, 130, 0.34],
    [318, 232, 120, 0.34],
  ]) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.55, `rgba(255,255,255,${a * 0.35})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Sky {
  constructor(scene, renderer, { clouds = 26 } = {}) {
    scene.background = new THREE.Color(PALETTE.deep);
    scene.fog = new THREE.Fog(PALETTE.deep, 60, 340);
    environment(renderer, scene, [
      [0, "#0a1d2e"],
      [0.5, "#04080f"],
      [0.78, "#123246"],
      [1, "#010204"],
    ]);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(460, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x010206) },
          mid: { value: new THREE.Color(0x040b16) },
          low: { value: new THREE.Color(PALETTE.horizon) },
        },
        vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 v;" +
          "void main(){ float h = v.y; vec3 c = h > 0.16 ? mix(mid, top, smoothstep(0.16, 0.8, h)) : mix(low, mid, smoothstep(-0.12, 0.16, h));" +
          " gl_FragColor = vec4(c, 1.0); }",
      })
    );
    dome.renderOrder = -3;
    scene.add(dome);
    this.dome = dome;

    // stars: soft dots of varied brightness, so they read as sky and not as noise
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const y = 0.05 + Math.random() * 0.95;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 420, y * 420, Math.sin(th) * r * 420], i * 3);
      const b = 0.25 + Math.pow(Math.random(), 2.2) * 0.75;
      col.set([b * 0.85, b * 0.95, b], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({
        map: dotTexture(),
        size: 4.2,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.stars.renderOrder = -2;
    scene.add(this.stars);

    // one cold key, low and raking, so the slabs get an edge and a shadow
    const key = new THREE.DirectionalLight(PALETTE.cold, 1.15);
    key.position.set(-26, 22, -34);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 140;
    const s = key.shadow.camera;
    s.left = -46;
    s.right = 46;
    s.top = 46;
    s.bottom = -46;
    scene.add(key);
    scene.add(key.target);
    this.key = key;

    // a black mirror sea under everything, catching the sky
    this.sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x01040a, roughness: 0.14, metalness: 0.9 })
    );
    this.sea.position.y = -0.5;
    this.sea.receiveShadow = true;
    scene.add(this.sea);

    const tex = cloudTexture();
    this.clouds = [];
    for (let i = 0; i < clouds; i++) {
      const low = i % 4 !== 0;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          color: low ? 0x0e2b3c : 0x1b4a63,
          transparent: true,
          opacity: low ? 0.7 : 0.26,
          depthWrite: false,
        })
      );
      const size = low ? 150 + Math.random() * 190 : 90 + Math.random() * 110;
      sprite.scale.set(size, size * 0.48, 1);
      sprite.userData = {
        ox: (Math.random() - 0.5) * 520,
        oz: (Math.random() - 0.5) * 520,
        y: low ? -16 - Math.random() * 30 : 24 + Math.random() * 40,
        drift: 0.15 + Math.random() * 0.4,
      };
      scene.add(sprite);
      this.clouds.push(sprite);
    }
    this.t = 0;
  }

  // Everything follows the walker so the sky and the sea never run out.
  update(dt, cam) {
    this.t += dt;
    this.dome.position.copy(cam);
    this.stars.position.copy(cam);
    this.sea.position.set(cam.x, this.sea.position.y, cam.z);
    this.key.position.set(cam.x - 26, 22, cam.z - 34);
    this.key.target.position.set(cam.x, 0, cam.z);
    this.key.target.updateMatrixWorld();
    for (const s of this.clouds) {
      const u = s.userData;
      u.ox += u.drift * dt;
      s.position.set(cam.x + wrap(u.ox - cam.x), u.y + Math.sin(this.t * 0.15 + u.oz) * 0.6, cam.z + wrap(u.oz - cam.z));
    }
  }
}

function wrap(v) {
  return ((((v + 260) % 520) + 520) % 520) - 260;
}
