const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));
export const SOUND_PROFILES = Object.freeze({
  "skill-ready":[880,1320,.16,.045,0,"sine",.4],
  "fire-impact": [70, 35, 0.28, 0.1, 0.25, "triangle", 0.12],
  "frost-impact": [2200, 1200, 0.14, 0.06, 0.04, "sine", 0.1],
  "lightning-impact": [130, 45, 0.07, 0.07, 0.14, "triangle", 0.09],
  "orbit-impact": [550, 750, 0.12, 0.05, 0.015, "sine", 0.15],
  attack: [180, 55, 0.11, 0.13, 0.08, "sawtooth", 0.12],
  hit: [220, 65, 0.085, 0.15, 0.16, "triangle", 0.045],
  critical: [1450, 540, 0.17, 0.16, 0.14, "triangle", 0.12],
  guard: [520, 300, 0.07, 0.07, 0.04, "triangle", 0.12],
  "guard-hit": [2200, 1500, 0.12, 0.16, 0.13, "sine", 0.1],
  "perfect-parry": [3600, 2200, 0.2, 0.22, 0.12, "sine", 0.18],
  counter: [330, 65, 0.22, 0.18, 0.22, "triangle", 0.2],
  fireball: [210, 65, 0.24, 0.09, 0.14, "sawtooth", 0.16],
  frost: [1350, 620, 0.3, 0.07, 0.08, "sine", 0.22],
  lightning: [1700, 110, 0.13, 0.09, 0.22, "square", 0.15],
  orbit: [660, 880, 0.16, 0.06, 0.015, "sine", 0.25],
  hurt: [125, 48, 0.18, 0.15, 0.12, "triangle", 0.18],
  dash: [280, 90, 0.13, 0.06, 0.12, "sine", 0.2],
  coin: [990, 1320, 0.08, 0.055, 0, "sine", 0.1],
  equip: [440, 880, 0.19, 0.085, 0.01, "triangle", 0.1],
  upgrade: [520, 1040, 0.3, 0.1, 0.015, "triangle", 0.2],
  start: [220, 440, 0.35, 0.09, 0.015, "sine", 0.5],
  stage: [290, 580, 0.38, 0.1, 0.03, "sine", 0.5],
  win: [440, 880, 0.6, 0.11, 0.01, "triangle", 0.7],
  over: [150, 42, 0.65, 0.09, 0.03, "triangle", 0.7],
  combo: [620, 1240, 0.18, 0.075, 0.01, "sine", 0.2],
  ui: [640, 490, 0.075, 0.045, 0, "sine", 0.045],
  step: [85, 45, 0.045, 0.025, 0.04, "triangle", 0.22],
  boss: [95, 38, 0.4, 0.15, 0.17, "triangle", 0.3],
});
const REGIONAL = {
  sanctum: [55, 82.4, 420],
  volcano: [49, 73.4, 170],
  tundra: [65.4, 98, 1300],
  forest: [58.3, 87.3, 570],
  ruins: [73.4, 110, 750],
  void: [46.2, 69.3, 330],
  throne: [51.9, 77.8, 270],
};
/** Original procedural sound, two mix buses and a bounded voice graph. */
export class Soundscape {
  constructor(game) {
    this.game = game;
    this.context = null;
    this.voices = new Set();
    this.last = new Map();
    this.region = "sanctum";
    this.effectsVolume = 0.7;
    this.backgroundVolume = 0.3;
    this.seed = 7979;
    this.peakVoices = 0;
    this.phase = "";
    this.nodes = [];
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  unlock() {
    if (this.game.muted) return false;
    try {
      if (!this.context) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return false;
        this.create(new C());
      }
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
      return this.context.state === "running";
    } catch {
      return false;
    }
  }
  create(context) {
    this.context = context;
    const c = context;
    this.master = c.createGain();
    this.effects = c.createGain();
    this.background = c.createGain();
    this.master.gain.value = this.game.muted ? 0 : 0.7;
    this.effects.gain.value = this.effectsVolume;
    this.background.gain.value = this.backgroundVolume * 0.65;
    this.compressor = c.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;
    this.effects.connect(this.compressor);
    this.background.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(c.destination);
    this.nodes.push(
      this.effects,
      this.background,
      this.compressor,
      this.master,
    );
    this.noise = c.createBuffer(1, Math.ceil(c.sampleRate * 2), c.sampleRate);
    const data = this.noise.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      const white = this.random() * 2 - 1;
      previous = (previous + white * 0.08) / 1.08;
      data[i] = white * 0.5 + previous * 0.5;
    }
    this.wind = c.createBufferSource();
    this.wind.buffer = this.noise;
    this.wind.loop = true;
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.Q.value = 0.45;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0.065;
    this.wind
      .connect(this.windFilter)
      .connect(this.windGain)
      .connect(this.background);
    this.wind.start();
    this.nodes.push(this.wind, this.windFilter, this.windGain);
    this.drones = [];
    for (let i = 0; i < 2; i++) {
      const osc = c.createOscillator(),
        gain = c.createGain();
      osc.type = i ? "triangle" : "sine";
      gain.gain.value = i ? 0.009 : 0.018;
      osc.connect(gain).connect(this.background);
      osc.start();
      this.drones.push(osc);
      this.nodes.push(osc, gain);
    }
    this.setVolumes(this.effectsVolume, this.backgroundVolume);
    this.setMuted(this.game.muted);
    this.setRegion(this.region);
  }
  setVolumes(effects, background) {
    this.effectsVolume = clamp(effects);
    this.backgroundVolume = clamp(background);
    if (this.context) {
      this.effects.gain.setTargetAtTime(
        this.effectsVolume,
        this.context.currentTime,
        0.015,
      );
      this.background.gain.setTargetAtTime(
        this.backgroundVolume *
          (this.phase === "paused"
            ? 0.22
            : ["playing", "camp", "menu", ""].includes(this.phase)
              ? 0.65
              : 0.35),
        this.context.currentTime,
        0.03,
      );
    }
  }
  setMuted(muted) {
    if (this.context)
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.7,
        this.context.currentTime,
        0.015,
      );
  }
  setRegion(id) {
    this.region = REGIONAL[id] ? id : "sanctum";
    if (!this.context) return;
    const p = REGIONAL[this.region],
      now = this.context.currentTime;
    this.drones.forEach((o, i) => o.frequency.setTargetAtTime(p[i], now, 1));
    this.windFilter.frequency.setTargetAtTime(p[2], now, 1);
  }
  play(type, position = null, options = {}) {
    const c = this.context;
    if (
      this.game.muted ||
      !c ||
      c.state !== "running" ||
      this.effectsVolume <= 0
    )
      return false;
    const p = SOUND_PROFILES[type] || SOUND_PROFILES.ui,
      now = c.currentTime,
      important = [
        "perfect-parry",
        "counter",
        "critical",
        "boss",
        "win",
        "over",
      ].includes(type);
    if (now - (this.last.get(type) ?? -Infinity) < p[6]) return false;
    if (this.voices.size >= (important ? 16 : 12)) {
      if (!important) return false;
      const old = [...this.voices].find((v) => !v.important);
      if (!old) return false;
      this.stopVoice(old);
    }
    this.last.set(type, now);
    const nodes = [],
      sources = [],
      gain = c.createGain();
    nodes.push(gain);
    const duration = p[2],
      weapon = this.game.stats?.weaponId,
      scale =
        type === "attack"
          ? weapon === "greatsword"
            ? 0.72
            : weapon === "tempest"
              ? 1.25
              : 1
          : 1;
    const amplitude = Number.isFinite(options.volume)
        ? Math.min(1, options.volume * 12)
        : 1,
      osc = c.createOscillator();
    osc.type = p[5];
    osc.frequency.setValueAtTime((options.note || p[0]) * scale, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(25, p[1] * scale),
      now + duration,
    );
    const tone = c.createGain();
    tone.gain.value = p[3] * amplitude;
    osc.connect(tone).connect(gain);
    nodes.push(osc, tone);
    sources.push(osc);
    if (p[4]) {
      const noise = c.createBufferSource(),
        filter = c.createBiquadFilter(),
        level = c.createGain();
      noise.buffer = this.noise;
      filter.type = ["fireball", "attack", "dash"].includes(type)
        ? "lowpass"
        : "highpass";
      filter.frequency.value =
        type === "attack" ? 1700 : type === "fireball" ? 620 : 1200;
      level.gain.value = p[4] * amplitude;
      noise.connect(filter).connect(level).connect(gain);
      nodes.push(noise, filter, level);
      sources.push(noise);
    }
    if (type === "perfect-parry" || type === "guard-hit") {
      const overtone = c.createOscillator(),
        level = c.createGain();
      overtone.type = "sine";
      overtone.frequency.value = type === "perfect-parry" ? 4820 : 2770;
      level.gain.value = 0.075;
      overtone.connect(level).connect(gain);
      nodes.push(overtone, level);
      sources.push(overtone);
    }
    let output = gain;
    if (position && this.game.player) {
      const dx = position.x - this.game.player.position.x,
        dz = position.z - this.game.player.position.z,
        d = Math.hypot(dx, dz),
        yaw = this.game.view?.yaw || 0,
        panner = c.createStereoPanner?.();
      if (panner) {
        panner.pan.value = Math.max(
          -0.85,
          Math.min(
            0.85,
            (-dx * Math.cos(yaw) + dz * Math.sin(yaw)) / Math.max(2, d),
          ),
        );
        gain.connect(panner);
        nodes.push(panner);
        output = panner;
      }
      gain.gain.setValueAtTime(Math.max(0.15, 1 - d / 35), now);
    } else gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    output.connect(this.effects);
    const voice = {
      nodes,
      sources,
      important,
      remaining: sources.length,
      stopped: false,
    };
    this.voices.add(voice);
    this.peakVoices = Math.max(this.peakVoices, this.voices.size);
    sources.forEach((s) => {
      s.onended = () => {
        if (--voice.remaining <= 0) this.stopVoice(voice);
      };
      s.start(now);
      s.stop(now + duration + 0.01);
    });
    return true;
  }
  stopVoice(v) {
    if (v.stopped) return;
    v.stopped = true;
    this.voices.delete(v);
    for (const s of v.sources) {
      try {
        s.stop();
      } catch {}
    }
    for (const n of v.nodes) {
      try {
        n.disconnect();
      } catch {}
    }
  }
  update() {
    const position = this.game.player?.position;
    if (position) {
      const d = Math.hypot(
        position.x - (this.lastX ?? position.x),
        position.z - (this.lastZ ?? position.z),
      );
      this.lastX = position.x;
      this.lastZ = position.z;
      if (d < 3 && !(this.game.dashTime > 0)) {
        this.stepDistance = (this.stepDistance || 0) + d;
        if (this.stepDistance > 2.15) {
          this.stepDistance = 0;
          this.play("step", position);
        }
      } else this.stepDistance = 0;
    }
    const region = this.game.camp?.active
      ? "sanctum"
      : this.game.sideAreas?.active
        ? "void"
        : this.game.regionId;
    if (region && region !== this.region) this.setRegion(region);
    const phase = this.game._state.phase;
    if (this.context && phase !== this.phase) {
      this.phase = phase;
      const level =
        phase === "paused"
          ? 0.22
          : ["playing", "camp", "menu"].includes(phase)
            ? 0.65
            : 0.35;
      this.background.gain.setTargetAtTime(
        this.backgroundVolume * level,
        this.context.currentTime,
        0.15,
      );
    }
  }
  reset() {
    for (const v of [...this.voices]) this.stopVoice(v);
    this.last.clear();
  }
  dispose() {
    this.reset();
    for (const n of this.nodes) {
      try {
        n.stop?.();
        n.disconnect();
      } catch {}
    }
    this.nodes.length = 0;
    if (this.context) this.context.close().catch(() => {});
    this.context = null;
  }
}
