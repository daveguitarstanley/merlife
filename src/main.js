import * as THREE from 'three';
import { buildWorld, terrainHeight, SPAWN, JETTY, COLLIDERS, WRECK } from './world.js';
import { Character } from './character.js';
import { Controls } from './controls.js';
import { setupCreator, loadConfig, saveConfig } from './creator.js';
import { createFishSchools } from './fish.js';
import { GameAudio } from './audio.js';
import { PearlSystem, PEARL_CAP } from './builder.js';
import { NastyFish } from './enemy.js';
import { QUESTS } from './quests.js';
import { buildVillage, makeTextSprite } from './village.js';
import { Net } from './net.js';
import QRCode from 'qrcode';

// ---------------------------------------------------------------- setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b4864, 0.02);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const world = buildWorld(scene);
const schools = createFishSchools(scene);
const controls = new Controls();
const audio = new GameAudio();

const config = loadConfig();
const character = new Character(config);
character.group.position.copy(SPAWN);
character.group.rotation.y = Math.PI / 2; // face the open sea
scene.add(character.group);

// ---------------------------------------------------------------- sparkle FX
const sparkles = [];
{
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(180,255,240,0.9)');
  grd.addColorStop(1, 'rgba(180,255,240,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
    }));
    s.scale.setScalar(0.5);
    s.visible = false;
    s.userData = { vel: new THREE.Vector3(), life: 0 };
    scene.add(s);
    sparkles.push(s);
  }
}
function burstSparkles(pos) {
  for (const s of sparkles) {
    s.visible = true;
    s.position.copy(pos).add(new THREE.Vector3(
      (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.2));
    s.userData.vel.set((Math.random() - 0.5) * 4, Math.random() * 3.5, (Math.random() - 0.5) * 4);
    s.userData.life = 0.9 + Math.random() * 0.4;
    s.material.opacity = 1;
    s.scale.setScalar(0.35 + Math.random() * 0.5);
  }
}
function updateSparkles(dt) {
  for (const s of sparkles) {
    if (!s.visible) continue;
    s.userData.life -= dt;
    if (s.userData.life <= 0) { s.visible = false; continue; }
    s.position.addScaledVector(s.userData.vel, dt);
    s.material.opacity = Math.min(1, s.userData.life);
  }
}

// ---------------------------------------------------------------- HUD helpers
const hud = document.getElementById('hud');
const toastEl = document.getElementById('toast');
const hintEl = document.getElementById('hint');
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
// Fullscreen needs a real user gesture — hook every tap, so the game goes (and
// stays) fullscreen from the first touch, and re-enters if the browser drops it.
// (iPhones don't support the fullscreen API at all — PWA install is their path.)
if (isTouch && document.documentElement.requestFullscreen) {
  document.addEventListener('touchend', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  }, { passive: true });
}
let toastTimer = null;
function toast(msg, ms = 2600) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, ms);
}
function setHint(msg) { hintEl.textContent = msg; }

const SAVE_DEFAULTS = {
  coins: 0, pearls: 6, hearts: 4, pot: 0, builds: [], sites: [],
  quests: { active: null, carrying: false, repeat: false, done: [] },
  unlocks: {}, houses: {},
};
const save = (() => {
  let s;
  try { s = { ...SAVE_DEFAULTS, ...JSON.parse(localStorage.getItem('merlife.save.v1') || '{}') }; }
  catch (e) { s = { ...SAVE_DEFAULTS }; }
  s.quests = { ...SAVE_DEFAULTS.quests, ...s.quests };
  s.unlocks = { ...s.unlocks };
  s.houses = { ...s.houses };
  return s;
})();
function saveGame() {
  try { localStorage.setItem('merlife.save.v1', JSON.stringify(save)); } catch (e) { /* ok */ }
}
function refreshHud() {
  document.getElementById('coins').textContent = `🐚 ${save.coins}`;
  document.getElementById('pearls').textContent = `🫧 ${save.pearls}`;
  document.getElementById('hearts').textContent =
    '💗'.repeat(save.hearts) + '🤍'.repeat(4 - save.hearts);
}
refreshHud();

document.getElementById('muteBtn').addEventListener('click', (e) => {
  const muted = audio.toggleMute();
  e.currentTarget.textContent = muted ? '🔇' : '🔊';
});

// ---------------------------------------------------------------- pearls & camo
const pearlSystem = new PearlSystem(scene, save, (type, data) => {
  if (type === 'built') {
    audio.chime();
    toast(`✨ You built a ${data.type === 'cave' ? 'Coral Cave' : data.type === 'house' ? 'Pearl House' : 'lovely ' + data.kind}! ✨`);
    saveGame();
  } else if (type === 'oyster') {
    audio.chime([659.25, 880]);
    toast('🦪 +3 pearls!');
  } else if (type === 'fizzle') {
    toast('Too shallow to build here — pearl came back!');
  }
  refreshHud();
  saveGame();
});

let camo = false;
let camoRegenT = 0;
function setCamo(on) {
  camo = on;
  character.setCamouflage(on);
  document.getElementById('btnCamo').classList.toggle('on', on);
  if (on) {
    vel.set(0, 0, 0);
    camoRegenT = 0;
    audio.chime([392, 349.23]);
    toast('🦎 Camouflaged! Rest to get your strength back…');
  }
}
function toggleCamo() {
  if (state !== 'play') return;
  if (mode !== 'water') { toast('You can only camouflage in the water!'); return; }
  setCamo(!camo);
  if (!camo) toast('Back to your true colours!');
}
function doShoot() {
  if (state !== 'play') return;
  if (mode !== 'water') { toast('Pearl magic only works underwater!'); return; }
  if (camo) { toast('You are resting — no pearl magic while camouflaged!'); return; }
  const yaw = character.group.rotation.y;
  // always lob at least gently downward so pearls land predictably just ahead
  const pitch = Math.max(character.visual.rotation.x, 0.45);
  const dir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const origin = pos.clone().addScaledVector(dir, 0.9).add(new THREE.Vector3(0, 0.4, 0));
  if (pearlSystem.shoot(origin, dir)) audio.pop();
  else toast('No pearls left! Find a glowing oyster 🦪');
}
function doCycleBlueprint() {
  if (state !== 'play') return;
  const bp = pearlSystem.cycleBlueprint();
  document.getElementById('btnBuild').textContent = bp.emoji;
  toast(`Blueprint: ${bp.emoji} ${bp.label} (${bp.cost} pearls)`);
}
document.getElementById('btnShoot').addEventListener('click', doShoot);
document.getElementById('btnBuild').addEventListener('click', doCycleBlueprint);
document.getElementById('btnCamo').addEventListener('click', toggleCamo);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyF') doShoot();
  else if (e.code === 'KeyB') doCycleBlueprint();
  else if (e.code === 'KeyX') toggleCamo();
});

// ---------------------------------------------------------------- boost & nasty fish
const nasty = new NastyFish(scene);
let nastyCooldown = 0;       // pause between encounters
let warnedDeep = false;
// Boost dash: 2 charges, each takes 10 s to come back. Zoom in, grab the
// treasure, zoom out before the nasty fish catches you!
const boost = { charges: 2, max: 2, recharge: 0, active: 0 };
const boostBtn = document.getElementById('btnBoost');
const boostPips = document.getElementById('boostPips');
function updateBoostUI() {
  boostPips.textContent = '●'.repeat(boost.charges) + '○'.repeat(boost.max - boost.charges);
  boostBtn.classList.toggle('empty', boost.charges === 0);
}
function doBoost() {
  if (state !== 'play') return;
  if (mode !== 'water') { toast('🚀 Boost only works underwater!'); return; }
  if (boost.charges <= 0) { toast(`🚀 Recharging… ${Math.ceil(10 - boost.recharge)}s`); return; }
  if (camo) setCamo(false);
  boost.charges--;
  boost.active = 0.9;
  audio.chime([659.25, 880]);
  burstSparkles(pos);
  updateBoostUI();
}
function tickBoost(dt) {
  boost.active = Math.max(0, boost.active - dt);
  if (boost.charges < boost.max) {
    boost.recharge += dt;
    if (boost.recharge >= 10) { boost.recharge = 0; boost.charges++; updateBoostUI(); if (boost.charges === boost.max) toast('🚀 Boost fully charged!'); }
  } else boost.recharge = 0;
}
boostBtn.addEventListener('click', doBoost);
window.addEventListener('keydown', (e) => {
  if (!e.repeat && (e.code === 'KeyQ' || e.code === 'Digit1')) doBoost();
});
updateBoostUI();

const hurtEl = document.getElementById('hurt');
function flashHurt() {
  hurtEl.classList.add('flash');
  setTimeout(() => hurtEl.classList.remove('flash'), 120);
}
function reClone() {
  save.hearts = 4;
  refreshHud();
  saveGame();
  pos.copy(SPAWN);
  vel.set(0, 0, 0);
  character.group.rotation.y = Math.PI / 2;
  setCamo(false);
  boost.charges = boost.max; boost.recharge = 0; boost.active = 0; updateBoostUI();
  nasty.despawn();
  nastyCooldown = 12;
  burstSparkles(pos);
  audio.splash();
  toast('💫 Four bites! You re-cloned safely at your waterfall home.', 4000);
  camera.position.set(pos.x - 7.5, pos.y + 2.6, pos.z);
  camera.lookAt(pos.x, pos.y + 1, pos.z);
}
function onBite() {
  save.hearts = Math.max(0, save.hearts - 1);
  refreshHud();
  saveGame();
  audio.buzz();
  flashHurt();
  if (save.hearts <= 0) reClone();
  else toast(`🦈 Chomp! ${save.hearts} ❤️ left — 🚀 BOOST away or 🦎 hide!`);
}

// ---------------------------------------------------------------- village, quests & houses
const village = buildVillage(scene);
const guardian = new NastyFish(scene);
let questItem = null;      // { sprite, pillar, pos }

const dialogEl = document.getElementById('dialog');
const interactBtn = document.getElementById('interactBtn');
let dialogOpen = false;
function showDialog(text, buttons) {
  dialogOpen = true;
  document.getElementById('dlgText').textContent = text;
  const btns = document.getElementById('dlgBtns');
  btns.innerHTML = '';
  buttons.forEach((b, i) => {
    const el = document.createElement('button');
    el.textContent = b.label;
    el.className = i === 0 ? 'primary' : 'plain';
    el.addEventListener('click', () => {
      if (!dialogOpen) return;  // ignore double-taps / stale buttons
      dialogEl.classList.add('hidden');
      dialogOpen = false;
      if (b.fn) b.fn();
    });
    btns.appendChild(el);
  });
  dialogEl.classList.remove('hidden');
}

function activeQuest() { return QUESTS.find((q) => q.id === save.quests.active) || null; }

function updateMarkers() {
  for (const n of village.npcs) {
    const q = n.quest;
    const locked = q.needsDone && save.quests.done.length < q.needsDone;
    const available = !save.quests.active && !save.quests.done.includes(q.id) && !locked;
    const awaiting = save.quests.active === q.id && save.quests.carrying;
    n.marker.visible = available || awaiting;
  }
}

function refreshQuestChip() {
  const chip = document.getElementById('questChip');
  const q = activeQuest();
  if (!q) { chip.classList.remove('active'); return; }
  document.getElementById('questText').textContent = save.quests.carrying
    ? `Bring the ${q.emoji} ${q.item} back to ${q.giver}!`
    : `Find the ${q.emoji} ${q.item}!`;
  chip.classList.add('active');
}

function spawnQuestSite(q) {
  const [x, z] = q.spot;
  const y = terrainHeight(x, z);
  const sprite = makeTextSprite(q.emoji, { fontSize: 90, bg: null, scale: 3.2 });
  sprite.position.set(x, y + 2.2, z);
  scene.add(sprite);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xaef3ff, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide,
    }));
  pillar.position.set(x, y + 15, z);
  scene.add(pillar);
  questItem = { sprite, pillar, pos: new THREE.Vector3(x, y + 2, z) };
  guardian.spawnGuard(new THREE.Vector3(x, y + 2.5, z), {
    weakness: q.weakness,
    color: q.fishColor,
    speed: q.id === 'trident' ? 4.6 : 3.4,
    scale: q.id === 'trident' ? 1.6 : 1.15,
  });
}

function clearQuestSite() {
  if (questItem) {
    scene.remove(questItem.sprite, questItem.pillar);
    questItem = null;
  }
}

function startQuest(q, repeat = false) {
  save.quests.active = q.id;
  save.quests.carrying = false;
  save.quests.repeat = repeat;
  spawnQuestSite(q);
  updateMarkers();
  refreshQuestChip();
  saveGame();
  audio.chime();
  toast(`${q.emoji} Quest started! Follow the glowing beacon into the sea!`, 3600);
}

// A finished quest giver always has a smaller repeat job — shell coins never
// run out, so the grandest houses stay within reach.
function repeatReward(q) {
  return Math.max(40, Math.round((q.reward.coins || 80) / 2));
}

function grantReward(q) {
  const r = q.reward;
  const gains = [];
  if (r.coins) { save.coins += r.coins; gains.push(`+${r.coins} 🐚`); }
  if (r.pearls) { save.pearls = Math.min(PEARL_CAP, save.pearls + r.pearls); gains.push(`+${r.pearls} 🫧`); }
  if (r.feast) { save.hearts = 4; gains.push('❤️ full hearts'); }
  if (r.unlock) {
    save.unlocks[r.unlock] = true;
    if (r.unlock === 'crown') gains.push('👑 Crown unlocked in the Character Creator!');
    if (r.unlock === 'rainbow') gains.push('🌈 Rainbow scales unlocked in the Character Creator!');
    if (r.unlock === 'sponge') gains.push('👟 You now run faster on land!');
  }
  audio.chime([523.25, 659.25, 783.99, 1046.5]);
  burstSparkles(pos);
  if (gains.length) toast(`✨ ${gains.join(' • ')} ✨`, 4000);
  refreshHud();
}

function completeQuest(q) {
  const wasRepeat = save.quests.repeat;
  if (!wasRepeat) save.quests.done.push(q.id);
  save.quests.active = null;
  save.quests.carrying = false;
  save.quests.repeat = false;
  guardian.kill();
  clearQuestSite();
  if (wasRepeat) {
    const c = repeatReward(q);
    save.coins += c;
    audio.chime([523.25, 659.25, 783.99, 1046.5]);
    burstSparkles(pos);
    toast(`✨ +${c} 🐚 — thank you, friend of the sea! ✨`, 3600);
    refreshHud();
  } else {
    grantReward(q);
  }
  updateMarkers();
  refreshQuestChip();
  saveGame();
}

// ---- houses ----
function nextHomeless() { return village.homeless.find((h) => !h.homed) || null; }
function applyHouseState(i, kind) {
  const h = world.saleHouses[i];
  if (kind === 'owned') h.setSign('MER', 'HOME', '#2e7dc0');
  else {
    h.setSign('HOME', '💗', '#c0392b');
    const hm = nextHomeless();
    if (hm) hm.setHome(new THREE.Vector3(h.x, 0, h.z), h.ry);
  }
}
function buyFlow(i) {
  const h = world.saleHouses[i];
  const afterBuy = () => {
    refreshHud();
    showDialog('It\'s yours! 🎉 Will you keep it as your own beach home, or gift it to someone who has no home?', [
      {
        label: 'Live here 🏠',
        fn: () => { save.houses[i] = 'owned'; applyHouseState(i, 'owned'); saveGame(); audio.chime(); toast('🏠 Welcome to your new island home!'); },
      },
      {
        label: 'Gift it ❤️',
        fn: () => {
          if (!nextHomeless()) {
            save.houses[i] = 'owned'; applyHouseState(i, 'owned'); saveGame();
            toast('Everyone already has a home — so this one is yours! 🏠');
            return;
          }
          save.houses[i] = 'gifted'; applyHouseState(i, 'gifted'); saveGame();
          audio.chime([523.25, 659.25, 783.99, 1046.5]);
          toast('❤️ You just changed someone\'s life! What a hero!', 4000);
        },
      },
    ]);
  };
  const opts = [];
  if (save.coins >= h.price) {
    opts.push({ label: 'Buy it! 🏠', fn: () => { save.coins -= h.price; afterBuy(); } });
  }
  if (save.pot >= h.price) {
    opts.push({ label: 'Pay from Community Pot 🏦', fn: () => { setPot(save.pot - h.price); afterBuy(); } });
  }
  if (!opts.length) {
    showDialog(`This cosy house costs ${h.price} 🐚 — you have ${save.coins} 🐚 and the Community Pot holds ${save.pot} 🐚. ` +
      'Help more villagers, or pool coins with a friend at the 🏦 Shell Bank!', [{ label: 'OK' }]);
    return;
  }
  opts.push({ label: 'Not now' });
  showDialog(`Buy this lovely house for ${h.price} 🐚?`, opts);
}

// ---- talking / buying ----
let currentInteract = null;
let insideHouse = -1;
let insideWreck = false;
function findInteract() {
  if (state !== 'play' || mode !== 'land' || dialogOpen) return null;
  if (ridingBuggy) return { type: 'buggyOut', label: '🛑 Hop out' };
  // several things can be in reach at once — offer the NEAREST one
  let best = null, bestD = Infinity;
  const consider = (d, reach, it) => { if (d < reach && d < bestD) { best = it; bestD = d; } };
  for (const n of village.npcs) {
    const d = Math.hypot(n.group.position.x - pos.x, n.group.position.z - pos.z);
    // shopkeepers stand behind their stall counter — let kids talk from the front
    consider(d, n.quest.shop ? 8.5 : 3.8, { type: 'npc', npc: n, label: `💬 Talk to ${n.quest.short}` });
  }
  {
    const b = village.banker.group.position;
    consider(Math.hypot(b.x - pos.x, b.z - pos.z), 4.5, { type: 'bank', label: '🏦 Shell Bank' });
  }
  for (const bg of world.buggies) {
    if (bg.driving) continue;
    const d = Math.hypot(bg.group.position.x - pos.x, bg.group.position.z - pos.z);
    consider(d, 4.5, { type: 'buggy', buggy: bg, label: '🛺 Hop in!' });
  }
  if (best) return best;
  for (let i = 0; i < world.saleHouses.length; i++) {
    if (save.houses[i]) continue;
    const h = world.saleHouses[i];
    const d = Math.hypot(h.x - pos.x, h.z - pos.z);
    if (d < 7.5) return { type: 'house', i, label: `🏠 For Sale · ${h.price} 🐚` };
  }
  return null;
}
// ---- the Shell Bank: pool coins into the community pot ----
function setPot(v) {
  save.pot = Math.max(0, Math.round(v));
  net.setPot(save.pot);
  saveGame();
}
function bankFlow() {
  const btns = [];
  if (save.coins >= 50) btns.push({ label: 'Put in 50 🐚', fn: () => { save.coins -= 50; setPot(save.pot + 50); refreshHud(); audio.chime(); toast(`💰 Community pot: ${save.pot} 🐚`); } });
  if (save.coins >= 200) btns.push({ label: 'Put in 200 🐚', fn: () => { save.coins -= 200; setPot(save.pot + 200); refreshHud(); audio.chime(); toast(`💰 Community pot: ${save.pot} 🐚`); } });
  if (save.pot >= 50) btns.push({ label: 'Take out 50 🐚', fn: () => { setPot(save.pot - 50); save.coins += 50; refreshHud(); toast(`🐚 You have ${save.coins} — pot: ${save.pot}`); } });
  btns.push({ label: 'Done 👋' });
  showDialog(`Goldie: "Welcome to the Shell Bank! 🏦 The Community Pot holds ${save.pot} 🐚. ` +
    `Everyone in your sea can add coins — pool together to buy the big houses for villagers in need!"`, btns);
}
// ---- golf buggies: hop in, zoom around town ----
let ridingBuggy = null;
function boardBuggy(b) {
  ridingBuggy = b;
  b.driving = true;
  audio.chime([523.25, 659.25]);
  toast('🛺 Beep beep! Off we go!');
  setHint(isTouch ? '🕹️ drive • 💬 button to hop out' : '⬅️➡️ steer • ⬆️ drive • E to hop out');
}
function unboardBuggy() {
  const b = ridingBuggy;
  ridingBuggy = null;
  b.driving = false;
  // step out to the side of the buggy
  pos.x += Math.sin(charYaw + Math.PI / 2) * 2.2;
  pos.z += Math.cos(charYaw + Math.PI / 2) * 2.2;
  toast('🛺 Parked! See you next ride.');
  setHint(isTouch ? '🕹️ walk • 🐰 JUMP to hop' : '⬅️➡️ steer • ⬆️ walk ahead • Space jump');
}
function doInteract() {
  if (!currentInteract) return;
  if (currentInteract.type === 'house') { buyFlow(currentInteract.i); return; }
  if (currentInteract.type === 'bank') { bankFlow(); return; }
  if (currentInteract.type === 'buggy') { boardBuggy(currentInteract.buggy); return; }
  if (currentInteract.type === 'buggyOut') { unboardBuggy(); return; }
  const q = currentInteract.npc.quest;
  const st = save.quests;
  if (st.active === q.id && st.carrying) {
    showDialog(`${q.giver}: "${st.repeat ? 'You found another one! Wonderful!' : q.thanks}"`,
      [{ label: 'Hooray! 🎉', fn: () => completeQuest(q) }]);
  } else if (st.active === q.id) {
    showDialog(`${q.giver}: "The ${q.emoji} ${q.item} is still out there — follow the glowing beacon! Be careful of its guardian…"`, [{ label: 'On my way!' }]);
  } else if (st.done.includes(q.id) && !st.active) {
    // repeatable side-task: coins never run out
    showDialog(`${q.giver}: "Thank you again, friend of the sea! Actually… another ${q.emoji} ${q.item} was spotted in the same spot! Fetch it and ${repeatReward(q)} 🐚 are yours!"`, [
      { label: 'On it! 💪', fn: () => startQuest(q, true) },
      { label: 'Maybe later' },
    ]);
  } else if (st.done.includes(q.id)) {
    showDialog(`${q.giver}: "Thank you again, friend of the sea! ${q.emoji}"`, [{ label: '💛' }]);
  } else if (st.active) {
    const cur = activeQuest();
    showDialog(`${q.giver}: "You're already helping ${cur.giver}! Finish that first, then come see me."`, [{ label: 'OK' }]);
  } else if (q.needsDone && st.done.length < q.needsDone) {
    showDialog(`${q.giver}: "${q.lockedLine}"`, [{ label: 'I\'ll be back' }]);
  } else {
    showDialog(`${q.giver}: "${q.line}"`, [
      { label: 'I\'ll do it! 💪', fn: () => startQuest(q) },
      { label: 'Maybe later' },
    ]);
  }
}
interactBtn.addEventListener('click', doInteract);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !e.repeat) doInteract();
});

// restore saved progress
for (const [i, kind] of Object.entries(save.houses)) applyHouseState(+i, kind);
{
  const q = activeQuest();
  if (q && !save.quests.carrying) spawnQuestSite(q);
}
updateMarkers();
refreshQuestChip();

// ---------------------------------------------------------------- game state
let state = 'creator'; // 'creator' | 'play'
let mode = 'water';    // 'water' | 'land'
const vel = new THREE.Vector3();
let vy = 0;            // land-mode vertical velocity
let onGround = false;
let creatorAngle = 0.6;

const pos = character.group.position;
// which way the character faces; ⬅️➡️ steer this, camera follows behind
let charYaw = Math.PI / 2;

function inJettyRect(x, z, pad = 0) {
  return x > JETTY.x1 - pad && x < JETTY.x2 + pad && z > JETTY.z1 - pad && z < JETTY.z2 + pad;
}

// Solid-town collision on land: house walls (with a walk-through doorway on
// the front face) and street furniture (fountain, stalls, lampposts, palms).
const PLAYER_R = 0.35;
function landBlocked(x, z) {
  for (const o of COLLIDERS.circles) {
    const dx = x - o.x, dz = z - o.z;
    const r = o.r + PLAYER_R;
    if (dx * dx + dz * dz < r * r) return true;
  }
  for (const h of COLLIDERS.houses) {
    const dx = x - h.x, dz = z - h.z;
    const c = Math.cos(h.ry), si = Math.sin(h.ry);
    const lx = dx * c - dz * si, lz = dx * si + dz * c;
    const W = 3.2 * h.s, D = 2.9 * h.s, T = 0.25;
    if (Math.abs(lx) > W + PLAYER_R || Math.abs(lz) > D + PLAYER_R) continue;   // outside
    if (Math.abs(lx) < W - T - PLAYER_R && Math.abs(lz) < D - T - PLAYER_R) continue; // inside the room
    if (lz > 0 && Math.abs(lx) < 0.95 * h.s - 0.15) continue;                  // the doorway
    return true;
  }
  return false;
}
function terrainGradient(x, z) {
  const e = 0.9;
  const gx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
  const gz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
  return Math.hypot(gx, gz);
}

// swap the big touch buttons to match the mode: UP/DOWN in water, JUMP on land
function updateMoveButtons() {
  const land = mode === 'land';
  document.body.classList.toggle('land', land);
  document.querySelector('#btnUp .ico').textContent = land ? '🐰' : '⬆️';
  document.querySelector('#btnUp .word').textContent = land ? 'JUMP' : 'UP';
}

function toLand(groundY) {
  mode = 'land';
  if (camo) setCamo(false);
  boost.active = 0;
  vel.set(0, 0, 0); vy = 0; onGround = true;
  pos.y = groundY + 1.47;
  character.setForm('human');
  updateMoveButtons();
  burstSparkles(pos);
  audio.chime();
  toast('✨ You have legs! ✨');
  setHint(isTouch ? '🕹️ walk • 🐰 JUMP to hop' : '⬅️➡️ steer • ⬆️ walk ahead • Space jump');
}
function toWater() {
  mode = 'water';
  vel.set(0, 0, 0); vy = 0;
  character.setForm('mer');
  updateMoveButtons();
  burstSparkles(pos);
  audio.splash();
  toast('🌊 Splash! Back to mer-form!');
  setHint(isTouch ? '🕹️ swim • UP/DOWN dive • 🚀 BOOST to escape!' : '⬅️➡️ steer • ⬆️ swim • Space up • Shift down • Q boost • F pearl • B build • X rest');
}

// ---------------------------------------------------------------- co-op
const net = new Net();
const coopPanel = document.getElementById('coopPanel');
const coopStatus = document.getElementById('coopStatus');
const coopLinkEl = document.getElementById('coopLink');

async function startCoop(showPanel) {
  if (showPanel) {
    coopPanel.classList.remove('hidden');
    coopStatus.textContent = 'Opening your sea to friends…';
    coopLinkEl.value = '';
  }
  try {
    const link = await net.start(scene, character.config);
    save.pot = net.syncPot(save.pot);           // community pots merge
    saveGame();
    document.getElementById('coopBtn').classList.add('live');
    net.onFriends = (n) => toast(n > 0 ? '💙 A sea friend is here!' : 'Your friend swam away… 🌊', 3000);
    if (showPanel) {
      coopStatus.textContent = 'Your sea is open! Share this link:';
      coopLinkEl.value = link;
      // QR code so a tablet/phone can just scan the screen to join
      const qrEl = document.getElementById('coopQR');
      QRCode.toCanvas(qrEl, link, { width: 296, margin: 1 })
        .then(() => qrEl.classList.add('show'))
        .catch(() => {});
    } else {
      toast("🌊 Splash! You're in your friend's sea!", 3600);
    }
  } catch (e) {
    if (showPanel) coopStatus.textContent = 'Could not reach the ocean — check the internet and try again 🌊';
    else toast('Could not join — check the internet 🌊', 3600);
  }
}
document.getElementById('coopBtn').addEventListener('click', () => startCoop(true));
document.getElementById('coopClose').addEventListener('click', () => coopPanel.classList.add('hidden'));
document.getElementById('coopCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(coopLinkEl.value);
    document.getElementById('coopCopy').textContent = '✅ Copied!';
    setTimeout(() => { document.getElementById('coopCopy').textContent = '📋 Copy link'; }, 1600);
  } catch (e) {
    coopLinkEl.select();
  }
});

const creatorUI = setupCreator(config,
  (cfg) => { character.setConfig(cfg); saveConfig(cfg); net.setLook(cfg); },
  () => {
    audio.init();
    audio.chime();
    document.getElementById('creator').classList.add('hidden');
    hud.classList.remove('hidden');
    document.body.classList.add('playing');
    state = 'play';
    controls.enabled = true;
    // snap the camera straight behind the character so "forward" means forward
    const yaw = character.group.rotation.y;
    const dist = mode === 'water' ? 7.5 : 8.5;
    camera.position.set(
      pos.x - Math.sin(yaw) * dist,
      pos.y + (mode === 'water' ? 2.6 : 3.4),
      pos.z - Math.cos(yaw) * dist);
    camera.lookAt(pos.x, pos.y + 1, pos.z);
    // arrived via a friend's share link → splash straight into their sea
    if (/^#r=/.test(location.hash) && !net.active) startCoop(false);
    else toast('Welcome home, little mer! Swim toward the sunny island! ☀️', 3800);
    updateMoveButtons();
    setHint(isTouch ? '🕹️ swim • UP/DOWN dive • 🚀 BOOST to escape!' : '⬅️➡️ steer • ⬆️ swim • Space up • Shift down • Q boost • F pearl • B build • X rest');
  },
  () => save.unlocks);

document.getElementById('customizeBtn').addEventListener('click', () => {
  state = 'creator';
  controls.enabled = false;
  hud.classList.add('hidden');
  document.body.classList.remove('playing');
  creatorUI.refresh();
  document.getElementById('creator').classList.remove('hidden');
});
controls.enabled = false;

// ---------------------------------------------------------------- movement
const _fwd = new THREE.Vector3();
const _move = new THREE.Vector3();

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

let _dbg = { frames: 0, mv: null };
function updatePlay(dt) {
  const mv = controls.getMove();
  _dbg.mv = mv;

  // resting under camouflage: frozen in place, strength returns
  if (camo) {
    if (Math.hypot(mv.x, mv.z) > 0.25 || controls.up || controls.down) {
      setCamo(false);
      toast('✨ You feel rested — back to your true colours!');
    } else {
      vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      camoRegenT += dt;
      if (camoRegenT >= 2.5) {
        camoRegenT = 0;
        if (save.hearts < 4) {
          save.hearts++;
          refreshHud();
          saveGame();
          audio.chime([523.25]);
        }
      }
      character.update(dt, { mode: 'water', speed: 0, vy: 0 });
      return;
    }
  }
  // character-relative driving: ⬅️➡️ turn her (the camera swings round behind),
  // ⬆️ walks/swims the way she faces, ⬇️ is a gentle back-step
  charYaw -= mv.x * dt * 2.7;
  const fwdIn = Math.max(-0.45, mv.z);
  // right = forward x up
  _move.set(Math.sin(charYaw) * fwdIn, 0, Math.cos(charYaw) * fwdIn);

  const moving = _move.lengthSq() > 0.001;

  if (mode === 'water') {
    const maxSpeed = 9;
    vel.x += (_move.x * maxSpeed - vel.x) * Math.min(1, dt * 3.2);
    vel.z += (_move.z * maxSpeed - vel.z) * Math.min(1, dt * 3.2);
    // boost dash: rocket along the facing direction while the burst lasts
    if (boost.active > 0) {
      const k = 17 * Math.min(1, boost.active / 0.25);   // eases out at the end
      vel.x += Math.sin(charYaw) * k * dt * 8;
      vel.z += Math.cos(charYaw) * k * dt * 8;
      const cap = 26;
      const sp = Math.hypot(vel.x, vel.z);
      if (sp > cap) { vel.x *= cap / sp; vel.z *= cap / sp; }
      if (Math.random() < 0.5) burstSparkles(pos);
    }
    const vertIn = (controls.up ? 1 : 0) - (controls.down ? 1 : 0);
    vel.y += (vertIn * 5.5 - vel.y) * Math.min(1, dt * 3.2);

    // horizontal move with wall sliding: steep terrain that reaches near the
    // surface is a wall; gentle slopes are beaches we can glide up
    const passable = (x, z) => {
      const f = terrainHeight(x, z);
      if (f + 0.9 <= -0.35) return true;
      return terrainGradient(x, z) < 0.8;
    };
    const nx = THREE.MathUtils.clamp(pos.x + vel.x * dt, -330, 330);
    const nz = THREE.MathUtils.clamp(pos.z + vel.z * dt, -330, 330);
    if (passable(nx, nz)) { pos.x = nx; pos.z = nz; }
    else if (passable(nx, pos.z)) { pos.x = nx; }
    else if (passable(pos.x, nz)) { pos.z = nz; }
    pos.y += vel.y * dt;
    const floor = terrainHeight(pos.x, pos.z);
    const maxY = Math.max(-0.35, floor + 0.9);
    pos.y = THREE.MathUtils.clamp(pos.y, floor + 0.9, maxY);

    character.group.rotation.y = charYaw;

    // ---- transitions to land ----
    const h = floor;
    if (h > -0.95 && terrainGradient(pos.x, pos.z) < 0.8) {
      toLand(h);
    } else if (inJettyRect(pos.x, pos.z, 1.2) && pos.y > -1.8) {
      toLand(JETTY.deckY);
      toast('✨ You climbed onto the jetty! ✨');
    }
    character.update(dt, { mode: 'water', speed: Math.hypot(vel.x, vel.z), vy: vel.y });
  } else {
    // ---- land ----
    const maxSpeed = ridingBuggy ? 12.5 : (save.unlocks.sponge ? 7.4 : 5.5);
    vel.x += (_move.x * maxSpeed - vel.x) * Math.min(1, dt * 8);
    vel.z += (_move.z * maxSpeed - vel.z) * Math.min(1, dt * 8);
    // solid town: house walls (except the doorway) and street furniture block
    // movement, with wall sliding like in the water
    const nx = pos.x + vel.x * dt, nz = pos.z + vel.z * dt;
    if (!landBlocked(nx, nz)) { pos.x = nx; pos.z = nz; }
    else if (!landBlocked(nx, pos.z)) { pos.x = nx; }
    else if (!landBlocked(pos.x, nz)) { pos.z = nz; }

    const onJetty = inJettyRect(pos.x, pos.z, 0.4);
    const ground = onJetty ? Math.max(JETTY.deckY, terrainHeight(pos.x, pos.z))
      : terrainHeight(pos.x, pos.z);

    if (ridingBuggy) {
      // sitting proud on the buggy bench; the buggy follows the driver
      vy = 0; onGround = true;
      pos.y = ground + 2.05;
      const bg = ridingBuggy.group;
      bg.position.set(pos.x, ground, pos.z);
      bg.rotation.y = charYaw;
      const spin = Math.hypot(vel.x, vel.z) * dt * 2.2;
      for (const w of ridingBuggy.wheels) w.rotation.x += spin;
    } else {
      if (controls.up && onGround) { vy = 7.2; onGround = false; audio.chime([660]); }
      vy -= 20 * dt;
      pos.y += vy * dt;
      if (pos.y <= ground + 1.47) {
        pos.y = ground + 1.47;
        vy = 0;
        onGround = true;
      }
    }

    character.group.rotation.y = charYaw;

    // ---- dive back into the sea ----
    if (!onJetty && terrainHeight(pos.x, pos.z) < -1.6 && pos.y < 0.6) {
      if (ridingBuggy) unboardBuggy();          // buggies don't float!
      toWater();
      pos.y = Math.max(terrainHeight(pos.x, pos.z) + 1, -1.1);
    }
    character.update(dt, { mode: 'land', speed: ridingBuggy ? 0 : Math.hypot(vel.x, vel.z), vy });
  }
}

// ---------------------------------------------------------------- camera
const camTarget = new THREE.Vector3();
camera.position.set(SPAWN.x + Math.sin(0.6) * 4.2, SPAWN.y + 1.1, SPAWN.z + Math.cos(0.6) * 4.2);
camera.lookAt(SPAWN.x, SPAWN.y + 0.5, SPAWN.z);
function updateCamera(dt) {
  if (state === 'creator') {
    creatorAngle += dt * 0.35;
    const r = 4.2;
    // on portrait screens the options panel covers the middle, so aim low to
    // float the character in the top part of the screen
    const portrait = window.innerHeight > window.innerWidth;
    const rr = portrait ? 6.2 : r;
    camTarget.set(
      pos.x + Math.sin(creatorAngle) * rr,
      pos.y + (portrait ? 0.5 : 1.1),
      pos.z + Math.cos(creatorAngle) * rr);
    camera.position.lerp(camTarget, Math.min(1, dt * 2.5));
    camera.lookAt(pos.x, pos.y + (portrait ? -1.2 : 0.5), pos.z);
  } else {
    // chase cam: gracefully swing round behind wherever she faces, so the
    // player always sees where they're going
    const dist = mode === 'water' ? 7.5 : 8.5;
    const height = mode === 'water' ? 2.6 : 3.4;
    camTarget.set(
      pos.x - Math.sin(charYaw) * dist,
      pos.y + height,
      pos.z - Math.cos(charYaw) * dist);
    camera.position.lerp(camTarget, Math.min(1, dt * 2.4));
    // never sink into the sea floor
    const camFloor = terrainHeight(camera.position.x, camera.position.z) + 0.5;
    if (camera.position.y < camFloor) camera.position.y = camFloor;
    camera.lookAt(pos.x, pos.y + 1, pos.z);
  }
}

// ---------------------------------------------------------------- sky & fog
const FOG_UNDER = new THREE.Color(0x10617f);
const FOG_ABOVE = new THREE.Color(0xbfe8ff);
const BG_UNDER = new THREE.Color(0x0e5a7d);
const BG_ABOVE = new THREE.Color(0x8fd4f0);
let wasUnder = null;
function updateAtmosphere() {
  const under = camera.position.y < 0;
  if (under !== wasUnder) {
    wasUnder = under;
    scene.fog.color.copy(under ? FOG_UNDER : FOG_ABOVE);
    scene.fog.density = under ? 0.014 : 0.0032;
    scene.background = (under ? BG_UNDER : BG_ABOVE).clone();
    audio.setUnderwater(under);
  }
}

// debug handle for automated play-testing
window.__mer = {
  net,
  get pos() { return { x: pos.x, y: pos.y, z: pos.z }; },
  get mode() { return mode; },
  get state() { return state; },
  setMove(x, z) { controls.debugMove = (x || z) ? { x, z } : null; },
  setYaw(y) { charYaw = y; },
  get yaw() { return charYaw; },
  setVertical(up, down) { controls.debugUp = up; controls.debugDown = down; },
  get dbg() { return { ..._dbg, vel: vel.toArray(), debugMove: controls.debugMove }; },
  get save() { return { ...save }; },
  get camo() { return camo; },
  get sites() { return pearlSystem.sites.map((s) => ({ type: s.type, pearls: s.pearls, cost: s.cost })); },
  char: character,
  shoot: doShoot,
  cycleBlueprint: doCycleBlueprint,
  toggleCamo,
  nasty,
  guardian,
  doBoost,
  doInteract,
  get boost() { return { ...boost }; },
  get quests() { return JSON.parse(JSON.stringify(save.quests)); },
  get questItemPos() { return questItem ? { ...questItem.pos } : null; },
  addCoins(n) { save.coins += n; refreshHud(); },
  addPearls(n) { save.pearls = Math.min(PEARL_CAP, save.pearls + n); refreshHud(); },
};

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let simT = 0;
function tick(dt) {
  simT += dt;
  const t = simT;

  _dbg.frames++;
  if (state === 'play') updatePlay(dt);
  else character.update(dt, { mode: mode === 'water' ? 'water' : 'land', speed: 0, vy: 0 });

  for (const u of world.updatables) u(t, dt);
  for (const s of schools) s.update(dt, t);
  pearlSystem.update(dt, t, pos, state === 'play');

  // ---- boost & the nasty fish ----
  tickBoost(dt);
  const floorHere = terrainHeight(pos.x, pos.z);
  const deep = floorHere < -15;
  const inWater = mode === 'water' && state === 'play';
  nastyCooldown = Math.max(0, nastyCooldown - dt);
  // one danger at a time: no roamer near an active quest-guardian fight
  const nearGuardian = guardian.active && guardian.guard
    && pos.distanceTo(guardian.guard.home) < 45;
  if (inWater && deep && !nasty.active && nastyCooldown === 0 && !nearGuardian) {
    nasty.spawn(pos);
    audio.buzz();
    toast('😨 A Nasty Fish is coming! 🚀 BOOST away or 🦎 hide!', 3500);
    if (!warnedDeep) warnedDeep = true;
  }
  if (nearGuardian && nasty.active && nasty.state !== 'leave') {
    nasty.state = 'leave';
    nasty.leaveT = 3;
  }
  const fishCtx = {
    playerPos: pos,
    playerInWater: inWater,
    deep,
    camo,
    onBite,
  };
  nasty.update(dt, t, fishCtx);
  guardian.update(dt, t, fishCtx);

  // ---- quests & village ----
  village.update(t);
  if (questItem) {
    questItem.sprite.position.y = questItem.pos.y + 0.2 + Math.sin(t * 2) * 0.3;
    questItem.pillar.material.opacity = 0.12 + Math.sin(t * 3) * 0.04;
    // pick the item up
    if (inWater && !save.quests.carrying && pos.distanceTo(questItem.pos) < 2.4) {
      const q = activeQuest();
      save.quests.carrying = true;
      clearQuestSite();
      audio.chime([659.25, 880, 1046.5]);
      burstSparkles(pos);
      toast(`🎉 You found the ${q.emoji} ${q.item}! Swim it back to ${q.giver}!`, 4000);
      updateMarkers();
      refreshQuestChip();
      saveGame();
    }
  }
  // quest tracker arrow
  {
    const q = activeQuest();
    if (q && state === 'play') {
      const target = save.quests.carrying
        ? { x: q.giverPos[0], z: q.giverPos[1] }
        : { x: q.spot[0], z: q.spot[1] };
      const targetAngle = Math.atan2(target.x - pos.x, target.z - pos.z);
      camera.getWorldDirection(_fwd);
      const camYaw = Math.atan2(_fwd.x, _fwd.z);
      const deg = (targetAngle - camYaw) * 180 / Math.PI;
      document.getElementById('questArrow').style.transform = `rotate(${deg.toFixed(0)}deg)`;
    }
  }
  // dollhouse view: fade the walls of whichever house the player is inside
  {
    let inside = -1;
    if (mode === 'land') {
      for (let i = 0; i < COLLIDERS.houses.length; i++) {
        const h = COLLIDERS.houses[i];
        const dx = pos.x - h.x, dz = pos.z - h.z;
        const c = Math.cos(h.ry), si = Math.sin(h.ry);
        const lx = dx * c - dz * si, lz = dx * si + dz * c;
        if (Math.abs(lx) < 3.2 * h.s && Math.abs(lz) < 2.9 * h.s) { inside = i; break; }
      }
    }
    if (inside !== insideHouse) {
      if (insideHouse >= 0) {
        for (const m of COLLIDERS.houses[insideHouse].fadeMats) {
          m.transparent = false; m.opacity = 1; m.needsUpdate = true;
        }
      }
      if (inside >= 0) {
        for (const m of COLLIDERS.houses[inside].fadeMats) {
          m.transparent = true; m.opacity = 0.32; m.needsUpdate = true;
        }
      }
      insideHouse = inside;
    }
    // same trick for the shipwreck: hull fades while exploring below decks
    const inWreck = mode === 'water' && pos.y < -8.5
      && Math.hypot(pos.x - WRECK.x, pos.z - WRECK.z) < WRECK.r;
    if (inWreck !== insideWreck) {
      for (const m of WRECK.mats) {
        m.transparent = inWreck; m.opacity = inWreck ? 0.35 : 1; m.needsUpdate = true;
      }
      insideWreck = inWreck;
    }
  }

  // talk / buy prompt
  const it = findInteract();
  if ((it && it.label) !== (currentInteract && currentInteract.label)) {
    currentInteract = it;
    if (it) {
      interactBtn.textContent = it.label;
      interactBtn.classList.remove('hidden');
    } else {
      interactBtn.classList.add('hidden');
    }
  }

  net.publish(pos, charYaw, character.form, mode, Math.hypot(vel.x, vel.z), vel.y, camo,
    ridingBuggy ? world.buggies.indexOf(ridingBuggy) : -1);
  net.update(dt);
  if (net.active) {
    const rp = net.getPot();                    // friend fed the pot? take it
    if (rp !== null && rp !== save.pot) { save.pot = rp; saveGame(); }
    // a friend driving a buggy drives OUR copy of that buggy too
    for (const r of net.remotes.values()) {
      const s = r.p.getState('s');
      if (!s || typeof s.v !== 'number' || s.v < 0) continue;
      const b = world.buggies[s.v];
      if (!b || b === ridingBuggy) continue;
      b.group.position.set(s.x, terrainHeight(s.x, s.z), s.z);
      b.group.rotation.y = s.yaw;
    }
  }

  updateSparkles(dt);
  updateCamera(dt);
  updateAtmosphere();

  renderer.render(scene, camera);
}
window.__mer.step = (n = 60, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) tick(dt);
};
// ---------------------------------------------------------------- pause & sleep
let paused = false;
let idleT = 0;                     // seconds since the last real input
const pausePanel = document.getElementById('pausePanel');
function setPaused(on, msg) {
  if (on === paused) return;
  paused = on;
  if (msg) document.getElementById('pauseMsg').textContent = msg;
  pausePanel.classList.toggle('hidden', !on);
  if (on) {
    saveGame();
    renderer.setAnimationLoop(null);          // stop rendering — saves battery
  } else {
    idleT = 0;
    clock.getDelta();                          // swallow the paused time
    renderer.setAnimationLoop(frame);
  }
}
document.getElementById('pauseBtn').addEventListener('click', () =>
  setPaused(true, 'Taking a little rest on a rock…'));
document.getElementById('pauseResume').addEventListener('click', () => setPaused(false));
document.getElementById('pauseExit').addEventListener('click', () => {
  saveGame();
  location.href = location.pathname;           // back to the title, save kept
});
// any real input wakes the idle timer
for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(ev, () => { idleT = 0; }, { passive: true });
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  // asleep after 5 quiet minutes: pause the game and the render loop
  if (state === 'play') {
    idleT += dt;
    if (idleT > 300) {
      setPaused(true, '💤 You drifted off for a nap… tap to wake up!');
      return;
    }
  }
  tick(dt);
}
renderer.setAnimationLoop(frame);
