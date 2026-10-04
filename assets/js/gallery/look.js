// Shared art direction for both worlds: one environment map, one post chain,
// one palette. Light and grade do the work here, not geometry.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// One cold hue for the world. Warmth is reserved for the prints, so they are the
// only warm thing in a cold place and carry the eye by themselves.
export const PALETTE = {
  deep: 0x03060c,
  horizon: 0x061620,
  cold: 0x7fd4f0,
  carpet: 0x571207,
  print: 0xffe9d2,
};

// An equirect gradient, pre-filtered into an environment map. This is what gives
// surfaces their falloff and sheen; without it everything reads as flat plastic.
export function environment(renderer, scene, stops) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 128);
  for (const [at, colour] of stops) grad.addColorStop(at, colour);
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return scene.environment;
}

// Vignette and grain, applied last so they sit in display space like a print does.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    grain: { value: 0.045 },
    seed: { value: 0 },
    falloff: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float grain; uniform float seed; uniform float falloff;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - smoothstep(0.16, 0.62, dot(d, d) * falloff);
      c.rgb *= mix(0.58, 1.0, v);
      float n = fract(sin(dot(vUv + seed, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

// Bloom makes neon read as light rather than paint; the threshold is kept high so
// only genuinely bright things glow, and the prints stay crisp.
export function makeComposer(renderer, scene, camera, { strength = 0.5, radius = 0.55, threshold = 0.82, grain = 0.045 } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(size, strength, radius, threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.grain.value = grain;
  composer.addPass(grade);
  return {
    render(now) {
      grade.uniforms.seed.value = (now % 1000) / 1000;
      composer.render();
    },
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
  };
}
