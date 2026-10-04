// Parallel paths: copies of the carpet floating in the clouds, each showing the
// same photos another way, with a faint ghost of the walker keeping pace.
import * as THREE from "three";

// World offsets. The copies translate with the path, so they stay parallel to it.
// They sit far out in the fog: other paths on the horizon, not debris overhead.
const COPIES = [
  { variant: "vector", offset: new THREE.Vector3(185, 44, -40) },
  { variant: "gray", offset: new THREE.Vector3(-205, -36, 30) },
  { variant: "cutout", offset: new THREE.Vector3(58, 120, 150) },
  { variant: "gray", offset: new THREE.Vector3(-70, -96, -165) },
];

export function parallelCopies(small) {
  return small ? COPIES.slice(0, 2) : COPIES;
}

export class Ghosts {
  constructor(scene, copies) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff1e6,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const body = new THREE.CapsuleGeometry(0.24, 0.95, 4, 12);
    const head = new THREE.SphereGeometry(0.17, 16, 12);
    this.list = copies.map((c) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(body, mat);
      b.position.y = 0.75;
      const h = new THREE.Mesh(head, mat);
      h.position.y = 1.55;
      g.add(b, h);
      scene.add(g);
      return { g, offset: c.offset };
    });
    this.t = 0;
  }

  // Each ghost walks where the walker walks, on its own copy of the path.
  update(dt, x, z, yaw, moving) {
    this.t += dt * (moving ? 7 : 1.5);
    for (const { g, offset } of this.list) {
      g.position.set(x + offset.x, offset.y + Math.abs(Math.sin(this.t)) * (moving ? 0.05 : 0.01), z + offset.z);
      g.rotation.y = yaw;
    }
  }
}
