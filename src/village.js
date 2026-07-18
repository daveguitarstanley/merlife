import * as THREE from 'three';
import { terrainHeight, JETTY, COLLIDERS } from './world.js';
import { QUESTS } from './quests.js';

export function makeTextSprite(text, { fontSize = 40, bg = 'rgba(8,44,66,0.78)', color = '#ffffff', scale = 1 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `bold ${fontSize}px 'Trebuchet MS', sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 36;
  const h = fontSize + 34;
  c.width = w; c.height = h;
  const g2 = c.getContext('2d');
  if (bg) {
    g2.fillStyle = bg;
    g2.beginPath();
    g2.roundRect(2, 2, w - 4, h - 4, h / 2.4);
    g2.fill();
  }
  g2.font = font;
  g2.fillStyle = color;
  g2.textAlign = 'center';
  g2.textBaseline = 'middle';
  g2.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set((w / h) * 0.62 * scale, 0.62 * scale, 1);
  return sprite;
}

// ---------------------------------------------------------------- villagers
// A proper little person (~2.3 u tall) with their own skin, hair and clothes.
// look: { skin, hair ('short'|'bun'|'long'|'afro'|'bald'|'ponytail'), hairColor,
//         top, bottom, dress, hat ('captain'|'baker'|'beret'|'straw'|'flower'),
//         hatColor, beard, beardColor, apron, staff, stout, earrings, sad }
export function makeVillager(look = {}) {
  const g = new THREE.Group();
  const skin = look.skin ?? 0xeec39a;
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const topMat = new THREE.MeshStandardMaterial({ color: look.top ?? 0x4f7ec0, roughness: 0.85 });
  const botMat = new THREE.MeshStandardMaterial({ color: look.bottom ?? 0x5a4632, roughness: 0.85 });
  const wide = look.stout ? 1.28 : 1;

  const limbs = { legs: [], arms: [] };
  g.userData.limbs = limbs;
  if (look.dress != null) {
    // full-length dress / robe
    const dressMat = new THREE.MeshStandardMaterial({ color: look.dress, roughness: 0.85 });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * wide, 0.62 * wide, 1.5, 12), dressMat);
    skirt.position.y = 0.75;
    g.add(skirt);
    const bodice = new THREE.Mesh(new THREE.CapsuleGeometry(0.3 * wide, 0.42, 4, 10), dressMat);
    bodice.position.y = 1.62;
    g.add(bodice);
  } else {
    // legs + shoes (pivoted at the hip so they can swing) + shirt
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.155 * s * wide, 0.95, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.95, 8), botMat);
      leg.position.y = -0.475;
      hip.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }));
      shoe.position.set(0, -0.88, 0.06);
      hip.add(shoe);
      g.add(hip);
      limbs.legs.push(hip);
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3 * wide, 0.5, 4, 10), topMat);
    torso.position.y = 1.5;
    g.add(torso);
  }
  if (look.apron != null) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5 * wide, 0.85, 0.08),
      new THREE.MeshStandardMaterial({ color: look.apron, roughness: 0.9 }));
    apron.position.set(0, 1.25, 0.28 * wide);
    g.add(apron);
  }
  if (look.sash != null) {
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.06),
      new THREE.MeshStandardMaterial({ color: look.sash, roughness: 0.8 }));
    sash.position.set(0.12, 1.5, 0.3 * wide);
    sash.rotation.z = 0.5;
    g.add(sash);
  }
  // arms (pivoted at the shoulder so they can swing), skin hands
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.36 * wide * s, 1.8, 0);
    shoulder.rotation.z = s * 0.26;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.62, 8),
      look.dress != null ? new THREE.MeshStandardMaterial({ color: look.dress, roughness: 0.85 }) : topMat);
    arm.position.y = -0.31;
    shoulder.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), skinMat);
    hand.position.y = -0.66;
    shoulder.add(hand);
    g.add(shoulder);
    limbs.arms.push(shoulder);
  }
  // head
  const headY = look.sad ? 1.98 : 2.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), skinMat);
  head.position.y = headY;
  if (look.sad) head.rotation.x = 0.22;
  g.add(head);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skinMat);
  nose.position.set(0, headY - 0.02, 0.27);
  g.add(nose);
  for (const s of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    white.position.set(0.1 * s, headY + 0.05, 0.24);
    g.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x203040 }));
    pupil.position.set(0.1 * s, headY + 0.05, 0.285);
    g.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03),
      new THREE.MeshStandardMaterial({ color: look.hairColor ?? 0x3a2a1a }));
    brow.position.set(0.1 * s, headY + 0.15, 0.25);
    brow.rotation.z = look.sad ? -0.35 * s : 0.1 * s;
    g.add(brow);
  }
  // hair
  const hairMat = new THREE.MeshStandardMaterial({ color: look.hairColor ?? 0x3a2a1a, roughness: 0.9 });
  const hair = look.hair ?? 'short';
  if (hair !== 'bald') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.y = headY + 0.03;
    g.add(cap);
    if (hair === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), hairMat);
      bun.position.set(0, headY + 0.28, -0.16);
      g.add(bun);
    } else if (hair === 'long') {
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.85, 10), hairMat);
      back.position.set(0, headY - 0.32, -0.14);
      g.add(back);
    } else if (hair === 'ponytail') {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.045, 0.62, 8), hairMat);
      tail.position.set(0, headY - 0.05, -0.3);
      tail.rotation.x = 0.5;
      g.add(tail);
    } else if (hair === 'afro') {
      const fro = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), hairMat);
      fro.position.y = headY + 0.14;
      fro.scale.y = 0.92;
      g.add(fro);
    }
  }
  if (look.beard) {
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 9, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.45),
      new THREE.MeshStandardMaterial({ color: look.beardColor ?? 0xf5f5f5, roughness: 0.95 }));
    beard.position.set(0, headY - 0.04, 0.06);
    beard.scale.z = 1.15;
    g.add(beard);
  }
  // hats
  const hatColor = look.hatColor ?? 0x2b3a55;
  if (look.hat === 'captain') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 14),
      new THREE.MeshStandardMaterial({ color: 0x14213d, roughness: 0.6 }));
    brim.position.y = headY + 0.2;
    g.add(brim);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.22, 14),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 }));
    cap.position.y = headY + 0.33;
    g.add(cap);
    const badge = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd76a, metalness: 0.6, roughness: 0.3 }));
    badge.position.set(0, headY + 0.33, 0.27);
    g.add(badge);
  } else if (look.hat === 'baker') {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
    puff.position.y = headY + 0.3;
    puff.scale.y = 0.75;
    g.add(puff);
  } else if (look.hat === 'beret') {
    const beret = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9),
      new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.85 }));
    beret.position.set(0.06, headY + 0.22, 0);
    beret.scale.set(1.15, 0.4, 1.15);
    g.add(beret);
  } else if (look.hat === 'straw') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 }));
    brim.position.y = headY + 0.2;
    g.add(brim);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 }));
    dome.position.y = headY + 0.2;
    g.add(dome);
  } else if (look.hat === 'flower') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff6fb5 : 0xffd23f, roughness: 0.6 }));
      f.position.set(Math.cos(a) * 0.26, headY + 0.22, Math.sin(a) * 0.26);
      g.add(f);
    }
  }
  if (look.earrings) {
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0xffd76a, metalness: 0.7, roughness: 0.3 }));
      ring.position.set(0.27 * s, headY - 0.06, 0);
      g.add(ring);
    }
  }
  if (look.staff) {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 }));
    staff.position.set(0.56, 1.25, 0.1);
    g.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x7ef3d0, emissive: 0x2ec4b6, emissiveIntensity: 0.6 }));
    orb.position.set(0.56, 2.55, 0.1);
    g.add(orb);
  }
  // match the player's stature (~2.9 u tall on land)
  g.scale.setScalar(1.18);
  return g;
}

const SHOP_STYLES = {
  Shoes: { color: 0x8a5a33, emoji: '👟' },
  Clothes: { color: 0x4fc08d, emoji: '👗' },
  Accessories: { color: 0xb05a9a, emoji: '💍' },
  Food: { color: 0xd2691e, emoji: '🍞' },
  Furniture: { color: 0xe0725c, emoji: '🛋️' },
};

function makeStall(shopName) {
  const style = SHOP_STYLES[shopName];
  const g = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 }));
  counter.position.y = 0.75;
  g.add(counter);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x7a4b2f, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.8, 8), postMat);
    post.position.set(2.1 * s, 1.9, -0.6);
    g.add(post);
  }
  // striped awning
  const ac = document.createElement('canvas');
  ac.width = 128; ac.height = 32;
  const ag = ac.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ag.fillStyle = i % 2 ? '#ffffff' : `#${new THREE.Color(style.color).getHexString()}`;
    ag.fillRect(i * 16, 0, 16, 32);
  }
  const awning = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.16, 3.2),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(ac), roughness: 0.8 }));
  awning.position.set(0, 3.9, 0.2);
  awning.rotation.x = -0.18;
  g.add(awning);
  const sign = makeTextSprite(`${style.emoji} ${shopName}`, { fontSize: 44, scale: 2.2 });
  sign.position.set(0, 5.1, 0);
  g.add(sign);
  return g;
}

// Quest-giver NPCs, shop stalls, homeless villagers and ambient strollers.
export function buildVillage(scene) {
  const npcs = [];
  for (const q of QUESTS) {
    const [x, z] = q.giverPos;
    const y = q.jetty ? JETTY.deckY : terrainHeight(x, z);
    const [fx, fz] = q.face ?? [150, 0];
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.atan2(fx - x, fz - z);
    group.add(makeVillager(q.look ?? { top: q.npcColor }));
    const label = makeTextSprite(`${q.emoji} ${q.giver}`, { fontSize: 36 });
    label.position.y = 3.65;
    group.add(label);
    const marker = makeTextSprite('❗', { fontSize: 64, bg: null, color: '#ffd23f', scale: 1.4 });
    marker.position.y = 4.45;
    group.add(marker);
    if (q.shop) {
      const stall = makeStall(q.shop);
      stall.position.set(x, y, z);
      stall.rotation.y = group.rotation.y;
      COLLIDERS.circles.push({ x, z, r: 2.3 });
      // shopkeeper stands behind the counter
      group.position.x -= Math.sin(group.rotation.y) * 2.0;
      group.position.z -= Math.cos(group.rotation.y) * 2.0;
      scene.add(stall);
    }
    scene.add(group);
    npcs.push({ quest: q, group, marker });
  }

  const homeless = [];
  const homelessLooks = [
    { skin: 0xd9a066, hair: 'short', hairColor: 0x6a6a6a, top: 0x8a8a92, bottom: 0x5a5a52, sad: true },
    { skin: 0xf3c9a5, hair: 'long', hairColor: 0x8a6a4a, dress: 0x7a7a72, sad: true },
    { skin: 0x8d5524, hair: 'bald', beard: true, beardColor: 0x777777, top: 0x6e6e5e, bottom: 0x4a4a42, sad: true },
  ];
  const homelessSpots = [[66, 8], [70, -14], [62, 18]];
  homelessSpots.forEach(([x, z], i) => {
    const y = terrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = Math.atan2(45 - x, 0 - z);  // gaze toward the sea
    group.add(makeVillager(homelessLooks[i]));
    const label = makeTextSprite('🥺 No home…', { fontSize: 32 });
    label.position.y = 3.4;
    group.add(label);
    scene.add(group);
    homeless.push({
      group,
      homed: false,
      setHome(housePos, ry) {
        this.homed = true;
        const hx = housePos.x + Math.sin(ry) * 5.2, hz = housePos.z + Math.cos(ry) * 5.2;
        group.position.set(hx, terrainHeight(hx, hz), hz);
        group.rotation.y = ry + Math.PI; // admire the new front door
        group.remove(label);
        const happy = makeTextSprite('😊 Home at last!', { fontSize: 32 });
        happy.position.y = 3.4;
        group.add(happy);
      },
    });
  });

  // ambient villagers strolling the streets — the town feels lived-in
  const strollers = [];
  const strollLooks = [
    { skin: 0xfbe0c4, hair: 'ponytail', hairColor: 0xe8c56c, top: 0x6fc9dc, bottom: 0x3a4a5a },
    { skin: 0x5d3a1a, hair: 'short', hairColor: 0x1b1b1b, top: 0xffd23f, bottom: 0x4a3a2a },
    { skin: 0xeec39a, hair: 'bun', hairColor: 0xc0392b, dress: 0x4caf50 },
    { skin: 0xb97a50, hair: 'short', hairColor: 0x2a2a2a, top: 0xe8ffd6, bottom: 0x5a4632, hat: 'straw' },
    { skin: 0xf3c9a5, hair: 'long', hairColor: 0x5a3620, dress: 0xd6f0ff },
    { skin: 0x8d5524, hair: 'afro', hairColor: 0x111111, top: 0xff8fa3, bottom: 0x2b3a55 },
  ];
  const routes = [
    [[90, 0], [255, 0]],
    [[150, -78], [150, 78]],
    [[108, -50], [240, -50]],
    [[108, 50], [240, 50]],
    [[220, -44], [220, 44]],
    [[137, -9], [163, -9], [163, 9], [137, 9]],  // window-shopping the market square
  ];
  strollLooks.forEach((look, i) => {
    const route = routes[i % routes.length];
    const group = new THREE.Group();
    const start = route[0];
    group.position.set(start[0], terrainHeight(start[0], start[1]), start[1]);
    group.add(makeVillager(look));
    scene.add(group);
    strollers.push({ group, route, target: 1, dir: 1, speed: 1.3 + (i % 3) * 0.25 });
  });

  let lastT = 0;
  return {
    npcs,
    homeless,
    update(t) {
      const dt = Math.min(0.1, Math.max(0.001, t - lastT));
      lastT = t;
      for (const n of npcs) {
        if (n.marker.visible) n.marker.position.y = 4.45 + Math.sin(t * 2.5) * 0.15;
      }
      for (const s of strollers) {
        const [tx, tz] = s.route[s.target];
        const p = s.group.position;
        const dx = tx - p.x, dz = tz - p.z;
        const d = Math.hypot(dx, dz);
        let walking = 0;
        if (d < 0.7) {
          // next waypoint (ping-pong along the route)
          let next = s.target + s.dir;
          if (next >= s.route.length || next < 0) { s.dir *= -1; next = s.target + s.dir; }
          s.target = next;
          s.bestD = Infinity; s.stuckT = 0;
        } else {
          walking = 1;
          // steer: aim at the waypoint, but veer politely around anything in
          // the way. Radial push alone can deadlock head-on (stroller stuck in
          // the fountain!), so add a tangential "walk around it" component.
          let sx = dx / d, sz = dz / d;
          const dodge = (ox, oz, range, w0) => {
            const od = Math.hypot(ox, oz);
            if (od >= range || od < 0.01) return;
            const w = ((range - od) / range) * w0;
            sx += (ox / od) * w; sz += (oz / od) * w;
            // tangential: pick whichever way around is closer to the waypoint
            let px = -oz / od, pz = ox / od;
            if (px * dx + pz * dz < 0) { px = -px; pz = -pz; }
            sx += px * w * 0.9; sz += pz * w * 0.9;
          };
          for (const o of COLLIDERS.circles) dodge(p.x - o.x, p.z - o.z, o.r + 1.6, 2.4);
          for (const h of COLLIDERS.houses) dodge(p.x - h.x, p.z - h.z, 4.6 * h.s + 1.4, 2.4);
          const sl = Math.hypot(sx, sz) || 1;
          p.x += (sx / sl) * s.speed * dt;
          p.z += (sz / sl) * s.speed * dt;
          // failsafe: if no progress toward the waypoint for a while, skip it
          s.stuckT = (s.stuckT ?? 0) + dt;
          if (d < (s.bestD ?? Infinity) - 0.5) { s.bestD = d; s.stuckT = 0; }
          if (s.stuckT > 5) {
            let next = s.target + s.dir;
            if (next >= s.route.length || next < 0) { s.dir *= -1; next = s.target + s.dir; }
            s.target = next;
            s.bestD = Infinity; s.stuckT = 0;
          }
          p.y = terrainHeight(p.x, p.z);
          const want = Math.atan2(sx, sz);
          let diff = want - s.group.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          s.group.rotation.y += diff * Math.min(1, dt * 5);
        }
        // little legs & arms swing while they walk
        s.phase = (s.phase ?? 0) + dt * s.speed * 3.6 * walking;
        const limbs = s.group.children[0]?.userData.limbs;
        if (limbs) {
          const sw = Math.sin(s.phase) * 0.55 * walking;
          limbs.legs.forEach((leg, i) => { leg.rotation.x = i === 0 ? sw : -sw; });
          limbs.arms.forEach((arm, i) => { arm.rotation.x = (i === 0 ? -sw : sw) * 0.7; });
        }
      }
    },
  };
}
