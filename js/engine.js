/* ============================================================
   engine.js — category evaluation + the scoring pipeline
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------
     Category evaluation over an exact hand of dice values.
     Returns { valid, idx } where idx are indices *within* vals
     that contribute chips.
     --------------------------------------------------------- */
  function evaluate(vals, catId) {
    const n = vals.length;
    const all = [];
    for (let i = 0; i < n; i++) all.push(i);
    const cnt = {};
    vals.forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; });
    const cat = C.CAT_BY_ID[catId];

    function maxOfAKind() {
      let m = 0;
      for (const k in cnt) if (cnt[k] > m) m = cnt[k];
      return m;
    }
    function runStart(len) {
      const uniq = Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; });
      for (let s = 0; s <= uniq.length - len; s++) {
        let ok = true;
        for (let j = 1; j < len; j++) if (uniq[s + j] !== uniq[s] + j) { ok = false; break; }
        if (ok) return uniq[s];
      }
      return null;
    }
    function pickRun(start, len) {
      const idx = [];
      for (let v = start; v < start + len; v++) {
        for (let i = 0; i < n; i++) {
          if (vals[i] === v && idx.indexOf(i) === -1) { idx.push(i); break; }
        }
      }
      return idx;
    }

    if (cat.section === 'upper') {
      const idx = [];
      for (let i = 0; i < n; i++) if (vals[i] === cat.face) idx.push(i);
      return { valid: idx.length > 0, idx: idx };
    }
    switch (catId) {
      case 'threeKind': return { valid: maxOfAKind() >= 3, idx: all };
      case 'fourKind':  return { valid: maxOfAKind() >= 4, idx: all };
      case 'fullHouse': {
        const c = Object.keys(cnt).map(function (k) { return cnt[k]; }).sort(function (a, b) { return b - a; });
        const ok = (c[0] === 5) || (c[0] === 3 && c[1] === 2);
        return { valid: ok, idx: all };
      }
      case 'smallStraight': {
        const s = runStart(4);
        return s === null ? { valid: false, idx: [] } : { valid: true, idx: pickRun(s, 4) };
      }
      case 'largeStraight': {
        const s = runStart(5);
        return s === null ? { valid: false, idx: [] } : { valid: true, idx: pickRun(s, 5) };
      }
      case 'fiveKind':   return { valid: maxOfAKind() >= 5, idx: all };
      case 'chance':    return { valid: true, idx: all };
      default:          return { valid: false, idx: [] };
    }
  }

  /* ---------------------------------------------------------
     Level helpers
     --------------------------------------------------------- */
  function levelOf(run, catId) {
    let lv = run.levels[catId] || 1;
    if (CH.hasPassive(run, 'levelBoost')) lv += 1;
    return Math.max(1, lv);
  }
  function baseValues(run, catId) {
    const cat = C.CAT_BY_ID[catId];
    const lv = levelOf(run, catId);
    let chips = cat.chips + (lv - 1) * cat.cpl;
    let mult = cat.mult + (lv - 1) * cat.mpl;
    const mods = (run.blind && run.blind.mods) || {};
    if (mods.halveBase) { chips = Math.ceil(chips / 2); mult = Math.max(1, Math.ceil(mult / 2)); }
    return { chips: chips, mult: mult, level: lv };
  }

  /* ---------------------------------------------------------
     Category availability under boss debuffs / usage
     --------------------------------------------------------- */
  function catStatus(run, catId) {
    const b = run.blind;
    if (!b) return 'open';
    if (b.used[catId]) return 'used';
    if (b.locked && b.locked.indexOf(catId) !== -1) return 'locked';
    return 'open';
  }

  /* ---------------------------------------------------------
     THE PIPELINE
     scoreWith(run, catId, diceSubsetIdx, opts)
       diceSubsetIdx : indices into run.dice forming the 5-die hand
       opts.commit   : apply randomness, money and permanent state
     --------------------------------------------------------- */
  function scoreWith(run, catId, handIdx, opts) {
    opts = opts || {};
    const commit = !!opts.commit;
    const dice = run.dice;
    const mods = (run.blind && run.blind.mods) || {};
    const cat = C.CAT_BY_ID[catId];
    const base = baseValues(run, catId);

    const handVals = handIdx.map(function (i) { return dice[i].value; });
    const ev = evaluate(handVals, catId);

    // scoring set: evaluated dice, plus every Stone die in the pool
    const scoringIdx = [];
    if (ev.valid) ev.idx.forEach(function (li) { scoringIdx.push(handIdx[li]); });
    for (let i = 0; i < dice.length; i++) {
      if (dice[i].enhancement === 'stone' && scoringIdx.indexOf(i) === -1 && !mods.nullifyDice) {
        scoringIdx.push(i);
      }
    }
    scoringIdx.sort(function (a, b) { return a - b; });

    const heldIdx = [];
    for (let i = 0; i < dice.length; i++) if (scoringIdx.indexOf(i) === -1) heldIdx.push(i);

    const log = [];
    const shattered = [];
    const sectionDead = mods.deadSection && cat.section === mods.deadSection;

    const ctx = {
      run: run, cat: cat, level: base.level, commit: commit,
      chips: base.chips, mult: base.mult,
      scoring: scoringIdx.map(function (i) { return dice[i]; }),
      held: heldIdx.map(function (i) { return dice[i]; }),
      scoringIdx: scoringIdx, heldIdx: heldIdx,
      rerollsUsed: run.blind ? run.blind.rerollsUsed : 0,
      turnIndex: run.blind ? run.blind.turnIndex : 0,
      turnsLeft: run.blind ? run.blind.turnsLeft : 1,
      money: 0,
      log: log,
      addChips: function (n, src) {
        if (!n) return;
        this.chips += n; log.push({ t: 'c', v: n, src: src, chips: this.chips, mult: this.mult });
      },
      addMult: function (n, src) {
        if (!n) return;
        this.mult += n; log.push({ t: 'm', v: n, src: src, chips: this.chips, mult: this.mult });
      },
      xmult: function (n, src) {
        if (n === 1 || !n) return;
        this.mult *= n; log.push({ t: 'x', v: n, src: src, chips: this.chips, mult: this.mult });
      },
      earn: function (n, src) {
        if (!n) return;
        this.money += n; log.push({ t: 'g', v: n, src: src, chips: this.chips, mult: this.mult });
      },
      note: function (txt, src) { log.push({ t: 'n', txt: txt, src: src, chips: this.chips, mult: this.mult }); }
    };

    // invalid category, or the boss killed this section -> flat zero
    if (!ev.valid || sectionDead) {
      return {
        catId: catId, valid: ev.valid, dead: sectionDead,
        chips: 0, mult: 0, total: 0, money: 0,
        scoringIdx: ev.valid ? scoringIdx : [], heldIdx: heldIdx,
        handIdx: handIdx, log: [], shattered: []
      };
    }

    const charms = run.charms;
    function eachCharm(fn) {
      for (let ci = 0; ci < charms.length; ci++) {
        const inst = charms[ci];
        const def = CH.CHARM_BY_ID[inst.id];
        if (def) fn(def, inst);
      }
    }

    const luckyBoost = CH.hasPassive(run, 'luckyBoost') ? 2 : 1;
    const glassSafe = CH.hasPassive(run, 'glassSafe');

    /* ---- scoring dice ---- */
    for (let s = 0; s < scoringIdx.length; s++) {
      const di = scoringIdx[s];
      const die = dice[di];
      const src = { kind: 'die', index: di };

      if (mods.deadFaces && mods.deadFaces.indexOf(die.value) !== -1) {
        ctx.note('debuffed', src);
        continue;
      }

      let triggers = 1;
      if (die.seal === 'red' && !mods.nullifyDice) triggers += 1;
      eachCharm(function (def, inst) {
        if (def.retrigger) triggers += def.retrigger(ctx, die, s, inst) || 0;
      });

      for (let t = 0; t < triggers; t++) {
        ctx.addChips(die.value, src);

        if (!mods.nullifyDice) {
          switch (die.enhancement) {
            case 'bonus': ctx.addChips(30, src); break;
            case 'mult':  ctx.addMult(4, src); break;
            case 'glass': ctx.xmult(2 - (glassSafe ? 0.25 : 0), src); break;
            case 'gold':  ctx.earn(3, src); break;
            case 'stone': ctx.addChips(50, src); break;
            case 'lucky':
              if (commit) {
                if (run.rng.chance(luckyBoost, 5)) ctx.addMult(20, src);
                if (run.rng.chance(luckyBoost, 15)) ctx.earn(20, src);
              }
              break;
          }
          switch (die.edition) {
            case 'foil': ctx.addChips(50, src); break;
            case 'holo': ctx.addMult(10, src); break;
            case 'poly': ctx.xmult(1.5, src); break;
          }
          if (die.seal === 'gold') ctx.earn(3, src);
        }

        eachCharm(function (def, inst) {
          if (def.onDieScored) def.onDieScored(ctx, die, s, inst);
        });
      }

      if (commit && die.enhancement === 'glass' && !glassSafe && !mods.nullifyDice) {
        if (run.rng.chance(1, 5)) shattered.push(di);
      }
      if (commit && die.seal === 'blue' && !mods.nullifyDice) {
        Game.grantRuneFor(catId);
      }
    }

    /* ---- unscored (held) dice ---- */
    for (let h = 0; h < heldIdx.length; h++) {
      const di = heldIdx[h];
      const die = dice[di];
      const src = { kind: 'die', index: di };
      if (die.enhancement === 'steel' && !mods.nullifyDice) ctx.xmult(1.5, src);
      eachCharm(function (def, inst) {
        if (def.onDieHeld) def.onDieHeld(ctx, die, h, inst);
      });
    }

    /* ---- charms ---- */
    for (let ci = 0; ci < charms.length; ci++) {
      const inst = charms[ci];
      const def = CH.CHARM_BY_ID[inst.id];
      if (def && def.onScore) def.onScore(ctx, inst);
    }

    if (ctx.mult < 0) ctx.mult = 0;
    const total = Math.floor(ctx.chips * ctx.mult);

    return {
      catId: catId, valid: true, dead: false,
      chips: ctx.chips, mult: ctx.mult, total: total, money: ctx.money,
      baseChips: base.chips, baseMult: base.mult, level: base.level,
      scoringIdx: scoringIdx, heldIdx: heldIdx, handIdx: handIdx,
      log: log, shattered: shattered
    };
  }

  /* ---------------------------------------------------------
     Pick the best 5-die hand out of a larger pool, then score.
     --------------------------------------------------------- */
  function bestHandIdx(run, catId) {
    const n = run.dice.length;
    const k = Math.min(5, n);
    if (n <= 5) {
      const idx = [];
      for (let i = 0; i < n; i++) idx.push(i);
      return idx;
    }
    const combos = U.combinations(n, k);
    let best = null, bestScore = -1;
    for (let i = 0; i < combos.length; i++) {
      const r = scoreWith(run, catId, combos[i], { commit: false });
      if (r.total > bestScore) { bestScore = r.total; best = combos[i]; }
    }
    return best || [];
  }

  function preview(run, catId) {
    return scoreWith(run, catId, bestHandIdx(run, catId), { commit: false });
  }

  function commitScore(run, catId) {
    return scoreWith(run, catId, bestHandIdx(run, catId), { commit: true });
  }

  global.E = {
    evaluate: evaluate, levelOf: levelOf, baseValues: baseValues,
    catStatus: catStatus, scoreWith: scoreWith,
    bestHandIdx: bestHandIdx, preview: preview, commitScore: commitScore
  };
})(window);
