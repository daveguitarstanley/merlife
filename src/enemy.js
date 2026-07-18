import * as THREE from 'three';
import { terrainHeight } from './world.js';

export const ELEMENTS = [
  { id: 'earth', label: 'Earth', emoji: '🪨', color: 0x6d9e3f },
  { id: 'wind', label: 'Wind', emoji: '💨', color: 0xbfeef5 },
  { id: 'fire', label: 'Fire', emoji: '🔥', color: 0xff6b35 },
  { id: 'water', label: 'Water', emoji: '💧', color: 0x3aa0ff },
];

function buildNastyMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.6, metalness: 0.2 });
  g.userData.bodyMat = bodyMat;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.7), bodyMat);
  g.add(body);
  // angry eyes
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4 }));
    eye.position.set(0.4 * s, 0.28, 0.72);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xb0182a }));
    pupil.position.set(0.4 * s, 0.28, 0.87);
    g.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x1e222b }));
    brow.position.set(0.4 * s, 0.5, 0.82);
    brow.rotation.z = 0.55 * s;
    g.add(brow);
  }
  // toothy mouth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.28, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x27060c }));
  mouth.position.set(0, -0.18, 0.86);
  g.add(mouth);
  for (let i = 0; i < 5; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff }));
    tooth.position.set(-0.32 + i * 0.16, -0.10, 0.90);
    tooth.rotation.x = Math.PI;
    g.add(tooth);
  }
  // fins & tail
  const finMat = new THREE.MeshStandardMaterial({ color: 0x8a2f3c, roughness: 0.7 });
  g.userData.finMat = finMat;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 4), finMat);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.x = 0.25;
  tail.position.z = -1.15;
  g.add(tail);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 4), finMat);
  dorsal.scale.z = 0.3;
  dorsal.position.set(0, 0.75, -0.2);
  g.add(dorsal);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), finMat);
    side.rotation.z = s * Math.PI / 2;
    side.scale.z = 0.3;
    side.position.set(0.68 * s, -0.1, 0.1);
    g.add(side);
  }
  g.userData.tail = tail;
  return g;
}

// One roaming guardian of the deep. States: idle (hidden) → approach ⇄ flee/confused → leave.
export class NastyFish {
  constructor(scene) {
    this.scene = scene;
    this.group = buildNastyMesh();
    this.group.visible = false;
    scene.add(this.group);
    this.state = 'idle';
    this.weakness = 'water';
    this.biteCooldown = 0;
    this.fleeT = 0;
    this.leaveT = 0;
    this.guard = null;          // { home, radius } when guarding a quest item
    this.speed = 3.4;
    this.patrolAngle = 0;
    this._v = new THREE.Vector3();
  }

  get active() { return this.state !== 'idle'; }

  // A species guardian: anchored to its treasure, tinted, patrols in circles.
  spawnGuard(home, { weakness, color, speed = 3.4, scale = 1.15 }) {
    this.guard = { home: home.clone(), radius: 15 };
    this.weakness = weakness;
    this.speed = speed;
    this.group.scale.setScalar(scale);
    this.group.userData.bodyMat.color.set(color);
    this.group.userData.finMat.color.set(new THREE.Color(color).multiplyScalar(0.55));
    this.group.position.copy(home).add(new THREE.Vector3(4, 1.5, 0));
    this.biteCooldown = 0;
    this.state = 'guardPatrol';
    this.group.visible = true;
  }

  kill() {
    this.guard = null;
    this.group.scale.setScalar(1);
    this.group.userData.bodyMat.color.set(0x4a4f5a);
    this.group.userData.finMat.color.set(0x8a2f3c);
    this.speed = 3.4;
    this.despawn();
  }

  spawn(playerPos) {
    const a = Math.random() * Math.PI * 2;
    const p = this.group.position;
    p.set(playerPos.x + Math.cos(a) * 22, playerPos.y - 1, playerPos.z + Math.sin(a) * 22);
    const floor = terrainHeight(p.x, p.z);
    p.y = THREE.MathUtils.clamp(p.y, floor + 1.5, -2);
    this.weakness = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)].id;
    this.state = 'approach';
    this.biteCooldown = 0;
    this.group.visible = true;
  }

  despawn() {
    this.state = 'idle';
    this.group.visible = false;
  }

  _tryBite(dist, ctx) {
    const p = this.group.position;
    if (dist < 1.9 && this.biteCooldown === 0) {
      ctx.onBite(this);
      this.biteCooldown = 2.4;
      // recoil a little so it charges again
      p.addScaledVector(this._v, -4);
    }
  }

  // ctx: { playerPos, playerInWater, deep, camo, onBite() }
  update(dt, t, ctx) {
    if (!this.active) return;
    this.biteCooldown = Math.max(0, this.biteCooldown - dt);
    const p = this.group.position;
    this._v.copy(ctx.playerPos).sub(p);
    const dist = this._v.length();
    this._v.normalize();
    let speed = 0;   // along _v (toward player); negative = away

    if (this.guard) {
      // ---- guardian of a quest item ----
      const home = this.guard.home;
      const playerNearHome = ctx.playerPos.distanceTo(home) < this.guard.radius;
      const playerFarFromHome = ctx.playerPos.distanceTo(home) > 26;
      if (this.state === 'guardPatrol') {
        this.patrolAngle += dt * 0.55;
        const tx = home.x + Math.cos(this.patrolAngle) * 4.5;
        const tz = home.z + Math.sin(this.patrolAngle) * 4.5;
        const ty = home.y + Math.sin(this.patrolAngle * 1.7) * 1;
        p.x += (tx - p.x) * Math.min(1, dt * 2);
        p.y += (ty - p.y) * Math.min(1, dt * 2);
        p.z += (tz - p.z) * Math.min(1, dt * 2);
        this.group.lookAt(home.x + Math.cos(this.patrolAngle + 0.5) * 4.5, ty, home.z + Math.sin(this.patrolAngle + 0.5) * 4.5);
        if (playerNearHome && ctx.playerInWater && !ctx.camo) this.state = 'approach';
      } else if (this.state === 'approach') {
        if (ctx.camo || !ctx.playerInWater || playerFarFromHome) {
          this.state = 'guardReturn';
        } else {
          speed = this.speed;
          this._tryBite(dist, ctx);
        }
      } else if (this.state === 'flee') {
        speed = -6.5;
        this.fleeT -= dt;
        if (this.fleeT <= 0) this.state = 'guardReturn';
      } else if (this.state === 'guardReturn') {
        this._v.copy(home).sub(p);
        const dh = this._v.length();
        this._v.normalize();
        speed = 4;
        if (dh < 2.5) this.state = 'guardPatrol';
        else if (playerNearHome && ctx.playerInWater && !ctx.camo && dh < 10) this.state = 'approach';
      }
    } else {
      // ---- roaming deep-water fish ----
      if (this.state !== 'leave' && (!ctx.playerInWater || !ctx.deep)) {
        this.state = 'leave';
        this.leaveT = 5;
      }
      if (this.state === 'approach') {
        if (ctx.camo) {
          speed = -1.5;  // camouflage confuses it — drifts away disinterested
        } else {
          speed = this.speed;
          this._tryBite(dist, ctx);
        }
      } else if (this.state === 'flee') {
        speed = -6.5;
        this.fleeT -= dt;
        if (this.fleeT <= 0) this.state = 'approach';
      } else if (this.state === 'leave') {
        speed = -5;
        this.leaveT -= dt;
        if (this.leaveT <= 0 || dist > 45) { this.despawn(); return; }
      }
    }

    if (speed !== 0) {
      p.addScaledVector(this._v, speed * dt);
      const facing = this._v.clone().multiplyScalar(speed >= 0 ? 1 : -1);
      this.group.lookAt(p.x + facing.x, p.y + facing.y * 0.4, p.z + facing.z);
    }
    const floor = terrainHeight(p.x, p.z);
    p.y = THREE.MathUtils.clamp(p.y, floor + 1.2, -1.2);

    // menacing wiggle & bob
    this.group.rotation.y += Math.sin(t * 7) * 0.05;
    this.group.position.y += Math.sin(t * 2.3) * 0.01;
    this.group.userData.tail.rotation.y = Math.sin(t * 8) * 0.5;
  }
}
