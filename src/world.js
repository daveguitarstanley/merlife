import * as THREE from 'three';

// Deterministic RNG so the world is identical every session.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SPAWN = new THREE.Vector3(-116, -3, 0);
export const JETTY = { x1: 32, x2: 58, z1: -2.4, z2: 2.4, deckY: 1.0 };
// Land collision registries, filled in buildWorld (stalls are appended by
// village.js). houses: {x, z, s, ry} — hollow boxes with a door gap on local
// +z. circles: {x, z, r} — fountain, lampposts, palm trunks, shop stalls.
export const COLLIDERS = { houses: [], circles: [] };
// The sunken shipwreck: main.js fades its hull while the player explores
// inside (same dollhouse trick as the houses).
export const WRECK = { x: 0, z: 55, r: 14, mats: [] };
// A big flat-topped island: level plateau (streets!) with a gentle beach ring.
// West coastline sits at x ≈ 57 so the whole reef/quest sea (x ≤ 70) is untouched.
export const ISLAND = { x: 170, z: 0, flatR: 95, shoreR: 150, top: 5.3 };

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function terrainHeight(x, z) {
  // gently rippling sea floor
  const ripples = Math.sin(x * 0.05) * Math.cos(z * 0.07) * 1.6
    + Math.sin(x * 0.13 + 3) * Math.sin(z * 0.11) * 0.8;
  // island mask: 1 on the plateau, 0 in open sea; ripples fade out under the
  // island so the town is perfectly level
  const d = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  const m = 1 - smoothstep(ISLAND.flatR, ISLAND.shoreR, d);
  let h = -16 + ripples * (1 - m) + (16 + ISLAND.top) * m;
  // west cliff ridge with a grotto channel carved at z ~ 0 (home behind the waterfall)
  const rx = (x + 124) / 16;
  const notch = Math.max(0.08, 1 - 0.92 * Math.exp(-(z * z) / (9 * 9)));
  h += 42 * Math.exp(-rx * rx) * notch;
  return h;
}

export function waterDepthAt(x, z) { return -terrainHeight(x, z); }

function makeStreakTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 256);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 64, w = 2 + Math.random() * 5;
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, `rgba(255,255,255,${0.25 + Math.random() * 0.55})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x, 0, w, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeSign() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const tex = new THREE.CanvasTexture(c);
  const draw = (line1, line2, color = '#b3543a') => {
    const g = c.getContext('2d');
    g.fillStyle = '#fff7e0'; g.fillRect(0, 0, 128, 64);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(3, 3, 122, 58);
    g.fillStyle = color; g.font = 'bold 22px Trebuchet MS';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(line1, 64, 20); g.fillText(line2, 64, 44);
    tex.needsUpdate = true;
  };
  draw('FOR', 'SALE');
  return { tex, draw };
}

function makeSprite(color, size, opacity = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, opacity, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

export function buildWorld(scene) {
  const R = mulberry32(1337);
  const updatables = [];

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xbfe8ff, 0xc2b280, 1.0));
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.6);
  sun.position.set(60, 90, 30);
  scene.add(sun);
  const grottoLight = new THREE.PointLight(0x7ef3d0, 12, 30);
  grottoLight.position.set(-120, 2, 0);
  scene.add(grottoLight);

  // ---------- terrain ----------
  const SIZE = 700, SEG = 220;
  const terrGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  terrGeo.rotateX(-Math.PI / 2);
  const pos = terrGeo.attributes.position;
  const colors = [];
  const sand = new THREE.Color(0xe8d29a), grass = new THREE.Color(0x7fc95c),
    deep = new THREE.Color(0x4a7a8c), rock = new THREE.Color(0x8a8f96);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    let c;
    if (h > 2.5) c = grass.clone().lerp(rock, Math.min(1, (h - 6) / 14));
    else if (h > -0.5) c = sand.clone();
    else if (h > -8) c = sand.clone().lerp(deep, (-h) / 10);
    else c = deep.clone().lerp(sand, 0.15);
    // steep slopes (the cliff & grotto walls) look rocky
    const e = 1.2;
    const grad = Math.hypot(
      terrainHeight(x + e, z) - terrainHeight(x - e, z),
      terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
    if (grad > 0.9) c.lerp(rock, Math.min(1, (grad - 0.9) / 0.8));
    colors.push(c.r, c.g, c.b);
  }
  terrGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  scene.add(terrain);

  // ---------- water surface ----------
  const wGeo = new THREE.PlaneGeometry(SIZE, SIZE, 60, 60);
  wGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(wGeo, new THREE.MeshPhongMaterial({
    color: 0x2fa3c7, transparent: true, opacity: 0.62, shininess: 140,
    specular: 0xbbeeff, side: THREE.DoubleSide,
  }));
  water.position.y = 0.02;
  scene.add(water);
  const wPos = wGeo.attributes.position;
  const wBase = wPos.array.slice();
  updatables.push((t) => {
    for (let i = 0; i < wPos.count; i++) {
      const x = wBase[i * 3], z = wBase[i * 3 + 2];
      wPos.setY(i, Math.sin(x * 0.14 + t * 1.4) * 0.28 + Math.cos(z * 0.11 + t * 1.1) * 0.24);
    }
    wPos.needsUpdate = true;
  });

  // ---------- the waterfall & grotto home ----------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d838c, roughness: 1 });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 22), rockMat);
  bridge.position.set(-108, 15.5, 0);
  bridge.rotation.y = 0.05;
  scene.add(bridge);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 + R() * 1.8), rockMat);
    b.position.set(-108 + (R() - 0.5) * 6, 16.5 + R() * 2, -9 + R() * 18);
    b.rotation.set(R() * 3, R() * 3, R() * 3);
    scene.add(b);
  }
  const streak = makeStreakTexture();
  const streak2 = makeStreakTexture();
  const fallMat = new THREE.MeshBasicMaterial({
    map: streak, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
  });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), fallMat);
  fall.rotation.y = Math.PI / 2;
  fall.position.set(-108, 7.2, 0);
  scene.add(fall);
  const fallMat2 = new THREE.MeshBasicMaterial({
    map: streak2, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
  });
  const fall2 = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15), fallMat2);
  fall2.rotation.y = Math.PI / 2;
  fall2.position.set(-107.4, 7.2, 0);
  scene.add(fall2);
  updatables.push((t, dt) => {
    streak.offset.y -= dt * 0.9;
    streak2.offset.y -= dt * 1.4;
  });
  // foam at the base
  const foam = [];
  for (let i = 0; i < 14; i++) {
    const s = makeSprite('rgba(255,255,255,0.95)', 1.6 + R() * 2.4, 0.8);
    s.position.set(-108 + (R() - 0.5) * 3, 0.3, (R() - 0.5) * 13);
    s.userData.phase = R() * 6.28;
    scene.add(s); foam.push(s);
  }
  updatables.push((t) => {
    for (const f of foam) {
      f.position.y = 0.3 + Math.sin(t * 3 + f.userData.phase) * 0.25;
      f.material.opacity = 0.5 + Math.sin(t * 2.2 + f.userData.phase) * 0.3;
    }
  });
  // glowing pearls + anemones make the grotto feel like home
  const pearlMat = new THREE.MeshStandardMaterial({
    color: 0xfff6ff, emissive: 0x8fd8f2, emissiveIntensity: 0.7, roughness: 0.2,
  });
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.32 + R() * 0.25, 16, 12), pearlMat);
    const px = -128 + R() * 10, pz = (R() - 0.5) * 8;
    p.position.set(px, terrainHeight(px, pz) + 0.4, pz);
    scene.add(p);
  }
  const anemColors = [0xff6fb5, 0xb56fff, 0x6fffe0];
  for (let i = 0; i < 9; i++) {
    const col = anemColors[i % 3];
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1 + R() * 0.8, 6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45 }));
    const px = -130 + R() * 14, pz = (R() - 0.5) * 10;
    a.position.set(px, terrainHeight(px, pz) + 0.5, pz);
    a.rotation.z = (R() - 0.5) * 0.5;
    scene.add(a);
  }

  // ---------- coral reef ----------
  const coralColors = [0xff7f6b, 0xffb26b, 0xff6fb5, 0xb56fff, 0xffe66b, 0x6fdcff, 0xff8fa3];
  const swayers = [];
  function coralAt(x, z) {
    const y = terrainHeight(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const col = coralColors[Math.floor(R() * coralColors.length)];
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
    const kind = Math.floor(R() * 4);
    if (kind === 0) { // branching
      const n = 4 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const h = 0.8 + R() * 1.5;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.11, h, 5), mat);
        m.position.y = h / 2;
        m.rotation.set((R() - 0.5) * 1.1, R() * 6.28, (R() - 0.5) * 1.1);
        g.add(m);
      }
    } else if (kind === 1) { // brain
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + R() * 0.7, 10, 8), mat);
      m.scale.y = 0.65; m.position.y = 0.3;
      g.add(m);
    } else if (kind === 2) { // tubes
      const n = 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const h = 0.5 + R() * 1.1;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, h, 6), mat);
        m.position.set((R() - 0.5) * 0.7, h / 2, (R() - 0.5) * 0.7);
        g.add(m);
      }
    } else { // fan
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.8 + R() * 0.6, 10, 8), mat);
      m.scale.set(1, 0.95, 0.14); m.position.y = 0.7;
      m.rotation.y = R() * 6.28;
      g.add(m);
    }
    scene.add(g);
  }
  for (let i = 0; i < 95; i++) {
    const x = -95 + R() * 135, z = (R() - 0.5) * 190;
    if (terrainHeight(x, z) < -5) coralAt(x, z);
  }
  // seaweed
  const weedMat = new THREE.MeshStandardMaterial({ color: 0x3fae6b, roughness: 0.9 });
  const weedMat2 = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9 });
  for (let i = 0; i < 42; i++) {
    const x = -95 + R() * 135, z = (R() - 0.5) * 190;
    const y = terrainHeight(x, z);
    if (y > -4) continue;
    const n = 3 + Math.floor(R() * 3);
    for (let j = 0; j < n; j++) {
      const h = 1.6 + R() * 2.6;
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.07 + R() * 0.05, h, 5), j % 2 ? weedMat : weedMat2);
      w.position.set(x + (R() - 0.5) * 1.2, y + h / 2, z + (R() - 0.5) * 1.2);
      w.userData.phase = R() * 6.28;
      scene.add(w);
      swayers.push(w);
    }
  }
  updatables.push((t) => {
    for (const w of swayers) w.rotation.z = Math.sin(t * 1.2 + w.userData.phase) * 0.12;
  });
  // rocks & starfish
  for (let i = 0; i < 26; i++) {
    const x = -95 + R() * 140, z = (R() - 0.5) * 190;
    const y = terrainHeight(x, z);
    if (y > -3) continue;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + R() * 1.4), rockMat);
    m.position.set(x, y + 0.3, z);
    m.rotation.set(R() * 3, R() * 3, R() * 3);
    scene.add(m);
  }
  const starColors = [0xff8c42, 0xff5d8f, 0xffd23f];
  for (let i = 0; i < 12; i++) {
    const x = -80 + R() * 120, z = (R() - 0.5) * 160;
    const y = terrainHeight(x, z);
    if (y > -3) continue;
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: starColors[i % 3], roughness: 0.7 });
    for (let a = 0; a < 5; a++) {
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
      arm.scale.set(1, 0.4, 2.2);
      arm.rotation.y = (a / 5) * Math.PI * 2;
      arm.position.set(Math.sin(arm.rotation.y) * 0.28, 0, Math.cos(arm.rotation.y) * 0.28);
      g.add(arm);
    }
    g.position.set(x, y + 0.1, z);
    g.rotation.y = R() * 6.28;
    scene.add(g);
  }

  // ---------- the island town: roads, plaza, houses ----------
  const ROAD_Y = ISLAND.top + 0.03;
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 1 });
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xcfc0a0, roughness: 1 });
  function road(cx, cz, len, w, alongX) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? len : w, alongX ? w : len), roadMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(cx, ROAD_Y, cz);
    scene.add(p);
  }
  road(168, 0, 184, 7, true);      // Harbour Road (x 76→260)
  road(150, 0, 170, 7, false);     // Main Street (z -85→85)
  road(172.5, -50, 145, 7, true);  // Coral Lane
  road(172.5, 50, 145, 7, true);   // Shell Street
  road(220, 0, 100, 7, false);     // East Avenue
  road(172.5, -75, 125, 7, true);  // Palm Row (civic quarter, north)
  road(172.5, 75, 125, 7, true);   // Sunset Lane (garden quarter, south)
  road(150, -75, 8, 7, false);     // Main St spurs join the new streets
  road(150, 75, 8, 7, false);
  // sloped path from the jetty landing up the beach to Harbour Road
  {
    const len = Math.hypot(19, ISLAND.top + 0.6);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 6), roadMat);
    ramp.rotation.z = Math.atan2(ISLAND.top + 0.6, 19);
    ramp.position.set(66.5, ISLAND.top / 2 - 0.15, 0);
    scene.add(ramp);
  }
  // Market Square plaza + fountain
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(16, 40), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(150, ROAD_Y + 0.01, 0);
  scene.add(plaza);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 1.0, 18),
    new THREE.MeshStandardMaterial({ color: 0xb9c4cc, roughness: 0.8 }));
  basin.position.set(150, ISLAND.top + 0.5, 0);
  scene.add(basin);
  COLLIDERS.circles.push({ x: 150, z: 0, r: 3.0 });
  const fWater = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.15, 18),
    new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x2fa3c7, emissiveIntensity: 0.4, roughness: 0.2 }));
  fWater.position.set(150, ISLAND.top + 1.0, 0);
  scene.add(fWater);
  const spray = makeSprite('rgba(220,245,255,0.95)', 3.2, 0.75);
  spray.position.set(150, ISLAND.top + 2.2, 0);
  scene.add(spray);
  updatables.push((t) => { spray.scale.setScalar(2.6 + Math.sin(t * 2.6) * 0.5); });

  // street lampposts (Lumi's night-lights)
  const lampPostMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6, metalness: 0.4 });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4, emissive: 0xffd76a, emissiveIntensity: 0.9, roughness: 0.3 });
  function lamppost(x, z) {
    COLLIDERS.circles.push({ x, z, r: 0.28 });
    const g = new THREE.Group();
    g.position.set(x, ISLAND.top, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.6, 8), lampPostMat);
    post.position.y = 1.8;
    g.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), lampGlowMat);
    lamp.position.y = 3.75;
    g.add(lamp);
    const glow = makeSprite('rgba(255,220,140,0.85)', 2.2, 0.5);
    glow.position.y = 3.75;
    g.add(glow);
    scene.add(g);
  }
  for (let x = 90; x <= 250; x += 32) { if (x < 134 || x > 166) { lamppost(x, 5.4); lamppost(x + 16, -5.4); } }
  for (let z = -70; z <= 70; z += 35) { if (Math.abs(z) > 18) lamppost(z > 0 ? 145.6 : 154.4, z); }
  for (const a of [0.6, 2.2, 4.0, 5.7]) lamppost(150 + Math.cos(a) * 14, Math.sin(a) * 14);

  // houses — big enough that the player fits through the door (player ≈ 2.9 u tall)
  const houseColors = [0xfff1d6, 0xffd6e0, 0xd6f0ff, 0xe8ffd6, 0xfde2c8, 0xe6d6ff];
  const roofColors = [0xc0574f, 0x4f7ec0, 0x4fc08d, 0xc09a4f];
  const saleHouses = [];
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xbfe8ff, emissive: 0x88bbdd, emissiveIntensity: 0.25, roughness: 0.15 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const woodFloorMat = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.95 });
  const furnWoodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.9 });
  const rugColors = [0xff8fa3, 0x8fd8f2, 0xffd23f, 0xb59aff, 0x9fe0a8];
  const beddingColors = [0xff9ad5, 0x7ec9f5, 0xc0e8a0, 0xffd76a];
  const bookColors = [0xc0574f, 0x4f7ec0, 0x4fc08d, 0xffd23f, 0x9b59b6];
  function house(x, z, s, ry, forSale) {
    const y = terrainHeight(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    // hollow shell: walls with a real doorway (local +z), so you can walk in
    const W = 3.2 * s, D = 2.9 * s, H = 5 * s, T = 0.25, gap = 0.95 * s;
    const wallMat = new THREE.MeshStandardMaterial({
      color: houseColors[Math.floor(R() * houseColors.length)], roughness: 0.9, side: THREE.DoubleSide });
    const wall = (w, h, d, px, py, pz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(px, py, pz);
      g.add(m);
    };
    wall(W * 2, H, T, 0, H / 2, -D + T / 2);                       // back
    wall(T, H, D * 2, -W + T / 2, H / 2, 0);                       // left
    wall(T, H, D * 2, W - T / 2, H / 2, 0);                        // right
    const segW = W - gap;
    wall(segW, H, T, gap + segW / 2, H / 2, D - T / 2);            // front right of door
    wall(segW, H, T, -(gap + segW / 2), H / 2, D - T / 2);         // front left of door
    wall(gap * 2, H - 3.4 * s, T, 0, 3.4 * s + (H - 3.4 * s) / 2, D - T / 2);  // above door
    // floor stays tucked inside the walls (flush edges z-fight and flicker)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W * 2 - T * 2 - 0.04, 0.14, D * 2 - T * 2 - 0.04), woodFloorMat);
    floor.position.y = 0.08;
    g.add(floor);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4 * s, 3.4 * s, 4),
      new THREE.MeshStandardMaterial({
        color: roofColors[Math.floor(R() * roofColors.length)], roughness: 0.9, side: THREE.DoubleSide }));
    roof.position.y = H + 1.7 * s;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    // the door stands open, welcoming visitors (hinged at the left post)
    const hinge = new THREE.Group();
    hinge.position.set(-gap, 0, D - T / 2);
    hinge.rotation.y = -2.0;
    const door = new THREE.Mesh(new THREE.BoxGeometry(gap * 2, 3.3 * s, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 }));
    door.position.set(gap, 1.65 * s, 0);
    hinge.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd76a, metalness: 0.6, roughness: 0.3 }));
    knob.position.set(gap * 1.7, 1.65 * s, 0.08);
    hinge.add(knob);
    g.add(hinge);
    // front + side windows
    for (const [wx, wz, wry] of [[-2.05, 2.92, 0], [2.05, 2.92, 0], [-3.22, 0.9, 1], [3.22, 0.9, 1]]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 1.5 * s, 0.1), frameMat);
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.24 * s, 1.24 * s, 0.12), winMat);
      const px = wx * s, pz = wz * s;
      frame.position.set(px, 3.1 * s, pz);
      win.position.set(px, 3.1 * s, pz);
      if (wry) { frame.rotation.y = Math.PI / 2; win.rotation.y = Math.PI / 2; }
      g.add(frame); g.add(win);
    }
    // ---- a furnished room to explore ----
    {
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.35 * s, 20),
        new THREE.MeshStandardMaterial({ color: rugColors[Math.floor(R() * rugColors.length)], roughness: 1 }));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0, 0.16, 0.5 * s);
      g.add(rug);
      // bed in the back-left corner
      const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7 * s, 0.5 * s, 2.6 * s), furnWoodMat);
      bedFrame.position.set(-W + 1.15 * s, 0.32 * s, -D + 1.6 * s);
      g.add(bedFrame);
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.55 * s, 0.28 * s, 2.45 * s),
        new THREE.MeshStandardMaterial({ color: beddingColors[Math.floor(R() * beddingColors.length)], roughness: 1 }));
      mattress.position.set(-W + 1.15 * s, 0.68 * s, -D + 1.6 * s);
      g.add(mattress);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 0.22 * s, 0.6 * s),
        new THREE.MeshStandardMaterial({ color: 0xfff7e0, roughness: 1 }));
      pillow.position.set(-W + 1.15 * s, 0.9 * s, -D + 0.75 * s);
      g.add(pillow);
      if (R() > 0.5) {  // a teddy starfish on some beds
        const ted = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.9 }));
        ted.scale.set(1, 0.5, 1);
        ted.position.set(-W + 1.4 * s, 0.95 * s, -D + 1.9 * s);
        g.add(ted);
      }
      // table + stools in the back-right corner
      if (R() > 0.2) {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85 * s, 0.85 * s, 0.12 * s, 14), furnWoodMat);
        top.position.set(W - 1.5 * s, 1.05 * s, -D + 1.6 * s);
        g.add(top);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.13 * s, 1.0 * s, 8), furnWoodMat);
        leg.position.set(W - 1.5 * s, 0.5 * s, -D + 1.6 * s);
        g.add(leg);
        for (const a of [0.9, 2.6]) {
          const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.34 * s, 0.55 * s, 10), furnWoodMat);
          stool.position.set(W - 1.5 * s + Math.cos(a) * 1.3 * s, 0.28 * s, -D + 1.6 * s + Math.sin(a) * 1.3 * s);
          g.add(stool);
        }
        // fruit bowl or a lit candle on the table
        const treat = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 10, 8),
          R() > 0.5
            ? new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.7 })
            : new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd76a, emissiveIntensity: 0.8 }));
        treat.position.set(W - 1.5 * s, 1.28 * s, -D + 1.6 * s);
        g.add(treat);
      }
      // bookshelf against the right wall
      if (R() > 0.3) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 2.3 * s, 1.5 * s), furnWoodMat);
        shelf.position.set(W - 0.5 * s, 1.15 * s, 0.4 * s);
        g.add(shelf);
        for (let b = 0; b < 5; b++) {
          const book = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.5 * s, 0.16 * s),
            new THREE.MeshStandardMaterial({ color: bookColors[Math.floor(R() * bookColors.length)], roughness: 0.9 }));
          book.position.set(W - 0.55 * s, (b < 3 ? 1.7 : 0.9) * s, 0.4 * s + ((b % 3) - 1) * 0.28 * s);
          g.add(book);
        }
      }
      // cosy lamp beside the door
      const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 1.7 * s, 8), furnWoodMat);
      lampPost.position.set(W - 0.8 * s, 0.85 * s, D - 1.0 * s);
      g.add(lampPost);
      const lampBall = new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd76a, emissiveIntensity: 0.85, roughness: 0.4 }));
      lampBall.position.set(W - 0.8 * s, 1.85 * s, D - 1.0 * s);
      g.add(lampBall);
      // potted plant on the other side of the door
      if (R() > 0.3) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.2 * s, 0.42 * s, 10),
          new THREE.MeshStandardMaterial({ color: 0xc0574f, roughness: 0.9 }));
        pot.position.set(-W + 0.7 * s, 0.21 * s, D - 1.0 * s);
        g.add(pot);
        const leafy = new THREE.Mesh(new THREE.SphereGeometry(0.4 * s, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x2e9e4f, roughness: 0.9 }));
        leafy.scale.y = 1.3;
        leafy.position.set(-W + 0.7 * s, 0.85 * s, D - 1.0 * s);
        g.add(leafy);
      }
    }
    // when the player steps inside, main.js fades these so the room shows
    COLLIDERS.houses.push({ x, z, s, ry, fadeMats: [wallMat, roof.material] });
    if (forSale) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4), new THREE.MeshStandardMaterial({ color: 0x8a5a33 }));
      post.position.set(3.0 * s, 1.2, 4.4 * s);
      g.add(post);
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xfff7e0, roughness: 0.9 }));
      board.position.set(3.0 * s, 2.4, 4.4 * s + 0.06);
      board.rotation.y = 0.2;
      g.add(board);
      const signBoard = makeSign();
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1),
        new THREE.MeshBasicMaterial({ map: signBoard.tex }));
      sign.position.set(3.0 * s, 2.4, 4.4 * s + 0.16);
      sign.rotation.y = 0.2;
      g.add(sign);
      saleHouses.push({
        x, z, size: s,
        price: Math.round((500 + (s - 0.85) * 1270) / 50) * 50,
        ry,
        setSign: signBoard.draw,
      });
    }
    scene.add(g);
  }
  const F = Math.PI; // face -z (house on the +z side of an east-west road)
  const houseSpots = [
    // [x, z, size, ry, forSale] — sale houses keep their old push order & sizes
    // (1 / 0.9 / 1.4 / 0.85 → indices 0-3 in existing saves)
    [115, 11, 1, F, true],           // Harbour Road, south side
    [205, -11, 0.9, 0, true],        // Harbour Road, east end
    [150, -61, 1.4, 0, true],        // Coral Lane — the grand house
    [170, 61, 0.85, F, true],        // Shell Street — the cosy one
    [95, -11, 1.05, 0, false], [95, 11, 0.95, F, false],
    [115, -11, 1.2, 0, false], [185, -11, 1.1, 0, false],
    [185, 11, 1, F, false], [205, 11, 0.95, F, false],
    [130, -61, 1, 0, false], [170, -61, 1.05, 0, false], [130, -39, 0.9, F, false],
    [130, 61, 1.1, F, false], [150, 61, 0.9, F, false], [190, 39, 1, 0, false],
    [231, -22, 1.05, -F / 2, false], [231, 22, 0.95, -F / 2, false],
    // the new quarters (two more for-sale homes → saleHouses indices 4 & 5)
    [156, -86, 1.15, 0, true],       // Palm Row — the artist's loft
    [196, 86, 0.9, F, true],         // Sunset Lane — the garden cottage
    [138, -86, 1, 0, false], [178, -86, 0.95, 0, false],
    [152, 86, 1.05, F, false], [140, 86, 0.9, F, false], [162, 86, 1.1, F, false],
    [112, 61, 0.95, 0, false], [196, -61, 1.05, 0, false], [112, -61, 0.9, 0, false],
  ];
  for (const [hx, hz, s, ry, sale] of houseSpots) house(hx, hz, s, ry, sale);

  // palm trees: avenue rows along Harbour Road + a beachy cluster by the jetty
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e9e4f, roughness: 0.9 });
  function palm(x, z, big = 1) {
    const y = terrainHeight(x, z);
    if (y < 0.3) return;
    // never grow a palm inside (or hugging) a house
    for (const h of COLLIDERS.houses) {
      const dx = x - h.x, dz = z - h.z;
      const c = Math.cos(h.ry), si = Math.sin(h.ry);
      const lx = dx * c - dz * si, lz = dx * si + dz * c;
      if (Math.abs(lx) < 3.2 * h.s + 2.2 && Math.abs(lz) < 2.9 * h.s + 2.2) return;
    }
    COLLIDERS.circles.push({ x, z, r: 0.5 });
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const h = 6.5 * big;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, h, 7), trunkMat);
    trunk.position.y = h / 2;
    trunk.rotation.z = (R() - 0.5) * 0.24;
    g.add(trunk);
    for (let l = 0; l < 7; l++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.15 * big, 8, 6), leafMat);
      leaf.scale.set(0.32, 0.1, 1.5);
      const a = (l / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.2 + trunk.rotation.z * -h, h, Math.sin(a) * 1.2);
      leaf.rotation.y = -a + Math.PI / 2;
      leaf.rotation.x = 0.35;
      g.add(leaf);
    }
    scene.add(g);
  }
  for (let x = 100; x <= 250; x += 30) {
    if (x < 134 || x > 166) { palm(x, 9.5); palm(x + 14, -9.5); }
  }
  for (let i = 0; i < 8; i++) palm(62 + R() * 16, (R() - 0.5) * 44, 0.8 + R() * 0.3);
  palm(150 + 13, 13, 1.1); palm(150 - 13, -13, 1.1);

  // (villagers & shopkeepers are built in village.js — Phase 4)

  // ---------- the civic quarter, the park & the golf buggies ----------
  function makeLabel(text, color = '#ffffff') {
    const c = document.createElement('canvas');
    const g2 = c.getContext('2d');
    const font = "bold 44px 'Trebuchet MS', sans-serif";
    g2.font = font;
    c.width = Math.ceil(g2.measureText(text).width) + 40;
    c.height = 64;
    g2.font = font;
    g2.fillStyle = 'rgba(8,44,66,0.82)';
    g2.beginPath(); g2.roundRect(0, 0, c.width, c.height, 18); g2.fill();
    g2.fillStyle = color; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(text, c.width / 2, c.height / 2 + 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    sp.scale.set(c.width / 64 * 2.2, 2.2, 1);
    return sp;
  }
  // civic buildings: sturdy public halls with columns and grand signs
  function civic(x, z, w, d, h, wallCol, roofCol, label) {
    const y = terrainHeight(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const wall = new THREE.MeshStandardMaterial({ color: wallCol, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    body.position.y = h / 2;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, d + 1),
      new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.8 }));
    roof.position.y = h + 0.25;
    g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.9 }));
    door.position.set(0, 1.6, d / 2 + 0.05);
    g.add(door);
    for (const sx of [-w / 3, w / 3]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.15), winMat);
      win.position.set(sx, h * 0.55, d / 2 + 0.05);
      g.add(win);
    }
    const sign = makeLabel(label);
    sign.position.y = h + 2.2;
    g.add(sign);
    scene.add(g);
    COLLIDERS.circles.push({ x: x - w / 4, z, r: d / 2 + 0.6 }, { x: x + w / 4, z, r: d / 2 + 0.6 });
  }
  civic(196, -80, 12, 8, 6.4, 0xe8e2d2, 0x8a4f9e, '🏛️ TOWN HALL');
  civic(214, -80, 8, 7, 5.2, 0xd6e8f0, 0xc0574f, '📮 POST OFFICE');
  civic(228, -80, 7, 6, 4.6, 0xffe8d0, 0x4fc08d, '☕ REEF CAFÉ');

  // the park on Sunset Lane: pond, benches and flower beds
  {
    const px = 178, pz = 66;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(5, 24),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x2fa3c7, emissiveIntensity: 0.3, roughness: 0.25 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(px, terrainHeight(px, pz) + 0.06, pz);
    scene.add(pond);
    COLLIDERS.circles.push({ x: px, z: pz, r: 5.2 });
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.9 });
    for (const a of [0.6, 2.4, 4.2]) {
      const bx = px + Math.cos(a) * 7.5, bz = pz + Math.sin(a) * 7.5;
      const bench = new THREE.Group();
      bench.position.set(bx, terrainHeight(bx, bz), bz);
      bench.rotation.y = -a + Math.PI / 2;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.7), benchMat);
      seat.position.y = 0.85; bench.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.12), benchMat);
      back.position.set(0, 1.35, -0.32); bench.add(back);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.6), benchMat);
        leg.position.set(s, 0.42, 0); bench.add(leg);
      }
      scene.add(bench);
      COLLIDERS.circles.push({ x: bx, z: bz, r: 1.1 });
    }
    for (let i = 0; i < 14; i++) {
      const a = R() * Math.PI * 2, r = 9 + R() * 5;
      const fx = px + Math.cos(a) * r, fz = pz + Math.sin(a) * r;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.28 + R() * 0.2, 8, 6),
        new THREE.MeshStandardMaterial({ color: [0xff6fb5, 0xffd23f, 0xff8a5c, 0xb98aff][i % 4], roughness: 0.8 }));
      flower.position.set(fx, terrainHeight(fx, fz) + 0.3, fz);
      scene.add(flower);
    }
  }

  // golf buggies: two of them, parked by the Market Square — hop in and drive!
  const buggies = [];
  function buggy(x, z, bodyCol) {
    const g = new THREE.Group();
    g.position.set(x, terrainHeight(x, z), z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 3.3),
      new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.5, metalness: 0.2 }));
    body.position.y = 0.75;
    g.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 0.8 }));
    seat.position.set(0, 1.15, -0.3);
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 0.8 }));
    back.position.set(0, 1.7, -0.9);
    g.add(back);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.9 });
    const wheels = [];
    for (const [wx, wz] of [[-1, 1.15], [1, 1.15], [-1, -1.15], [1, -1.15]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      g.add(wheel);
      wheels.push(wheel);
    }
    // striped sunshade roof on posts
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
    roof.position.y = 2.75;
    g.add(roof);
    for (const [px2, pz2] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6),
        new THREE.MeshStandardMaterial({ color: 0xb9c4cc, metalness: 0.5, roughness: 0.4 }));
      post.position.set(px2, 2, pz2);
      g.add(post);
    }
    const wheel2 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6 }));
    wheel2.position.set(-0.5, 1.7, 0.75);
    wheel2.rotation.x = -0.9;
    g.add(wheel2);
    scene.add(g);
    buggies.push({ group: g, wheels, driving: false, home: { x, z } });
  }
  buggy(138, 16, 0x4fc08d);
  buggy(142.5, 16, 0xff8a5c);

  // ---------- more to discover under the sea ----------
  // a swaying kelp forest in the south sea
  {
    const kelpMat = new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.9, side: THREE.DoubleSide });
    const tops = [];
    for (let i = 0; i < 34; i++) {
      const kx = -44 + (R() - 0.5) * 34, kz = 76 + (R() - 0.5) * 30;
      const floor = terrainHeight(kx, kz);
      if (floor > -6) continue;
      const h = Math.min(-floor - 1.5, 9 + R() * 5);
      const strand = new THREE.Group();
      strand.position.set(kx, floor, kz);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, h, 6), kelpMat);
      stem.position.y = h / 2;
      strand.add(stem);
      for (let b = 1; b <= 4; b++) {
        const blade = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5), kelpMat);
        blade.scale.set(0.5, 1.6, 0.12);
        blade.position.set(Math.sin(b * 2.4) * 0.5, (h * b) / 4.6, Math.cos(b * 2.4) * 0.4);
        strand.add(blade);
      }
      scene.add(strand);
      tops.push({ strand, phase: R() * Math.PI * 2 });
    }
    updatables.push((t) => {
      for (const k of tops) k.strand.rotation.z = Math.sin(t * 0.8 + k.phase) * 0.08;
    });
  }
  // a grand stone sea arch on the far west reef
  {
    const ax = -140, az = -55;
    const floor = terrainHeight(ax, az);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(7, 2.2, 10, 22, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x7d8590, roughness: 1 }));
    arch.position.set(ax, floor + 0.5, az);
    scene.add(arch);
    for (let i = 0; i < 8; i++) {
      const a = (i / 7) * Math.PI;
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.5 + R() * 0.4, 8, 6),
        new THREE.MeshStandardMaterial({ color: [0xff6fb5, 0xffd23f, 0x6fffe0, 0xff8a5c][i % 4], roughness: 0.8 }));
      spot.position.set(ax + Math.cos(a) * 7, floor + 0.6 + Math.sin(a) * 7, az + (R() - 0.5) * 2);
      scene.add(spot);
    }
  }

  // ---------- the sunken shipwreck (free-roam exploration) ----------
  // An old merchant ship listing on the sea floor: swim in through the hull
  // breach, explore the cargo hold, rise through the deck hatch, and peek
  // into the captain's cabin at the stern. Treasure glitters below decks.
  {
    const wx = WRECK.x, wz = WRECK.z;
    const wreck = new THREE.Group();
    wreck.position.set(wx, terrainHeight(wx, wz) + 0.4, wz);
    wreck.rotation.y = 0.6;
    wreck.rotation.z = 0.13;           // listing gently to one side
    const shipWood = new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 0.95, side: THREE.DoubleSide });
    const shipWoodDark = new THREE.MeshStandardMaterial({ color: 0x46331f, roughness: 1, side: THREE.DoubleSide });
    WRECK.mats.push(shipWood, shipWoodDark);
    const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      wreck.add(mesh);
      return mesh;
    };
    const box = (w, h, d, mat = shipWood) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    // hull: floor, stern transom, bow wedges
    add(box(24, 0.4, 8, shipWoodDark), 0, 0.2, 0);
    add(box(0.35, 3.6, 8), -12, 2, 0);
    add(box(6, 3.6, 0.35), 13.7, 2, 1.9, 0, -0.62, 0);      // bow port wedge
    add(box(6, 3.6, 0.35), 13.7, 2, -1.9, 0, 0.62, 0);      // bow starboard wedge
    const sprit = add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 6, 8), shipWood), 17.5, 3.4, 0);
    sprit.rotation.z = -1.05;
    // port side: two segments leave a 4-wide BREACH to swim into the hold
    add(box(9, 3.2, 0.35), -7.5, 1.8, 4);
    add(box(9, 3.2, 0.35), 7.5, 1.8, 4);
    // starboard side: intact
    add(box(24, 3.2, 0.35), 0, 1.8, -4);
    // main deck with a hatch opening (x ∈ [-3.1, -0.9] is the way up)
    add(box(8.9, 0.3, 8), -7.55, 3.55, 0);
    add(box(10.8, 0.3, 8), 4.5, 3.55, 0);
    // deck railing posts
    for (let i = -5; i <= 4; i++) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), shipWood), i * 2.4, 4.3, 3.9);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), shipWood), i * 2.4, 4.3, -3.9);
    }
    add(box(24, 0.12, 0.12), 0, 4.75, 3.9);
    add(box(24, 0.12, 0.12), 0, 4.75, -3.9);
    // captain's cabin at the stern: hollow room with a doorway onto the deck
    const cw = 5.6, cd = 5.6, ch = 2.9, cx = -8.9, cy = 3.7;
    add(box(cw, ch, 0.3), cx, cy + ch / 2, -cd / 2);            // cabin back
    add(box(cw, ch, 0.3), cx, cy + ch / 2, cd / 2);             // cabin front
    add(box(0.3, ch, cd), cx - cw / 2, cy + ch / 2, 0);         // cabin stern wall
    add(box(0.3, ch, 1.6), cx + cw / 2, cy + ch / 2, -2);       // door-side segment
    add(box(0.3, ch, 1.6), cx + cw / 2, cy + ch / 2, 2);        // door-side segment
    add(box(0.3, 0.8, 2.4), cx + cw / 2, cy + ch - 0.4, 0);     // lintel — doorway below
    add(box(cw + 0.8, 0.3, cd + 0.8), cx, cy + ch + 0.15, 0);   // cabin roof
    // cabin furnishings: desk, chair, sea chest, lantern
    add(box(1.8, 0.15, 1), cx - 1.2, cy + 0.95, -1.4);
    add(box(0.15, 0.9, 0.15), cx - 1.9, cy + 0.45, -1.4);
    add(box(0.15, 0.9, 0.15), cx - 0.5, cy + 0.45, -1.4);
    add(box(0.7, 0.7, 0.7, shipWoodDark), cx + 0.9, cy + 0.35, 1.6);
    const cabinLamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd76a, emissiveIntensity: 0.9 }));
    add(cabinLamp, cx, cy + ch - 0.35, 0);
    // broken main mast + fallen foremast + torn sail
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 7, 8), shipWood), 1.5, 6.5, 0, 0, 0, 0.55);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 9, 8), shipWood), 7, 4.1, 0.5, 0.25, 0, 1.35);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3),
      new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    add(sail, 3.2, 5.6, 0.4, 0.3, 0.5, 0.6);
    // cargo hold: crates, barrels and the TREASURE ✨
    for (const [bx, bz] of [[4, -2], [5.4, -2.2], [4.7, -0.8], [-4, 2.2]]) {
      add(box(1.2, 1.2, 1.2, shipWoodDark), bx, 1.0, bz, 0, R() * 1.2, 0);
    }
    for (const [bx, bz] of [[-6, -2.4], [-7.4, -2.1], [-6.7, -2.3]]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 10), shipWood);
      add(barrel, bx, 1.05, bz, bx === -6.7 ? 1.57 : 0, 0, 0);
    }
    const chest = box(1.6, 1.0, 1.1, shipWoodDark);
    add(chest, -10.2, 0.95, 1.8, 0, 0.5, 0);
    const lid = box(1.6, 0.25, 1.1);
    add(lid, -10.55, 1.62, 2.0, 0, 0.5, -0.85);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd76a, emissive: 0xcc9a1e, emissiveIntensity: 0.65, metalness: 0.7, roughness: 0.25 });
    const gold = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9), goldMat);
    gold.scale.y = 0.5;
    add(gold, -10.2, 1.35, 1.8);
    for (let i = 0; i < 7; i++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), goldMat);
      add(coin, -10.2 + (R() - 0.5) * 3, 0.55, 1.8 + (R() - 0.5) * 2.4, R(), R(), 0);
    }
    const holdLamp = cabinLamp.clone();
    add(holdLamp, 2, 2.8, -2.8);
    const treasureGlow = makeSprite('rgba(255,220,120,0.9)', 3.4, 0.55);
    add(treasureGlow, -10.2, 1.6, 1.8);
    updatables.push((t) => { treasureGlow.material.opacity = 0.35 + Math.sin(t * 2.2) * 0.2; });
    scene.add(wreck);
    // the sea has grown over the old girl: coral, weed and a sand drift
    for (let i = 0; i < 7; i++) coralAt(wx + (R() - 0.5) * 26, wz + (R() - 0.5) * 14);
    const drift = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8c48e, roughness: 1 }));
    drift.scale.set(1.6, 0.22, 1);
    drift.position.set(wx + 8, terrainHeight(wx + 8, wz) + 0.15, wz);
    drift.rotation.y = 0.6;
    scene.add(drift);
  }

  // ---------- the jetty ----------
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 1 });
  const woodMat2 = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1 });
  const jLen = JETTY.x2 - JETTY.x1;
  const nPlanks = 13;
  for (let i = 0; i < nPlanks; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(jLen / nPlanks - 0.16, 0.22, 4.4), i % 2 ? woodMat : woodMat2);
    plank.position.set(JETTY.x1 + (i + 0.5) * (jLen / nPlanks), JETTY.deckY - 0.11, 0);
    scene.add(plank);
  }
  for (let i = 0; i <= 4; i++) {
    for (const side of [-1, 1]) {
      const px = JETTY.x1 + (i / 4) * jLen;
      const floorY = terrainHeight(px, side * 2);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, JETTY.deckY - floorY + 0.6, 8), woodMat2);
      post.position.set(px, (JETTY.deckY + floorY) / 2, side * 2);
      scene.add(post);
    }
  }

  // ---------- ambient bubbles ----------
  const bubbles = [];
  const bubbleSpots = [[-60, -20], [-20, 30], [10, -35], [-90, 5]];
  for (const [bx, bz] of bubbleSpots) {
    for (let i = 0; i < 10; i++) {
      const s = makeSprite('rgba(220,245,255,0.9)', 0.25 + R() * 0.3, 0.7);
      const floorY = terrainHeight(bx, bz);
      s.position.set(bx + (R() - 0.5) * 2, floorY + R() * (-floorY), bz + (R() - 0.5) * 2);
      s.userData = { floorY, speed: 1 + R() * 1.5, bx, bz };
      scene.add(s); bubbles.push(s);
    }
  }
  updatables.push((t, dt) => {
    for (const b of bubbles) {
      b.position.y += b.userData.speed * dt;
      b.position.x += Math.sin(t * 2 + b.position.y) * 0.01;
      if (b.position.y > -0.2) {
        b.position.y = b.userData.floorY + 0.3;
        b.position.x = b.userData.bx + (Math.random() - 0.5) * 2;
      }
    }
  });

  return { updatables, saleHouses, buggies };
}
