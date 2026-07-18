import { DEFAULT_CONFIG, GOLDEN } from './character.js';

const SKIN_COLORS = ['#fbe0c4', '#f3c9a5', '#eec39a', '#d9a066', '#b97a50', '#8d5524', '#5d3a1a', GOLDEN];
const SCALE_COLORS = ['#2ec4b6', '#4fc3f7', '#3f51b5', '#8e44ad', '#ff6fb5', '#e74c3c',
  '#ff9042', '#ffd23f', '#4caf50', '#a5f3e3', '#c0c0c0', '#22333b'];
const HAIR_COLORS = ['#1b1b1b', '#5a3620', '#a56a34', '#e8c56c', '#c0392b', '#6b3fa0', '#ff6fb5', '#4fc3f7', '#f5f5f5'];
const RAINBOW_CSS = 'conic-gradient(#ff5d8f, #ff9042, #ffd23f, #4caf50, #4fc3f7, #8e44ad, #ff5d8f)';

const STORAGE_KEY = 'merlife.character.v1';

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (e) { /* fresh start */ }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) { /* private mode */ }
}

// Builds the creator UI; calls onChange(cfg) live and onDive() for the big button.
// getUnlocks() is read on every rebuild so quest rewards appear when re-opened.
export function setupCreator(cfg, onChange, onDive, getUnlocks = () => ({})) {
  const apply = (patch) => {
    Object.assign(cfg, patch);
    saveConfig(cfg);
    onChange(cfg);
  };

  function segmented(elId, options, key) {
    const el = document.getElementById(elId);
    el.innerHTML = '';
    for (const [value, label] of options) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.value = value;
      if (cfg[key] === value) b.classList.add('active');
      b.addEventListener('click', () => {
        el.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        apply({ [key]: value });
      });
      el.appendChild(b);
    }
  }

  function swatches(elId, colors, key, withCustom, specials = []) {
    const el = document.getElementById(elId);
    el.innerHTML = '';
    const mark = (btn) => {
      el.querySelectorAll('.sw').forEach((x) => x.classList.remove('active'));
      if (btn) btn.classList.add('active');
    };
    const addSwatch = (value, css, title) => {
      const b = document.createElement('button');
      b.className = 'sw';
      b.style.background = css;
      b.title = title;
      if (String(cfg[key]).toLowerCase() === value.toLowerCase()) b.classList.add('active');
      b.addEventListener('click', () => { mark(b); apply({ [key]: value }); });
      el.appendChild(b);
    };
    for (const c of colors) {
      addSwatch(c, c === GOLDEN ? 'linear-gradient(135deg,#fff3b0,#ffd700 55%,#b8860b)' : c,
        c === GOLDEN ? 'Golden!' : c);
    }
    for (const s of specials) addSwatch(s.value, s.css, s.title);
    if (withCustom) {
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.value = /^#[0-9a-f]{6}$/i.test(cfg[key]) ? cfg[key] : '#2ec4b6';
      inp.title = 'Pick any colour!';
      inp.addEventListener('input', () => { mark(null); apply({ [key]: inp.value }); });
      el.appendChild(inp);
    }
  }

  function build() {
    const unlocks = getUnlocks();
    segmented('optKind', [['mermaid', '🧜‍♀️ Mermaid'], ['merman', '🧜‍♂️ Merman']], 'kind');
    segmented('optBody', [['fit', '💪 Fit'], ['soft', '🙂 Soft'], ['round', '🤗 Round'], ['pregnant', '🤰 Pregnant']], 'body');
    segmented('optHairStyle', [['long', 'Long hair'], ['short', 'Short hair']], 'hairStyle');
    swatches('optSkin', SKIN_COLORS, 'skin', false);
    swatches('optScales', SCALE_COLORS, 'scales', true, unlocks.rainbow
      ? [{ value: 'rainbow', css: RAINBOW_CSS, title: 'Prismatic rainbow scales!' }] : []);
    swatches('optHair', HAIR_COLORS, 'hair', true);
    // quest-reward extras
    const extrasTitle = document.getElementById('extrasTitle');
    const extrasEl = document.getElementById('optExtras');
    if (unlocks.crown) {
      extrasTitle.classList.remove('hidden');
      extrasEl.classList.remove('hidden');
      extrasEl.innerHTML = '';
      for (const [value, label] of [[false, 'No crown'], [true, '👑 Royal Crown']]) {
        const b = document.createElement('button');
        b.textContent = label;
        if (cfg.crown === value) b.classList.add('active');
        b.addEventListener('click', () => {
          extrasEl.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
          apply({ crown: value });
        });
        extrasEl.appendChild(b);
      }
    }
  }

  build();
  document.getElementById('diveBtn').addEventListener('click', onDive);
  return { refresh: build };
}
