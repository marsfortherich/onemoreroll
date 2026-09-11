/* ============================================================
   audio.js — procedural sound and music (WebAudio, zero assets)

   Every sound is synthesised at runtime from oscillators and noise,
   so the game ships with no audio files and no licensing questions.

     Sfx.unlock()          create/resume the context (needs a gesture)
     Sfx.play(name, opts)  fire a one-shot
     Sfx.music(mode)       'menu' | 'play' | 'shop' | 'boss' | null
     Sfx.setVolumes()      re-read Settings
   ============================================================ */
(function (global) {
  'use strict';

  let ctx = null;
  let master = null, sfxBus = null, musicBus = null;
  let available = true;
  let unlocked = false;

  /* ---------------------------------------------------------
     graph
     --------------------------------------------------------- */
  function build() {
    if (ctx || !available) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { available = false; return null; }
    try {
      ctx = new AC();
    } catch (e) { available = false; return null; }

    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 8;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;

    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    setVolumes();
    return ctx;
  }

  function setVolumes() {
    if (!ctx) return;
    const s = Settings.get();
    master.gain.value = s.master;
    sfxBus.gain.value = s.sfx;
    musicBus.gain.value = s.music * 0.9;
  }

  function unlock() {
    build();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
    return true;
  }
  function ready() { return !!ctx && unlocked && ctx.state === 'running'; }
  function t0() { return ctx.currentTime; }

  /* ---------------------------------------------------------
     tiny synth toolkit
     --------------------------------------------------------- */
  const noiseBuffers = {};
  function noiseBuffer(seconds) {
    const key = String(seconds);
    if (noiseBuffers[key]) return noiseBuffers[key];
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers[key] = buf;
    return buf;
  }

  /**
   * One oscillator voice with an AD envelope and optional pitch/filter sweeps.
   */
  function tone(o) {
    if (!ctx) return;
    const when = (o.when || 0) + t0();
    const dur = o.dur || 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, when);
    if (o.freqTo && o.freqTo !== o.freq) {
      if (o.glide === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), when + dur);
      else osc.frequency.linearRampToValueAtTime(o.freqTo, when + dur);
    }
    if (o.detune) osc.detune.setValueAtTime(o.detune, when);

    const peak = o.gain === undefined ? 0.25 : o.gain;
    const atk = o.attack === undefined ? 0.004 : o.attack;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + atk);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.cutoff || 1200, when);
      if (o.cutoffTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.cutoffTo), when + dur);
      if (o.q) f.Q.value = o.q;
      node.connect(f); node = f;
    }
    node.connect(gain);
    gain.connect(o.bus || sfxBus);

    osc.start(when);
    osc.stop(when + dur + 0.03);
    osc.onended = function () { try { gain.disconnect(); } catch (e) {} };
  }

  /** A burst of filtered noise — clicks, swishes, shatters, hats. */
  function noise(o) {
    if (!ctx) return;
    const when = (o.when || 0) + t0();
    const dur = o.dur || 0.08;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(Math.max(0.05, dur + 0.02));
    const gain = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1400, when);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.freqTo), when + dur);
    f.Q.value = o.q === undefined ? 1 : o.q;

    const peak = o.gain === undefined ? 0.2 : o.gain;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + (o.attack || 0.003));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    src.connect(f); f.connect(gain); gain.connect(o.bus || sfxBus);
    src.start(when);
    src.stop(when + dur + 0.02);
    src.onended = function () { try { gain.disconnect(); } catch (e) {} };
  }

  const mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  /* ---------------------------------------------------------
     the sound bank
     --------------------------------------------------------- */
  const BANK = {
    click: function () {
      tone({ type: 'square', freq: 760, freqTo: 620, dur: 0.045, gain: 0.10, filter: 'lowpass', cutoff: 2600 });
    },
    tick: function () {
      noise({ dur: 0.028, freq: 2600, q: 3, gain: 0.06 });
    },
    hover: function () {
      tone({ type: 'sine', freq: 1180, dur: 0.035, gain: 0.035 });
    },
    back: function () {
      tone({ type: 'square', freq: 520, freqTo: 380, dur: 0.07, gain: 0.09, filter: 'lowpass', cutoff: 1800 });
    },

    /* --- dice --- */
    diceRoll: function (o) {
      const n = (o && o.count) || 5;
      for (let i = 0; i < Math.min(n, 7); i++) {
        const w = 0.012 * i + Math.random() * 0.05;
        noise({ when: w, dur: 0.05, filter: 'bandpass', freq: 900 + Math.random() * 1400, q: 2.5, gain: 0.11 });
        tone({ when: w, type: 'triangle', freq: 190 + Math.random() * 120, freqTo: 90, dur: 0.06, gain: 0.05 });
      }
      noise({ dur: 0.22, filter: 'highpass', freq: 1800, freqTo: 700, gain: 0.05 });
    },
    hold: function () {
      tone({ type: 'triangle', freq: 620, freqTo: 880, dur: 0.06, gain: 0.10 });
      noise({ dur: 0.03, freq: 3000, q: 4, gain: 0.05 });
    },
    release: function () {
      tone({ type: 'triangle', freq: 780, freqTo: 520, dur: 0.06, gain: 0.08 });
    },

    /* --- scoring --- */
    chip: function (o) {
      // rises as the counter climbs, like a ratchet
      const step = Math.min((o && o.index) || 0, 26);
      const f = mtof(64 + step * 0.85);
      tone({ type: 'sine', freq: f, dur: 0.075, gain: 0.16, filter: 'lowpass', cutoff: 5200 });
      noise({ dur: 0.02, freq: 4200, q: 4, gain: 0.03 });
    },
    mult: function (o) {
      const step = Math.min((o && o.index) || 0, 18);
      tone({ type: 'triangle', freq: mtof(52 + step * 0.7), freqTo: mtof(45 + step * 0.7), dur: 0.14, gain: 0.2, glide: 'exp' });
      noise({ dur: 0.04, filter: 'lowpass', freq: 900, gain: 0.06 });
    },
    xmult: function () {
      tone({ type: 'sawtooth', freq: 196, dur: 0.26, gain: 0.13, filter: 'lowpass', cutoff: 480, cutoffTo: 3200, q: 6 });
      tone({ type: 'sawtooth', freq: 196, detune: 14, dur: 0.26, gain: 0.11, filter: 'lowpass', cutoff: 520, cutoffTo: 3000, q: 6 });
      tone({ type: 'sine', freq: 98, freqTo: 74, dur: 0.3, gain: 0.16, glide: 'exp' });
    },
    slam: function (o) {
      const power = Math.min((o && o.power) || 0, 1);
      tone({ type: 'sine', freq: 150, freqTo: 38, dur: 0.42, gain: 0.32, glide: 'exp' });
      noise({ dur: 0.3, filter: 'lowpass', freq: 2600, freqTo: 220, gain: 0.16 + power * 0.1 });
      [0, 4, 7, 12].forEach(function (semi, i) {
        tone({ when: 0.02 + i * 0.035, type: 'triangle', freq: mtof(69 + semi), dur: 0.3, gain: 0.09 });
      });
    },
    scratch: function () {
      noise({ dur: 0.3, filter: 'bandpass', freq: 1600, freqTo: 260, q: 1.4, gain: 0.14 });
      tone({ type: 'sawtooth', freq: 180, freqTo: 70, dur: 0.34, gain: 0.10, filter: 'lowpass', cutoff: 900 });
    },
    shatter: function () {
      noise({ dur: 0.34, filter: 'highpass', freq: 2400, freqTo: 5200, gain: 0.16 });
      for (let i = 0; i < 5; i++) {
        tone({ when: i * 0.028, type: 'sine', freq: 2200 + Math.random() * 2600, dur: 0.09, gain: 0.06 });
      }
    },

    /* --- money and shop --- */
    coin: function () {
      tone({ type: 'sine', freq: 1244, dur: 0.1, gain: 0.14 });
      tone({ when: 0.055, type: 'sine', freq: 1864, dur: 0.16, gain: 0.12 });
      noise({ dur: 0.05, freq: 5200, q: 6, gain: 0.04 });
    },
    buy: function () {
      tone({ type: 'square', freq: 520, dur: 0.05, gain: 0.08, filter: 'lowpass', cutoff: 2200 });
      tone({ when: 0.05, type: 'sine', freq: 1046, dur: 0.12, gain: 0.13 });
      tone({ when: 0.11, type: 'sine', freq: 1568, dur: 0.16, gain: 0.11 });
    },
    sell: function () {
      tone({ type: 'sine', freq: 880, freqTo: 440, dur: 0.18, gain: 0.12, glide: 'exp' });
      noise({ when: 0.02, dur: 0.06, freq: 1800, gain: 0.05 });
    },
    denied: function () {
      tone({ type: 'square', freq: 200, freqTo: 150, dur: 0.14, gain: 0.10, filter: 'lowpass', cutoff: 900 });
    },
    cardFlip: function () {
      noise({ dur: 0.11, filter: 'bandpass', freq: 2600, freqTo: 900, q: 1.2, gain: 0.11 });
    },
    packOpen: function () {
      noise({ dur: 0.34, filter: 'bandpass', freq: 700, freqTo: 3400, q: 1, gain: 0.14 });
      [0, 5, 9, 12, 16].forEach(function (s, i) {
        tone({ when: 0.06 + i * 0.05, type: 'triangle', freq: mtof(72 + s), dur: 0.22, gain: 0.08 });
      });
    },
    levelUp: function () {
      [0, 4, 7].forEach(function (s, i) {
        tone({ when: i * 0.06, type: 'triangle', freq: mtof(69 + s), dur: 0.26, gain: 0.11 });
      });
      noise({ dur: 0.2, filter: 'highpass', freq: 3000, freqTo: 6000, gain: 0.04 });
    },

    /* --- structure --- */
    blindStart: function () {
      tone({ type: 'sine', freq: 110, freqTo: 55, dur: 0.5, gain: 0.26, glide: 'exp' });
      noise({ dur: 0.5, filter: 'lowpass', freq: 400, freqTo: 120, gain: 0.12 });
      tone({ when: 0.1, type: 'sawtooth', freq: 220, freqTo: 440, dur: 0.4, gain: 0.07, filter: 'lowpass', cutoff: 700, cutoffTo: 2400 });
    },
    bossStart: function () {
      tone({ type: 'sawtooth', freq: 82, dur: 0.9, gain: 0.18, filter: 'lowpass', cutoff: 300, cutoffTo: 1400, q: 8 });
      tone({ type: 'sawtooth', freq: 82.5, detune: -18, dur: 0.9, gain: 0.16, filter: 'lowpass', cutoff: 320, q: 8 });
      tone({ when: 0.45, type: 'triangle', freq: mtof(56), dur: 0.7, gain: 0.12 });
      noise({ dur: 0.7, filter: 'lowpass', freq: 900, freqTo: 140, gain: 0.13 });
    },
    win: function () {
      [0, 4, 7, 12, 16, 19].forEach(function (s, i) {
        tone({ when: i * 0.075, type: 'triangle', freq: mtof(65 + s), dur: 0.45, gain: 0.13 });
        tone({ when: i * 0.075, type: 'sine', freq: mtof(53 + s), dur: 0.45, gain: 0.09 });
      });
      noise({ when: 0.1, dur: 0.6, filter: 'highpass', freq: 2000, freqTo: 7000, gain: 0.05 });
    },
    lose: function () {
      [0, -3, -7, -12].forEach(function (s, i) {
        tone({ when: i * 0.16, type: 'sawtooth', freq: mtof(57 + s), dur: 0.6, gain: 0.13, filter: 'lowpass', cutoff: 1100, cutoffTo: 300 });
      });
      tone({ when: 0.5, type: 'sine', freq: 70, freqTo: 40, dur: 1.1, gain: 0.2, glide: 'exp' });
    },
    victory: function () {
      [0, 7, 12, 16, 19, 24].forEach(function (s, i) {
        tone({ when: i * 0.1, type: 'triangle', freq: mtof(60 + s), dur: 0.7, gain: 0.14 });
      });
      [0, 4, 7, 12].forEach(function (s) {
        tone({ when: 0.62, type: 'sawtooth', freq: mtof(60 + s), dur: 1.4, gain: 0.07, filter: 'lowpass', cutoff: 2600 });
      });
    }
  };

  function play(name, opts) {
    if (!available) return;
    if (!ctx) { if (!unlocked) return; build(); }
    if (!ctx || ctx.state !== 'running') return;
    const fn = BANK[name];
    if (!fn) return;
    try { fn(opts || {}); } catch (e) { /* never let audio break the game */ }
  }

  /* ---------------------------------------------------------
     procedural music
     --------------------------------------------------------- */
  const MODES = {
    menu: {
      bpm: 76, pad: 0.055, bass: 0.075, hat: 0, pluck: 0.045,
      chords: [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]]
    },
    play: {
      bpm: 92, pad: 0.05, bass: 0.085, hat: 0.03, pluck: 0.05,
      chords: [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]]
    },
    shop: {
      bpm: 80, pad: 0.055, bass: 0.07, hat: 0.022, pluck: 0.055,
      chords: [[50, 57, 60, 65], [55, 59, 62, 65], [48, 55, 59, 64], [57, 60, 64, 67]]
    },
    boss: {
      bpm: 104, pad: 0.06, bass: 0.1, hat: 0.035, pluck: 0.04,
      chords: [[45, 48, 52], [44, 48, 51], [43, 46, 50], [40, 47, 56]]
    }
  };

  let musicMode = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;

  function padVoice(notes, when, dur, gain) {
    notes.forEach(function (n, i) {
      tone({
        when: when, type: 'sawtooth', freq: mtof(n + 12), dur: dur,
        gain: gain * (i === 0 ? 1 : 0.75), attack: 0.35,
        filter: 'lowpass', cutoff: 620, cutoffTo: 900, q: 2, bus: musicBus, detune: i * 6 - 6
      });
    });
  }

  function schedule() {
    if (!ctx || !musicMode) return;
    const cfg = MODES[musicMode];
    const spb = 60 / cfg.bpm;
    const stepDur = spb / 2;               // eighth notes
    const lookahead = 0.35;

    while (nextTime < ctx.currentTime + lookahead) {
      const when = Math.max(0, nextTime - ctx.currentTime);
      const bar = Math.floor(step / 8) % cfg.chords.length;
      const inBar = step % 8;
      const chord = cfg.chords[bar];

      if (inBar === 0) {
        padVoice(chord, when, spb * 3.6, cfg.pad);
        tone({ when: when, type: 'triangle', freq: mtof(chord[0] - 12), dur: spb * 1.1, gain: cfg.bass, filter: 'lowpass', cutoff: 420, bus: musicBus });
      }
      if (inBar === 4) {
        tone({ when: when, type: 'triangle', freq: mtof(chord[0] - 12), dur: spb * 0.7, gain: cfg.bass * 0.75, filter: 'lowpass', cutoff: 420, bus: musicBus });
      }
      if (cfg.hat && (inBar % 2 === 1)) {
        noise({ when: when, dur: 0.035, filter: 'highpass', freq: 6800, gain: cfg.hat, bus: musicBus });
      }
      if (cfg.pluck && (inBar === 2 || inBar === 5 || inBar === 7)) {
        const note = chord[(step + inBar) % chord.length] + 12;
        tone({ when: when, type: 'triangle', freq: mtof(note), dur: spb * 0.85, gain: cfg.pluck, filter: 'lowpass', cutoff: 2600, bus: musicBus });
      }

      nextTime += stepDur;
      step++;
    }
  }

  function music(mode) {
    if (!available) return;
    if (mode === musicMode) return;
    musicMode = mode;
    if (!mode) { stopMusic(); return; }
    build();
    if (!ctx || !unlocked) return;
    if (Settings.get('music') <= 0) return;
    if (!timer) {
      step = 0;
      nextTime = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 60);
    }
  }

  function stopMusic() {
    if (timer) { clearInterval(timer); timer = null; }
    musicMode = null;
  }

  /* volume changes take effect immediately, and music can be toggled live */
  Settings.on(function (key) {
    setVolumes();
    if (key === 'music') {
      const v = Settings.get('music');
      if (v <= 0) { const m = musicMode; stopMusic(); musicMode = m; }
      else if (!timer && musicMode) { const m = musicMode; musicMode = null; music(m); }
    }
  });

  global.Sfx = {
    unlock: unlock, ready: ready, play: play,
    music: music, stopMusic: stopMusic, setVolumes: setVolumes,
    get available() { return available; },
    get mode() { return musicMode; }
  };
})(window);
