/* ============================================================
   tools/harness.js — load the game's logic into Node

   The browser build is plain <script> files hanging off `window`, with
   all DOM work confined to ui.js / shop.js / fx.js. So the logic layer
   (util, content, charms, engine, game) can be loaded into a vm context
   with stubbed UI + localStorage + Sfx and driven headlessly.

   Usage:
     const { createGame } = require('./harness');
     const g = createGame();
     g.Game.newRun('SEED');
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');
const LOGIC_FILES = ['util.js', 'content.js', 'charms.js', 'content-extra.js', 'decks.js', 'meta.js', 'engine.js', 'game.js'];

/** Records everything the game tried to show, so tests can assert on it. */
function makeUIStub(bus) {
  const noop = function () {};
  return {
    toast: function (text, kind) { bus.toasts.push({ text: text, kind: kind }); },
    render: noop,
    refreshStats: noop,
    enterPlay: noop,
    animateRoll: noop,
    closeOverlay: noop,
    openOverlay: noop,
    btn: function () { return {}; },
    render_: noop,
    showBlindSelect: function () { bus.screen = 'blindSelect'; },
    showCashout: function (lines, total, noMoney) {
      bus.screen = 'cashout';
      bus.lastCashout = { lines: lines, total: total, noMoney: noMoney };
    },
    showShop: function () { bus.screen = 'shop'; },
    showGameOver: function () { bus.screen = 'gameover'; },
    showVictory: function () { bus.screen = 'victory'; },
    showRunInfo: noop,
    showOptions: noop,
    showHelp: noop,
    // a pack is "opened" by parking its options for the driver to choose from
    showPack: function (pack, options, pick) {
      bus.pendingPack = { pack: pack, options: options, pick: pick };
    },
    // die-targeting effects auto-target the first die unless the driver overrides
    openDicePicker: function (title, cb) {
      bus.dicePicks.push(title);
      cb(bus.dicePickIndex || 0);
    }
  };
}

function makeStorageStub() {
  const store = Object.create(null);
  return {
    _store: store,
    getItem: function (k) { return k in store ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    clear: function () { for (const k in store) delete store[k]; }
  };
}

function createGame(options) {
  options = options || {};
  const bus = {
    toasts: [], screen: null, pendingPack: null,
    dicePicks: [], dicePickIndex: 0, lastCashout: null
  };

  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.console = options.quiet ? { log: function () {}, warn: function () {}, error: console.error } : console;
  sandbox.localStorage = makeStorageStub();
  sandbox.UI = makeUIStub(bus);
  sandbox.Sfx = {
    play: function () {}, music: function () {}, stopMusic: function () {},
    ready: function () { return false; }, unlock: function () {}
  };
  sandbox.FX = { shake: function () {}, burst: function () {}, flash: function () {} };
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.requestAnimationFrame = function (fn) { return setTimeout(function () { fn(Date.now()); }, 16); };

  const ctx = vm.createContext(sandbox);
  for (const file of LOGIC_FILES) {
    const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    vm.runInContext(code, ctx, { filename: 'js/' + file });
  }

  sandbox.bus = bus;

  /* ---- convenience helpers for tests and the simulator ---- */
  sandbox.helpers = {
    /** Start a run and immediately enter its first blind. */
    beginRun: function (seed, opts) {
      sandbox.Game.newRun(seed, opts);
      sandbox.Game.startBlind();
      return sandbox.Game.run;
    },
    /** Force the dice to exact values (padding/truncating the pool as needed). */
    setDice: function (values) {
      const run = sandbox.Game.run;
      while (run.dice.length < values.length) run.dice.push(sandbox.Game.makeDie());
      while (run.dice.length > values.length) run.dice.pop();
      values.forEach(function (v, i) { run.dice[i].value = v; });
      return run.dice;
    },
    /** Preview a category without committing. */
    preview: function (catId) {
      return sandbox.E.preview(sandbox.Game.run, catId);
    },
    /** Score a category for real, returning the engine result. */
    commit: function (catId) {
      return sandbox.E.commitScore(sandbox.Game.run, catId);
    }
  };

  return sandbox;
}

module.exports = { createGame: createGame, LOGIC_FILES: LOGIC_FILES };
