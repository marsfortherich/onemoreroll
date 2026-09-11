/* ============================================================
   tools/policies.js — bot policies for the simulator

   Balance claims are meaningless without a named skill level, so every
   number the sim prints is tagged with the policy that produced it.

     random    — holds nothing, rerolls blindly, buys nothing
     greedy    — never rerolls, always scores the best category
     competent — holds toward pairs/straights, stops on a made hand,
                 keeps a money buffer, levels categories, opens packs
   ============================================================ */
'use strict';

/* ---------- dice heuristics ---------- */

function holdTowardBest(g) {
  const run = g.Game.run;
  const d = run.dice;
  const cnt = {};
  d.forEach(function (x) { cnt[x.value] = (cnt[x.value] || 0) + 1; });
  let modal = null, mc = 0;
  for (const k in cnt) if (cnt[k] > mc) { mc = cnt[k]; modal = +k; }
  const uniq = Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; });
  let bestRun = 1, cur = 1;
  for (let i = 1; i < uniq.length; i++) {
    cur = uniq[i] === uniq[i - 1] + 1 ? cur + 1 : 1;
    if (cur > bestRun) bestRun = cur;
  }

  d.forEach(function (x) { x.held = false; });
  if (bestRun >= 3 && mc < 3) {
    // chase the straight: keep one die of each distinct value
    const seen = {};
    d.forEach(function (x) { if (!seen[x.value]) { seen[x.value] = 1; x.held = true; } });
  } else if (mc >= 2) {
    d.forEach(function (x) { if (x.value === modal) x.held = true; });
  } else {
    d.forEach(function (x) { if (x.value >= 5) x.held = true; });
  }
  // never hold everything — that wastes the reroll
  if (d.every(function (x) { return x.held; })) d[d.length - 1].held = false;
}

/** Already sitting on something big? Stop rerolling. */
function hasMadeHand(g) {
  const run = g.Game.run;
  return ['fiveKind', 'largeStraight', 'fourKind'].some(function (id) {
    if (g.E.catStatus(run, id) !== 'open') return false;
    const p = g.E.preview(run, id);
    return p.valid && !p.dead;
  });
}

function bestCategory(g) {
  const run = g.Game.run;
  let best = null, bv = -Infinity;
  g.C.CATEGORIES.forEach(function (c) {
    if (g.E.catStatus(run, c.id) !== 'open') return;
    const p = g.E.preview(run, c.id);
    const v = (p.valid && !p.dead) ? p.total : -1;
    if (v > bv) { bv = v; best = c.id; }
  });
  return best;
}

/* ---------- shop heuristics ---------- */

function drainPack(g, buffer) {
  const bus = g.bus;
  if (!bus.pendingPack) return;
  const p = bus.pendingPack;
  let taken = 0;
  for (let i = 0; i < p.options.length && taken < p.pick; i++) {
    if (g.Game.takePackOption(p.options[i])) taken++;
  }
  bus.pendingPack = null;
}

function shopCompetent(g) {
  const Game = g.Game;
  const buffer = 2;

  // consumables first — they free up slots and raise scoring floor
  let guard = 0;
  while (Game.run.consumables.length && guard++ < 12) {
    const c = Game.run.consumables[0];
    if (Game.useConsumable(c.uid, c.kind === 'omen' ? 0 : undefined) !== 'done') break;
  }

  if (Game.run.shop && Game.run.shop.voucher &&
      Game.run.money >= Game.run.shop.voucher.cost + buffer) {
    Game.buy('voucher', 0);
  }

  for (let i = 0; i < Game.run.shop.items.length; i++) {
    const it = Game.run.shop.items[i];
    if (!it) continue;
    const room = it.kind === 'charm'
      ? Game.run.charms.length < Game.run.charmSlots
      : Game.run.consumables.length < Game.run.consumableSlots;
    if (room && Game.run.money >= it.cost + buffer) Game.buy('item', i);
  }

  // one booster if it is comfortably affordable
  for (let i = 0; i < Game.run.shop.packs.length; i++) {
    const p = Game.run.shop.packs[i];
    if (p && Game.run.money >= p.cost + buffer + 4) {
      Game.buy('pack', i);
      drainPack(g, buffer);
      break;
    }
  }

  guard = 0;
  while (Game.run.consumables.length && guard++ < 12) {
    const c = Game.run.consumables[0];
    if (Game.useConsumable(c.uid, c.kind === 'omen' ? 0 : undefined) !== 'done') break;
  }
}

/* ---------- the policies ---------- */

const POLICIES = {
  random: {
    play: function (g) {
      const run = g.Game.run;
      if (run.blind.rerollsLeft > 0) {
        run.dice.forEach(function (d) { d.held = false; });
        g.Game.reroll();
      }
      return bestCategory(g);
    },
    shop: function () {}
  },

  greedy: {
    play: function (g) { return bestCategory(g); },
    shop: function (g) {
      const Game = g.Game;
      for (let i = 0; i < Game.run.shop.items.length; i++) {
        const it = Game.run.shop.items[i];
        if (it && it.kind === 'charm' && Game.run.money >= it.cost &&
            Game.run.charms.length < Game.run.charmSlots) Game.buy('item', i);
      }
    }
  },

  competent: {
    play: function (g) {
      const run = g.Game.run;
      let guard = 0;
      while (run.blind.rerollsLeft > 0 && guard++ < 8) {
        if (hasMadeHand(g)) break;
        holdTowardBest(g);
        if (!g.Game.reroll()) break;
      }
      return bestCategory(g);
    },
    shop: shopCompetent
  }
};

/* ---------- driver ---------- */

/**
 * Play one full run to completion.
 * @returns {{outcome:string, ante:number, blindIndex:number, round:number,
 *            charms:string[], best:number, money:number, steps:number}}
 */
function runOne(g, seed, policyName, opts) {
  opts = opts || {};
  const pol = POLICIES[policyName] || POLICIES.competent;
  const Game = g.Game;

  Game.abandon();
  Game.newRun(seed, opts.runOpts);

  let steps = 0;
  const maxAnte = opts.maxAnte || 8;

  while (steps++ < 8000) {
    const run = Game.run;

    if (run.phase === 'gameover') {
      return summarise(run, 'died', steps);
    }
    if (run.phase === 'won') {
      return summarise(run, 'won', steps);
    }
    if (run.phase === 'blindSelect') {
      if (run.ante > maxAnte) return summarise(run, 'capped', steps);
      Game.startBlind();
      continue;
    }
    if (run.phase === 'cashout') { Game.advanceAfterCashout(); continue; }
    if (run.phase === 'shop') {
      try { pol.shop(g); } catch (e) { return summarise(run, 'shop-error:' + e.message, steps); }
      g.bus.pendingPack = null;
      if (Game.run.shop) Game.leaveShop();
      continue;
    }
    if (run.phase === 'playing') {
      const cat = pol.play(g);
      if (cat === null) return summarise(run, 'stuck', steps);
      const res = Game.scoreCategory(cat);
      if (!res) return summarise(run, 'reject', steps);
      Game.applyScore(res);
      continue;
    }
    return summarise(run, 'unknown-phase:' + run.phase, steps);
  }
  return summarise(Game.run, 'timeout', steps);
}

function summarise(run, outcome, steps) {
  return {
    outcome: outcome,
    ante: run.ante,
    blindIndex: run.blindIndex,
    round: run.roundNum,
    charms: run.charms.map(function (c) { return c.id; }),
    vouchers: run.vouchers.slice(),
    best: run.stats.best,
    money: run.money,
    steps: steps
  };
}

module.exports = { POLICIES: POLICIES, runOne: runOne, holdTowardBest: holdTowardBest };
