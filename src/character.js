import * as THREE from 'three';

export const GOLDEN = '#ffd700';

export const DEFAULT_CONFIG = {
  kind: 'mermaid',        // 'mermaid' | 'merman'
  body: 'soft',           // 'fit' | 'soft' | 'round' | 'pregnant'
  skin: '#eec39a',
  scales: '#2ec4b6',      // hex colour, or 'rainbow' once unlocked
  hairStyle: 'long',      // 'long' | 'short'
  hair: '#6b3fa0',
  crown: false,           // Royal Coral Crown, once unlocked
};

// ---- shared fish-scale textures (plain = grayscale tinted by material colour) ----
const texCache = {};
function getScaleTexture(rainbow = false) {
  const key = rainbow ? 'rainbow' : 'plain';
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (rainbow) {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    ['#ff5d8f', '#ff9042', '#ffd23f', '#4caf50', '#4fc3f7', '#8e44ad'].forEach((col, i, a) => {
      grad.addColorStop(i / (a.length - 1), col);
    });
    g.fillStyle = grad;
  } else {
    g.fillStyle = '#e8e8e8';
  }
  g.fillRect(0, 0, 128, 128);
  const r = 16;
  for (let row = 0; row < 10; row++) {
    const y = row * r * 0.75;
    const off = (row % 2) * r;
    for (let x = -r; x < 140; x += r * 2) {
      if (!rainbow) {
        const grd = g.createRadialGradient(x + off + r, y, 2, x + off + r, y, r);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.8, '#d0d0d0');
        grd.addColorStop(1, '#9a9a9a');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x + off + r, y, r, 0, Math.PI);
        g.fill();
      }
      g.beginPath();
      g.arc(x + off + r, y, r, 0, Math.PI);
      g.strokeStyle = 'rgba(120,120,120,0.55)';
      g.lineWidth = 1.5;
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  texCache[key] = tex;
  return tex;
}

const PETAL_COLORS = [0xffb3c6, 0xfff3c4, 0xffd6a5, 0xf9f9f9, 0xffa5c0];

function makeFlower(size, petalColor) {
  const f = new THREE.Group();
  const petalMat = new THREE.MeshStandardMaterial({ color: petalColor, roughness: 0.7 });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 });
  for (let p = 0; p < 5; p++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 8, 6), petalMat);
    petal.scale.set(1, 0.45, 0.75);
    const a = (p / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * size * 0.6, 0, Math.sin(a) * size * 0.6);
    petal.rotation.y = -a;
    f.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(size * 0.32, 8, 6), centerMat);
  center.position.y = size * 0.12;
  f.add(center);
  return f;
}

// Character origin is at the waist. Head ~ +1.5, feet / tail tip ~ -1.5.
export class Character {
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.group = new THREE.Group();          // world position + yaw
    this.visual = new THREE.Group();         // pitch + bob + animation root
    this.group.add(this.visual);
    this.form = 'mer';                       // 'mer' | 'human'
    this.animT = 0;
    this.camo = false;
    this.build();
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
    this.build();
  }

  build() {
    this.camo = false;
    while (this.visual.children.length) {
      const c = this.visual.children.pop();
      c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    const cfg = this.config;
    const isMaid = cfg.kind === 'mermaid';
    const golden = cfg.skin.toLowerCase() === GOLDEN;
    const isRainbow = cfg.scales === 'rainbow';
    const scalesHex = isRainbow ? '#ffffff' : cfg.scales;

    // ---------- materials ----------
    const skinMat = new THREE.MeshStandardMaterial({
      color: cfg.skin, roughness: golden ? 0.35 : 0.65, metalness: golden ? 0.55 : 0,
    });
    const scaleMat = new THREE.MeshStandardMaterial({
      color: scalesHex, roughness: 0.4, metalness: 0.35, map: getScaleTexture(isRainbow),
    });
    const plainScaleMat = new THREE.MeshStandardMaterial({
      color: scalesHex, roughness: 0.35, metalness: 0.3,
      map: isRainbow ? getScaleTexture(true) : null,
    });
    // pearly translucent fins (fluke, hip fins) — scale colour softened to white
    const finColor = new THREE.Color(isRainbow ? '#ff9ad5' : cfg.scales).lerp(new THREE.Color(0xffffff), 0.55);
    const finMat = new THREE.MeshPhysicalMaterial({
      color: finColor, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88,
      iridescence: 0.6, iridescenceIOR: 1.3,
    });
    const hairMat = new THREE.MeshStandardMaterial({ color: cfg.hair, roughness: 0.72 });
    const shellColor = new THREE.Color(isRainbow ? '#ff9ad5' : cfg.scales).lerp(new THREE.Color(0xffffff), 0.35);
    const shellMat = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.4, metalness: 0.25 });
    this._camoMats = [skinMat, scaleMat, plainScaleMat, finMat, hairMat, shellMat];
    this._camoOrig = this._camoMats.map((m) => ({
      color: m.color.clone(), opacity: m.opacity, transparent: m.transparent,
    }));

    const V = this.visual;

    // ---------- head & face ----------
    const head = new THREE.Group();
    head.position.y = 1.32;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), skinMat));

    const irisMat = new THREE.MeshStandardMaterial({ color: 0x37b5c4, roughness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x26202a, roughness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), whiteMat);
      eye.scale.set(1, 1.15, 0.55);
      eye.position.set(0.155 * s, 0.06, 0.345);
      head.add(eye);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), irisMat);
      iris.scale.set(1, 1, 0.5);
      iris.position.set(0.155 * s, 0.06, 0.402);
      head.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), darkMat);
      pupil.scale.set(1, 1, 0.5);
      pupil.position.set(0.155 * s, 0.06, 0.428);
      head.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), whiteMat);
      glint.position.set(0.155 * s + 0.02, 0.085, 0.44);
      head.add(glint);
      // lashes for mermaids, brows for both
      if (isMaid) {
        const lash = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.011, 6, 12, 2.2), darkMat);
        lash.position.set(0.155 * s, 0.075, 0.395);
        lash.rotation.z = Math.PI / 2 - 1.1;
        lash.rotation.x = -0.25;
        head.add(lash);
      }
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.15, isMaid ? 0.02 : 0.035, 0.02),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.hair).multiplyScalar(0.6), roughness: 0.8 }));
      brow.position.set(0.155 * s, 0.20, 0.375);
      brow.rotation.z = -0.12 * s;
      head.add(brow);
      // rosy cheeks
      if (isMaid) {
        const blush = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xff9eb0, roughness: 0.8, transparent: true, opacity: 0.5 }));
        blush.scale.set(1, 0.6, 0.3);
        blush.position.set(0.26 * s, -0.08, 0.30);
        head.add(blush);
      }
    }
    const lipMat = new THREE.MeshStandardMaterial({ color: isMaid ? 0xe0607e : 0xb06a5a, roughness: 0.5 });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, isMaid ? 0.028 : 0.02, 8, 14, 1.5), lipMat);
    smile.position.set(0, -0.13, 0.365);
    smile.rotation.z = Math.PI + (Math.PI - 1.5) / 2;
    smile.scale.z = 0.6;
    head.add(smile);
    // little nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), skinMat);
    nose.position.set(0, -0.03, 0.42);
    head.add(nose);

    // ---------- hair ----------
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.475, 22, 16), hairMat);
    cap.position.set(0, 0.06, -0.07);
    head.add(cap);
    // sweeping fringe
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 12), hairMat);
    fringe.scale.set(1.02, 0.55, 0.9);
    fringe.position.set(0, 0.28, 0.09);
    fringe.rotation.x = 0.3;
    head.add(fringe);
    this.hairStrands = [];
    if (cfg.hairStyle === 'long') {
      // fan of flowing back strands, longest in the middle
      const fan = [
        [0, -0.55, -0.34, 0, 0.15, 1.0],
        [0.19, -0.50, -0.28, 0.22, 0.12, 0.85],
        [-0.19, -0.50, -0.28, -0.22, 0.12, 0.85],
        [0.34, -0.38, -0.18, 0.45, 0.10, 0.6],
        [-0.34, -0.38, -0.18, -0.45, 0.10, 0.6],
      ];
      for (const [x, y, z, rz, rad, len] of fan) {
        const st = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 5, 10), hairMat);
        st.scale.set(1.25, 1, 0.7);
        st.position.set(x, y, z);
        st.rotation.z = rz;
        st.rotation.x = 0.12;
        head.add(st);
        this.hairStrands.push(st);
      }
      // long tapering tip below, with a wavy curl at the end
      const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.6, 5, 10), hairMat);
      tip.scale.set(1.35, 1, 0.6);
      tip.position.set(0.06, -1.42, -0.38);
      tip.rotation.z = 0.18;
      tip.rotation.x = -0.1;
      head.add(tip);
      this.hairStrands.push(tip);
      const endCurl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), hairMat);
      endCurl.position.set(0.18, -1.82, -0.32);
      head.add(endCurl);
    } else {
      // wavy shorter hair: side tufts + neck tuft
      for (const s of [-1, 1]) {
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), hairMat);
        tuft.scale.set(0.7, 1.2, 0.9);
        tuft.position.set(0.37 * s, -0.12, -0.05);
        head.add(tuft);
      }
      const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 5, 8), hairMat);
      neck.scale.set(1.6, 1, 0.55);
      neck.position.set(0, -0.42, -0.28);
      neck.rotation.x = 0.25;
      head.add(neck);
      this.hairStrands.push(neck);
    }
    if (cfg.crown) {
      // the Royal Coral Crown (quest reward)
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700, roughness: 0.25, metalness: 0.8,
      });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.33, 0.16, 18, 1, true), goldMat);
      band.position.y = 0.42;
      head.add(band);
      const gemColors = [0xe0115f, 0x2ec4b6, 0x4169e1, 0xff9042, 0xb56fff];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 6), goldMat);
        spike.position.set(Math.sin(a) * 0.30, 0.58, Math.cos(a) * 0.30);
        head.add(spike);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6),
          new THREE.MeshStandardMaterial({
            color: gemColors[i], roughness: 0.15, emissive: gemColors[i], emissiveIntensity: 0.35,
          }));
        gem.position.set(Math.sin(a) * 0.315, 0.44, Math.cos(a) * 0.315);
        head.add(gem);
      }
    } else if (isMaid) {
      // flower crown for mermaids 🌸
      const crown = new THREE.Group();
      crown.position.y = 0.30;
      const nF = 8;
      for (let i = 0; i < nF; i++) {
        const a = (i / nF) * Math.PI * 2;
        const fl = makeFlower(0.11 + (i % 3) * 0.025, PETAL_COLORS[i % PETAL_COLORS.length]);
        fl.position.set(Math.sin(a) * 0.38, Math.cos(a * 2) * 0.045, Math.cos(a) * 0.38);
        fl.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
        crown.add(fl);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5),
          new THREE.MeshStandardMaterial({ color: 0x69b578, roughness: 0.8 }));
        leaf.scale.set(1, 0.4, 1.8);
        const la = a + Math.PI / nF;
        leaf.position.set(Math.sin(la) * 0.40, 0, Math.cos(la) * 0.40);
        leaf.rotation.y = la;
        crown.add(leaf);
      }
      head.add(crown);
    }
    V.add(head);
    this.head = head;

    // ---------- torso ----------
    const torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 6, 16), skinMat);
    chest.position.y = 0.52;
    torso.add(chest);
    if (!isMaid) {
      chest.scale.set(1.2, 1, 0.95);
      // pecs
      for (const s of [-1, 1]) {
        const pec = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skinMat);
        pec.scale.set(1.1, 0.7, 0.5);
        pec.position.set(0.17 * s, 0.60, 0.27);
        torso.add(pec);
      }
    }
    if (cfg.body === 'fit') {
      chest.scale.x *= 1.05; chest.scale.z *= 0.92;
      const absMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.skin).multiplyScalar(0.88), roughness: 0.6,
        metalness: golden ? 0.5 : 0,
      });
      for (let r = 0; r < 3; r++) for (const s of [-1, 1]) {
        const ab = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), absMat);
        ab.position.set(0.08 * s, 0.40 - r * 0.14, 0.295);
        ab.scale.z = 0.45;
        torso.add(ab);
      }
    } else if (cfg.body === 'round') {
      chest.scale.x *= 1.22; chest.scale.z *= 1.28;
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), skinMat);
      belly.position.set(0, 0.32, 0.1);
      torso.add(belly);
    } else if (cfg.body === 'pregnant') {
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), skinMat);
      belly.position.set(0, 0.38, 0.22);
      torso.add(belly);
    }
    // seashell top for mermaids
    if (isMaid) {
      for (const s of [-1, 1]) {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), shellMat);
        shell.position.set(0.165 * s, 0.72, 0.24);
        shell.scale.set(1, 0.85, 0.65);
        torso.add(shell);
        // shell ridges
        for (let rr = -1; rr <= 1; rr++) {
          const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.02), shellMat);
          ridge.position.set(0.165 * s + rr * 0.07, 0.73, 0.345);
          ridge.rotation.z = -rr * 0.5;
          torso.add(ridge);
        }
      }
      // pearl necklace strand
      for (let i = -2; i <= 2; i++) {
        const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), whiteMat);
        pearl.position.set(i * 0.075, 0.92 - Math.abs(i) * -0.015 - 0.03 * Math.abs(i), 0.30);
        torso.add(pearl);
      }
    }
    V.add(torso);

    // ---------- arms ----------
    this.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(0.42 * s * (isMaid ? 1 : 1.14), 0.88, 0);
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(isMaid ? 0.09 : 0.11, 0.62, 4, 10), skinMat);
      limb.position.y = -0.38;
      arm.add(limb);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), skinMat);
      hand.position.y = -0.78;
      arm.add(hand);
      // pearl armband like the reference
      if (isMaid) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 14), shellMat);
        band.position.y = -0.16;
        band.rotation.x = Math.PI / 2;
        arm.add(band);
      }
      arm.rotation.z = 0.22 * s;
      V.add(arm);
      this.arms.push(arm);
    }

    // ---------- mer tail ----------
    const tail = new THREE.Group();
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.37, 18, 14), scaleMat);
    hips.scale.set(1.05, 0.75, 0.95);
    if (cfg.body === 'round') hips.scale.multiplyScalar(1.2);
    tail.add(hips);
    // flower garland at the waist 🌺
    if (isMaid) {
      for (let i = 0; i < 5; i++) {
        const a = (-0.5 + i / 4) * Math.PI * 1.5;
        const fl = makeFlower(0.12, PETAL_COLORS[(i + 2) % PETAL_COLORS.length]);
        fl.position.set(Math.sin(a) * 0.36, 0.10, Math.cos(a) * 0.34);
        fl.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
        tail.add(fl);
      }
    }
    // chained segments with a gentle resting S-curve
    this.tailSegs = [];
    this.tailBase = [0.10, 0.06, 0.0, -0.07, -0.11];
    let parent = tail;
    const radii = [0.32, 0.27, 0.21, 0.15, 0.1];
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.y = i === 0 ? -0.18 : -0.34;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(radii[i], i < 4 ? radii[i + 1] : 0.07, 0.38, 14), scaleMat);
      m.position.y = -0.17;
      seg.add(m);
      parent.add(seg);
      parent = seg;
      this.tailSegs.push(seg);
    }
    // pearly fan fluke — spreads SIDEWAYS like a real mermaid tail
    const fluke = new THREE.Group();
    fluke.position.y = -0.36;
    for (const s of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), finMat);
      lobe.scale.set(0.85, 0.30, 0.10);
      lobe.rotation.z = -0.55 * s;                 // tips sweep downward-outward
      lobe.position.set(0.38 * s, -0.16, 0);
      fluke.add(lobe);
    }
    const notch = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), finMat);
    notch.scale.set(0.7, 0.5, 0.1);
    notch.position.set(0, -0.1, 0);
    fluke.add(notch);
    fluke.rotation.x = 0.18;                        // slight backward flare
    parent.add(fluke);
    this.fluke = fluke;
    // little translucent hip fins
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), finMat);
      fin.scale.set(0.12, 0.5, 0.8);
      fin.position.set(0.36 * s, -0.28, -0.02);
      fin.rotation.z = 0.5 * s;
      tail.add(fin);
    }
    V.add(tail);
    this.tail = tail;

    // ---------- human legs ----------
    const legs = new THREE.Group();
    this.legs = [];
    // mermaids wear a floor-length gown on land, so their legs are never
    // visible — don't build them at all (anything unseen can be removed)
    if (!isMaid) {
      for (const s of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(0.17 * s, 0.02, 0);
        const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.95, 4, 10), skinMat);
        limb.position.y = -0.62;
        leg.add(limb);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.42), skinMat);
        foot.position.set(0, -1.22, 0.1);
        leg.add(foot);
        legs.add(leg);
        this.legs.push(leg);
      }
    }
    const shorts = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), plainScaleMat);
    shorts.scale.set(1.05, 0.7, 0.95);
    if (cfg.body === 'round') shorts.scale.multiplyScalar(1.2);
    legs.add(shorts);
    this.skirtGroup = null;
    if (isMaid) {
      // flowing floor-length gown. A fixed hip yoke always hugs the waist so
      // the fabric never looks detached; the swaying part pivots from the
      // yoke's hem and sheathes over it, so no gap ever opens.
      plainScaleMat.side = THREE.DoubleSide;
      const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.54, 0.55, 20), plainScaleMat);
      yoke.position.y = -0.22;
      legs.add(yoke);
      const sk = new THREE.Group();
      sk.position.y = -0.42;
      // capped (not open-ended) and slightly narrower than the yoke, so the
      // top rim stays tucked inside it — no hollow ring can ever show
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.95, 1.06, 20), plainScaleMat);
      skirt.position.y = -0.51;
      sk.add(skirt);
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.045, 8, 22), shellMat);
      hem.position.y = -1.02;
      hem.rotation.x = Math.PI / 2;
      sk.add(hem);
      legs.add(sk);
      this.skirtGroup = sk;
    }
    V.add(legs);
    this.legsGroup = legs;

    this.setForm(this.form);
  }

  setForm(form) {
    this.form = form;
    this.tail.visible = form === 'mer';
    this.legsGroup.visible = form === 'human';
  }

  // Blend into the reef: mottled sand/green/rock tints, slightly ghostly.
  setCamouflage(on) {
    if (this.camo === on) return;
    this.camo = on;
    const targets = [0xb8a878, 0x5f8f5f, 0x7d838c].map((c) => new THREE.Color(c));
    this._camoMats.forEach((m, i) => {
      const orig = this._camoOrig[i];
      if (on) {
        m.color.copy(orig.color).lerp(targets[i % 3], 0.82);
        m.transparent = true;
        m.opacity = Math.min(orig.opacity, 0.8);
      } else {
        m.color.copy(orig.color);
        m.transparent = orig.transparent;
        m.opacity = orig.opacity;
      }
      m.needsUpdate = true;
    });
  }

  // state: { mode: 'water'|'land', speed, vy }
  update(dt, state) {
    const speedNorm = Math.min(1, state.speed / 9);
    this.animT += dt * (1.5 + speedNorm * 6);
    const t = this.animT;

    if (state.mode === 'water') {
      const targetPitch = speedNorm * 1.15 - THREE.MathUtils.clamp(state.vy * 0.09, -0.6, 0.6);
      this.visual.rotation.x += (targetPitch - this.visual.rotation.x) * Math.min(1, dt * 5);
      this.visual.position.y = Math.sin(t * 0.8) * 0.06;
      this.tailSegs.forEach((seg, i) => {
        seg.rotation.x = this.tailBase[i] + Math.sin(t * 2.2 - i * 0.55) * (0.14 + speedNorm * 0.22);
      });
      this.fluke.rotation.x = 0.18 + Math.sin(t * 2.2 - 5 * 0.55) * (0.2 + speedNorm * 0.25);
      this.arms.forEach((arm, i) => {
        const s = i === 0 ? -1 : 1;
        arm.rotation.z = s * (0.22 + speedNorm * 0.5) + Math.sin(t * 1.4 + i) * 0.06;
        arm.rotation.x = speedNorm * 0.9;
      });
      this.hairStrands.forEach((h, i) => {
        h.rotation.x = 0.14 + Math.sin(t * 1.3 + i * 0.8) * 0.09 + speedNorm * 0.45;
      });
    } else {
      this.visual.rotation.x += (0 - this.visual.rotation.x) * Math.min(1, dt * 8);
      const walk = speedNorm > 0.04 ? 1 : 0;
      // a little step-bounce sells the walk (especially under the gown)
      this.visual.position.y = walk * Math.abs(Math.sin(t * 2.4)) * 0.06;
      this.legs.forEach((leg, i) => {
        const s = i === 0 ? 1 : -1;
        leg.rotation.x = walk * Math.sin(t * 2.4 + (s > 0 ? 0 : Math.PI)) * 0.55;
      });
      if (this.skirtGroup) {
        // fabric is pushed by whichever knee is leading, swishes side to side,
        // and flares out a little with each stride
        const stride = Math.sin(t * 2.4);
        this.skirtGroup.rotation.x = -walk * (0.08 + 0.13 * Math.abs(stride)) - 0.03;
        this.skirtGroup.rotation.z = walk * stride * 0.18;
        const flare = 1 + walk * Math.abs(stride) * 0.05 + (walk ? 0 : Math.sin(t * 1.2) * 0.015);
        this.skirtGroup.scale.set(flare, 1, flare);
      }
      this.arms.forEach((arm, i) => {
        const s = i === 0 ? -1 : 1;
        arm.rotation.z = s * 0.18;
        arm.rotation.x = walk * Math.sin(t * 2.4 + (s > 0 ? 0 : Math.PI)) * 0.4;
      });
      this.hairStrands.forEach((h, i) => {
        h.rotation.x = 0.14 + Math.sin(t * 1.1 + i * 0.8) * 0.04;
      });
    }
  }
}
