/* ============================================================
   util.js — seeded RNG, math + DOM helpers
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- seeded RNG (mulberry32 + string hash) ---------- */
  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  function RNG(seed) {
    this.seedString = String(seed);
    this.state = hashSeed(this.seedString) || 1;
  }
  RNG.prototype.next = function () {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** integer in [min, max] inclusive */
  RNG.prototype.int = function (min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  };
  RNG.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
  };
  /** true with probability num/den */
  RNG.prototype.chance = function (num, den) {
    return this.next() < num / den;
  };
  RNG.prototype.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  /** weighted pick: items are {weight:n} */
  RNG.prototype.weighted = function (items, weightFn) {
    const wf = weightFn || function (x) { return x.weight || 1; };
    let total = 0;
    for (const it of items) total += wf(it);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const it of items) {
      r -= wf(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  };
  RNG.prototype.save = function () { return { s: this.seedString, st: this.state }; };
  RNG.prototype.load = function (o) { this.seedString = o.s; this.state = o.st; };

  function randomSeedString() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }

  /* ---------- number formatting ---------- */
  function fmt(n) {
    if (n !== n) return '0';
    if (!isFinite(n)) return 'inf';
    const a = Math.abs(n);
    /* The suffixes below keep big numbers short and readable, but they run out
       at T: without this, a deep endless run prints "128000.00T". */
    if (a >= 1e15) return n.toExponential(2).replace('e+', 'e');
    if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e5) return Math.round(n / 1e3) + 'k';
    return String(Math.round(n * 100) / 100);
  }
  function fmtMult(n) {
    const r = Math.round(n * 100) / 100;
    return String(r);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ---------- combinations ---------- */
  const comboCache = {};
  /** all index-combinations of size k from n items */
  function combinations(n, k) {
    const key = n + ':' + k;
    if (comboCache[key]) return comboCache[key];
    const out = [];
    if (k > n) { comboCache[key] = out; return out; }
    const idx = [];
    (function rec(start) {
      if (idx.length === k) { out.push(idx.slice()); return; }
      for (let i = start; i < n; i++) { idx.push(i); rec(i + 1); idx.pop(); }
    })(0);
    comboCache[key] = out;
    return out;
  }

  /* ---------- tiny DOM helpers ---------- */
  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function on(node, ev, fn) { node.addEventListener(ev, fn); return node; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  global.U = {
    RNG: RNG, hashSeed: hashSeed, randomSeedString: randomSeedString,
    fmt: fmt, fmtMult: fmtMult, clamp: clamp, combinations: combinations,
    $: $, el: el, clear: clear, on: on, sleep: sleep
  };
})(window);
