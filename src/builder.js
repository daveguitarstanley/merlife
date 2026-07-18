import * as THREE from 'three';
import { terrainHeight } from './world.js';

export const BLUEPRINTS = [
  { id: 'cave', label: 'Coral Cave', emoji: '🕳️', cost: 6 },
  { id: 'house', label: 'Pearl House', emoji: '🏠', cost: 10 },
  { id: 'furniture', label: 'Furniture', emoji: '🛋️', cost: 3 },
];
export const PEARL_CAP = 24;
const FURNITURE_KINDS = ['bed', 'table', 'chair', 'lamp', 'sofa'];

const CORAL_SPOT_COLORS = [0xff7f6b, 0xff6fb5, 0xffe66b, 0x6fdcff];

// Each structure gets its own materials so ghosts can be transparent.
export function makeStructure(type, kind) {
  const g = new THREE.Group();
  if (type === 'cave') {
    // a big swim-through coral archway — glide right under it
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(2.0, 0.75, 10, 18, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 1 }));
    arch.position.y = 0.3;
    g.add(arch);
    for (let i = 0; i < 5; i++) {
      const a = (i / 4) * Math.PI;
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshStandardMaterial({ color: CORAL_SPOT_COLORS[i % 4], roughness: 0.8 }));
      spot.position.set(Math.cos(a) * 2.0, 0.3 + Math.sin(a) * 2.0, (i % 2 ? 0.5 : -0.4));
      g.add(spot);
    }
    for (const s of [-1, 1]) {
      const col = s > 0 ? 0xff6fb5 : 0x6fffe0;
      const anem = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 6),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 }));
      anem.position.set(1.3 * s, 0.45, 0.6);
      g.add(anem);
    }
    g.scale.setScalar(2.4);
  } else if (type === 'house') {
    // a grand hollow pearl dome — swim in through the archway, furnish inside!
    const R = 5.2;
    const doorW = 0.62;                                   // doorway wedge (radians)
    const pearlMat = new THREE.MeshStandardMaterial({
      color: 0xfdf3ff, roughness: 0.25, metalness: 0.15,
      emissive: 0x334455, emissiveIntensity: 0.15, side: THREE.DoubleSide,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(R, 30, 18, doorW / 2, Math.PI * 2 - doorW, 0, Math.PI / 2), pearlMat);
    dome.rotation.y = Math.PI / 2;                        // doorway gap faces +z
    g.add(dome);
    g.userData.dollhouse = { r: R, mats: [pearlMat] };    // shell fades when you swim in
    // pearly floor with a soft rug
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R - 0.15, 28),
      new THREE.MeshStandardMaterial({ color: 0xf6e7d7, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.04;
    g.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20),
      new THREE.MeshStandardMaterial({ color: 0xff9ec4, roughness: 0.9 }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = 0.07;
    g.add(rug);
    // shining doorway arch
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.24, 10, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.3, emissive: 0x557788, emissiveIntensity: 0.25 }));
    frame.position.set(0, 0.1, Math.cos(doorW / 2) * R - 0.35);
    g.add(frame);
    // porthole windows on the shell, either side of the door
    for (const s of [-1, 1]) {
      const a = s * 1.92;                                 // ±110° from the doorway
      const h = 2.2, r = Math.sqrt(R * R - h * h) + 0.06;
      const window_ = new THREE.Mesh(new THREE.CircleGeometry(0.85, 14),
        new THREE.MeshStandardMaterial({ color: 0x9adcf0, emissive: 0x2a6a8a, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
      window_.position.set(Math.sin(a) * r, h, Math.cos(a) * r);
      window_.lookAt(Math.sin(a) * r * 2, h, Math.cos(a) * r * 2);
      g.add(window_);
    }
    // glowing pearl lamp inside
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaee7ff, emissiveIntensity: 1.1, roughness: 0.2 }));
    lamp.position.set(0, R * 0.72, 0);
    g.add(lamp);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0x8fd8f2, emissiveIntensity: 0.6, roughness: 0.2,
      }));
    finial.position.y = R + 0.35;
    g.add(finial);
  } else {
    // furniture
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 });
    const soft = new THREE.MeshStandardMaterial({ color: 0xff9ec4, roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 0.7 });
    if (kind === 'bed') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 2.1), wood);
      frame.position.y = 0.14; g.add(frame);
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.2, 1.95), white);
      mattress.position.y = 0.36; g.add(mattress);
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), soft);
      blanket.position.set(0, 0.44, 0.35); g.add(blanket);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.45), white);
      pillow.position.set(0, 0.5, -0.7); g.add(pillow);
    } else if (kind === 'table') {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.6, 10), wood);
      leg.position.y = 0.3; g.add(leg);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 18),
        new THREE.MeshStandardMaterial({ color: 0xffe3ef, roughness: 0.4, metalness: 0.2 }));
      top.position.y = 0.65; g.add(top);
    } else if (kind === 'chair') {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), soft);
      seat.position.y = 0.45; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.1), soft);
      back.position.set(0, 0.85, -0.26); g.add(back);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.45, 8), wood);
      ped.position.y = 0.2; g.add(ped);
    } else if (kind === 'lamp') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.2, 8), wood);
      pole.position.y = 0.6; g.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10),
        new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0xaee7ff, emissiveIntensity: 1.1, roughness: 0.2,
        }));
      bulb.position.y = 1.35; g.add(bulb);
    } else { // sofa
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.75), soft);
      base.position.y = 0.3; g.add(base);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.22), soft);
      back.position.set(0, 0.75, -0.28); g.add(back);
      for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.75), soft);
        arm.position.set(0.75 * s, 0.42, 0); g.add(arm);
      }
    }
  }
  return g;
}

function makeGhost(type, kind) {
  const g = makeStructure(type, kind);
  g.traverse((o) => {
    if (o.material) {
      o.material.transparent = true;
      o.material.opacity = 0.32;
      o.material.depthWrite = false;
    }
  });
  return g;
}

function makeProgressSprite() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.4, 1.2, 1);
  sprite.userData.draw = (text) => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(8,44,66,0.8)';
    g.beginPath();
    g.roundRect(14, 10, 100, 44, 20);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 26px Trebuchet MS';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 33);
    tex.needsUpdate = true;
  };
  return sprite;
}

export class PearlSystem {
  // events(type, data): 'pearls' | 'built' | 'oyster' | 'fizzle' | 'progress'
  constructor(scene, save, events) {
    this.scene = scene;
    this.save = save;
    this.events = events;
    this.blueprintIdx = 0;
    this.projectiles = [];
    this.sites = [];
    this.dollhouses = [];        // built pearl homes: shell fades when inside
    this.oysters = [];
    this.sparkles = [];

    this.pearlGeo = new THREE.SphereGeometry(0.15, 12, 10);
    this.pearlMat = new THREE.MeshStandardMaterial({
      color: 0xfff6ff, emissive: 0x8fd8f2, emissiveIntensity: 0.8, roughness: 0.2,
    });

    // rebuild saved structures and half-finished sites
    for (const b of save.builds) this._placeStructure(b);
    if (!save.sites) save.sites = [];
    for (const s of save.sites) {
      this._createSite(new THREE.Vector3(s.x, terrainHeight(s.x, s.z), s.z), s);
    }

    // glowing oysters scattered on the reef
    const spots = [[-88, -14], [-58, 22], [-34, -30], [-8, 14], [4, -18], [-70, 40], [-20, 44], [16, 28]];
    for (const [x, z] of spots) {
      const y = terrainHeight(x, z);
      if (y > -3) continue;
      const o = new THREE.Group();
      o.position.set(x, y + 0.15, z);
      o.rotation.y = Math.random() * 6.28;
      const shellMat = new THREE.MeshStandardMaterial({ color: 0xc9b8d8, roughness: 0.5, metalness: 0.2 });
      const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
      bottom.scale.y = 0.4;
      bottom.rotation.x = Math.PI;
      bottom.position.y = 0.22;
      o.add(bottom);
      const lid = new THREE.Group();
      lid.position.set(0, 0.24, -0.5);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
      top.scale.y = 0.4;
      top.position.z = 0.5;
      lid.add(top);
      o.add(lid);
      const pearl = new THREE.Mesh(this.pearlGeo, this.pearlMat);
      pearl.scale.setScalar(1.7);
      pearl.position.y = 0.35;
      o.add(pearl);
      this.scene.add(o);
      this.oysters.push({ group: o, lid, pearl, open: true, timer: 0, phase: Math.random() * 6.28 });
    }
  }

  get blueprint() { return BLUEPRINTS[this.blueprintIdx]; }
  cycleBlueprint() {
    this.blueprintIdx = (this.blueprintIdx + 1) % BLUEPRINTS.length;
    return this.blueprint;
  }

  shoot(origin, dir) {
    if (this.save.pearls <= 0) return false;
    this.save.pearls--;
    this.events('pearls');
    const m = new THREE.Mesh(this.pearlGeo, this.pearlMat);
    m.position.copy(origin);
    this.scene.add(m);
    this.projectiles.push({ mesh: m, vel: dir.clone().multiplyScalar(12), life: 6 });
    return true;
  }

  _placeStructure(b) {
    const s = makeStructure(b.type, b.kind);
    s.position.set(b.x, terrainHeight(b.x, b.z), b.z);
    s.rotation.y = b.ry || 0;
    this.scene.add(s);
    if (s.userData.dollhouse) this.dollhouses.push({ group: s, ...s.userData.dollhouse, faded: false });
  }

  _sparkle(pos, n = 10) {
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(this.pearlGeo, this.pearlMat);
      p.scale.setScalar(0.4 + Math.random() * 0.4);
      p.position.copy(pos);
      this.scene.add(p);
      this.sparkles.push({
        mesh: p, life: 0.8 + Math.random() * 0.4,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3),
      });
    }
  }

  _deposit(pos) {
    const floor = terrainHeight(pos.x, pos.z);
    if (floor > -1.5) {
      // too shallow to build — pearl pops back to you
      this.save.pearls = Math.min(PEARL_CAP, this.save.pearls + 1);
      this.events('fizzle');
      return;
    }
    let site = this.sites.find((s) => s.pos.distanceTo(pos) < 4.5);
    if (!site) {
      const bp = this.blueprint;
      site = this._createSite(new THREE.Vector3(pos.x, floor, pos.z), {
        type: bp.id,
        kind: FURNITURE_KINDS[Math.floor(Math.random() * FURNITURE_KINDS.length)],
        cost: bp.cost, pearls: 0, ry: Math.random() * 6.28,
      });
    }
    site.pearls++;
    site.saved.pearls = site.pearls;
    this._sparkle(pos, 5);
    if (site.pearls >= site.cost) {
      this.scene.remove(site.ghost, site.label);
      this.sites.splice(this.sites.indexOf(site), 1);
      this.save.sites.splice(this.save.sites.indexOf(site.saved), 1);
      const b = { type: site.type, kind: site.kind, x: site.pos.x, z: site.pos.z, ry: site.ry };
      this.save.builds.push(b);
      this._placeStructure(b);
      this._sparkle(site.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 18);
      this.events('built', site);
    } else {
      site.label.userData.draw(`${site.pearls}/${site.cost}`);
      this.events('progress', site);
    }
  }

  _createSite(sitePos, data) {
    const ghost = makeGhost(data.type, data.kind);
    ghost.position.copy(sitePos);
    ghost.rotation.y = data.ry;
    this.scene.add(ghost);
    const label = makeProgressSprite();
    label.position.copy(sitePos).add(new THREE.Vector3(0, 3.2, 0));
    label.userData.draw(`${data.pearls}/${data.cost}`);
    this.scene.add(label);
    let saved = this.save.sites.find((s) => s.x === sitePos.x && s.z === sitePos.z);
    if (!saved) {
      saved = { type: data.type, kind: data.kind, cost: data.cost, pearls: data.pearls, ry: data.ry, x: sitePos.x, z: sitePos.z };
      this.save.sites.push(saved);
    }
    const site = { ...data, pos: sitePos, ghost, label, saved };
    this.sites.push(site);
    return site;
  }

  update(dt, t, playerPos, playing) {
    // pearl-home dollhouse view: the shell turns glassy while you're inside
    for (const d of this.dollhouses) {
      const g = d.group.position;
      const inside = playing
        && Math.hypot(playerPos.x - g.x, playerPos.z - g.z) < d.r
        && playerPos.y < g.y + d.r + 1;
      if (inside !== d.faded) {
        d.faded = inside;
        for (const m of d.mats) {
          m.transparent = true;
          m.opacity = inside ? 0.35 : 1;
          m.needsUpdate = true;
        }
      }
    }
    // pearls in flight
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.vel.y -= 6 * dt;            // gentle sink so they always land
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt;
      const floor = terrainHeight(p.mesh.position.x, p.mesh.position.z);
      if (p.mesh.position.y <= floor + 0.25 || p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        this._deposit(p.mesh.position);
      }
    }
    // sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.life -= dt;
      if (s.life <= 0) { this.scene.remove(s.mesh); this.sparkles.splice(i, 1); continue; }
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.scale.multiplyScalar(Math.max(0.0001, 1 - dt * 1.2));
    }
    // ghost sites gently pulse
    for (const s of this.sites) {
      const k = 1 + Math.sin(t * 2.5) * 0.03;
      s.ghost.scale.setScalar(k);
    }
    // oysters breathe, close when collected, reopen on a timer
    for (const o of this.oysters) {
      if (o.open) {
        o.lid.rotation.x = -0.65 - Math.sin(t * 1.2 + o.phase) * 0.12;
        o.pearl.visible = true;
        o.pearl.position.y = 0.35 + Math.sin(t * 2 + o.phase) * 0.04;
        if (playing && playerPos.distanceTo(o.group.position) < 2.4) {
          o.open = false;
          o.timer = 25;
          this.save.pearls = Math.min(PEARL_CAP, this.save.pearls + 3);
          this._sparkle(o.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 8);
          this.events('oyster');
        }
      } else {
        o.lid.rotation.x += (0 - o.lid.rotation.x) * Math.min(1, dt * 6);
        o.pearl.visible = false;
        o.timer -= dt;
        if (o.timer <= 0) o.open = true;
      }
    }
  }
}
