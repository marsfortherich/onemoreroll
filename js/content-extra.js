/* ============================================================
   content-extra.js — content expansion pack

   Appends to the base tables and re-indexes them. Kept separate from
   content.js/charms.js so the original hand-tuned core stays readable
   and this file can grow without turning into a wall.

   Loaded AFTER charms.js and content.js, BEFORE engine.js.
   ============================================================ */
(function (global) {
  'use strict';

  const RAR = { COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare', LEGENDARY: 'legendary' };

  function st(charm, key, dflt) {
    const v = charm.state ? charm.state[key] : undefined;
    return v === undefined ? dflt : v;
  }
  function scoringValues(ctx) {
    return ctx.scoring.map(function (d) { return d.value; });
  }
  function pipTotal(ctx) {
    let s = 0; ctx.scoring.forEach(function (d) { s += d.value; }); return s;
  }

  /* ============================================================
     CHARMS
     ============================================================ */
  const MORE_CHARMS = [
    /* ---------------- scaling engines ---------------- */
    {
      id: 'ratchet', name: 'Ratchet', icon: '\u{1F527}', rarity: RAR.UNCOMMON,
      init: function () { return { mult: 0 }; },
      desc: function (ch) { return 'Currently <span class="m">+' + st(ch, 'mult', 0) + ' Fortune</span>.<br>Gains <span class="m">+2 Fortune</span> for every reroll you spend, <b>permanently</b>'; },
      onScore: function (ctx, c) { ctx.addMult(st(c, 'mult', 0), c); },
      onReroll: function (run, c) { c.state.mult = (c.state.mult || 0) + 2; }
    },
    {
      id: 'cartographer', name: 'Cartographer', icon: '\u{1F5FA}️', rarity: RAR.UNCOMMON,
      init: function () { return { chips: 0 }; },
      desc: function (ch) { return 'Currently <span class="c">+' + st(ch, 'chips', 0) + ' Pips</span>.<br>Gains <span class="c">+40 Pips</span> for every blind you clear'; },
      onScore: function (ctx, c) { ctx.addChips(st(c, 'chips', 0), c); },
      onBlindEnd: function (run, c) { c.state.chips = (c.state.chips || 0) + 40; }
    },
    {
      id: 'tithe', name: 'Tithe', icon: '⛪', rarity: RAR.RARE,
      init: function () { return { mult: 0 }; },
      desc: function (ch) { return 'Currently <span class="m">+' + st(ch, 'mult', 0) + ' Fortune</span>.<br>Gains <span class="m">+8 Fortune</span> for every <b>Boss Blind</b> you defeat'; },
      onScore: function (ctx, c) { ctx.addMult(st(c, 'mult', 0), c); },
      onBlindEnd: function (run, c) {
        if (run.blind && run.blind.bossId) c.state.mult = (c.state.mult || 0) + 8;
      }
    },
    {
      id: 'scrivener', name: 'Scrivener', icon: '\u{1F58B}️', rarity: RAR.UNCOMMON,
      init: function () { return { mult: 0, seen: null }; },
      desc: function (ch) { return 'Currently <span class="m">+' + st(ch, 'mult', 0) + ' Fortune</span>.<br>Gains <span class="m">+3 Fortune</span> whenever a category gains a level'; },
      onScore: function (ctx, c) { ctx.addMult(st(c, 'mult', 0), c); },
      onTurnEnd: function (run, res, c) {
        let sum = 0;
        for (const k in run.levels) sum += run.levels[k];
        if (c.state.seen === null) { c.state.seen = sum; return; }
        if (sum > c.state.seen) c.state.mult = (c.state.mult || 0) + 3 * (sum - c.state.seen);
        c.state.seen = sum;
      },
      onBlindStart: function (run, c) {
        let sum = 0;
        for (const k in run.levels) sum += run.levels[k];
        if (c.state.seen === null) c.state.seen = sum;
      }
    },
    {
      id: 'vulture', name: 'Vulture', icon: '\u{1F985}', rarity: RAR.UNCOMMON,
      init: function () { return { chips: 0 }; },
      desc: function (ch) { return 'Currently <span class="c">+' + st(ch, 'chips', 0) + ' Pips</span>.<br>Gains <span class="c">+80 Pips</span> whenever one of your dice is destroyed'; },
      onScore: function (ctx, c) { ctx.addChips(st(c, 'chips', 0), c); },
      onTurnEnd: function (run, res, c) {
        if (res.shattered && res.shattered.length) {
          c.state.chips = (c.state.chips || 0) + 80 * res.shattered.length;
        }
      }
    },
    {
      id: 'hoard', name: 'The Hoard', icon: '\u{1F48E}', rarity: RAR.RARE,
      init: function () { return { x: 1 }; },
      desc: function (ch) { return 'Currently <span class="m">X' + U.fmtMult(st(ch, 'x', 1)) + ' Fortune</span>.<br>Gains <span class="m">X0.05</span> per <b>$10</b> you hold when a blind ends'; },
      onScore: function (ctx, c) { ctx.xmult(st(c, 'x', 1), c); },
      onBlindEnd: function (run, c) {
        const steps = Math.floor(run.money / 10);
        if (steps > 0) c.state.x = st(c, 'x', 1) + 0.05 * steps;
      }
    },

    /* ---------------- shape of the dice ---------------- */
    {
      id: 'monotone', name: 'Monotone', icon: '\u{1F3B5}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X2.5 Fortune</span> if every scoring die shows the <b>same</b> value'; },
      onScore: function (ctx, c) {
        const v = scoringValues(ctx);
        if (v.length > 1 && v.every(function (x) { return x === v[0]; })) ctx.xmult(2.5, c);
      }
    },
    {
      id: 'rainbow', name: 'Rainbow', icon: '\u{1F308}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">X2.5 Fortune</span> if every scoring die shows a <b>different</b> value'; },
      onScore: function (ctx, c) {
        const v = scoringValues(ctx);
        if (v.length > 1 && new Set(v).size === v.length) ctx.xmult(2.5, c);
      }
    },
    {
      id: 'ascending', name: 'Ascending', icon: '\u{1F4C8}', rarity: RAR.RARE,
      desc: function () { return '<span class="m">X3 Fortune</span> if the scoring dice, left to right, never decrease'; },
      onScore: function (ctx, c) {
        const v = scoringValues(ctx);
        if (v.length < 2) return;
        for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) return;
        ctx.xmult(3, c);
      }
    },
    {
      id: 'symmetry', name: 'Symmetry', icon: '\u{1F98B}', rarity: RAR.RARE,
      desc: function () { return '<span class="m">X3 Fortune</span> if the scoring dice read the <b>same backwards</b>'; },
      onScore: function (ctx, c) {
        const v = scoringValues(ctx);
        if (v.length < 3) return;
        for (let i = 0, j = v.length - 1; i < j; i++, j--) if (v[i] !== v[j]) return;
        ctx.xmult(3, c);
      }
    },
    {
      id: 'low_roller', name: 'Low Roller', icon: '\u{1F41C}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Scoring dice showing <b>1</b> or <b>2</b> give <span class="c">+25 Pips</span> and <span class="m">+4 Fortune</span>'; },
      onDieScored: function (ctx, die, i, c) {
        if (die.value <= 2) { ctx.addChips(25, c); ctx.addMult(4, c); }
      }
    },
    {
      id: 'seven_up', name: 'Seven Up', icon: '\u{1F3B0}', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">+11 Fortune</span> if the scoring pips total a multiple of <b>7</b>'; },
      onScore: function (ctx, c) {
        const s = pipTotal(ctx);
        if (s > 0 && s % 7 === 0) ctx.addMult(11, c);
      }
    },
    {
      id: 'overflow', name: 'Overflow', icon: '\u{1F30A}', rarity: RAR.UNCOMMON,
      desc: function () { return '<span class="m">+8 Fortune</span> for every die in your pool beyond the fifth'; },
      onScore: function (ctx, c) {
        ctx.addMult(8 * Math.max(0, ctx.run.dice.length - 5), c);
      }
    },
    {
      id: 'the_pit', name: 'The Pit', icon: '\u{1F573}️', rarity: RAR.RARE,
      desc: function () { return '<span class="m">X3 Fortune</span> while you have <b>4 or fewer</b> dice'; },
      onScore: function (ctx, c) { if (ctx.run.dice.length <= 4) ctx.xmult(3, c); }
    },

    /* ---------------- retriggers ---------------- */
    {
      id: 'twin_flame', name: 'Twin Flame', icon: '\u{1F525}', rarity: RAR.RARE,
      desc: function () { return 'Retriggers every scoring die that <b>shares its value</b> with another scoring die'; },
      retrigger: function (ctx, die) {
        let n = 0;
        ctx.scoring.forEach(function (d) { if (d.value === die.value) n++; });
        return n > 1 ? 1 : 0;
      }
    },
    {
      id: 'bookends', name: 'Bookends', icon: '\u{1F4DA}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Retriggers both the <b>first</b> and the <b>last</b> scoring die'; },
      retrigger: function (ctx, die, i) {
        return (i === 0 || i === ctx.scoring.length - 1) ? 1 : 0;
      }
    },
    {
      id: 'polish', name: 'Polish', icon: '✨', rarity: RAR.UNCOMMON,
      desc: function () { return 'Retriggers every scoring die that has an <b>edition</b>'; },
      retrigger: function (ctx, die) { return die.edition ? 1 : 0; }
    },
    {
      id: 'understudy', name: 'Understudy', icon: '\u{1F3AD}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Each <b>unscored</b> die gives <span class="m">+3 Fortune</span>'; },
      onDieHeld: function (ctx, die, i, c) { ctx.addMult(3, c); }
    },

    /* ---------------- economy ---------------- */
    {
      id: 'usurer', name: 'Usurer', icon: '\u{1F4B9}', rarity: RAR.COMMON,
      desc: function () { return 'Earn <b>$1</b> per Charm you own at the end of every blind'; },
      onBlindEnd: function (run, c) { Game.earn(run.charms.length, 'Usurer'); }
    },
    {
      id: 'tax_haven', name: 'Tax Haven', icon: '\u{1F3DD}️', rarity: RAR.COMMON,
      desc: function () { return 'Earn <b>$4</b> whenever you scratch a category for 0'; },
      onTurnEnd: function (run, res, c) {
        if (!res.valid || res.dead) Game.earn(4, 'Tax Haven');
      }
    },
    {
      id: 'piggy_bank', name: 'Piggy Bank', icon: '\u{1F416}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Earn <b>$10</b> each time you defeat a <b>Boss Blind</b>'; },
      onBlindEnd: function (run, c) {
        if (run.blind && run.blind.bossId) Game.earn(10, 'Piggy Bank');
      }
    },
    {
      id: 'broker', name: 'Broker', icon: '\u{1F454}', rarity: RAR.UNCOMMON,
      desc: function () { return 'Shop rerolls are <b>free</b>'; },
      passive: 'freeReroll'
    },

    /* ---------------- category play ---------------- */
    {
      id: 'ladder', name: 'Ladder', icon: '\u{1FA9C}', rarity: RAR.RARE,
      desc: function () { return 'Straights give <span class="m">X2 Fortune</span> and <b>level up</b> when you score them'; },
      onScore: function (ctx, c) {
        if (ctx.cat.id === 'smallStraight' || ctx.cat.id === 'largeStraight') ctx.xmult(2, c);
      },
      onTurnEnd: function (run, res, c) {
        if (res.valid && (res.catId === 'smallStraight' || res.catId === 'largeStraight')) {
          run.levels[res.catId] = (run.levels[res.catId] || 1) + 1;
        }
      }
    },
    {
      id: 'understated', name: 'Understated', icon: '\u{1F4C9}', rarity: RAR.COMMON,
      desc: function () { return '<b>Chance</b> gives <span class="c">+120 Pips</span>'; },
      onScore: function (ctx, c) { if (ctx.cat.id === 'chance') ctx.addChips(120, c); }
    },
    {
      id: 'housekeeper', name: 'Housekeeper', icon: '\u{1F9F9}', rarity: RAR.UNCOMMON,
      desc: function () { return '<b>Full House</b> gives <span class="m">X1.8 Fortune</span> and <b>$4</b>'; },
      onScore: function (ctx, c) {
        if (ctx.cat.id === 'fullHouse') { ctx.xmult(1.8, c); ctx.earn(4, c); }
      }
    },
    {
      id: 'purist', name: 'Purist', icon: '\u{1F5FF}', rarity: RAR.RARE,
      desc: function () { return '<b>Upper section</b> gives <span class="m">X2.5 Fortune</span>.<br><b>Lower section</b> gives <span class="m">X0.6 Fortune</span>'; },
      onScore: function (ctx, c) { ctx.xmult(ctx.cat.section === 'upper' ? 2.5 : 0.6, c); }
    },
    {
      id: 'bookkeeper', name: 'Bookkeeper', icon: '\u{1F4D3}', rarity: RAR.COMMON,
      desc: function () { return '<span class="m">+6 Fortune</span> for each category already used this blind'; },
      onScore: function (ctx, c) {
        const used = ctx.run.blind ? Object.keys(ctx.run.blind.used).length : 0;
        ctx.addMult(6 * used, c);
      }
    },
    {
      id: 'second_wind', name: 'Second Wind', icon: '\u{1F343}', rarity: RAR.RARE,
      init: function () { return { used: false }; },
      desc: function () { return 'The <b>first</b> scratch each blind costs you <b>no turn</b>'; },
      onBlindStart: function (run, c) { c.state.used = false; },
      onTurnEnd: function (run, res, c) {
        if (!c.state.used && (!res.valid || res.dead)) {
          c.state.used = true;
          run.blind.turnsLeft += 1;      // cancels the decrement that follows
          UI.toast('Second Wind: turn refunded', 'good');
        }
      }
    },
    {
      id: 'deadeye', name: 'Deadeye', icon: '\u{1F3AF}', rarity: RAR.RARE,
      desc: function () { return '<span class="m">X1.5 Fortune</span>, plus <span class="m">X0.35</span> more for every <b>unused</b> reroll'; },
      onScore: function (ctx, c) {
        const left = ctx.run.blind ? ctx.run.blind.rerollsLeft : 0;
        ctx.xmult(1.5 + 0.35 * left, c);
      }
    },

    /* ---------------- legendary ---------------- */
    {
      id: 'colossus', name: 'The Colossus', icon: '\u{1F5FF}', rarity: RAR.LEGENDARY,
      desc: function (ch, run) {
        const n = run ? run.dice.length : 5;
        return '<span class="m">X Fortune</span> equal to <b>1 + 0.3 per die</b> in your pool<br>(currently <span class="m">X' + U.fmtMult(1 + 0.3 * n) + '</span>)';
      },
      onScore: function (ctx, c) { ctx.xmult(1 + 0.3 * ctx.run.dice.length, c); }
    },
    {
      id: 'ouroboros', name: 'Ouroboros', icon: '\u{1F40D}', rarity: RAR.LEGENDARY,
      desc: function () { return 'Every category gains a <b>level</b> at the end of each blind — but you lose <b>$6</b>'; },
      onBlindEnd: function (run, c) {
        C.CATEGORIES.forEach(function (cat) { run.levels[cat.id] = (run.levels[cat.id] || 1) + 1; });
        Game.lose(6, 'Ouroboros');
      }
    },
    {
      id: 'the_mint', name: 'The Mint', icon: '\u{1F3E6}', rarity: RAR.LEGENDARY,
      desc: function () { return 'Every scoring die also pays <b>$1</b>'; },
      onDieScored: function (ctx, die, i, c) { ctx.earn(1, c); }
    }
  ];

  /* ============================================================
     TAGS
     ============================================================ */
  const MORE_TAGS = [
    { id: 't_boss',    name: 'Boss Boon',      icon: '\u{1F480}', desc: 'The next <b>Boss Blind</b> target is <b>25%</b> lower' },
    { id: 't_voucher', name: 'Relic Boon',   icon: '\u{1F3F7}️', desc: 'Adds a <b>Relic</b> to the next shop' },
    { id: 't_charmpack', name: 'Charm Pack Boon', icon: '\u{1F381}', desc: 'Open a free <b>Charm Pack</b> immediately' },
    { id: 't_omenpack',  name: 'Omen Pack Boon',  icon: '\u{1F52E}', desc: 'Open a free <b>Omen Pack</b> immediately' },
    { id: 't_runepack',  name: 'Rune Pack Boon',  icon: '\u{1F4DC}', desc: 'Open a free <b>Rune Pack</b> immediately' },
    { id: 't_foundry',   name: 'Foundry Boon',    icon: '⚒️', desc: 'Open a free <b>Foundry Pack</b> immediately' },
    { id: 't_invest',  name: 'Investment Boon', icon: '\u{1F4C8}', desc: 'Gain <b>$18</b>' },
    { id: 't_juggle',  name: 'Juggle Boon',    icon: '\u{1F939}', desc: '<b>+1</b> die for the next blind only' },
    { id: 't_slot',    name: 'Locksmith Boon', icon: '\u{1F5DD}️', desc: '<b>+1</b> Charm slot, permanently' },
    { id: 't_polish',  name: 'Polish Boon',    icon: '✨', desc: 'A random die gains a random <b>edition</b>' },
    { id: 't_wax',     name: 'Wax Boon',       icon: '\u{1F534}', desc: 'A random die gains a <b>Red Seal</b>' },
    { id: 't_ethereal', name: 'Ethereal Boon', icon: '\u{1F31F}', desc: 'Gain a random <b>Omen</b> and a random <b>Rune</b>' },
    { id: 't_handshake', name: 'Handshake Boon', icon: '\u{1F91D}', desc: 'The next shop is <b>half price</b>' },
    { id: 't_meteor',  name: 'Meteor Boon',    icon: '☄️', desc: 'Level up <b>three random</b> categories' }
  ];

  /* ============================================================
     TIER-2 VOUCHERS — each needs its tier-1 already bought
     ============================================================ */
  const MORE_VOUCHERS = [
    { id: 'v_reroll2',  requires: 'v_reroll',   name: 'Reroll Deed',       icon: '\u{1F3B2}', cost: 16, desc: 'Another <b>+1</b> reroll every turn' },
    { id: 'v_turn2',    requires: 'v_turn',     name: 'Chronograph',       icon: '⌛', cost: 18, desc: 'Another <b>+1</b> turn every blind' },
    { id: 'v_die2',     requires: 'v_die',      name: 'Seventh Die',       icon: '\u{1F3B2}', cost: 18, desc: 'Another <b>+1</b> die in your pool' },
    { id: 'v_slot2',    requires: 'v_slot',     name: 'Charm Vault',       icon: '\u{1F5C4}️', cost: 16, desc: 'Another <b>+1</b> Charm slot' },
    { id: 'v_pouch2',   requires: 'v_pouch',    name: 'Rune Satchel',      icon: '\u{1F392}', cost: 14, desc: 'Another <b>+1</b> consumable slot' },
    { id: 'v_discount2', requires: 'v_discount', name: 'Liquidation',      icon: '\u{1F4B0}', cost: 16, desc: 'Shop items are <b>50%</b> cheaper instead of 25%' },
    { id: 'v_interest2', requires: 'v_interest', name: 'Compound Interest', icon: '\u{1F4C8}', cost: 16, desc: 'Interest cap raised by a further <b>$10</b>' },
    { id: 'v_shopwide2', requires: 'v_shopwide', name: 'Megastore',        icon: '\u{1F3EC}', cost: 16, desc: 'Another <b>+1</b> item on the shop shelf' },
    { id: 'v_cheapre2',  requires: 'v_cheapre',  name: 'Members Club',     icon: '\u{1F3AB}', cost: 14, desc: 'Shop rerolls cost a further <b>$2</b> less' },
    { id: 'v_omen2',     requires: 'v_omen',     name: 'Astrolabe',        icon: '\u{1F52D}', cost: 16, desc: 'Omens & Runes appear <b>three times</b> as often' }
  ];

  /* ============================================================
     splice everything in and rebuild the indexes
     ============================================================ */
  MORE_CHARMS.forEach(function (c) {
    if (CH.CHARM_BY_ID[c.id]) return;           // never shadow a base charm
    c.cost = c.cost || CH.RARITY_COST[c.rarity];
    CH.CHARMS.push(c);
    CH.CHARM_BY_ID[c.id] = c;
  });

  MORE_TAGS.forEach(function (t) {
    if (C.TAGS.some(function (x) { return x.id === t.id; })) return;
    C.TAGS.push(t);
  });

  MORE_VOUCHERS.forEach(function (v) {
    if (C.VOUCHER_BY_ID[v.id]) return;
    C.VOUCHERS.push(v);
    C.VOUCHER_BY_ID[v.id] = v;
  });

  global.EXTRA = {
    charms: MORE_CHARMS.length, tags: MORE_TAGS.length, vouchers: MORE_VOUCHERS.length
  };
})(window);
