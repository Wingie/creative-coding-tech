// Night sky for the cloud path: a dark gradient dome, stars, a glowing grid
// running off into the dark, drifting clouds and fog. Cold neon, one warm accent.
import * as THREE from "three";

const HORIZON = 0x071a26;
const GRID = 0x2ad4ff;

function cloudTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  // a few soft puffs in one sprite
  const puffs = [
    [128, 140, 90],
    [80, 150, 60],
    [176, 150, 64],
    [110, 110, 58],
    [158, 115, 52],
  ];
  for (const [x, y, r] of puffs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.22)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Sky {
  constructor(scene, { clouds = 140 } = {}) {
    scene.background = new THREE.Color(HORIZON);
    scene.fog = new THREE.Fog(HORIZON, 70, 320);

    // gradient dome that follows the camera
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(460, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x02030a) },
          mid: { value: new THREE.Color(0x061021) },
          low: { value: new THREE.Color(0x0a2b3d) },
        },
        vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 v;" +
          "void main(){ float h = v.y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, h)) : mix(low, mid, smoothstep(-0.05, 0.18, h));" +
          " gl_FragColor = vec4(c, 1.0); }",
      })
    );
    dome.renderOrder = -2;
    scene.add(dome);
    this.dome = dome;

    // stars on the upper half of a sphere
    const n = 2200;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      const th = Math.random() * Math.PI * 2;
      const y = 0.15 + u * 0.85;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 430, y * 430, Math.sin(th) * r * 430], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: 0xdff2ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 })
    );
    scene.add(this.stars);

    // temple at night: cold light from the grid, a little warm bounce from the braziers
    scene.add(new THREE.HemisphereLight(0x4f9fd0, 0x2a1408, 1.7));
    const cold = new THREE.DirectionalLight(0xa8e6ff, 0.95);
    cold.position.set(-20, 16, -30);
    scene.add(cold);
    // the grid: lines running off into the dark, following the walker
    this.grid = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: { colour: { value: new THREE.Color(GRID) }, centre: { value: new THREE.Vector2() } },
        vertexShader:
          "varying vec3 w; void main(){ w = (modelMatrix * vec4(position,1.0)).xyz;" +
          " gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 colour; uniform vec2 centre; varying vec3 w;" +
          "float line(float v){ float g = abs(fract(v / 8.0 - 0.5) - 0.5) / fwidth(v / 8.0); return 1.0 - min(g, 1.0); }" +
          "void main(){ float l = max(line(w.x), line(w.z));" +
          " float d = distance(w.xz, centre);" +
          " float fade = smoothstep(600.0, 80.0, d) * 0.55 + smoothstep(40.0, 5.0, d) * 0.25;" +
          " gl_FragColor = vec4(colour, l * fade); }",
      })
    );
    this.grid.position.y = -0.06;
    this.grid.renderOrder = -1;
    scene.add(this.grid);

    // clouds: a sea below the carpet plus a few drifting across it
    const tex = cloudTexture();
    this.clouds = [];
    for (let i = 0; i < clouds; i++) {
      const low = i % 5 !== 0;
      const m = new THREE.SpriteMaterial({
        map: tex,
        color: low ? 0x1d3d52 : 0x2e5f78,
        transparent: true,
        opacity: low ? 0.85 : 0.3,
        depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      const size = low ? 40 + Math.random() * 50 : 14 + Math.random() * 16;
      s.scale.set(size, size * 0.55, 1);
      s.userData = {
        low,
        ox: (Math.random() - 0.5) * 330,
        oz: (Math.random() - 0.5) * 330,
        y: low ? -10 - Math.random() * 22 : -1 + Math.random() * 8,
        drift: 0.2 + Math.random() * 0.5,
      };
      scene.add(s);
      this.clouds.push(s);
    }
    this.t = 0;
  }

  // Clouds wrap around the walker so the sea never runs out.
  update(dt, cam) {
    this.t += dt;
    this.dome.position.copy(cam);
    this.stars.position.copy(cam);
    this.grid.position.set(Math.round(cam.x / 8) * 8, this.grid.position.y, Math.round(cam.z / 8) * 8);
    this.grid.material.uniforms.centre.value.set(cam.x, cam.z);
    for (const s of this.clouds) {
      const u = s.userData;
      u.ox += u.drift * dt;
      // clouds sit still in the world and wrap to the far side once they fall behind
      const x = wrap(u.ox - cam.x);
      const z = wrap(u.oz - cam.z);
      s.position.set(cam.x + x, u.y + Math.sin(this.t * 0.2 + u.oz) * 0.3, cam.z + z);
    }
  }
}

function wrap(v) {
  return ((((v + 165) % 330) + 330) % 330) - 165;
}
