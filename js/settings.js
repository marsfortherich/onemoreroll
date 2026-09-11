/* ============================================================
   settings.js — persisted player preferences

   Everything that changes how the game feels lives here, so audio,
   FX and the UI can all read one source of truth.
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'onemoreroll.settings.v1';
  const LEGACY_KEY = 'rollatro.settings.v1';   // pre-rename

  function prefersReducedMotion() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  const DEFAULTS = {
    master: 0.7,
    sfx: 0.8,
    music: 0.4,
    shake: true,
    particles: true,
    reducedMotion: prefersReducedMotion(),
    speed: 1,          // 1 = normal, 1.75 = fast, 3 = instant-ish
    highContrast: false,
    showPreview: true  // highlight which dice will score
  };

  let state = null;
  const listeners = [];

  function load() {
    let stored = {};
    try {
      stored = JSON.parse(
        global.localStorage.getItem(KEY) ||
        global.localStorage.getItem(LEGACY_KEY)) || {};
    } catch (e) { stored = {}; }
    state = {};
    for (const k in DEFAULTS) {
      state[k] = (stored && Object.prototype.hasOwnProperty.call(stored, k)) ? stored[k] : DEFAULTS[k];
    }
    // guard against a hand-edited or corrupted blob
    ['master', 'sfx', 'music'].forEach(function (k) {
      const n = Number(state[k]);
      state[k] = isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULTS[k];
    });
    const sp = Number(state.speed);
    state.speed = isFinite(sp) && sp > 0 ? Math.min(4, Math.max(0.5, sp)) : 1;
    return state;
  }

  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function get(key) {
    if (!state) load();
    return key === undefined ? state : state[key];
  }

  function set(key, value) {
    if (!state) load();
    state[key] = value;
    persist();
    apply();
    listeners.forEach(function (fn) { try { fn(key, value, state); } catch (e) {} });
  }

  function reset() {
    state = null;
    try { global.localStorage.removeItem(KEY); } catch (e) {}
    load(); apply();
    listeners.forEach(function (fn) { try { fn(null, null, state); } catch (e) {} });
  }

  function on(fn) { listeners.push(fn); }

  /** Push the visual settings onto the document so CSS can react. */
  function apply() {
    if (!state) load();
    const root = global.document && global.document.documentElement;
    if (!root) return;
    root.classList.toggle('reduced-motion', !!state.reducedMotion);
    root.classList.toggle('high-contrast', !!state.highContrast);
    root.style.setProperty('--anim-speed', String(1 / state.speed));
  }

  /** Scale an animation duration (ms) by the player's speed preference. */
  function ms(base) {
    if (!state) load();
    if (state.reducedMotion) return Math.min(base, 40);
    return Math.max(0, base / state.speed);
  }

  load();

  global.Settings = {
    get: get, set: set, reset: reset, on: on, apply: apply, ms: ms,
    DEFAULTS: DEFAULTS
  };
})(window);
