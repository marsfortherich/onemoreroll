/* ============================================================
   charms.js — the "Joker" library

   Hook API (all optional). `ctx` is the scoring context built by
   engine.js and exposes: chips, mult, cat, level, scoring[], held[],
   allDice[], rerollsUsed, turnIndex, turnsLeft, run, commit,
   addChips(n,src) addMult(n,src) xmult(n,src) earn(n,src) note(txt,src)

   onDieScored(ctx, die, i)      once per trigger of each scoring die
   onDieHeld(ctx, die, i)        once per unscored die
   onScore(ctx)                  after all dice have resolved
   retrigger(ctx, die, i)        -> extra trigger count for that die
   onTurnEnd(run, res)           after a turn is committed
   onBlindStart(run) / onBlindEnd(run)
   onReroll(run)
   onBuy(run) / onSell(run)
   desc(charm, run)              -> HTML string
   init                          -> initial `state` object
   ============================================================ */
(function (global) {
  'use strict';

  const RAR = { COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare', LEGENDARY: 'legendary' };
  const RARITY_COST = { common: 4, uncommon: 6, rare: 8, legendary: 10 };

  /** bump a scaling stat, but only for real (committed) scoring */
  function grow(ctx, charm, key, amt) {
    if (!ctx.commit) return;
    charm.state[key] = (charm.state[key] || 0) + amt;
  }
  function st(charm, key, dflt) {
    const v = charm.state ? charm.state[key] : undefined;
    return v === undefined ? dflt : v;
  }
  function counts(values) {
    const m = {};
    values.forEach(function (v) { m[v] = (m[v] || 0) + 1; });
    return m;
  }

  const CHARMS = [
    /* ---------------- flat mult / chips ---------------- */
    {
      id: 'lucky_seven', name: 'Lucky Seven', icon: '\u{1F340}', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">+7 Fortune</span>'; },
      onScore: function (ctx, c) { ctx.addMult(7, c); }
    },
    {
      id: 'pip_counter', name: 'Pip Counter', icon: '\u{1F9EE}', rarity: RAR.COMMON,
      desc: function () { return '<span class="c">+50 Pips</span>'; },
      onScore: function (ctx, c) { ctx.addChips(50, c); }
    },
    {
      id: 'double_down', name: 'Double Down', icon: '\u{23EB}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X1.5 Fortune</span>'; },
      onScore: function (ctx, c) { ctx.xmult(1.5, c); }
    },
    {
      id: 'chip_stack', name: 'Pip Stack', icon: '\u{1FA99}', rarity: RAR.COMMON,
      desc: function () { return '<span class="c">+12 Pips</span> for every scoring die'; },
      onScore: function (ctx, c) { ctx.addChips(12 * ctx.scoring.length, c); }
    },
    {
      id: 'sum_total', name: 'Sum Total', icon: '\u{2795}', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">+1 Fortune</span> per <b>4</b> total pips on scoring dice'; },
      onScore: function (ctx, c) {
        let s = 0; ctx.scoring.forEach(function (d) { s += d.value; });
        ctx.addMult(Math.floor(s / 4), c);
      }
    },

    /* ---------------- face-based ---------------- */
    {
      id: 'snake_eyes', name: 'Snake Eyes', icon: '\u{1F40D}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Each scoring <b>1</b> gives <span class="m">+12 Fortune</span>'; },
      onDieScored: function (ctx, die, i, c) { if (die.value === 1) ctx.addMult(12, c); }
    },
    {
      id: 'boxcars', name: 'Boxcars', icon: '\u{1F686}', rarity: RAR.COMMON,
      desc: function () { return 'Each scoring <b>6</b> gives <span class="c">+30 Pips</span>'; },
      onDieScored: function (ctx, die, i, c) { if (die.value === 6) ctx.addChips(30, c); }
    },
    {
      id: 'odd_job', name: 'Odd Job', icon: '\u{1F3AD}', rarity: RAR.COMMON,
      desc: function () { return 'Each scoring <b>odd</b> die gives <span class="m">+3 Fortune</span>'; },
      onDieScored: function (ctx, die, i, c) { if (die.value % 2 === 1) ctx.addMult(3, c); }
    },
    {
      id: 'even_steven', name: 'Even Steven', icon: '\u{2696}️', rarity: RAR.COMMON,
      desc: function () { return 'Each scoring <b>even</b> die gives <span class="m">+3 Fortune</span>'; },
      onDieScored: function (ctx, die, i, c) { if (die.value % 2 === 0) ctx.addMult(3, c); }
    },
    {
      id: 'prime_time', name: 'Prime Time', icon: '\u{1F52A}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Each scoring <b>2</b>, <b>3</b> or <b>5</b> gives <span class="m">+5 Fortune</span>'; },
      onDieScored: function (ctx, die, i, c) {
        if (die.value === 2 || die.value === 3 || die.value === 5) ctx.addMult(5, c);
      }
    },
    {
      id: 'high_roller', name: 'High Roller', icon: '\u{1F3B0}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Scoring dice showing <b>5</b> or <b>6</b> give <span class="c">+20 Pips</span> and <span class="m">+2 Fortune</span>'; },
      onDieScored: function (ctx, die, i, c) {
        if (die.value >= 5) { ctx.addChips(20, c); ctx.addMult(2, c); }
      }
    },

    /* ---------------- category-based ---------------- */
    {
      id: 'the_trio', name: 'The Trio', icon: '\u{1F3B3}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X2 Fortune</span> if the category is <b>Three of a Kind</b>'; },
      onScore: function (ctx, c) { if (ctx.cat.id === 'threeKind') ctx.xmult(2, c); }
    },
    {
      id: 'quads', name: 'Quadratic', icon: '\u{1F536}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X2.5 Fortune</span> if the category is <b>Four of a Kind</b>'; },
      onScore: function (ctx, c) { if (ctx.cat.id === 'fourKind') ctx.xmult(2.5, c); }
    },
    {
      id: 'house_rules', name: 'House Rules', icon: '\u{1F3E0}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X2.5 Fortune</span> if the category is <b>Full House</b>'; },
      onScore: function (ctx, c) { if (ctx.cat.id === 'fullHouse') ctx.xmult(2.5, c); }
    },
    {
      id: 'straight_edge', name: 'Straight Edge', icon: '\u{1F4CF}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Straights give <span class="c">+80 Pips</span> and <span class="m">+8 Fortune</span>'; },
      onScore: function (ctx, c) {
        if (ctx.cat.id === 'smallStraight' || ctx.cat.id === 'largeStraight') {
          ctx.addChips(80, c); ctx.addMult(8, c);
        }
      }
    },
    {
      id: 'big_five', name: 'Big Five', icon: '\u{1F31F}', rarity: RAR.RARE,
      desc: function () { return '<span class="m">X4 Fortune</span> if the category is <b>Five of a Kind</b>'; },
      onScore: function (ctx, c) { if (ctx.cat.id === 'fiveKind') ctx.xmult(4, c); }
    },
    {
      id: 'upper_hand', name: 'Upper Hand', icon: '\u{1F446}', rarity: RAR.UNCOMMON,
      desc: function () { return '<b>Upper section</b> categories give <span class="c">+60 Pips</span> and <span class="m">+6 Fortune</span>'; },
      onScore: function (ctx, c) {
        if (ctx.cat.section === 'upper') { ctx.addChips(60, c); ctx.addMult(6, c); }
      }
    },
    {
      id: 'ace_high', name: 'Ace High', icon: '\u{2660}️', rarity: RAR.UNCOMMON,
      desc: function () { return 'In <b>Aces</b>, every scoring die counts as <span class="c">11 Pips</span>'; },
      onDieScored: function (ctx, die, i, c) {
        if (ctx.cat.id === 'ones') ctx.addChips(10, c);
      }
    },
    {
      id: 'chancer', name: 'Chancer', icon: '\u{1F3B2}', rarity: RAR.COMMON,
      desc: function () { return '<b>Chance</b> gives <span class="m">X3 Fortune</span>'; },
      onScore: function (ctx, c) { if (ctx.cat.id === 'chance') ctx.xmult(3, c); }
    },
    {
      id: 'pairs_well', name: 'Pairs Well', icon: '\u{1F46B}', rarity: RAR.COMMON,
      desc: function () { return '<span class="c">+35 Pips</span> for each <b>pair</b> among the scoring dice'; },
      onScore: function (ctx, c) {
        const m = counts(ctx.scoring.map(function (d) { return d.value; }));
        let pairs = 0;
        for (const k in m) pairs += Math.floor(m[k] / 2);
        ctx.addChips(35 * pairs, c);
      }
    },
    {
      id: 'full_send', name: 'Full Send', icon: '\u{1F680}', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">X1.6 Fortune</span> if <b>5 or more</b> dice score'; },
      onScore: function (ctx, c) { if (ctx.scoring.length >= 5) ctx.xmult(1.6, c); }
    },
    {
      id: 'minimalist', name: 'Minimalist', icon: '\u{1F4A0}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X3 Fortune</span> if <b>2 or fewer</b> dice score'; },
      onScore: function (ctx, c) { if (ctx.scoring.length <= 2) ctx.xmult(3, c); }
    },
    {
      id: 'bakers_dozen', name: "Baker's Dozen", icon: '\u{1F950}', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">+13 Fortune</span> if scoring pips total exactly <b>13</b>'; },
      onScore: function (ctx, c) {
        let s = 0; ctx.scoring.forEach(function (d) { s += d.value; });
        if (s === 13) ctx.addMult(13, c);
      }
    },

    /* ---------------- reroll / tempo ---------------- */
    {
      id: 'gamblers_charm', name: "Gambler's Charm", icon: '\u{1F9FF}', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">+4 Fortune</span> per reroll used this turn'; },
      onScore: function (ctx, c) { ctx.addMult(4 * ctx.rerollsUsed, c); }
    },
    {
      id: 'cold_streak', name: 'Cold Streak', icon: '\u{2744}️', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X2.5 Fortune</span> if you used <b>no rerolls</b> this turn'; },
      onScore: function (ctx, c) { if (ctx.rerollsUsed === 0) ctx.xmult(2.5, c); }
    },
    {
      id: 'blind_luck', name: 'Blind Luck', icon: '\u{1F576}️', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X3 Fortune</span> on the <b>first turn</b> of a blind'; },
      onScore: function (ctx, c) { if (ctx.turnIndex === 0) ctx.xmult(3, c); }
    },
    {
      id: 'last_stand', name: 'Last Stand', icon: '\u{1F6E1}️', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X3 Fortune</span> on the <b>final turn</b> of a blind'; },
      onScore: function (ctx, c) { if (ctx.turnsLeft <= 1) ctx.xmult(3, c); }
    },
    {
      id: 'momentum', name: 'Momentum', icon: '\u{1F3C3}', rarity: RAR.UNCOMMON,
      init: function () { return { chips: 0 }; },
      desc: function (ch) { return 'Currently <span class="c">+' + st(ch, 'chips', 0) + ' Pips</span>.<br>Gains <span class="c">+25 Pips</span> per turn scored. Resets each blind.'; },
      onScore: function (ctx, c) { ctx.addChips(st(c, 'chips', 0), c); },
      onTurnEnd: function (run, res, c) { c.state.chips = (c.state.chips || 0) + 25; },
      onBlindStart: function (run, c) { c.state.chips = 0; }
    },
    {
      id: 'tally_mark', name: 'Tally Mark', icon: '\u{1F4CA}', rarity: RAR.RARE,
      init: function () { return { mult: 0 }; },
      desc: function (ch) { return 'Currently <span class="m">+' + st(ch, 'mult', 0) + ' Fortune</span>.<br>Gains <span class="m">+2 Fortune</span> every turn scored — <b>permanently</b>'; },
      onScore: function (ctx, c) { ctx.addMult(st(c, 'mult', 0), c); },
      onTurnEnd: function (run, res, c) { c.state.mult = (c.state.mult || 0) + 2; }
    },
    {
      id: 'ivory_tower', name: 'Ivory Tower', icon: '\u{1F3F0}', rarity: RAR.RARE,
      init: function () { return { x: 1 }; },
      desc: function (ch) { return 'Currently <span class="m">X' + U.fmtMult(st(ch, 'x', 1)) + ' Fortune</span>.<br>Gains <span class="m">X0.25</span> each time you score a <b>Five of a Kind</b>'; },
      onScore: function (ctx, c) {
        ctx.xmult(st(c, 'x', 1), c);
        if (ctx.commit && ctx.cat.id === 'fiveKind') c.state.x = st(c, 'x', 1) + 0.25;
      }
    },
    {
      id: 'hot_hand', name: 'Hot Hand', icon: '\u{1F525}', rarity: RAR.RARE,
      init: function () { return { x: 1, last: 0 }; },
      desc: function (ch) { return 'Currently <span class="m">X' + U.fmtMult(st(ch, 'x', 1)) + ' Fortune</span>.<br>Gains <span class="m">X0.2</span> when a turn beats the previous one. Resets each blind.'; },
      onScore: function (ctx, c) { ctx.xmult(st(c, 'x', 1), c); },
      onTurnEnd: function (run, res, c) {
        if (res.total > (c.state.last || 0)) c.state.x = st(c, 'x', 1) + 0.2;
        else c.state.x = 1;
        c.state.last = res.total;
      },
      onBlindStart: function (run, c) { c.state.x = 1; c.state.last = 0; }
    },

    /* ---------------- retriggers ---------------- */
    {
      id: 'duplicator', name: 'Duplicator', icon: '\u{1F5B6}️', rarity: RAR.UNCOMMON,
      desc: function () { return 'Retriggers the <b>first</b> scoring die'; },
      retrigger: function (ctx, die, i) { return i === 0 ? 1 : 0; }
    },
    {
      id: 'echo', name: 'Echo', icon: '\u{1F50A}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Retriggers the <b>last</b> scoring die'; },
      retrigger: function (ctx, die, i) { return i === ctx.scoring.length - 1 ? 1 : 0; }
    },
    {
      id: 'mirror_die', name: 'Mirror Die', icon: '\u{1FA9E}', rarity: RAR.RARE,
      desc: function () { return 'Retriggers every scoring die showing the <b>most common</b> value'; },
      retrigger: function (ctx, die, i) {
        const m = counts(ctx.scoring.map(function (d) { return d.value; }));
        let best = 0, bestV = null;
        for (const k in m) { if (m[k] > best) { best = m[k]; bestV = +k; } }
        return die.value === bestV ? 1 : 0;
      }
    },
    {
      id: 'stutter', name: 'Stutter', icon: '\u{23ED}️', rarity: RAR.LEGENDARY,
      desc: function () { return 'Retriggers <b>all</b> scoring dice once'; },
      retrigger: function () { return 1; }
    },

    /* ---------------- dice-modifier synergies ---------------- */
    {
      id: 'glassblower', name: 'Glassblower', icon: '\u{1FAA9}', rarity: RAR.RARE,
      desc: function () { return '<b>Glass Dice</b> never shatter, but give <span class="m">X1.75</span> instead of X2'; },
      passive: 'glassSafe'
    },
    {
      id: 'rabbits_foot', name: "Rabbit's Foot", icon: '\u{1F430}', rarity: RAR.UNCOMMON,
      desc: function () { return '<b>Lucky Dice</b> trigger <b>twice</b> as often'; },
      passive: 'luckyBoost'
    },
    {
      id: 'steel_nerves', name: 'Steel Nerves', icon: '\u{1F9F2}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Each <b>unscored</b> die gives <span class="c">+25 Pips</span>'; },
      onDieHeld: function (ctx, die, i, c) { ctx.addChips(25, c); }
    },
    {
      id: 'quarry', name: 'The Quarry', icon: '\u{26F0}️', rarity: RAR.UNCOMMON,
      desc: function () { return 'Each <b>Stone Die</b> you own gives <span class="m">+4 Fortune</span>'; },
      onScore: function (ctx, c) {
        let n = 0;
        ctx.run.dice.forEach(function (d) { if (d.enhancement === 'stone') n++; });
        ctx.addMult(4 * n, c);
      }
    },
    {
      id: 'midas', name: 'Midas Touch', icon: '\u{1F451}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Each <b>Gold Die</b> scored also gives <span class="m">+6 Fortune</span>'; },
      onDieScored: function (ctx, die, i, c) { if (die.enhancement === 'gold') ctx.addMult(6, c); }
    },

    /* ---------------- economy ---------------- */
    {
      id: 'hoarder', name: 'Hoarder', icon: '\u{1F9F3}', rarity: RAR.COMMON,
      desc: function () { return 'Earn <b>$1</b> per unused reroll at the end of each turn'; },
      onTurnEnd: function (run, res, c) {
        const n = run.blind.rerollsLeft;
        if (n > 0) Game.earn(n, 'Hoarder');
      }
    },
    {
      id: 'golden_touch', name: 'Golden Egg', icon: '\u{1F95A}', rarity: RAR.COMMON,
      desc: function () { return 'Earn <b>$5</b> at the end of every blind'; },
      onBlindEnd: function (run, c) { Game.earn(5, 'Golden Egg'); }
    },
    {
      id: 'ledger_charm', name: 'Interest Ledger', icon: '\u{1F4D2}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Interest cap raised by <b>$5</b>'; },
      passive: 'interest5'
    },
    {
      id: 'scorekeeper', name: 'Scorekeeper', icon: '\u{1F4D1}', rarity: RAR.COMMON,
      desc: function (ch, run) { return '<span class="c">+2 Pips</span> per <b>$1</b> you hold<br><span class="c">(+' + (run ? run.money * 2 : 0) + ' Pips)</span>'; },
      onScore: function (ctx, c) { ctx.addChips(2 * Math.max(0, ctx.run.money), c); }
    },
    {
      id: 'debt_collector', name: 'Debt Collector', icon: '\u{1F9FE}', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">+12 Fortune</span> while you have <b>$4 or less</b>'; },
      onScore: function (ctx, c) { if (ctx.run.money <= 4) ctx.addMult(12, c); }
    },
    {
      id: 'fat_stacks', name: 'Fat Stacks', icon: '\u{1F4B0}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X2 Fortune</span> while you have <b>$40 or more</b>'; },
      onScore: function (ctx, c) { if (ctx.run.money >= 40) ctx.xmult(2, c); }
    },
    {
      id: 'overkill', name: 'Overkill', icon: '\u{1F4A5}', rarity: RAR.COMMON,
      desc: function () { return 'Earn <b>$6</b> when a blind is beaten with <b>double</b> its target'; },
      onBlindEnd: function (run, c) {
        if (run.blind.score >= run.blind.target * 2) Game.earn(6, 'Overkill');
      }
    },

    /* ---------------- slots / meta ---------------- */
    {
      id: 'collector', name: 'Collector', icon: '\u{1F5C3}️', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">+3 Fortune</span> for each Charm you own'; },
      onScore: function (ctx, c) { ctx.addMult(3 * ctx.run.charms.length, c); }
    },
    {
      id: 'vacancy', name: 'Vacancy', icon: '\u{1F573}️', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X1.35 Fortune</span> for each <b>empty</b> Charm slot'; },
      onScore: function (ctx, c) {
        const empty = Math.max(0, ctx.run.charmSlots - ctx.run.charms.length);
        for (let i = 0; i < empty; i++) ctx.xmult(1.35, c);
      }
    },
    {
      id: 'sixth_sense', name: 'Sixth Sense', icon: '\u{1F441}️', rarity: RAR.RARE,
      desc: function () { return '<b>+1</b> die in your pool'; },
      passive: 'extraDie'
    },
    {
      id: 'extra_roll', name: 'Extra Roll', icon: '\u{1F504}', rarity: RAR.RARE,
      desc: function () { return '<b>+1</b> reroll every turn'; },
      passive: 'extraReroll'
    },
    {
      id: 'time_keeper', name: 'Timekeeper', icon: '\u{23F0}', rarity: RAR.RARE,
      desc: function () { return '<b>+1</b> turn every blind'; },
      passive: 'extraTurn'
    },
    {
      id: 'scratchproof', name: 'Scratchproof', icon: '\u{1F6E0}️', rarity: RAR.RARE,
      desc: function () { return 'Scoring an <b>invalid</b> category earns <b>$6</b> and does not use up that category'; },
      passive: 'scratchproof'
    },
    {
      id: 'loaded_dice', name: 'Loaded Dice', icon: '\u{1F3AF}', rarity: RAR.RARE,
      desc: function () { return 'Rerolled dice are rolled <b>twice</b> — the higher face is kept'; },
      passive: 'loaded'
    },
    {
      id: 'weighted', name: 'Weighted', icon: '\u{2696}️', rarity: RAR.UNCOMMON,
      desc: function () { return 'Rerolled dice can never land on their <b>lowest</b> face'; },
      passive: 'noLow'
    },
    {
      /* Replaying a category is the one thing the base game never lets you do,
         so it is deliberately rationed: unlimited replays would just mean
         scoring your best category every turn, and the scorecard would stop
         being a constraint at all. `encores` is a count so a future charm can
         grant more without touching game.js. */
      id: 'encore', name: 'Encore', icon: '\u{1F3AD}', rarity: RAR.RARE,
      desc: function () {
        return 'The <b>first</b> category you score each blind is <b>not used up</b>';
      },
      passive: 'encore', encores: 1
    },
    {
      id: 'the_archivist', name: 'The Archivist', icon: '\u{1F4DA}', rarity: RAR.RARE,
      desc: function () { return 'Every category starts each blind <b>1 level higher</b>'; },
      passive: 'levelBoost'
    },
    {
      id: 'wildcard', name: 'Wildcard', icon: '\u{1F0CF}', rarity: RAR.LEGENDARY,
      init: function () { return { mult: 0 }; },
      desc: function (ch) { return 'Currently <span class="m">+' + st(ch, 'mult', 0) + ' Fortune</span>.<br>Gains <span class="m">+6 Fortune</span> whenever you score a category for the <b>first time</b> in a run'; },
      onScore: function (ctx, c) { ctx.addMult(st(c, 'mult', 0), c); },
      onTurnEnd: function (run, res, c) {
        if (!run.everScored) run.everScored = {};
        if (!run.everScored[res.catId]) { run.everScored[res.catId] = true; c.state.mult = (c.state.mult || 0) + 6; }
      }
    },
    {
      id: 'the_obelisk', name: 'The Obelisk', icon: '\u{1F5FC}', rarity: RAR.LEGENDARY,
      init: function () { return { x: 1 }; },
      desc: function (ch) { return 'Currently <span class="m">X' + U.fmtMult(st(ch, 'x', 1)) + ' Fortune</span>.<br>Gains <span class="m">X0.15</span> per turn that does <b>not</b> use your most-played category'; },
      onScore: function (ctx, c) { ctx.xmult(st(c, 'x', 1), c); },
      onTurnEnd: function (run, res, c) {
        let best = null, bn = -1;
        for (const k in run.catPlays) { if (run.catPlays[k] > bn) { bn = run.catPlays[k]; best = k; } }
        if (res.catId !== best) c.state.x = st(c, 'x', 1) + 0.15;
        else c.state.x = 1;
      }
    },
    {
      id: 'perfectionist', name: 'Perfectionist', icon: '\u{1F48E}', rarity: RAR.LEGENDARY,
      desc: function () { return '<span class="m">X5 Fortune</span>, but only while <b>every</b> die in your pool is enhanced'; },
      onScore: function (ctx, c) {
        const all = ctx.run.dice.every(function (d) { return !!d.enhancement; });
        if (all) ctx.xmult(5, c);
      }
    }
  ];

  const CHARM_BY_ID = {};
  CHARMS.forEach(function (c) {
    c.cost = c.cost || RARITY_COST[c.rarity];
    CHARM_BY_ID[c.id] = c;
  });

  /** Does the run own a charm with this passive flag? */
  function hasPassive(run, flag) {
    for (let i = 0; i < run.charms.length; i++) {
      const def = CHARM_BY_ID[run.charms[i].id];
      if (def && def.passive === flag) return true;
    }
    return false;
  }
  /** Total of a numeric field across every charm carrying `flag`. */
  function sumPassive(run, flag, field) {
    let n = 0;
    for (let i = 0; i < run.charms.length; i++) {
      const def = CHARM_BY_ID[run.charms[i].id];
      if (def && def.passive === flag) n += (def[field] || 0);
    }
    return n;
  }
  function countPassive(run, flag) {
    let n = 0;
    for (let i = 0; i < run.charms.length; i++) {
      const def = CHARM_BY_ID[run.charms[i].id];
      if (def && def.passive === flag) n++;
    }
    return n;
  }

  global.CH = {
    CHARMS: CHARMS, CHARM_BY_ID: CHARM_BY_ID, RARITY_COST: RARITY_COST,
    hasPassive: hasPassive, countPassive: countPassive, sumPassive: sumPassive, grow: grow, st: st
  };
})(window);
