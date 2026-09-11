/* ============================================================
   content.js — static game data
   categories, dice enhancements/editions/seals, blinds, bosses,
   runes, omens, vouchers, packs, tags
   ============================================================ */
(function (global) {
  'use strict';

  /* ============ SCORING CATEGORIES ============
     chips / mult   = level-1 base values
     cpl / mpl      = per-level growth
     face           = upper-section face (1..6) or null
  */
  const CATEGORIES = [
    { id: 'ones',          name: 'Aces',            section: 'upper', face: 1, chips: 10,  mult: 1, cpl: 10, mpl: 1 },
    { id: 'twos',          name: 'Twos',            section: 'upper', face: 2, chips: 12,  mult: 1, cpl: 10, mpl: 1 },
    { id: 'threes',        name: 'Threes',          section: 'upper', face: 3, chips: 15,  mult: 2, cpl: 12, mpl: 1 },
    { id: 'fours',         name: 'Fours',           section: 'upper', face: 4, chips: 18,  mult: 2, cpl: 14, mpl: 1 },
    { id: 'fives',         name: 'Fives',           section: 'upper', face: 5, chips: 22,  mult: 2, cpl: 16, mpl: 1 },
    { id: 'sixes',         name: 'Sixes',           section: 'upper', face: 6, chips: 26,  mult: 3, cpl: 18, mpl: 1 },
    { id: 'threeKind',     name: 'Three of a Kind', section: 'lower', face: null, chips: 30,  mult: 3, cpl: 20, mpl: 2 },
    { id: 'fourKind',      name: 'Four of a Kind',  section: 'lower', face: null, chips: 45,  mult: 4, cpl: 25, mpl: 2 },
    { id: 'fullHouse',     name: 'Full House',      section: 'lower', face: null, chips: 40,  mult: 4, cpl: 25, mpl: 2 },
    { id: 'smallStraight', name: 'Small Straight',  section: 'lower', face: null, chips: 50,  mult: 4, cpl: 30, mpl: 3 },
    { id: 'largeStraight', name: 'Large Straight',  section: 'lower', face: null, chips: 70,  mult: 5, cpl: 35, mpl: 3 },
    { id: 'fiveKind',       name: 'Five of a Kind',         section: 'lower', face: null, chips: 100, mult: 8, cpl: 50, mpl: 4 },
    { id: 'chance',        name: 'Chance',          section: 'lower', face: null, chips: 20,  mult: 2, cpl: 15, mpl: 1 }
  ];
  const CAT_BY_ID = {};
  CATEGORIES.forEach(function (c) { CAT_BY_ID[c.id] = c; });

  /* ============ DICE ENHANCEMENTS ============ */
  const ENHANCEMENTS = {
    bonus: { id: 'bonus', name: 'Bonus Die', short: 'BONUS', desc: '<span class="c">+30 Pips</span> when scored' },
    mult:  { id: 'mult',  name: 'Fortune Die',  short: 'FORT',  desc: '<span class="m">+4 Fortune</span> when scored' },
    glass: { id: 'glass', name: 'Glass Die', short: 'GLASS', desc: '<span class="m">X2 Fortune</span> when scored.<br>1 in 5 chance to shatter' },
    gold:  { id: 'gold',  name: 'Gold Die',  short: 'GOLD',  desc: 'Earn <b>$3</b> when scored' },
    steel: { id: 'steel', name: 'Steel Die', short: 'STEEL', desc: '<span class="m">X1.5 Fortune</span> while this die stays <b>unscored</b>' },
    lucky: { id: 'lucky', name: 'Lucky Die', short: 'LUCKY', desc: '1 in 5 for <span class="m">+20 Fortune</span><br>1 in 15 for <b>$20</b>' },
    stone: { id: 'stone', name: 'Stone Die', short: 'STONE', desc: '<span class="c">+50 Pips</span>.<br>Always scores, whatever the category' }
  };

  const EDITIONS = {
    foil: { id: 'foil', name: 'Foil',        short: 'FOIL',  desc: '<span class="c">+50 Pips</span>' },
    holo: { id: 'holo', name: 'Holographic', short: 'HOLO',  desc: '<span class="m">+10 Fortune</span>' },
    poly: { id: 'poly', name: 'Polychrome',  short: 'POLY',  desc: '<span class="m">X1.5 Fortune</span>' }
  };

  const SEALS = {
    red:  { id: 'red',  name: 'Red Seal',  color: '#d0434f', desc: 'Retriggers this die <b>1</b> extra time' },
    gold: { id: 'gold', name: 'Gold Seal', color: '#f0a92c', desc: 'Earn <b>$3</b> when this die is scored' },
    blue: { id: 'blue', name: 'Blue Seal', color: '#0090ff', desc: 'Creates a <b>Rune</b> for the scored category (needs room)' }
  };

  /* ============ ANTE TARGETS ============ */
  // Tuned with tools/tune.js against the competent bot: this curve spreads
  // deaths evenly across antes 3-8 instead of front-loading them at 4-5.
  const ANTE_BASE = [0, 250, 600, 1300, 2700, 5400, 9800, 17000, 27000];
  function anteBase(ante) {
    if (ante < ANTE_BASE.length) return ANTE_BASE[ante];
    // endless scaling
    let v = ANTE_BASE[ANTE_BASE.length - 1];
    for (let i = ANTE_BASE.length; i <= ante; i++) v = Math.round(v * 1.6);
    return v;
  }

  const BLIND_KINDS = [
    { id: 'small', name: 'Small Blind', mult: 1.0, reward: 3 },
    { id: 'big',   name: 'Big Blind',   mult: 1.5, reward: 4 },
    { id: 'boss',  name: 'Boss Blind',  mult: 2.0, reward: 5 }
  ];

  /* ============ BOSS BLINDS ============
     Each boss can define:
       minAnte    – earliest ante it can appear
       targetMult – overrides blind target multiplier
       apply(run) – called at blind start, mutates blind-local modifiers
     Flags read by the engine live on run.blind.mods
  */
  const BOSSES = [
    { id: 'cage',    name: 'The Cage',    icon: '\u{1F512}', desc: '−1 Reroll each turn',
      minAnte: 1, mods: { rerolls: -1 } },
    { id: 'vise',    name: 'The Vise',    icon: '\u{2702}️', desc: '−1 Turn this blind',
      minAnte: 2, mods: { turns: -1 } },
    { id: 'mirror',  name: 'The Mirror',  icon: '\u{1FA9E}', desc: 'Upper section categories score 0',
      minAnte: 1, mods: { deadSection: 'upper' } },
    { id: 'serpent', name: 'The Serpent', icon: '\u{1F40D}', desc: 'Three & Four of a Kind are disabled',
      minAnte: 2, mods: { lockCats: ['threeKind', 'fourKind'] } },
    { id: 'sieve',   name: 'The Sieve',   icon: '\u{1F578}️', desc: 'Dice showing 1 or 2 give no Pips',
      minAnte: 1, mods: { deadFaces: [1, 2] } },
    { id: 'fog',     name: 'The Fog',     icon: '\u{2601}️', desc: 'Rerolled dice are hidden until scored',
      minAnte: 3, mods: { hideRerolled: true } },
    { id: 'wall',    name: 'The Wall',    icon: '\u{1F9F1}', desc: 'Extra large score requirement',
      minAnte: 2, targetMult: 3.5 },
    { id: 'miser',   name: 'The Miser',   icon: '\u{1F4B8}', desc: 'No money earned this blind',
      minAnte: 2, mods: { noMoney: true } },
    { id: 'chain',   name: 'The Chain',   icon: '\u{1F517}', desc: '3 random categories are disabled',
      minAnte: 3, mods: { lockRandom: 3 } },
    { id: 'hook',    name: 'The Hook',    icon: '\u{1FA9D}', desc: 'Lose $1 at the end of every turn',
      minAnte: 2, mods: { hookCost: 1 } },
    { id: 'ox',      name: 'The Ox',      icon: '\u{1F402}', desc: 'Your highest-level category is disabled',
      minAnte: 4, mods: { lockBest: true } },
    { id: 'clamp',   name: 'The Clamp',   icon: '\u{1F5DC}️', desc: 'One random die is removed this blind',
      minAnte: 3, mods: { removeDice: 1 } },
    { id: 'flint',   name: 'The Flint',   icon: '\u{1F5FF}', desc: 'Base Pips and Fortune are halved',
      minAnte: 4, mods: { halveBase: true } },
    { id: 'plague',  name: 'The Plague',  icon: '\u{1F9A0}', desc: 'All die enhancements & editions are nullified',
      minAnte: 4, mods: { nullifyDice: true } },
    { id: 'water',   name: 'The Water',   icon: '\u{1F30A}', desc: 'No rerolls at all',
      minAnte: 5, mods: { rerolls: -99 } },
    { id: 'arm',     name: 'The Arm',     icon: '\u{1F4AA}', desc: 'Each category you score loses 1 level',
      minAnte: 5, mods: { drainLevel: true } },
    { id: 'needle',  name: 'The Needle',  icon: '\u{1F489}', desc: 'Only 1 turn — but a small target',
      minAnte: 4, targetMult: 1.0, mods: { setTurns: 1 } },
    { id: 'tooth',   name: 'The Tooth',   icon: '\u{1F9B7}', desc: 'Lose $1 per scored die',
      minAnte: 5, mods: { toothCost: true } },
    { id: 'grand',   name: 'The Grand',   icon: '\u{1F451}', desc: 'Huge target and −1 Reroll',
      minAnte: 8, finalOnly: true, targetMult: 2.5, mods: { rerolls: -1 } }
  ];
  const BOSS_BY_ID = {};
  BOSSES.forEach(function (b) { BOSS_BY_ID[b.id] = b; });

  /* ============ RUNES (level up a category) ============ */
  const RUNES = CATEGORIES.map(function (c) {
    return {
      id: 'rune_' + c.id, kind: 'rune', name: 'Rune of ' + c.name, icon: '\u{1F52E}',
      cat: c.id, cost: 3,
      desc: 'Level up <b>' + c.name + '</b>'
    };
  });
  RUNES.push({
    id: 'rune_wild', kind: 'rune', name: 'Wild Rune', icon: '\u{1F340}', cat: null, cost: 4,
    desc: 'Level up a <b>random</b> category by 2'
  });
  const RUNE_BY_ID = {};
  RUNES.forEach(function (r) { RUNE_BY_ID[r.id] = r; });

  /* ============ OMENS (tarot-likes) ============
     targets: 'die' (needs N dice selected), 'none', 'charm'
  */
  const OMENS = [
    { id: 'forge',    name: 'The Forge',    icon: '\u{1F528}', targets: 'die', n: 1, cost: 3, desc: 'Turn 1 selected die into a <b>Bonus Die</b>' },
    { id: 'ember',    name: 'The Ember',    icon: '\u{1F525}', targets: 'die', n: 1, cost: 3, desc: 'Turn 1 selected die into a <b>Fortune Die</b>' },
    { id: 'pane',     name: 'The Pane',     icon: '\u{1FA9F}', targets: 'die', n: 1, cost: 3, desc: 'Turn 1 selected die into a <b>Glass Die</b>' },
    { id: 'vault',    name: 'The Vault',    icon: '\u{1F3E6}', targets: 'die', n: 1, cost: 3, desc: 'Turn 1 selected die into a <b>Gold Die</b>' },
    { id: 'anvil',    name: 'The Anvil',    icon: '\u{2699}️', targets: 'die', n: 1, cost: 3, desc: 'Turn 1 selected die into a <b>Steel Die</b>' },
    { id: 'clover',   name: 'The Clover',   icon: '\u{1F340}', targets: 'die', n: 1, cost: 3, desc: 'Turn 1 selected die into a <b>Lucky Die</b>' },
    { id: 'monolith', name: 'The Monolith', icon: '\u{1F5FF}', targets: 'die', n: 1, cost: 3, desc: 'Turn 1 selected die into a <b>Stone Die</b>' },
    { id: 'gilder',   name: 'The Gilder',   icon: '\u{2728}', targets: 'die', n: 1, cost: 4, desc: 'Add <b>Foil</b> to 1 selected die (<span class="c">+50 Pips</span>)' },
    { id: 'spectre',  name: 'The Spectre',  icon: '\u{1F47B}', targets: 'die', n: 1, cost: 4, desc: 'Add <b>Holographic</b> to 1 selected die (<span class="m">+10 Fortune</span>)' },
    { id: 'prism',    name: 'The Prism',    icon: '\u{1F308}', targets: 'die', n: 1, cost: 5, desc: 'Add <b>Polychrome</b> to 1 selected die (<span class="m">X1.5 Fortune</span>)' },
    { id: 'wax',      name: 'The Wax',      icon: '\u{1F534}', targets: 'die', n: 1, cost: 4, desc: 'Add a <b>Red Seal</b> to 1 selected die (retrigger)' },
    { id: 'ledger',   name: 'The Ledger',   icon: '\u{1F4D2}', targets: 'die', n: 1, cost: 4, desc: 'Add a <b>Gold Seal</b> to 1 selected die (<b>$3</b> on score)' },
    { id: 'chisel',   name: 'The Chisel',   icon: '\u{1FAA8}', targets: 'die', n: 1, cost: 3, desc: 'Raise the <b>lowest face</b> of 1 selected die by 1' },
    { id: 'lathe',    name: 'The Lathe',    icon: '\u{1F504}', targets: 'die', n: 1, cost: 3, desc: 'Set <b>all faces</b> of 1 selected die to its current value' },
    { id: 'twins',    name: 'The Twins',    icon: '\u{1F46F}', targets: 'die', n: 1, cost: 5, desc: 'Duplicate 1 selected die (copies all upgrades)' },
    { id: 'reaper',   name: 'The Reaper',   icon: '\u{1F480}', targets: 'die', n: 1, cost: 2, desc: 'Destroy 1 selected die and gain <b>$8</b>' },
    { id: 'hermit',   name: 'The Hermit',   icon: '\u{1F9D9}', targets: 'none', cost: 3, desc: 'Double your money (max <b>$20</b>)' },
    { id: 'beggar',   name: 'The Beggar',   icon: '\u{1FA99}', targets: 'none', cost: 2, desc: 'Gain <b>$12</b>' },
    { id: 'judge',    name: 'The Judge',    icon: '\u{2696}️', targets: 'none', cost: 4, desc: 'Create a random <b>Charm</b> (needs a free slot)' },
    { id: 'echoOmen', name: 'The Echo',     icon: '\u{1F501}', targets: 'none', cost: 4, desc: 'Create a copy of a random <b>Rune</b>' }
  ];
  const OMEN_BY_ID = {};
  OMENS.forEach(function (o) { OMEN_BY_ID[o.id] = o; });

  /* ============ VOUCHERS ============ */
  const VOUCHERS = [
    { id: 'v_reroll',   name: 'Reroll Token',  icon: '\u{1F3B2}', cost: 10, desc: '<b>+1</b> reroll every turn' },
    { id: 'v_turn',     name: 'Hourglass',     icon: '⏳', cost: 12, desc: '<b>+1</b> turn every blind' },
    { id: 'v_die',      name: 'Sixth Die',     icon: '⚅', cost: 12, desc: '<b>+1</b> die in your pool' },
    { id: 'v_slot',     name: 'Charm Case',    icon: '\u{1F5C3}️', cost: 10, desc: '<b>+1</b> Charm slot' },
    { id: 'v_pouch',    name: 'Rune Pouch',    icon: '\u{1F45D}', cost: 8,  desc: '<b>+1</b> consumable slot' },
    { id: 'v_discount', name: 'Clearance',     icon: '\u{1F3F7}️', cost: 10, desc: 'Shop items are <b>25%</b> cheaper' },
    { id: 'v_interest', name: 'Seed Money',    icon: '\u{1F331}', cost: 10, desc: 'Interest cap raised to <b>$10</b>' },
    { id: 'v_shopwide', name: 'Wide Aisle',    icon: '\u{1F6D2}', cost: 10, desc: '<b>+1</b> item on the shop shelf' },
    { id: 'v_cheapre',  name: 'Loyalty Card',  icon: '\u{1F4B3}', cost: 8,  desc: 'Shop rerolls cost <b>$2</b> less' },
    { id: 'v_omen',     name: 'Omen Globe',    icon: '\u{1F52E}', cost: 10, desc: 'Omens & Runes appear <b>twice</b> as often' }
  ];
  const VOUCHER_BY_ID = {};
  VOUCHERS.forEach(function (v) { VOUCHER_BY_ID[v.id] = v; });

  /* ============ BOOSTER PACKS ============ */
  const PACKS = [
    { id: 'p_charm',  name: 'Charm Pack',       icon: '\u{1F381}', cost: 4, kindOf: 'charm', size: 2, pick: 1 },
    { id: 'p_charm2', name: 'Jumbo Charm Pack', icon: '\u{1F381}', cost: 6, kindOf: 'charm', size: 4, pick: 1 },
    { id: 'p_rune',   name: 'Rune Pack',        icon: '\u{1F4DC}', cost: 4, kindOf: 'rune',  size: 3, pick: 1 },
    { id: 'p_rune2',  name: 'Jumbo Rune Pack',  icon: '\u{1F4DC}', cost: 6, kindOf: 'rune',  size: 4, pick: 2 },
    { id: 'p_omen',   name: 'Omen Pack',        icon: '\u{1F52E}', cost: 4, kindOf: 'omen',  size: 3, pick: 1 },
    { id: 'p_omen2',  name: 'Jumbo Omen Pack',  icon: '\u{1F52E}', cost: 6, kindOf: 'omen',  size: 4, pick: 2 },
    { id: 'p_die',    name: 'Foundry Pack',     icon: '⚒', cost: 5, kindOf: 'dieupg', size: 3, pick: 1 }
  ];

  /* ============ SKIP TAGS ============ */
  const TAGS = [
    { id: 't_cash',   name: 'Coin Boon',    icon: '\u{1FA99}', desc: 'Gain <b>$12</b>' },
    { id: 't_charm',  name: 'Charm Boon',   icon: '\u{1F0CF}', desc: 'Gain a free random <b>Charm</b>' },
    { id: 't_rune',   name: 'Rune Boon',    icon: '\u{1F4DC}', desc: 'Gain 2 random <b>Runes</b>' },
    { id: 't_omen',   name: 'Omen Boon',    icon: '\u{1F52E}', desc: 'Gain 2 random <b>Omens</b>' },
    { id: 't_double', name: 'Double Boon',  icon: '\u{23EC}', desc: 'Next shop item is <b>free</b>' },
    { id: 't_reroll', name: 'Reroll Boon',  icon: '\u{1F3B2}', desc: '<b>+1</b> reroll for the next blind' },
    { id: 't_level',  name: 'Scholar Boon', icon: '\u{1F393}', desc: 'Level up your <b>most-used</b> category by 2' }
  ];

  /* ============ DIE UPGRADE ITEMS (Foundry pack contents) ============ */
  const DIE_UPGRADES = [
    { id: 'du_bonus', name: 'Bonus Stamp', enh: 'bonus' },
    { id: 'du_mult',  name: 'Fortune Stamp',  enh: 'mult' },
    { id: 'du_gold',  name: 'Gold Stamp',  enh: 'gold' },
    { id: 'du_steel', name: 'Steel Stamp', enh: 'steel' },
    { id: 'du_lucky', name: 'Lucky Stamp', enh: 'lucky' },
    { id: 'du_glass', name: 'Glass Stamp', enh: 'glass' },
    { id: 'du_stone', name: 'Stone Stamp', enh: 'stone' }
  ];

  global.C = {
    CATEGORIES: CATEGORIES, CAT_BY_ID: CAT_BY_ID,
    ENHANCEMENTS: ENHANCEMENTS, EDITIONS: EDITIONS, SEALS: SEALS,
    ANTE_BASE: ANTE_BASE, anteBase: anteBase, BLIND_KINDS: BLIND_KINDS,
    BOSSES: BOSSES, BOSS_BY_ID: BOSS_BY_ID,
    RUNES: RUNES, RUNE_BY_ID: RUNE_BY_ID,
    OMENS: OMENS, OMEN_BY_ID: OMEN_BY_ID,
    VOUCHERS: VOUCHERS, VOUCHER_BY_ID: VOUCHER_BY_ID,
    PACKS: PACKS, TAGS: TAGS, DIE_UPGRADES: DIE_UPGRADES
  };
})(window);
