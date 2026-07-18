// Keyboard + touch input. getMove() returns {x, z} in [-1,1] (screen space:
// x = right, z = forward/up-on-screen), plus up/down booleans.
export class Controls {
  constructor() {
    this.keys = {};
    this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.touchUp = false;
    this.touchDown = false;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });

    // ---- touch joystick (left half of screen) ----
    const stickEl = document.getElementById('stick');
    const knobEl = document.getElementById('stickKnob');
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) document.body.classList.add('touch');

    const onStart = (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.55 && this.stick.id === null &&
            !t.target.closest('button') && !t.target.closest('#creatorPanel')) {
          this.stick.id = t.identifier;
          this.stick.ox = t.clientX; this.stick.oy = t.clientY;
          this.stick.x = 0; this.stick.y = 0;
          stickEl.style.display = 'block';
          stickEl.style.left = (t.clientX - 60) + 'px';
          stickEl.style.top = (t.clientY - 60) + 'px';
          knobEl.style.transform = 'translate(-50%,-50%)';
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          const dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy;
          const len = Math.hypot(dx, dy), max = 52;
          const k = len > max ? max / len : 1;
          this.stick.x = (dx * k) / max;
          this.stick.y = (dy * k) / max;
          knobEl.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
          e.preventDefault();
        }
      }
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          this.stick.id = null; this.stick.x = 0; this.stick.y = 0;
          stickEl.style.display = 'none';
        }
      }
    };
    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    // ---- up / down buttons ----
    const bindBtn = (id, prop) => {
      const el = document.getElementById(id);
      const set = (v) => (e) => {
        this[prop] = v;
        el.classList.toggle('pressed', v);
        e.preventDefault();
      };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('touchend', set(false));
      el.addEventListener('touchcancel', set(false));
      el.addEventListener('mousedown', set(true));
      el.addEventListener('mouseup', set(false));
    };
    bindBtn('btnUp', 'touchUp');
    bindBtn('btnDown', 'touchDown');
  }

  getMove() {
    let x = 0, z = 0;
    if (this.debugMove) { x += this.debugMove.x; z += this.debugMove.z; }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z -= 1;
    x += this.stick.x;
    z -= this.stick.y; // screen up = forward
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  get up() { return !!(this.keys['Space'] || this.touchUp || this.debugUp); }
  get down() { return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyC'] || this.touchDown || this.debugDown); }
}
