/* ============================================================
   decks.js — starting decks and difficulty stakes

   A deck changes the *opening rules* of a run; a stake changes the
   pressure applied to all of them. 12 x 8 = 96 distinct starts.

   Deck shape:
     mods   — read by Game's derived stats
              {turns, rerolls, dice, charmSlots, consumableSlots,
               targetMul, rewardDelta, interestBonus}
     setup(run, api) — one-off mutation when the run is created
   ============================================================ */
(function (global) {
  'use strict';

  const DECKS = [
    {
      id: 'standard', name: 'Standard Deck', icon: '\u{1F3B2}',
      desc: 'Five plain dice. No modifiers, no excuses.',
      unlock: null, mods: {}
    },
    {
      id: 'loaded', name: 'Loaded Deck', icon: '\u{1F3AF}',
      desc: 'Every die is faced <b>2·3·4·5·6·6</b> — no ones, but straights are harder.',
      unlock: { type: 'ante', value: 3 }, mods: {},
      setup: function (run) {
        run.dice.forEach(function (d) { d.faces = [2, 3, 4, 5, 6, 6]; });
      }
    },
    {
      id: 'gambler', name: "Gambler's Deck", icon: '\u{1F0CF}',
      desc: '<b>+2</b> rerolls every turn, but <b>−1</b> turn every blind.',
      unlock: { type: 'ante', value: 4 }, mods: { rerolls: 2, turns: -1 }
    },
    {
      id: 'quarry', name: 'Quarry Deck', icon: '\u{26F0}️',
      desc: 'Two dice start as <b>Stone Dice</b> — they always score, whatever the category.',
      unlock: { type: 'ante', value: 5 }, mods: {},
      setup: function (run) {
        run.dice[0].enhancement = 'stone';
        run.dice[1].enhancement = 'stone';
      }
    },
    {
      id: 'scholar', name: "Scholar's Deck", icon: '\u{1F393}',
      desc: 'Every category starts at <b>level 3</b>, but you have <b>−1</b> Charm slot.',
      unlock: { type: 'best', value: 5000 }, mods: { charmSlots: -1 },
      setup: function (run) {
        C.CATEGORIES.forEach(function (c) { run.levels[c.id] = 3; });
      }
    },
    {
      id: 'miser', name: "Miser's Deck", icon: '\u{1F3E6}',
      desc: 'Start with <b>$25</b>, but every blind reward is <b>$2</b> smaller.',
      unlock: { type: 'money', value: 60 }, mods: { rewardDelta: -2 },
      setup: function (run) { run.money = 25; }
    },
    {
      id: 'glass', name: 'Glass Deck', icon: '\u{1FA9F}',
      desc: 'Three dice start as <b>Glass Dice</b> and you get <b>+1</b> Charm slot. They break.',
      unlock: { type: 'ante', value: 6 }, mods: { charmSlots: 1 },
      setup: function (run) {
        for (let i = 0; i < 3 && i < run.dice.length; i++) run.dice[i].enhancement = 'glass';
      }
    },
    {
      id: 'abacus', name: 'Abacus Deck', icon: '\u{1F9EE}',
      desc: '<b>+2</b> consumable slots and two free <b>Runes</b> to start.',
      unlock: { type: 'ante', value: 7 }, mods: { consumableSlots: 2 },
      setup: function (run, api) {
        api.addConsumable({ kind: 'rune', id: api.rng.pick(C.RUNES).id });
        api.addConsumable({ kind: 'rune', id: api.rng.pick(C.RUNES).id });
      }
    },
    {
      id: 'wide', name: 'Wide Deck', icon: '\u{1F3B0}',
      desc: '<b>Seven</b> dice in the pool — but every target is <b>20%</b> higher.',
      unlock: { type: 'wins', value: 1 }, mods: { dice: 2, targetMul: 1.2 }
    },
    {
      id: 'plated', name: 'Plated Deck', icon: '\u{1F947}',
      desc: 'Two <b>Gold Dice</b>, and your interest cap is <b>$5</b> higher.',
      unlock: { type: 'wins', value: 2 }, mods: { interestBonus: 5 },
      setup: function (run) {
        run.dice[0].enhancement = 'gold';
        run.dice[1].enhancement = 'gold';
      }
    },
    {
      id: 'magpie', name: 'Magpie Deck', icon: '\u{1F426}',
      desc: 'Start holding a random <b>Charm</b> — and <b>$0</b>.',
      unlock: { type: 'best', value: 50000 }, mods: {},
      setup: function (run, api) { run.money = 0; api.addRandomCharm(); }
    },
    {
      id: 'anarchy', name: 'Anarchy Deck', icon: '\u{1F4A5}',
      desc: '<b>Two</b> random Charms to start — and <b>no</b> consumable slots at all.',
      unlock: { type: 'wins', value: 3 }, mods: { consumableSlots: -2 },
      setup: function (run, api) { api.addRandomCharm(); api.addRandomCharm(); }
    }
  ];

  const DECK_BY_ID = {};
  DECKS.forEach(function (d) { DECK_BY_ID[d.id] = d; });

  /* ============================================================
     STAKES — cumulative. Playing at stake N applies stakes 1..N.
     ============================================================ */
  const STAKES = [
    { level: 1, id: 'white',  name: 'White Peril',  color: '#e8e3d5', desc: 'The base game.', mods: {} },
    { level: 2, id: 'red',    name: 'Red Peril',    color: '#d0434f', desc: 'Small Blinds pay <b>no</b> reward.', mods: { smallBlindReward: 0 } },
    { level: 3, id: 'green',  name: 'Green Peril',  color: '#57d17a', desc: 'All score targets are <b>10%</b> higher.', mods: { targetMul: 1.10 } },
    { level: 4, id: 'black',  name: 'Black Peril',  color: '#6b7380', desc: 'Shop prices are <b>25%</b> higher.', mods: { priceMul: 1.25 } },
    { level: 5, id: 'blue',   name: 'Blue Peril',   color: '#0090ff', desc: '<b>−1</b> turn every blind.', mods: { turns: -1 } },
    { level: 6, id: 'purple', name: 'Purple Peril', color: '#9b6bd8', desc: 'All score targets are a further <b>15%</b> higher.', mods: { targetMul: 1.15 } },
    { level: 7, id: 'orange', name: 'Orange Peril', color: '#f0a92c', desc: 'Interest is <b>halved</b> and you start with <b>$0</b>.', mods: { interestMul: 0.5, startMoney: 0 } },
    { level: 8, id: 'gold',   name: 'Gold Peril',   color: '#ffd479', desc: '<b>−1</b> reroll every turn.', mods: { rerolls: -1 } }
  ];

  /** Merge stakes 1..level into one modifier block. */
  function stakeMods(level) {
    const out = { targetMul: 1, priceMul: 1, interestMul: 1, turns: 0, rerolls: 0 };
    const n = Math.max(1, Math.min(level || 1, STAKES.length));
    for (let i = 0; i < n; i++) {
      const m = STAKES[i].mods;
      for (const k in m) {
        if (k === 'targetMul' || k === 'priceMul' || k === 'interestMul') out[k] *= m[k];
        else if (k === 'turns' || k === 'rerolls') out[k] += m[k];
        else out[k] = m[k];
      }
    }
    return out;
  }

  function deckById(id) { return DECK_BY_ID[id] || DECK_BY_ID.standard; }
  function stakeByLevel(n) { return STAKES[Math.max(0, Math.min((n || 1) - 1, STAKES.length - 1))]; }

  /** Human-readable unlock requirement. */
  function unlockText(deck) {
    const u = deck.unlock;
    if (!u) return null;
    switch (u.type) {
      case 'ante':  return 'Reach Ante ' + u.value;
      case 'wins':  return 'Win ' + u.value + (u.value === 1 ? ' run' : ' runs');
      case 'best':  return 'Score ' + u.value.toLocaleString('en-US') + ' in one turn';
      case 'money': return 'Hold $' + u.value + ' at once';
      default:      return 'Locked';
    }
  }

  global.DK = {
    DECKS: DECKS, DECK_BY_ID: DECK_BY_ID, STAKES: STAKES,
    stakeMods: stakeMods, deckById: deckById, stakeByLevel: stakeByLevel,
    unlockText: unlockText
  };
})(window);
