// Tiny procedural audio — no files needed. Gentle ocean wash + magic chimes.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // must be called from a user gesture
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    // looping filtered noise = ocean ambience
    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish noise
      d[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 800;
    const g = this.ctx.createGain();
    g.gain.value = 0.10;
    src.connect(this.filter); this.filter.connect(g); g.connect(this.master);
    src.start();

    // slow swell LFO on the ambience volume
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    lfo.start();
  }

  setUnderwater(under) {
    if (!this.ctx) return;
    const f = under ? 320 : 1100;
    this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4);
  }

  chime(notes = [523.25, 659.25, 783.99, 1046.5]) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0 + i * 0.09);
      g.gain.linearRampToValueAtTime(0.12, t0 + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.8);
      o.connect(g); g.connect(this.master);
      o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.9);
    });
  }

  splash() { this.chime([392, 329.63, 261.63]); }

  buzz() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(130, t0);
    o.frequency.exponentialRampToValueAtTime(55, t0 + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.36);
  }

  pop() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, t0);
    o.frequency.exponentialRampToValueAtTime(220, t0 + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.16);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }
}
