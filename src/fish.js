import * as THREE from 'three';
import { terrainHeight } from './world.js';

function makeFishMesh(color, size) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28 * size, 12, 9), mat);
  body.scale.set(0.55, 0.8, 1.6);
  g.add(body);
  const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.2 * size, 0.35 * size, 4), mat);
  tailFin.rotation.x = -Math.PI / 2;
  tailFin.scale.x = 0.3;
  tailFin.position.z = -0.5 * size;
  g.add(tailFin);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x203040 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045 * size, 6, 5), eyeMat);
    eye.position.set(0.14 * size * s, 0.06 * size, 0.3 * size);
    g.add(eye);
  }
  g.userData.tailFin = tailFin;
  return g;
}

export class FishSchool {
  constructor(scene, { count = 10, color = 0xffb26b, center, radius = 14, size = 1 }) {
    this.center = center.clone();
    this.home = center.clone();
    this.radius = radius;
    this.angle = Math.random() * Math.PI * 2;
    this.fish = [];
    for (let i = 0; i < count; i++) {
      const mesh = makeFishMesh(color, size * (0.8 + Math.random() * 0.5));
      mesh.position.copy(center).add(new THREE.Vector3(
        (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8));
      scene.add(mesh);
      this.fish.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)),
        phase: Math.random() * Math.PI * 2,
        offset: new THREE.Vector3(
          (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 5),
      });
    }
    this._v = new THREE.Vector3();
    this._target = new THREE.Vector3();
  }

  update(dt, t) {
    // the school's target slowly circles its home patch
    this.angle += dt * 0.25;
    this.center.set(
      this.home.x + Math.cos(this.angle) * this.radius,
      this.home.y + Math.sin(this.angle * 0.7) * 2,
      this.home.z + Math.sin(this.angle) * this.radius);

    for (const f of this.fish) {
      this._target.copy(this.center).add(f.offset);
      this._v.copy(this._target).sub(f.mesh.position);
      const dist = this._v.length();
      this._v.normalize().multiplyScalar(Math.min(3.5, dist));
      f.vel.lerp(this._v, Math.min(1, dt * 1.5));
      f.mesh.position.addScaledVector(f.vel, dt);
      // stay underwater and above the sea floor
      const floor = terrainHeight(f.mesh.position.x, f.mesh.position.z);
      if (f.mesh.position.y < floor + 1) f.mesh.position.y = floor + 1;
      if (f.mesh.position.y > -1.2) f.mesh.position.y = -1.2;
      // face the way we swim
      if (f.vel.lengthSq() > 0.01) {
        const look = this._v.copy(f.mesh.position).add(f.vel);
        f.mesh.lookAt(look);
      }
      // tail wiggle
      const fin = f.mesh.userData.tailFin;
      fin.rotation.y = Math.sin(t * 9 + f.phase) * 0.5;
      f.mesh.rotation.y += Math.sin(t * 9 + f.phase) * 0.03;
    }
  }
}

export function createFishSchools(scene) {
  const schools = [
    new FishSchool(scene, { count: 12, color: 0xffb26b, center: new THREE.Vector3(-70, -6, -12), radius: 12 }),
    new FishSchool(scene, { count: 10, color: 0x6fdcff, center: new THREE.Vector3(-30, -8, 24), radius: 16 }),
    new FishSchool(scene, { count: 10, color: 0xff6fb5, center: new THREE.Vector3(0, -5, -28), radius: 14 }),
    new FishSchool(scene, { count: 8, color: 0xffe66b, center: new THREE.Vector3(22, -4, 10), radius: 10, size: 0.8 }),
    new FishSchool(scene, { count: 6, color: 0xb56fff, center: new THREE.Vector3(-100, -5, 3), radius: 6, size: 0.7 }),
  ];
  return schools;
}
