// Co-op multiplayer via Playroom Kit: join-by-link rooms. A friend opens the
// shared URL (…#r=CODE), makes their own character, and appears in your sea.
// Only positions/looks are synced — each player keeps their own save, coins
// and quests (the shared community pot comes later with Supabase).
import { insertCoin, onPlayerJoin, myPlayer, getRoomCode, getParticipants } from 'playroomkit';
import { Character } from './character.js';
import { makeTextSprite } from './village.js';

export class Net {
  constructor() {
    this.active = false;
    this.starting = false;
    this.remotes = new Map();   // playerId -> { p, char, form, lookV }
    this._pubT = 0;
    this._lookV = 0;
  }

  count() { return this.remotes.size; }

  async start(scene, look) {
    if (this.active || this.starting) return this.shareLink();
    this.starting = true;
    try {
      await insertCoin({
        gameId: import.meta.env.VITE_PLAYROOM_GAME_ID,
        skipLobby: true,
        maxPlayersPerRoom: 6,
      });
    } finally {
      this.starting = false;
    }
    this.scene = scene;
    this.me = myPlayer();
    this.setLook(look);
    this.api = { getRoomCode, getParticipants };   // for automated tests
    onPlayerJoin((p) => {
      if (p.id === this.me.id) return;
      const r = { p, char: null, label: null, form: 'mer', lookV: -1 };
      this.remotes.set(p.id, r);
      p.onQuit(() => {
        if (r.char) this.scene.remove(r.char.group);
        this.remotes.delete(p.id);
        if (this.onFriends) this.onFriends(this.remotes.size);
      });
      if (this.onFriends) this.onFriends(this.remotes.size);
    });
    this.active = true;
    return this.shareLink();
  }

  // Playroom maintains the #r=CODE hash itself — build the link from it verbatim
  // (getRoomCode() strips the code's prefix character, so don't rebuild from it)
  shareLink() {
    return `${location.origin}${location.pathname}${location.hash}`;
  }

  setLook(look) {
    if (!this.me) return;
    this.me.setState('look', look, true);
    this.me.setState('lookV', ++this._lookV, true);
  }

  // ~10 Hz state broadcast; remotes interpolate between packets
  publish(pos, yaw, form, mode, speed, vy, camo) {
    if (!this.active) return;
    const now = performance.now();
    if (now - this._pubT < 100) return;
    this._pubT = now;
    this.me.setState('s', {
      x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2),
      yaw: +yaw.toFixed(3), f: form, m: mode,
      sp: +speed.toFixed(2), vy: +vy.toFixed(2), c: camo ? 1 : 0,
    });
  }

  update(dt) {
    if (!this.active) return;
    for (const r of this.remotes.values()) {
      const s = r.p.getState('s');
      if (!s) continue;
      if (!r.char) {
        const look = r.p.getState('look');
        if (!look) continue;
        r.char = new Character(look);
        r.char.group.position.set(s.x, s.y, s.z);
        r.char.group.rotation.y = s.yaw;
        r.lookV = r.p.getState('lookV') ?? 0;
        const name = r.p.getProfile()?.name || 'Sea Friend';
        r.label = makeTextSprite(`💙 ${name}`, { fontSize: 34 });
        r.label.position.y = 2.7;
        r.char.group.add(r.label);
        this.scene.add(r.char.group);
      }
      // friend re-visited the mirror → rebuild their avatar
      const lv = r.p.getState('lookV');
      if (lv !== r.lookV) { r.lookV = lv; r.char.setConfig(r.p.getState('look') || {}); }
      const g = r.char.group;
      const k = Math.min(1, dt * 8);
      g.position.x += (s.x - g.position.x) * k;
      g.position.y += (s.y - g.position.y) * k;
      g.position.z += (s.z - g.position.z) * k;
      let d = s.yaw - g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.rotation.y += d * k;
      if (s.f !== r.form) { r.form = s.f; r.char.setForm(s.f); }
      if (!!s.c !== r.char.camo) r.char.setCamouflage(!!s.c);
      r.char.update(dt, { mode: s.m, speed: s.sp, vy: s.vy });
    }
  }
}
