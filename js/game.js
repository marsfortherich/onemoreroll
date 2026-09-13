/* ============================================================
   game.js — run state, blind flow, economy, save/load
   ============================================================ */
(function (global) {
  'use strict';

  const SAVE_VERSION = 3;
  const SAVE_KEY = 'onemoreroll.save.v3';
  // read order matters: newest first, then the pre-rename keys
  const LEGACY_SAVE_KEYS = [
    'onemoreroll.save.v2', 'onemoreroll.save.v1',
    'rollatro.save.v2', 'rollatro.save.v1'
  ];
  const META_KEY = 'onemoreroll.meta.v1';

  const BASE_TURNS = 5;
  const BASE_REROLLS = 2;
  const BASE_DICE = 5;

  let run = null;
  let uidCounter = 1;
  function uid() { return 'u' + (uidCounter++); }

  /* ================= dice ================= */
  function makeDie() {
    return {
      id: uid(),
      faces: [1, 2, 3, 4, 5, 6],
      value: 1,
      enhancement: null,
      edition: null,
      seal: null,
      held: false,
      hidden: false
    };
  }
  function cloneDie(d) {
    return {
      id: uid(), faces: d.faces.slice(), value: d.value,
      enhancement: d.enhancement, edition: d.edition, seal: d.seal,
      held: false, hidden: false
    };
  }

  /* ================= run creation ================= */
  function newRun(seedStr, opts) {
    opts = opts || {};
    const seed = (seedStr && String(seedStr).trim()) || U.randomSeedString();
    const deck = DK.deckById(opts.deckId || 'standard');
    const stake = Math.max(1, Math.min(opts.stake || 1, DK.STAKES.length));
    run = {
      version: SAVE_VERSION,
      seed: seed.toUpperCase(),
      rng: new U.RNG(seed.toUpperCase()),
      deckId: deck.id,
      stake: stake,
      ante: 1,
      blindIndex: 0,           // 0 small, 1 big, 2 boss
      roundNum: 0,
      money: 4,
      dice: [],
      levels: {},
      charms: [],
      consumables: [],
      vouchers: [],
      charmSlots: 5,
      consumableSlots: 2,
      blind: null,
      bossId: null,
      usedBosses: [],
      catPlays: {},
      everScored: {},
      pendingTag: null,
      freeItems: 0,
      bonusRerollNext: 0,
      shop: null,
      phase: 'blindSelect',
      stats: { turns: 0, best: 0, bestCat: '-', rerolls: 0, moneyEarned: 0 },
      won: false,
      endless: false,
      metaSaved: false
    };

    const dm = deck.mods || {};
    const sm = DK.stakeMods(stake);

    const meta = (global.Arcade && global.Arcade.progress)
      ? {
          money: global.Arcade.progress.bonus('onemoreroll', 'money'),
          dice: global.Arcade.progress.bonus('onemoreroll', 'dice'),
          consumable: global.Arcade.progress.bonus('onemoreroll', 'consumable')
        }
      : { money: 0, dice: 0, consumable: 0 };

    run.money += meta.money;
    const dieCount = Math.max(1, BASE_DICE + (dm.dice || 0) + meta.dice);
    for (let i = 0; i < dieCount; i++) run.dice.push(makeDie());
    C.CATEGORIES.forEach(function (c) { run.levels[c.id] = 1; });

    run.charmSlots = Math.max(1, 5 + (dm.charmSlots || 0));
    run.consumableSlots = Math.max(0, 2 + (dm.consumableSlots || 0) + meta.consumable);

    // the deck reshapes the opening position...
    if (deck.setup) {
      deck.setup(run, {
        rng: run.rng,
        makeDie: makeDie,
        addConsumable: function (obj) {
          if (run.consumables.length >= run.consumableSlots) return false;
          run.consumables.push({ uid: uid(), kind: obj.kind, id: obj.id });
          return true;
        },
        addRandomCharm: function () {
          const c = randomCharm();
          if (c && run.charms.length < run.charmSlots) addCharm(c.id, true);
        }
      });
    }
    // ...and the stake then overrides anything it insists on
    if (sm.startMoney !== undefined) run.money = sm.startMoney;

    rollBoss();
    if (global.Profile) Profile.startRun(run.deckId, run.stake);
    save();
    return run;
  }

  /* ================= deck / stake modifiers ================= */
  function deckMods() {
    if (!run) return {};
    return (DK.deckById(run.deckId).mods) || {};
  }
  function stakeMods() {
    if (!run) return DK.stakeMods(1);
    return DK.stakeMods(run.stake || 1);
  }

  /* ================= derived stats ================= */
  function voucher(id) { return run.vouchers.indexOf(id) !== -1; }

  function turnsForBlind() {
    const mods = (run.blind && run.blind.mods) || {};
    if (mods.setTurns) return mods.setTurns;
    let t = BASE_TURNS;
    t += deckMods().turns || 0;
    t += stakeMods().turns || 0;
    if (voucher('v_turn')) t += 1;
    if (voucher('v_turn2')) t += 1;
    t += CH.countPassive(run, 'extraTurn');
    t += mods.turns || 0;
    return Math.max(1, t);
  }
  function rerollsPerTurn() {
    const mods = (run.blind && run.blind.mods) || {};
    let r = BASE_REROLLS;
    r += deckMods().rerolls || 0;
    r += stakeMods().rerolls || 0;
    if (voucher('v_reroll')) r += 1;
    if (voucher('v_reroll2')) r += 1;
    r += CH.countPassive(run, 'extraReroll');
    r += run.bonusRerollNext || 0;
    r += mods.rerolls || 0;
    return Math.max(0, r);
  }
  function interestCap() {
    let cap = 5;
    cap += deckMods().interestBonus || 0;
    if (voucher('v_interest')) cap += 5;
    if (voucher('v_interest2')) cap += 10;
    cap += CH.countPassive(run, 'interest5') * 5;
    return Math.max(0, Math.floor(cap * stakeMods().interestMul));
  }
  function shopSlots() {
    return 2 + (voucher('v_shopwide') ? 1 : 0) + (voucher('v_shopwide2') ? 1 : 0);
  }
  function priceOf(base) {
    let p = base * stakeMods().priceMul;
    if (voucher('v_discount2')) p = p * 0.5;
    else if (voucher('v_discount')) p = p * 0.75;
    if (run.halfPriceShop) p = p * 0.5;
    return Math.max(1, Math.round(p));
  }
  function rerollCost() {
    if (CH.hasPassive(run, 'freeReroll')) return 0;
    let c = 3 + (run.shop ? run.shop.rerolls * 2 : 0);
    if (voucher('v_cheapre')) c -= 2;
    if (voucher('v_cheapre2')) c -= 2;
    return Math.max(0, c);
  }

  /* ================= money ================= */
  function earn(n, src) {
    if (!n) return 0;
    if (run.blind && run.blind.mods && run.blind.mods.noMoney) return 0;
    run.money += n;
    run.stats.moneyEarned += n;
    if (src) { UI.toast('+$' + n + '  ' + src, 'good'); Sfx.play('coin'); }
    UI.refreshStats();
    return n;
  }
  function spend(n) {
    if (run.money < n) return false;
    run.money -= n;
    UI.refreshStats();
    return true;
  }
  function lose(n, src) {
    const amt = Math.min(run.money, n);
    run.money -= amt;
    if (amt > 0 && src) UI.toast('-$' + amt + '  ' + src, 'bad');
    UI.refreshStats();
  }

  /* ================= blinds ================= */
  function rollBoss() {
    if (run.ante === 8 && !run.endless) {
      run.bossId = 'grand';
      return;
    }
    let pool = C.BOSSES.filter(function (b) {
      return !b.finalOnly && b.minAnte <= run.ante && run.usedBosses.indexOf(b.id) === -1;
    });
    if (!pool.length) {
      pool = C.BOSSES.filter(function (b) { return !b.finalOnly && b.minAnte <= run.ante; });
      run.usedBosses = [];
    }
    run.bossId = run.rng.pick(pool).id;
  }

  function blindTarget(index) {
    const base = C.anteBase(run.ante);
    const kind = C.BLIND_KINDS[index];
    let m = kind.mult;
    if (index === 2) {
      const boss = C.BOSS_BY_ID[run.bossId];
      if (boss && boss.targetMult) m = boss.targetMult;
    }
    m *= deckMods().targetMul || 1;
    m *= stakeMods().targetMul || 1;
    if (index === 2 && run.bossDiscount) m *= run.bossDiscount;
    return Math.round(base * m);
  }
  function blindReward(index) {
    const sm = stakeMods();
    if (index === 0 && sm.smallBlindReward !== undefined) return sm.smallBlindReward;
    return Math.max(0, C.BLIND_KINDS[index].reward + (deckMods().rewardDelta || 0));
  }

  function startBlind() {
    const index = run.blindIndex;
    const kind = C.BLIND_KINDS[index];
    const boss = index === 2 ? C.BOSS_BY_ID[run.bossId] : null;
    const mods = boss ? JSON.parse(JSON.stringify(boss.mods || {})) : {};

    run.roundNum++;
    run.blind = {
      index: index, kindId: kind.id, name: boss ? boss.name : kind.name,
      bossId: boss ? boss.id : null,
      target: blindTarget(index),
      reward: blindReward(index),
      score: 0,
      mods: mods,
      used: {},
      // Replays granted by Encore-style charms, spent as categories are scored.
      // Set below, once the blind's charms have been applied.
      encoresLeft: 0,
      locked: [],
      benched: [],
      borrowed: [],
      turnIndex: 0,
      turnsLeft: 0,
      rerollsLeft: 0,
      rerollsUsed: 0
    };

    // boss set-up that needs the run
    if (mods.lockCats) run.blind.locked = mods.lockCats.slice();
    if (mods.lockRandom) {
      const pool = run.rng.shuffle(C.CATEGORIES.map(function (c) { return c.id; }));
      run.blind.locked = pool.slice(0, mods.lockRandom);
    }
    if (mods.lockBest) {
      let best = 'chance', bv = -1;
      C.CATEGORIES.forEach(function (c) {
        const lv = run.levels[c.id] || 1;
        if (lv > bv) { bv = lv; best = c.id; }
      });
      run.blind.locked = [best];
    }
    if (mods.removeDice && run.dice.length > 2) {
      for (let i = 0; i < mods.removeDice && run.dice.length > 2; i++) {
        const k = run.rng.int(0, run.dice.length - 1);
        run.blind.benched.push(run.dice.splice(k, 1)[0]);
      }
    }

    if (index === 2 && run.bossDiscount) run.bossDiscount = 0;
    // dice loaned by a Juggle Boon, returned when the blind ends
    if (run.borrowDice) {
      for (let i = 0; i < run.borrowDice; i++) {
        const d = makeDie();
        run.dice.push(d);
        run.blind.borrowed.push(d.id);
      }
      run.borrowDice = 0;
    }
    run.blind.turnsLeft = turnsForBlind();
    // Replays refresh each blind, so Encore is a per-blind decision rather
    // than a one-off for the whole run.
    run.blind.encoresLeft = CH.sumPassive(run, 'encore', 'encores');
    run.charms.forEach(function (inst) {
      const def = CH.CHARM_BY_ID[inst.id];
      if (def && def.onBlindStart) def.onBlindStart(run, inst);
    });

    if (boss && global.Profile) Profile.discover('boss', boss.id);
    run.phase = 'playing';
    newTurn(true);
    save();
    Sfx.play(boss ? 'bossStart' : 'blindStart');
    Sfx.music(boss ? 'boss' : 'play');
    UI.enterPlay();
  }

  function newTurn(first) {
    const b = run.blind;
    b.rerollsLeft = rerollsPerTurn();
    b.rerollsUsed = 0;
    run.dice.forEach(function (d) { d.held = false; d.hidden = false; });
    rollDice(run.dice.map(function (_, i) { return i; }), true);
    if (!first) b.turnIndex++;
    UI.render();
  }

  function rollFace(die) {
    const loaded = CH.hasPassive(run, 'loaded');
    const noLow = CH.hasPassive(run, 'noLow');
    let faces = die.faces;
    if (noLow && faces.length > 1) {
      const lo = Math.min.apply(null, faces);
      const filtered = faces.filter(function (f) { return f !== lo; });
      if (filtered.length) faces = filtered;
    }
    let v = faces[run.rng.int(0, faces.length - 1)];
    if (loaded) {
      const v2 = faces[run.rng.int(0, faces.length - 1)];
      if (v2 > v) v = v2;
    }
    return v;
  }

  function rollDice(indices, initial) {
    const mods = run.blind.mods || {};
    indices.forEach(function (i) {
      const d = run.dice[i];
      d.value = rollFace(d);
      if (mods.hideRerolled && !initial) d.hidden = true;
    });
  }

  function reroll() {
    const b = run.blind;
    if (b.rerollsLeft <= 0) return false;
    const idx = [];
    run.dice.forEach(function (d, i) { if (!d.held) idx.push(i); });
    if (!idx.length) { UI.toast('All dice are held', 'bad'); return false; }
    b.rerollsLeft--;
    b.rerollsUsed++;
    run.stats.rerolls++;
    rollDice(idx, false);
    Sfx.play('diceRoll', { count: idx.length });
    run.charms.forEach(function (inst) {
      const def = CH.CHARM_BY_ID[inst.id];
      if (def && def.onReroll) def.onReroll(run, inst);
    });
    UI.animateRoll(idx);
    save();
    return true;
  }

  function toggleHold(i) {
    const d = run.dice[i];
    if (!d) return;
    d.held = !d.held;
    UI.render();
  }

  /* ================= scoring a category ================= */
  function scoreCategory(catId) {
    const b = run.blind;
    if (!b || run.phase !== 'playing') return null;
    if (E.catStatus(run, catId) !== 'open') return null;

    const res = E.commitScore(run, catId);

    // scratch protection
    if ((!res.valid || res.dead) && CH.hasPassive(run, 'scratchproof')) {
      earn(6, 'Scratchproof');
      UI.toast('Scratchproof: category kept', 'good');
    } else if (res.valid && !res.dead && (b.encoresLeft || 0) > 0) {
      // Encore: this category stays open, so it can be played again.
      b.encoresLeft--;
      UI.toast('Encore: ' + C.CAT_BY_ID[catId].name + ' stays open', 'good');
      if (global.Arcade && global.Arcade.progress) global.Arcade.progress.award('omr_encore');
    } else {
      b.used[catId] = true;
    }

    run.dice.forEach(function (d) { d.hidden = false; });
    return res;
  }

  /** called by UI once the score animation has finished */
  function applyScore(res) {
    const b = run.blind;
    b.score += res.total;
    run.stats.turns++;
    run.catPlays[res.catId] = (run.catPlays[res.catId] || 0) + 1;
    if (res.total > run.stats.best) {
      run.stats.best = res.total;
      run.stats.bestCat = C.CAT_BY_ID[res.catId].name;
    }
    if (res.money) earn(res.money, null);

    // shattered glass dice
    if (res.shattered && res.shattered.length) {
      res.shattered.sort(function (a, c) { return c - a; });
      res.shattered.forEach(function (i) {
        if (run.dice.length > 1) run.dice.splice(i, 1);
      });
      UI.toast('A Glass Die shattered!', 'bad');
    }

    const mods = b.mods || {};
    if (mods.drainLevel && res.valid) {
      run.levels[res.catId] = Math.max(1, (run.levels[res.catId] || 1) - 1);
      UI.toast(C.CAT_BY_ID[res.catId].name + ' lost a level', 'bad');
    }
    if (mods.toothCost && res.scoringIdx.length) lose(res.scoringIdx.length, 'The Tooth');
    if (mods.hookCost) lose(mods.hookCost, 'The Hook');

    run.charms.forEach(function (inst) {
      const def = CH.CHARM_BY_ID[inst.id];
      if (def && def.onTurnEnd) def.onTurnEnd(run, res, inst);
    });

    b.turnsLeft--;

    if (b.score >= b.target) { winBlind(); return 'win'; }
    if (b.turnsLeft <= 0) { loseRun(); return 'lose'; }
    // out of usable categories?
    const anyOpen = C.CATEGORIES.some(function (c) { return E.catStatus(run, c.id) === 'open'; });
    if (!anyOpen) { loseRun(); return 'lose'; }

    newTurn(false);
    save();
    return 'continue';
  }

  function unbench() {
    if (!run.blind) return;
    if (run.blind.benched.length) {
      run.blind.benched.forEach(function (d) { run.dice.push(d); });
      run.blind.benched = [];
    }
    if (run.blind.borrowed && run.blind.borrowed.length) {
      run.dice = run.dice.filter(function (d) { return run.blind.borrowed.indexOf(d.id) === -1; });
      run.blind.borrowed = [];
    }
  }

  function winBlind() {
    const b = run.blind;
    run.charms.forEach(function (inst) {
      const def = CH.CHARM_BY_ID[inst.id];
      if (def && def.onBlindEnd) def.onBlindEnd(run, inst);
    });
    unbench();
    run.bonusRerollNext = 0;

    const noMoney = !!(b.mods && b.mods.noMoney);
    const lines = [];
    const base = noMoney ? 0 : b.reward;
    lines.push({ label: b.name + ' cleared', amt: base });
    const spare = Math.max(0, b.turnsLeft);
    if (spare > 0 && !noMoney) lines.push({ label: spare + ' unused turn' + (spare > 1 ? 's' : ''), amt: spare });
    const interest = noMoney ? 0 : Math.min(interestCap(), Math.floor(run.money / 5));
    if (interest > 0) lines.push({ label: 'Interest ($1 per $5)', amt: interest });

    let total = 0;
    lines.forEach(function (l) { total += l.amt; });
    run.money += total;
    run.stats.moneyEarned += total;

    run.lastCashout = { lines: lines, total: total, noMoney: noMoney };
    run.phase = 'cashout';
    save();
    UI.showCashout(lines, total, noMoney);
  }

  function advanceAfterCashout() {
    if (run.blindIndex === 2) {
      if (run.ante >= 8 && !run.endless) {
        run.won = true; run.phase = 'won';
        run.unlocks = saveMetaOnEnd(true);
        save();
        Sfx.play('victory');
        Sfx.music('menu');
        UI.showVictory();
        return;
      }
      run.usedBosses.push(run.bossId);
      run.ante++;
      run.blindIndex = 0;
      rollBoss();
    } else {
      run.blindIndex++;
    }
    openShop();
  }

  /** leave the victory screen and roll into endless mode */
  function goEndless() {
    run.won = false;
    run.endless = true;
    run.metaSaved = true;
    run.usedBosses.push(run.bossId);
    run.ante++;
    run.blindIndex = 0;
    rollBoss();
    openShop();
  }

  function skipBlind() {
    if (run.blindIndex === 2) return;
    const tag = run.rng.pick(C.TAGS);
    applyTag(tag);
    run.blindIndex++;
    run.blind = null;
    run.phase = 'blindSelect';
    save();
    UI.showBlindSelect();
  }

  function applyTag(tag) {
    if (global.Profile) Profile.discover('tag', tag.id);
    switch (tag.id) {
      case 't_cash': run.money += 12; Sfx.play('coin'); UI.toast('Coin Boon: +$12', 'good'); break;
      case 't_charm': {
        const c = randomCharm();
        if (c && run.charms.length < run.charmSlots) { addCharm(c.id); UI.toast('Charm Boon: ' + c.name, 'good'); }
        else { run.money += 8; UI.toast('No room — +$8 instead', 'good'); }
        break;
      }
      case 't_rune':
        for (let i = 0; i < 2; i++) addConsumable({ kind: 'rune', id: run.rng.pick(C.RUNES).id });
        UI.toast('Rune Boon: +2 Runes', 'good');
        break;
      case 't_omen':
        for (let i = 0; i < 2; i++) addConsumable({ kind: 'omen', id: run.rng.pick(C.OMENS).id });
        UI.toast('Omen Boon: +2 Omens', 'good');
        break;
      case 't_double': run.freeItems += 1; UI.toast('Double Boon: next shop item is free', 'good'); break;
      case 't_reroll': run.bonusRerollNext += 1; UI.toast('Reroll Boon: +1 reroll next blind', 'good'); break;
      case 't_boss': run.bossDiscount = 0.75; UI.toast('Boss Boon: next Boss target −25%', 'good'); break;
      case 't_voucher': run.forceVoucher = true; UI.toast('Relic Boon: a Relic next shop', 'good'); break;
      case 't_charmpack': openFreePack('p_charm'); return;
      case 't_omenpack': openFreePack('p_omen'); return;
      case 't_runepack': openFreePack('p_rune'); return;
      case 't_foundry': openFreePack('p_die'); return;
      case 't_invest': run.money += 18; Sfx.play('coin'); UI.toast('Investment Boon: +$18', 'good'); break;
      case 't_juggle': run.borrowDice = (run.borrowDice || 0) + 1; UI.toast('Juggle Boon: +1 die next blind', 'good'); break;
      case 't_slot': run.charmSlots++; UI.toast('Locksmith Boon: +1 Charm slot', 'good'); break;
      case 't_handshake': run.halfPriceShop = true; UI.toast('Handshake Boon: next shop is half price', 'good'); break;
      case 't_polish': {
        const d = run.dice[run.rng.int(0, run.dice.length - 1)];
        d.edition = run.rng.pick(['foil', 'holo', 'poly']);
        UI.toast('Polish Boon: a die gained ' + C.EDITIONS[d.edition].name, 'good');
        break;
      }
      case 't_wax': {
        const d = run.dice[run.rng.int(0, run.dice.length - 1)];
        d.seal = 'red';
        UI.toast('Wax Boon: a die gained a Red Seal', 'good');
        break;
      }
      case 't_ethereal':
        addConsumable({ kind: 'omen', id: run.rng.pick(C.OMENS).id });
        addConsumable({ kind: 'rune', id: run.rng.pick(C.RUNES).id });
        UI.toast('Ethereal Boon: an Omen and a Rune', 'good');
        break;
      case 't_meteor': {
        for (let i = 0; i < 3; i++) levelUp(run.rng.pick(C.CATEGORIES).id, 1);
        break;
      }
      case 't_level': {
        let best = 'chance', bn = -1;
        for (const k in run.catPlays) if (run.catPlays[k] > bn) { bn = run.catPlays[k]; best = k; }
        run.levels[best] = (run.levels[best] || 1) + 2;
        UI.toast('Scholar Boon: ' + C.CAT_BY_ID[best].name + ' +2 levels', 'good');
        break;
      }
    }
  }

  function loseRun() {
    unbench();
    run.phase = 'gameover';
    run.unlocks = saveMetaOnEnd(false);
    clearSaves();
    Sfx.play('lose');
    Sfx.music('menu');
    UI.showGameOver();
  }

  /* ================= charms / consumables ================= */
  function randomCharm(excludeIds) {
    const owned = {};
    run.charms.forEach(function (c) { owned[c.id] = true; });
    (excludeIds || []).forEach(function (id) { owned[id] = true; });
    const pool = CH.CHARMS.filter(function (c) { return !owned[c.id]; });
    if (!pool.length) return null;
    const weights = { common: 100, uncommon: 45, rare: 18, legendary: 4 };
    return run.rng.weighted(pool, function (c) { return weights[c.rarity] || 10; });
  }

  function addCharm(id, quiet) {
    const def = CH.CHARM_BY_ID[id];
    if (!def) return null;
    const inst = { uid: uid(), id: id, state: def.init ? def.init() : {}, sell: Math.max(1, Math.floor(def.cost / 2)) };
    run.charms.push(inst);
    if (def.passive === 'extraDie') run.dice.push(makeDie());
    if (def.onBuy) def.onBuy(run, inst);
    if (global.Profile) Profile.discover('charm', id);
    if (!quiet) UI.render();
    return inst;
  }

  function sellCharm(uidStr) {
    const i = run.charms.findIndex(function (c) { return c.uid === uidStr; });
    if (i === -1) return;
    const inst = run.charms[i];
    const def = CH.CHARM_BY_ID[inst.id];
    if (def && def.passive === 'extraDie' && run.dice.length > 1) {
      let k = -1;
      for (let j = run.dice.length - 1; j >= 0; j--) {
        if (!run.dice[j].enhancement && !run.dice[j].edition && !run.dice[j].seal) { k = j; break; }
      }
      run.dice.splice(k === -1 ? run.dice.length - 1 : k, 1);
    }
    if (def && def.onSell) def.onSell(run, inst);
    run.charms.splice(i, 1);
    run.money += inst.sell;
    UI.toast('Sold for $' + inst.sell, 'good');
    save();
    UI.render();
  }

  function addConsumable(obj) {
    if (run.consumables.length >= run.consumableSlots) { UI.toast('No consumable room', 'bad'); return false; }
    run.consumables.push({ uid: uid(), kind: obj.kind, id: obj.id });
    UI.render();
    return true;
  }

  function grantRuneFor(catId) {
    if (run.consumables.length >= run.consumableSlots) return;
    run.consumables.push({ uid: uid(), kind: 'rune', id: 'rune_' + catId });
  }

  function levelUp(catId, n) {
    run.levels[catId] = (run.levels[catId] || 1) + (n || 1);
    Sfx.play('levelUp');
    UI.toast(C.CAT_BY_ID[catId].name + ' → lvl ' + run.levels[catId], 'good');
  }

  /** returns 'done' | 'needsDie' | 'fail' */
  function useConsumable(uidStr, targetDieIndex) {
    const i = run.consumables.findIndex(function (c) { return c.uid === uidStr; });
    if (i === -1) return 'fail';
    const item = run.consumables[i];

    if (item.kind === 'rune') {
      const def = C.RUNE_BY_ID[item.id];
      if (def.cat) levelUp(def.cat, 1);
      else levelUp(run.rng.pick(C.CATEGORIES).id, 2);
      run.consumables.splice(i, 1);
      save(); UI.render();
      return 'done';
    }

    const def = C.OMEN_BY_ID[item.id];
    if (!def) return 'fail';

    if (def.targets === 'die') {
      if (targetDieIndex === undefined || targetDieIndex === null) return 'needsDie';
      const d = run.dice[targetDieIndex];
      if (!d) return 'fail';
      switch (def.id) {
        case 'forge': d.enhancement = 'bonus'; break;
        case 'ember': d.enhancement = 'mult'; break;
        case 'pane': d.enhancement = 'glass'; break;
        case 'vault': d.enhancement = 'gold'; break;
        case 'anvil': d.enhancement = 'steel'; break;
        case 'clover': d.enhancement = 'lucky'; break;
        case 'monolith': d.enhancement = 'stone'; break;
        case 'gilder': d.edition = 'foil'; break;
        case 'spectre': d.edition = 'holo'; break;
        case 'prism': d.edition = 'poly'; break;
        case 'wax': d.seal = 'red'; break;
        case 'ledger': d.seal = 'gold'; break;
        case 'chisel': {
          let lo = 0;
          for (let k = 1; k < d.faces.length; k++) if (d.faces[k] < d.faces[lo]) lo = k;
          d.faces[lo] = d.faces[lo] + 1;
          break;
        }
        case 'lathe': d.faces = d.faces.map(function () { return d.value; }); break;
        case 'twins': run.dice.push(cloneDie(d)); break;
        case 'reaper':
          if (run.dice.length <= 1) { UI.toast('You need at least one die', 'bad'); return 'fail'; }
          run.dice.splice(targetDieIndex, 1);
          run.money += 8;
          break;
      }
      run.consumables.splice(i, 1);
      UI.toast(def.name + ' used', 'good');
      save(); UI.render();
      return 'done';
    }

    // no-target omens
    switch (def.id) {
      case 'hermit': {
        const gain = Math.min(20, run.money);
        run.money += gain; UI.toast('The Hermit: +$' + gain, 'good');
        break;
      }
      case 'beggar': run.money += 12; UI.toast('The Beggar: +$12', 'good'); break;
      case 'judge': {
        if (run.charms.length >= run.charmSlots) { UI.toast('No Charm room', 'bad'); return 'fail'; }
        const c = randomCharm();
        if (!c) { UI.toast('No Charms left', 'bad'); return 'fail'; }
        addCharm(c.id); UI.toast('The Judge: ' + c.name, 'good');
        break;
      }
      case 'echoOmen': {
        run.consumables.splice(i, 1);
        const ok = addConsumable({ kind: 'rune', id: run.rng.pick(C.RUNES).id });
        if (!ok) run.money += 3;
        save(); UI.render();
        return 'done';
      }
    }
    run.consumables.splice(i, 1);
    save(); UI.render();
    return 'done';
  }

  /* ================= shop ================= */
  function rollShopItem() {
    const omenBoost = voucher('v_omen2') ? 3 : (voucher('v_omen') ? 2 : 1);
    const kinds = [
      { k: 'charm', w: 20 },
      { k: 'rune', w: 4 * omenBoost },
      { k: 'omen', w: 4 * omenBoost }
    ];
    const pick = run.rng.weighted(kinds, function (x) { return x.w; });
    if (pick.k === 'charm') {
      const c = randomCharm(run.shop ? run.shop.items.filter(function (it) { return it && it.kind === 'charm'; }).map(function (it) { return it.id; }) : []);
      if (!c) return { kind: 'rune', id: run.rng.pick(C.RUNES).id, cost: priceOf(3) };
      return { kind: 'charm', id: c.id, cost: priceOf(c.cost) };
    }
    if (pick.k === 'rune') {
      const r = run.rng.pick(C.RUNES);
      return { kind: 'rune', id: r.id, cost: priceOf(r.cost) };
    }
    const o = run.rng.pick(C.OMENS);
    return { kind: 'omen', id: o.id, cost: priceOf(o.cost) };
  }

  function availableVouchers() {
    return C.VOUCHERS.filter(function (v) {
      if (run.vouchers.indexOf(v.id) !== -1) return false;
      if (v.requires && run.vouchers.indexOf(v.requires) === -1) return false;
      return true;
    });
  }

  function noteSeen(item) {
    if (!global.Profile || !item) return;
    if (item.kind === 'charm') Profile.discover('charm', item.id);
    else if (item.kind === 'omen') Profile.discover('omen', item.id);
    else if (item.kind === 'rune') Profile.discover('rune', item.id);
    else if (item.kind === 'voucher') Profile.discover('voucher', item.id);
  }

  function openShop() {
    const packPool = run.rng.shuffle(C.PACKS);
    const vpool = availableVouchers();
    run.shop = {
      items: [],
      packs: [
        { kind: 'pack', id: packPool[0].id, cost: priceOf(packPool[0].cost) },
        { kind: 'pack', id: packPool[1].id, cost: priceOf(packPool[1].cost) }
      ],
      voucher: null,
      rerolls: 0
    };
    if (run.halfPriceShop) run.halfPriceShop = false;   // consumed by the prices above
    // one voucher on offer per ante, on the Small-Blind shop or via a Relic Boon
    if (vpool.length && (run.blindIndex === 0 || run.forceVoucher)) {
      run.forceVoucher = false;
      const v = run.rng.pick(vpool);
      run.shop.voucher = { kind: 'voucher', id: v.id, cost: priceOf(v.cost) };
    }
    for (let i = 0; i < shopSlots(); i++) run.shop.items.push(rollShopItem());
    run.shop.items.forEach(noteSeen);
    noteSeen(run.shop.voucher);
    run.phase = 'shop';
    save();
    Sfx.music('shop');
    UI.showShop();
  }

  function rerollShop() {
    const cost = rerollCost();
    if (!spend(cost)) { UI.toast('Not enough money', 'bad'); return; }
    run.shop.rerolls++;
    run.shop.items = [];
    for (let i = 0; i < shopSlots(); i++) run.shop.items.push(rollShopItem());
    run.shop.items.forEach(noteSeen);
    save();
    Sfx.play('cardFlip');
    UI.showShop();
  }

  function costFor(item) {
    return run.freeItems > 0 ? 0 : item.cost;
  }

  function buy(where, index) {
    const list = where === 'item' ? run.shop.items : where === 'pack' ? run.shop.packs : null;
    const item = where === 'voucher' ? run.shop.voucher : list[index];
    if (!item) return;
    const cost = costFor(item);

    if (item.kind === 'charm' && run.charms.length >= run.charmSlots) { UI.toast('No Charm slots free', 'bad'); return; }
    if ((item.kind === 'rune' || item.kind === 'omen') && run.consumables.length >= run.consumableSlots) {
      UI.toast('No consumable slots free', 'bad'); return;
    }
    if (run.money < cost) { UI.toast('Not enough money', 'bad'); return; }

    run.money -= cost;
    if (run.freeItems > 0) run.freeItems--;

    if (item.kind === 'charm') addCharm(item.id);
    else if (item.kind === 'rune') addConsumable({ kind: 'rune', id: item.id });
    else if (item.kind === 'omen') addConsumable({ kind: 'omen', id: item.id });
    else if (item.kind === 'voucher') { applyVoucher(item.id); run.shop.voucher = null; }
    else if (item.kind === 'pack') { openPack(item.id, index); return; }

    if (where === 'item') run.shop.items[index] = null;
    save();
    UI.showShop();
  }

  function applyVoucher(id) {
    run.vouchers.push(id);
    if (id === 'v_die' || id === 'v_die2') run.dice.push(makeDie());
    if (id === 'v_slot' || id === 'v_slot2') run.charmSlots++;
    if (id === 'v_pouch' || id === 'v_pouch2') run.consumableSlots++;
    UI.toast(C.VOUCHER_BY_ID[id].name + ' acquired', 'good');
  }

  function buildPackOptions(pack) {
    const options = [];
    const taken = [];
    for (let i = 0; i < pack.size; i++) {
      if (pack.kindOf === 'charm') {
        const c = randomCharm(taken);
        if (!c) break;
        taken.push(c.id);
        options.push({ kind: 'charm', id: c.id });
      } else if (pack.kindOf === 'rune') {
        options.push({ kind: 'rune', id: run.rng.pick(C.RUNES).id });
      } else if (pack.kindOf === 'omen') {
        options.push({ kind: 'omen', id: run.rng.pick(C.OMENS).id });
      } else if (pack.kindOf === 'dieupg') {
        options.push({ kind: 'dieupg', id: run.rng.pick(C.DIE_UPGRADES).id });
      }
    }
    return options;
  }

  function openPack(packId, index) {
    const pack = C.PACKS.filter(function (p) { return p.id === packId; })[0];
    const options = buildPackOptions(pack);
    run.shop.packs[index] = null;
    options.forEach(noteSeen);
    save();
    Sfx.play('packOpen');
    UI.showPack(pack, options, pack.pick);
  }

  /** A pack opened outside the shop, e.g. from a skip tag. */
  function openFreePack(packId) {
    const pack = C.PACKS.filter(function (p) { return p.id === packId; })[0];
    if (!pack) return;
    const options = buildPackOptions(pack);
    options.forEach(noteSeen);
    save();
    Sfx.play('packOpen');
    UI.showPack(pack, options, pack.pick);
  }

  function takePackOption(opt) {
    if (opt.kind === 'charm') {
      if (run.charms.length >= run.charmSlots) { UI.toast('No Charm slots free', 'bad'); return false; }
      addCharm(opt.id); return true;
    }
    if (opt.kind === 'rune' || opt.kind === 'omen') {
      return addConsumable({ kind: opt.kind, id: opt.id });
    }
    if (opt.kind === 'dieupg') {
      const du = C.DIE_UPGRADES.filter(function (d) { return d.id === opt.id; })[0];
      UI.openDicePicker('Apply ' + du.name, function (idx) {
        run.dice[idx].enhancement = du.enh;
        UI.toast(du.name + ' applied', 'good');
        save(); UI.render();
      });
      return true;
    }
    return false;
  }

  function leaveShop() {
    run.shop = null;
    run.blind = null;
    run.phase = 'blindSelect';
    save();
    UI.showBlindSelect();
  }

  /* ================= save / load ================= */
  function save() {
    if (!run) return;
    try {
      const data = JSON.parse(JSON.stringify(run, function (k, v) { return k === 'rng' ? undefined : v; }));
      data.version = SAVE_VERSION;
      data.rngState = run.rng.save();
      data.uidCounter = uidCounter;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable or quota exceeded — play on unsaved */ }
  }

  /** Read + validate a stored save. Returns the parsed object, or null. */
  function readSave() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!raw) {
      for (let i = 0; i < LEGACY_SAVE_KEYS.length; i++) {
        try { raw = localStorage.getItem(LEGACY_SAVE_KEYS[i]); } catch (e) { raw = null; }
        if (raw) break;
      }
    }
    if (!raw) return null;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    // structural sanity — a half-written save must not brick the title screen
    if (!data || typeof data !== 'object') return null;
    if (!data.rngState || !Array.isArray(data.dice) || !Array.isArray(data.charms)) return null;
    if (typeof data.ante !== 'number' || typeof data.money !== 'number') return null;
    return migrate(data);
  }

  /** The Five of a Kind category used to be called something trademarked. */
  function renameCatKey(obj) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, 'yahtzee')) {
      obj.fiveKind = obj.yahtzee;
      delete obj.yahtzee;
    }
  }

  /** Bring an older save forward to the current shape. */
  function migrate(data) {
    const v = data.version || 1;
    if (v < 2) {
      // v1 predates decks, stakes and the modifier block
      data.deckId = data.deckId || 'standard';
      data.stake = data.stake || 1;
      data.mods = data.mods || {};
      data.endless = !!data.endless;
      data.metaSaved = !!data.metaSaved;
    }
    if (v < 3) {
      renameCatKey(data.levels);
      renameCatKey(data.catPlays);
      renameCatKey(data.everScored);
      if (data.blind) {
        renameCatKey(data.blind.used);
        if (Array.isArray(data.blind.locked)) {
          data.blind.locked = data.blind.locked.map(function (id) {
            return id === 'yahtzee' ? 'fiveKind' : id;
          });
        }
      }
      (data.consumables || []).forEach(function (c) {
        if (c && c.id === 'rune_yahtzee') c.id = 'rune_fiveKind';
      });
      if (data.stats && data.stats.bestCat === 'Five of a Kind') data.stats.bestCat = 'Five of a Kind';
      // any category the old save never knew about starts at level 1
      data.levels = data.levels || {};
      C.CATEGORIES.forEach(function (c) {
        if (typeof data.levels[c.id] !== 'number') data.levels[c.id] = 1;
      });
    }
    data.version = SAVE_VERSION;
    return data;
  }

  function hasSave() { return readSave() !== null; }

  function load() {
    const data = readSave();
    if (!data) { clearSaves(); return false; }
    try {
      run = data;
      run.rng = new U.RNG(data.rngState.s);
      run.rng.load(data.rngState);
      uidCounter = data.uidCounter || 1;
      // a save taken mid-animation could be missing a blind; drop back to select
      if (run.phase === 'playing' && !run.blind) run.phase = 'blindSelect';
      return true;
    } catch (e) { clearSaves(); return false; }
  }

  function clearSaves() {
    try {
      localStorage.removeItem(SAVE_KEY);
      LEGACY_SAVE_KEYS.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  function abandon() {
    clearSaves();
    run = null;
  }

  function meta() { return Profile.get(); }

  /** Fold a finished run into the profile exactly once. Returns new unlocks. */
  function saveMetaOnEnd(won) {
    if (!run || run.metaSaved) return null;
    run.metaSaved = true;

    // The arcade ranks One More Roll by best single turn — the number this
    // game already treats as its headline score. Fire-and-forget.
    if (global.Arcade) {
      global.Arcade.progress.recordRun('onemoreroll', {
        score: (run.stats && run.stats.best) || 0,
        ante: run.ante,
        won: !!won,
        // The peril level is this game's difficulty ladder.
        difficulty: String(run.stake || 1)
      });
      global.Arcade.submitScore('onemoreroll', {
        score: (run.stats && run.stats.best) || 0,
        metrics: {
          ante: run.ante,
          money: (run.stats && run.stats.moneyEarned) || 0
        },
        meta: {
          ante: run.ante,
          round: run.roundNum,
          won: !!won,
          deck: run.deckId,
          stake: run.stake,
          seed: run.seed
        }
      });
    }

    return Profile.endRun(run, won);
  }

  global.Game = {
    get run() { return run; },
    newRun: newRun, save: save, load: load, hasSave: hasSave, abandon: abandon,
    meta: meta, saveMetaOnEnd: saveMetaOnEnd,
    makeDie: makeDie,
    turnsForBlind: turnsForBlind, rerollsPerTurn: rerollsPerTurn,
    interestCap: interestCap, rerollCost: rerollCost, priceOf: priceOf,
    deckMods: deckMods, stakeMods: stakeMods,
    voucher: voucher, costFor: costFor,
    earn: earn, spend: spend, lose: lose,
    blindTarget: blindTarget, blindReward: blindReward,
    startBlind: startBlind, skipBlind: skipBlind, applyTag: applyTag,
    reroll: reroll, toggleHold: toggleHold,
    scoreCategory: scoreCategory, applyScore: applyScore,
    advanceAfterCashout: advanceAfterCashout, goEndless: goEndless,
    addCharm: addCharm, sellCharm: sellCharm, randomCharm: randomCharm,
    addConsumable: addConsumable, useConsumable: useConsumable, grantRuneFor: grantRuneFor,
    levelUp: levelUp,
    openShop: openShop, rerollShop: rerollShop, buy: buy, openFreePack: openFreePack,
    takePackOption: takePackOption, leaveShop: leaveShop,
    loseRun: loseRun
  };
})(window);
