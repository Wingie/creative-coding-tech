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

// Vignette, plus a dither applied last in display space. The dither is about one
// 8-bit step, fixed to the screen pixel and the same every frame: enough to break
// banding in the dark sky gradients, too small and too still to read as noise.
// A per-frame sin() hash on uv at several times that strength used to sit here; it
// crawled over the prints in a visible repeating pattern.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    grain: { value: 1.5 / 255 },
    falloff: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float grain; uniform float falloff;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - smoothstep(0.16, 0.62, dot(d, d) * falloff);
      c.rgb *= mix(0.58, 1.0, v);
      // interleaved gradient noise: no sin(), so no precision patterns on any GPU
      float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      c.rgb += (n - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

// Bloom makes neon read as light rather than paint; the threshold is kept high so
// only genuinely bright things glow, and the prints stay crisp.
export function makeComposer(renderer, scene, camera, { strength = 0.5, radius = 0.55, threshold = 0.82 } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(size, strength, radius, threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(GradeShader));
  return {
    render() {
      composer.render();
    },
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
  };
}
