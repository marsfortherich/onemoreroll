/* ============================================================
   tools/test.js — scoring, determinism and persistence tests

   Run:  node tools/test.js
   ============================================================ */
'use strict';

const { createGame } = require('./harness');
const { runOne } = require('./policies');

/* ---------- micro test framework ---------- */
let passed = 0;
const failures = [];
let group = '';

function describe(name, fn) { group = name; fn(); }
function it(name, fn) {
  try { fn(); passed++; }
  catch (e) { failures.push({ group: group, name: name, err: e.message }); }
}
function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error((what ? what + ': ' : '') + 'expected ' + JSON.stringify(expected) +
      ', got ' + JSON.stringify(actual));
  }
}
function ok(cond, what) { if (!cond) throw new Error(what || 'expected truthy'); }
function near(actual, expected, tol, what) {
  if (Math.abs(actual - expected) > (tol || 1e-9)) {
    throw new Error((what || '') + ': expected ~' + expected + ', got ' + actual);
  }
}
function deepEq(a, b, what) { eq(JSON.stringify(a), JSON.stringify(b), what); }

/* ---------- fixture ---------- */
/** A run parked in a plain Small Blind with an exact set of dice. */
function fixture(values, mutate) {
  const g = createGame({ quiet: true });
  g.Game.newRun('TESTSEED');
  g.Game.startBlind();
  g.helpers.setDice(values);
  g.Game.run.dice.forEach(function (d) {
    d.enhancement = null; d.edition = null; d.seal = null;
  });
  if (mutate) mutate(g.Game.run, g);
  return g;
}
function total(g, catId) { return g.E.preview(g.Game.run, catId).total; }

/* ============================================================
   RNG
   ============================================================ */
describe('rng', function () {
  it('is deterministic for a given seed', function () {
    const g = createGame({ quiet: true });
    const a = new g.U.RNG('ABC'), b = new g.U.RNG('ABC');
    for (let i = 0; i < 200; i++) eq(a.next(), b.next(), 'draw ' + i);
  });
  it('differs across seeds', function () {
    const g = createGame({ quiet: true });
    const a = new g.U.RNG('ABC'), b = new g.U.RNG('ABD');
    let same = 0;
    for (let i = 0; i < 50; i++) if (a.next() === b.next()) same++;
    ok(same < 5, 'seeds should diverge');
  });
  it('save/load restores the stream position', function () {
    const g = createGame({ quiet: true });
    const a = new g.U.RNG('XYZ');
    for (let i = 0; i < 10; i++) a.next();
    const snap = a.save();
    const expect = [a.next(), a.next(), a.next()];
    const b = new g.U.RNG('XYZ');
    b.load(snap);
    deepEq([b.next(), b.next(), b.next()], expect, 'resumed stream');
  });
  it('int() stays in range', function () {
    const g = createGame({ quiet: true });
    const r = new g.U.RNG('R');
    for (let i = 0; i < 500; i++) {
      const v = r.int(1, 6);
      ok(v >= 1 && v <= 6, 'got ' + v);
      ok(Number.isInteger(v), 'not an integer: ' + v);
    }
  });
});

/* ============================================================
   Category evaluation
   ============================================================ */
describe('evaluate', function () {
  const g = createGame({ quiet: true });
  const ev = g.E.evaluate;

  it('upper sections match only their face', function () {
    const r = ev([6, 6, 2, 3, 4], 'sixes');
    ok(r.valid); deepEq(r.idx, [0, 1]);
    ok(!ev([1, 2, 3, 4, 5], 'sixes').valid, 'no sixes present');
  });
  it('three of a kind needs three', function () {
    ok(ev([4, 4, 4, 1, 2], 'threeKind').valid);
    ok(!ev([4, 4, 1, 1, 2], 'threeKind').valid);
    deepEq(ev([4, 4, 4, 1, 2], 'threeKind').idx, [0, 1, 2, 3, 4], 'all dice score');
  });
  it('four of a kind needs four', function () {
    ok(ev([4, 4, 4, 4, 2], 'fourKind').valid);
    ok(!ev([4, 4, 4, 1, 2], 'fourKind').valid);
  });
  it('full house is 3+2, and five of a kind counts', function () {
    ok(ev([3, 3, 3, 2, 2], 'fullHouse').valid);
    ok(ev([3, 3, 3, 3, 3], 'fullHouse').valid, 'five of a kind');
    ok(!ev([3, 3, 3, 2, 4], 'fullHouse').valid);
    ok(!ev([3, 3, 2, 2, 4], 'fullHouse').valid, 'two pair is not a full house');
  });
  it('small straight finds four in a row and scores only those', function () {
    const r = ev([1, 2, 3, 4, 6], 'smallStraight');
    ok(r.valid); eq(r.idx.length, 4);
    ok(ev([2, 3, 4, 5, 5], 'smallStraight').valid);
    ok(!ev([1, 2, 3, 5, 6], 'smallStraight').valid, 'gap breaks the run');
  });
  it('large straight needs five in a row', function () {
    ok(ev([1, 2, 3, 4, 5], 'largeStraight').valid);
    ok(ev([2, 3, 4, 5, 6], 'largeStraight').valid);
    ok(!ev([1, 2, 3, 4, 6], 'largeStraight').valid);
  });
  it('five of a kind needs five alike', function () {
    ok(ev([5, 5, 5, 5, 5], 'fiveKind').valid);
    ok(!ev([5, 5, 5, 5, 1], 'fiveKind').valid);
  });
  it('chance always scores everything', function () {
    const r = ev([1, 3, 5, 2, 6], 'chance');
    ok(r.valid); eq(r.idx.length, 5);
  });
});

/* ============================================================
   Base scoring maths
   ============================================================ */
describe('scoring', function () {
  it('chance = (base chips + pips) x base mult', function () {
    const g = fixture([1, 2, 3, 4, 5]);
    // level 1 chance: 20 chips, 2 mult; pips 15 -> 35 x 2
    eq(total(g, 'chance'), 70);
  });
  it('upper section only counts its own face', function () {
    const g = fixture([6, 6, 2, 3, 4]);
    // sixes: 26 chips + 12 pips = 38, x3
    eq(total(g, 'sixes'), 114);
  });
  it('five of a kind uses its big base', function () {
    const g = fixture([5, 5, 5, 5, 5]);
    // 100 + 25 = 125, x8
    eq(total(g, 'fiveKind'), 1000);
  });
  it('small straight scores only the run', function () {
    const g = fixture([1, 2, 3, 4, 6]);
    // 50 + (1+2+3+4)=10 -> 60, x4
    eq(total(g, 'smallStraight'), 240);
  });
  it('large straight scores all five', function () {
    const g = fixture([2, 3, 4, 5, 6]);
    // 70 + 20 = 90, x5
    eq(total(g, 'largeStraight'), 450);
  });
  it('an unsatisfied category scores zero', function () {
    const g = fixture([1, 2, 3, 4, 6]);
    const p = g.E.preview(g.Game.run, 'fiveKind');
    eq(p.valid, false);
    eq(p.total, 0);
  });
  it('levels raise both chips and mult', function () {
    const g = fixture([1, 2, 3, 4, 5]);
    g.Game.run.levels.chance = 3;
    const bv = g.E.baseValues(g.Game.run, 'chance');
    eq(bv.chips, 20 + 2 * 15, 'chips at level 3');
    eq(bv.mult, 2 + 2 * 1, 'mult at level 3');
    eq(total(g, 'chance'), (50 + 15) * 4);
  });
});

/* ============================================================
   Die upgrades
   ============================================================ */
describe('enhancements', function () {
  it('bonus adds flat chips', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].enhancement = 'bonus'; });
    eq(total(g, 'chance'), (35 + 30) * 2);
  });
  it('mult adds flat mult', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].enhancement = 'mult'; });
    eq(total(g, 'chance'), 35 * (2 + 4));
  });
  it('stone adds chips and always scores, even off-category', function () {
    // Sixes with a single 6; the stone die is a 1 and would normally be ignored
    const g = fixture([6, 1, 1, 1, 1], function (run) { run.dice[1].enhancement = 'stone'; });
    // chips: 26 base + 6 (the six) + 1 (stone die pip) + 50 (stone) = 83, x3
    eq(total(g, 'sixes'), 83 * 3);
  });
  it('steel multiplies while the die stays unscored', function () {
    const g = fixture([6, 6, 2, 3, 4], function (run) { run.dice[2].enhancement = 'steel'; });
    // 38 chips x (3 * 1.5)
    eq(total(g, 'sixes'), Math.floor(38 * 4.5));
  });
  it('glass multiplies when scored', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].enhancement = 'glass'; });
    eq(total(g, 'chance'), 35 * 4);
  });
  it('gold pays money instead of scoring', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].enhancement = 'gold'; });
    const p = g.E.preview(g.Game.run, 'chance');
    eq(p.total, 70, 'score unchanged');
    eq(p.money, 3, 'money logged');
  });
});

describe('editions and seals', function () {
  it('foil adds chips', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].edition = 'foil'; });
    eq(total(g, 'chance'), (35 + 50) * 2);
  });
  it('holographic adds mult', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].edition = 'holo'; });
    eq(total(g, 'chance'), 35 * 12);
  });
  it('polychrome multiplies mult', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].edition = 'poly'; });
    eq(total(g, 'chance'), Math.floor(35 * 3));
  });
  it('a red seal retriggers the die', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].seal = 'red'; });
    // die 0 (value 1) fires twice -> +1 chip
    eq(total(g, 'chance'), (35 + 1) * 2);
  });
  it('a gold seal pays on score', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].seal = 'gold'; });
    eq(g.E.preview(g.Game.run, 'chance').money, 3);
  });
});

/* ============================================================
   Charms
   ============================================================ */
describe('charms', function () {
  it('flat mult charms apply', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run, gg) { gg.Game.addCharm('lucky_seven'); });
    eq(total(g, 'chance'), 35 * 9);
  });
  it('charm order changes the result (x before + vs + before x)', function () {
    const a = fixture([1, 2, 3, 4, 5], function (run, gg) {
      gg.Game.addCharm('double_down'); gg.Game.addCharm('lucky_seven');
    });
    const b = fixture([1, 2, 3, 4, 5], function (run, gg) {
      gg.Game.addCharm('lucky_seven'); gg.Game.addCharm('double_down');
    });
    eq(total(a, 'chance'), Math.floor(35 * (2 * 1.5 + 7)));   // x1.5 first
    eq(total(b, 'chance'), Math.floor(35 * ((2 + 7) * 1.5))); // +7 first
    ok(total(a, 'chance') !== total(b, 'chance'), 'order must matter');
  });
  it('per-die charms fire once per scoring die', function () {
    const g = fixture([6, 6, 6, 1, 1], function (run, gg) { gg.Game.addCharm('boxcars'); });
    // sixes: 26 + 18 pips + 3x30 = 134, x3
    eq(total(g, 'sixes'), 134 * 3);
  });
  it('retrigger charms multiply die contributions', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run, gg) { gg.Game.addCharm('stutter'); });
    // every die fires twice -> pips counted twice
    eq(total(g, 'chance'), (20 + 30) * 2);
  });
  it('scaling charm state only advances on commit', function () {
    const g = fixture([5, 5, 5, 5, 5], function (run, gg) { gg.Game.addCharm('ivory_tower'); });
    const charm = g.Game.run.charms[0];
    g.E.preview(g.Game.run, 'fiveKind');
    g.E.preview(g.Game.run, 'fiveKind');
    eq(charm.state.x, 1, 'previews must not mutate charm state');
    g.E.commitScore(g.Game.run, 'fiveKind');
    near(charm.state.x, 1.25, 1e-9, 'commit advances it');
  });
  it('passive charms change derived stats', function () {
    const g = fixture([1, 2, 3, 4, 5]);
    const before = g.Game.rerollsPerTurn();
    g.Game.addCharm('extra_roll');
    eq(g.Game.rerollsPerTurn(), before + 1);
  });
  it('sixth sense adds and removes a die', function () {
    const g = fixture([1, 2, 3, 4, 5]);
    const n = g.Game.run.dice.length;
    g.Game.addCharm('sixth_sense');
    eq(g.Game.run.dice.length, n + 1, 'die added on buy');
    g.Game.sellCharm(g.Game.run.charms[0].uid);
    eq(g.Game.run.dice.length, n, 'die removed on sell');
  });
});

/* ============================================================
   Boss debuffs
   ============================================================ */
describe('boss debuffs', function () {
  function boss(values, mods) {
    const g = fixture(values);
    g.Game.run.blind.mods = mods;
    return g;
  }
  it('the mirror nullifies the upper section', function () {
    const g = boss([6, 6, 2, 3, 4], { deadSection: 'upper' });
    eq(total(g, 'sixes'), 0);
    ok(total(g, 'chance') > 0, 'lower section unaffected');
  });
  it('the sieve strips chips from 1s and 2s', function () {
    const g = boss([1, 2, 3, 4, 5], { deadFaces: [1, 2] });
    // pips 3+4+5 = 12 -> 32 x 2
    eq(total(g, 'chance'), 32 * 2);
  });
  it('the flint halves the base', function () {
    const g = boss([1, 2, 3, 4, 5], { halveBase: true });
    // chips ceil(20/2)=10, mult ceil(2/2)=1 -> (10+15) x 1
    eq(total(g, 'chance'), 25);
  });
  it('the plague nullifies die upgrades', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) {
      run.dice[0].enhancement = 'bonus';
      run.dice[1].edition = 'foil';
      run.dice[2].seal = 'red';
    });
    // base 20 + pips 15 + bonus 30 + foil 50 + the red-sealed 3 firing twice
    eq(total(g, 'chance'), (35 + 30 + 50 + 3) * 2, 'upgrades active normally');
    g.Game.run.blind.mods = { nullifyDice: true };
    eq(total(g, 'chance'), 70, 'all upgrades ignored');
  });
  it('locked categories are unusable', function () {
    const g = fixture([1, 2, 3, 4, 5]);
    g.Game.run.blind.locked = ['chance'];
    eq(g.E.catStatus(g.Game.run, 'chance'), 'locked');
    eq(g.Game.scoreCategory('chance'), null, 'scoring a locked category is rejected');
  });
});

/* ============================================================
   Larger dice pools
   ============================================================ */
describe('dice pools larger than five', function () {
  it('picks the best five-die subset', function () {
    const g = fixture([1, 1, 6, 6, 6, 6]);
    // best four-of-a-kind subset keeps all four 6s
    const p = g.E.preview(g.Game.run, 'fourKind');
    ok(p.valid, 'should find the quad');
    const vals = p.scoringIdx.map(function (i) { return g.Game.run.dice[i].value; });
    eq(vals.filter(function (v) { return v === 6; }).length, 4, 'all four sixes chosen');
  });
  it('leftover dice count as held', function () {
    const g = fixture([2, 3, 4, 5, 6, 6]);
    const p = g.E.preview(g.Game.run, 'largeStraight');
    ok(p.valid);
    eq(p.scoringIdx.length + p.heldIdx.length, 6, 'every die is accounted for');
    eq(p.heldIdx.length, 1);
  });
});

/* ============================================================
   Preview / commit parity
   ============================================================ */
describe('preview parity', function () {
  it('preview equals commit when nothing random is involved', function () {
    const g = fixture([3, 3, 3, 2, 2], function (run, gg) {
      gg.Game.addCharm('house_rules');
      gg.Game.addCharm('pip_counter');
      run.dice[0].enhancement = 'bonus';
      run.dice[1].edition = 'poly';
    });
    const p = g.E.preview(g.Game.run, 'fullHouse');
    const c = g.E.commitScore(g.Game.run, 'fullHouse');
    eq(c.total, p.total, 'totals match');
    eq(c.chips, p.chips, 'chips match');
    near(c.mult, p.mult, 1e-9, 'mult matches');
  });
  it('preview never spends money or rng', function () {
    const g = fixture([1, 2, 3, 4, 5], function (run) { run.dice[0].enhancement = 'lucky'; });
    const money = g.Game.run.money;
    const rngState = g.Game.run.rng.state;
    for (let i = 0; i < 20; i++) g.E.preview(g.Game.run, 'chance');
    eq(g.Game.run.money, money, 'money untouched');
    eq(g.Game.run.rng.state, rngState, 'rng stream untouched');
  });
});

/* ============================================================
   Persistence
   ============================================================ */
describe('save and load', function () {
  it('round-trips a run', function () {
    const g = createGame({ quiet: true });
    g.Game.newRun('SAVEME');
    g.Game.startBlind();
    g.Game.addCharm('lucky_seven');
    g.Game.run.money = 37;
    g.Game.run.levels.chance = 4;
    g.Game.save();

    const before = {
      money: g.Game.run.money,
      charm: g.Game.run.charms[0].id,
      level: g.Game.run.levels.chance,
      seed: g.Game.run.seed,
      rng: g.Game.run.rng.state
    };
    ok(g.Game.load(), 'load succeeded');
    eq(g.Game.run.money, before.money);
    eq(g.Game.run.charms[0].id, before.charm);
    eq(g.Game.run.levels.chance, before.level);
    eq(g.Game.run.seed, before.seed);
    eq(g.Game.run.rng.state, before.rng, 'rng position preserved');
  });
  it('survives a corrupted save', function () {
    const g = createGame({ quiet: true });
    g.localStorage.setItem('onemoreroll.save.v2', '{not json at all');
    eq(g.Game.load(), false, 'load reports failure instead of throwing');
    eq(g.Game.hasSave(), false, 'a corrupt save is not offered as resumable');
  });
  it('migrates a pre-rename save, including the renamed category', function () {
    const g = createGame({ quiet: true });
    // a v2 save written before the rename: old key, old category id
    const old = {
      version: 2, seed: 'OLD', rngState: { s: 'OLD', st: 12345 }, uidCounter: 9,
      deckId: 'standard', stake: 1, ante: 3, blindIndex: 1, roundNum: 5, money: 17,
      dice: [{ id: 'd1', faces: [1, 2, 3, 4, 5, 6], value: 4, enhancement: null, edition: null, seal: null }],
      levels: { yahtzee: 7, chance: 2 },
      catPlays: { yahtzee: 3 },
      everScored: { yahtzee: true },
      charms: [], consumables: [{ uid: 'c1', kind: 'rune', id: 'rune_yahtzee' }],
      vouchers: [], charmSlots: 5, consumableSlots: 2, blind: null,
      stats: { turns: 4, best: 900, bestCat: '-', rerolls: 1, moneyEarned: 20 },
      phase: 'blindSelect'
    };
    g.localStorage.setItem('rollatro.save.v2', JSON.stringify(old));

    ok(g.Game.hasSave(), 'the old save is found under its old key');
    ok(g.Game.load(), 'it loads');
    const run = g.Game.run;
    eq(run.levels.fiveKind, 7, 'category level carried over to the new id');
    eq(run.levels.yahtzee, undefined, 'the old id is gone');
    eq(run.catPlays.fiveKind, 3, 'play count carried over');
    eq(run.consumables[0].id, 'rune_fiveKind', 'the rune was retargeted');
    eq(run.money, 17, 'the rest of the run is intact');
    eq(run.ante, 3);
    eq(run.version, 3, 'stamped with the current save version');
    // every category must have a level after migration
    g.C.CATEGORIES.forEach(function (c) {
      eq(typeof run.levels[c.id], 'number', c.id + ' has a level');
    });
  });

  it('carries a pre-rename profile across', function () {
    const g = createGame({ quiet: true });
    g.localStorage.setItem('rollatro.profile.v1', JSON.stringify({
      version: 1, runs: 12, wins: 2, bestAnte: 6, bestHand: 4242, unlockedStake: 3,
      deckWins: { standard: 2 }, deckPlays: {}, discovered: {}, history: []
    }));
    const p = g.Profile.reload();   // the profile is read once at boot
    eq(p.runs, 12, 'runs carried over');
    eq(p.wins, 2, 'wins carried over');
    eq(p.unlockedStake, 3, 'peril ceiling carried over');
  });

  it('abandon clears the save', function () {
    const g = createGame({ quiet: true });
    g.Game.newRun('BYE');
    ok(g.Game.hasSave());
    g.Game.abandon();
    ok(!g.Game.hasSave());
  });
});

/* ============================================================
   Whole-run determinism
   ============================================================ */
describe('determinism', function () {
  it('the same seed and policy produce the same run', function () {
    const a = runOne(createGame({ quiet: true }), 'DETERMINISM', 'competent');
    const b = runOne(createGame({ quiet: true }), 'DETERMINISM', 'competent');
    eq(b.outcome, a.outcome, 'outcome');
    eq(b.ante, a.ante, 'ante');
    eq(b.round, a.round, 'round');
    eq(b.best, a.best, 'best hand');
    deepEq(b.charms, a.charms, 'charm build');
  });
  it('different seeds produce different runs', function () {
    const results = ['A1', 'B2', 'C3', 'D4', 'E5'].map(function (s) {
      return runOne(createGame({ quiet: true }), s, 'competent');
    });
    const distinct = new Set(results.map(function (r) { return r.ante + ':' + r.round + ':' + r.best; }));
    ok(distinct.size > 1, 'seeds should diverge');
  });
  it('every run terminates cleanly', function () {
    for (let i = 0; i < 12; i++) {
      const r = runOne(createGame({ quiet: true }), 'TERM' + i, 'competent');
      ok(r.outcome === 'died' || r.outcome === 'won' || r.outcome === 'capped',
        'seed TERM' + i + ' ended as ' + r.outcome);
    }
  });
});


/* ============================================================
   Content integrity — every item must survive being used
   ============================================================ */
describe('content integrity', function () {
  it('every charm scores without throwing', function () {
    const broken = [];
    const g0 = createGame({ quiet: true });
    g0.CH.CHARMS.forEach(function (def) {
      try {
        const g = fixture([6, 6, 6, 2, 3]);
        g.Game.addCharm(def.id);
        ['sixes', 'threeKind', 'chance', 'fiveKind'].forEach(function (cat) {
          g.E.preview(g.Game.run, cat);
        });
        const res = g.E.commitScore(g.Game.run, 'threeKind');
        g.Game.applyScore(res);
      } catch (e) {
        broken.push(def.id + ': ' + e.message);
      }
    });
    eq(broken.length, 0, 'broken charms: ' + broken.join(' | '));
  });

  it('every charm survives a whole blind lifecycle', function () {
    const broken = [];
    const g0 = createGame({ quiet: true });
    g0.CH.CHARMS.forEach(function (def) {
      try {
        const g = createGame({ quiet: true });
        g.Game.newRun('LIFECYCLE');
        g.Game.addCharm(def.id);
        g.Game.startBlind();
        g.helpers.setDice([5, 5, 5, 5, 5]);
        g.Game.applyScore(g.E.commitScore(g.Game.run, 'fiveKind'));
      } catch (e) {
        broken.push(def.id + ': ' + e.message);
      }
    });
    eq(broken.length, 0, 'broken lifecycles: ' + broken.join(' | '));
  });

  it('every charm has a unique id, a cost and an icon', function () {
    const g = createGame({ quiet: true });
    const seen = {};
    const bad = [];
    g.CH.CHARMS.forEach(function (c) {
      if (seen[c.id]) bad.push('duplicate ' + c.id);
      seen[c.id] = true;
      if (!c.icon) bad.push('no icon ' + c.id);
      if (!c.cost || c.cost < 1) bad.push('no cost ' + c.id);
      if (!c.rarity) bad.push('no rarity ' + c.id);
    });
    eq(bad.length, 0, bad.join(' | '));
  });

  it('every tag applies without throwing', function () {
    const broken = [];
    const g0 = createGame({ quiet: true });
    g0.C.TAGS.forEach(function (tag) {
      try {
        const g = createGame({ quiet: true });
        g.Game.newRun('TAGTEST');
        g.Game.startBlind();
        g.Game.applyScore(g.E.commitScore(g.Game.run, 'chance'));
        g.Game.run.phase = 'blindSelect';
        g.Game.run.blindIndex = 0;
        g.Game.applyTag(tag);
        // whatever it did must leave the run in a legal state
        g.Game.startBlind();
        ok(g.Game.turnsForBlind() >= 1, tag.id + ' left no turns');
      } catch (e) {
        broken.push(tag.id + ': ' + e.message);
      }
    });
    eq(broken.length, 0, 'broken tags: ' + broken.join(' | '));
  });

  it('every voucher applies without throwing', function () {
    const broken = [];
    const g0 = createGame({ quiet: true });
    g0.C.VOUCHERS.forEach(function (v) {
      try {
        const g = createGame({ quiet: true });
        g.Game.newRun('VOUCHERTEST');
        if (v.requires) g.Game.run.vouchers.push(v.requires);
        g.Game.run.shop = { items: [], packs: [], voucher: { kind: 'voucher', id: v.id, cost: 0 }, rerolls: 0 };
        g.Game.run.money = 999;
        g.Game.buy('voucher', 0);
        g.Game.turnsForBlind();
        g.Game.rerollsPerTurn();
        g.Game.interestCap();
        g.Game.rerollCost();
        g.Game.priceOf(10);
        if (g.Game.run.vouchers.indexOf(v.id) === -1) broken.push(v.id + ': not applied');
      } catch (e) {
        broken.push(v.id + ': ' + e.message);
      }
    });
    eq(broken.length, 0, 'broken vouchers: ' + broken.join(' | '));
  });

  it('tier-2 vouchers only appear once their tier-1 is owned', function () {
    const g = createGame({ quiet: true });
    g.Game.newRun('TIER2');
    const tiered = g.C.VOUCHERS.filter(function (v) { return v.requires; });
    ok(tiered.length > 0, 'there are tier-2 vouchers');
    tiered.forEach(function (v) {
      ok(g.C.VOUCHER_BY_ID[v.requires], v.id + ' requires a real voucher: ' + v.requires);
    });
  });

  it('every boss blind can be played', function () {
    const broken = [];
    const g0 = createGame({ quiet: true });
    g0.C.BOSSES.forEach(function (boss) {
      try {
        const g = createGame({ quiet: true });
        g.Game.newRun('BOSSTEST');
        g.Game.run.blindIndex = 2;
        g.Game.run.bossId = boss.id;
        g.Game.startBlind();
        g.helpers.setDice([1, 2, 3, 4, 5]);
        g.C.CATEGORIES.forEach(function (c) {
          if (g.E.catStatus(g.Game.run, c.id) === 'open') g.E.preview(g.Game.run, c.id);
        });
        const open = g.C.CATEGORIES.filter(function (c) {
          return g.E.catStatus(g.Game.run, c.id) === 'open';
        });
        ok(open.length > 0, boss.id + ' left no playable category');
        g.Game.applyScore(g.E.commitScore(g.Game.run, open[0].id));
      } catch (e) {
        broken.push(boss.id + ': ' + e.message);
      }
    });
    eq(broken.length, 0, 'broken bosses: ' + broken.join(' | '));
  });

  it('every omen resolves without throwing', function () {
    const broken = [];
    const g0 = createGame({ quiet: true });
    g0.C.OMENS.forEach(function (omen) {
      try {
        const g = createGame({ quiet: true });
        g.Game.newRun('OMENTEST');
        g.Game.startBlind();
        g.Game.run.consumableSlots = 4;
        g.Game.addConsumable({ kind: 'omen', id: omen.id });
        const item = g.Game.run.consumables[g.Game.run.consumables.length - 1];
        const r = g.Game.useConsumable(item.uid, 0);
        ok(r === 'done' || r === 'fail', omen.id + ' returned ' + r);
      } catch (e) {
        broken.push(omen.id + ': ' + e.message);
      }
    });
    eq(broken.length, 0, 'broken omens: ' + broken.join(' | '));
  });

  it('every rune levels its category', function () {
    const g = createGame({ quiet: true });
    g.Game.newRun('RUNETEST');
    g.Game.run.consumableSlots = 20;
    g.C.RUNES.forEach(function (rune) {
      const before = rune.cat ? g.Game.run.levels[rune.cat] : null;
      g.Game.addConsumable({ kind: 'rune', id: rune.id });
      const item = g.Game.run.consumables[g.Game.run.consumables.length - 1];
      eq(g.Game.useConsumable(item.uid), 'done', rune.id);
      if (rune.cat) eq(g.Game.run.levels[rune.cat], before + 1, rune.id + ' level');
    });
  });
});

/* ============================================================
   Decks and stakes
   ============================================================ */
describe('decks', function () {
  it('every deck produces a legal opening position', function () {
    const broken = [];
    const g0 = createGame({ quiet: true });
    g0.DK.DECKS.forEach(function (deck) {
      try {
        const g = createGame({ quiet: true });
        g.Game.newRun('DECK-' + deck.id, { deckId: deck.id, stake: 1 });
        const run = g.Game.run;
        ok(run.dice.length >= 1, deck.id + ' has dice');
        ok(run.charmSlots >= 1, deck.id + ' has charm slots');
        ok(run.money >= 0, deck.id + ' has non-negative money');
        ok(run.consumables.length <= run.consumableSlots, deck.id + ' respects consumable slots');
        ok(run.charms.length <= run.charmSlots, deck.id + ' respects charm slots');
        g.Game.startBlind();
        ok(g.Game.turnsForBlind() >= 1, deck.id + ' allows at least one turn');
      } catch (e) {
        broken.push(deck.id + ': ' + e.message);
      }
    });
    eq(broken.length, 0, broken.join(' | '));
  });

  it('deck modifiers actually change the numbers', function () {
    const std = createGame({ quiet: true });
    std.Game.newRun('CMP', { deckId: 'standard', stake: 1 });
    const wide = createGame({ quiet: true });
    wide.Game.newRun('CMP', { deckId: 'wide', stake: 1 });
    ok(wide.Game.run.dice.length > std.Game.run.dice.length, 'wide deck has more dice');
    ok(wide.Game.blindTarget(0) > std.Game.blindTarget(0), 'wide deck has higher targets');

    const gam = createGame({ quiet: true });
    gam.Game.newRun('CMP', { deckId: 'gambler', stake: 1 });
    gam.Game.startBlind();
    std.Game.startBlind();
    ok(gam.Game.rerollsPerTurn() > std.Game.rerollsPerTurn(), 'gambler rerolls more');
    ok(gam.Game.turnsForBlind() < std.Game.turnsForBlind(), 'gambler has fewer turns');
  });
});

describe('stakes', function () {
  it('stack cumulatively', function () {
    const g = createGame({ quiet: true });
    const s1 = g.DK.stakeMods(1);
    const s8 = g.DK.stakeMods(8);
    ok(s8.targetMul > s1.targetMul, 'targets rise');
    ok(s8.turns < s1.turns, 'turns fall');
    ok(s8.rerolls < s1.rerolls, 'rerolls fall');
    ok(s8.priceMul > s1.priceMul, 'prices rise');
  });

  it('raise targets monotonically', function () {
    let prev = 0;
    for (let lvl = 1; lvl <= 8; lvl++) {
      const g = createGame({ quiet: true });
      g.Game.newRun('STAKE', { deckId: 'standard', stake: lvl });
      const t = g.Game.blindTarget(0);
      ok(t >= prev, 'stake ' + lvl + ' target ' + t + ' >= ' + prev);
      prev = t;
    }
  });

  it('every stake still leaves a playable run', function () {
    for (let lvl = 1; lvl <= 8; lvl++) {
      const g = createGame({ quiet: true });
      g.Game.newRun('PLAYABLE', { deckId: 'standard', stake: lvl });
      g.Game.startBlind();
      ok(g.Game.turnsForBlind() >= 1, 'stake ' + lvl + ' turns');
      ok(g.Game.rerollsPerTurn() >= 0, 'stake ' + lvl + ' rerolls');
      ok(g.Game.run.money >= 0, 'stake ' + lvl + ' money');
    }
  });
});

/* ============================================================
   Profile
   ============================================================ */
describe('encore', function () {
  function playing(g, seed) {
    g.Game.newRun(seed || 'ENCORE');
    g.Game.startBlind();
    return g.Game.run;
  }

  it('without the charm a category is used up once scored', function () {
    const g = createGame({ quiet: true });
    const run = playing(g);
    const cat = g.C.CATEGORIES[0].id;          // Aces: always a valid score
    eq(g.E.catStatus(run, cat), 'open');
    g.Game.scoreCategory(cat);
    eq(g.E.catStatus(run, cat), 'used', 'category consumed');
  });

  it('Encore keeps the first scored category open, then stops', function () {
    const g = createGame({ quiet: true });
    const run = playing(g, 'ENCORE2');
    g.Game.addCharm('encore', true);
    run.blind.encoresLeft = g.CH.sumPassive(run, 'encore', 'encores');
    eq(run.blind.encoresLeft, 1, 'one replay granted');

    const cat = g.C.CATEGORIES[0].id;
    g.Game.scoreCategory(cat);
    eq(g.E.catStatus(run, cat), 'open', 'first score does not consume it');
    eq(run.blind.encoresLeft, 0, 'the replay is spent');

    g.Game.scoreCategory(cat);
    eq(g.E.catStatus(run, cat), 'used', 'second score consumes it');
  });

  it('replays refresh each blind', function () {
    const g = createGame({ quiet: true });
    const run = playing(g, 'ENCORE3');
    g.Game.addCharm('encore', true);
    run.blind.encoresLeft = 0;
    g.Game.startBlind();
    eq(g.Game.run.blind.encoresLeft, 1, 'a new blind restores the replay');
  });
});

describe('profile', function () {
  it('records a finished run and unlocks decks', function () {
    const g = createGame({ quiet: true });
    g.Profile.reset();
    eq(g.Profile.get().bestAnte, 0);
    g.Game.newRun('PROF', { deckId: 'standard', stake: 1 });
    g.Game.run.ante = 5;
    g.Game.run.stats.best = 9000;
    g.Game.saveMetaOnEnd(false);
    eq(g.Profile.get().bestAnte, 5, 'best ante recorded');
    eq(g.Profile.get().runs, 1, 'run counted');
    ok(g.Profile.deckUnlocked(g.DK.deckById('loaded')), 'ante-3 deck unlocked');
    ok(g.Profile.deckUnlocked(g.DK.deckById('scholar')), 'best-5000 deck unlocked');
    ok(!g.Profile.deckUnlocked(g.DK.deckById('wide')), 'win-gated deck still locked');
  });

  it('winning raises the stake ceiling', function () {
    const g = createGame({ quiet: true });
    g.Profile.reset();
    eq(g.Profile.unlockedStake(), 1);
    g.Game.newRun('PROF2', { deckId: 'standard', stake: 1 });
    g.Game.run.ante = 8;
    g.Game.saveMetaOnEnd(true);
    eq(g.Profile.unlockedStake(), 2, 'stake 2 unlocked by a stake 1 win');
    eq(g.Profile.get().deckWins.standard, 1, 'deck win recorded');
  });

  it('only records a run once', function () {
    const g = createGame({ quiet: true });
    g.Profile.reset();
    g.Game.newRun('PROF3');
    g.Game.saveMetaOnEnd(false);
    g.Game.saveMetaOnEnd(false);
    g.Game.saveMetaOnEnd(true);
    eq(g.Profile.get().runs, 1, 'exactly one run recorded');
  });

  it('survives a corrupted profile blob', function () {
    const g = createGame({ quiet: true });
    g.localStorage.setItem('onemoreroll.profile.v1', 'not json');
    const p = g.Profile.get();
    ok(p && typeof p.runs === 'number', 'falls back to a blank profile');
  });
});

/* ---------- report ---------- */
const totalTests = passed + failures.length;
if (failures.length) {
  console.log('\n' + failures.length + ' of ' + totalTests + ' tests FAILED\n');
  failures.forEach(function (f) {
    console.log('  x [' + f.group + '] ' + f.name);
    console.log('      ' + f.err);
  });
  console.log('');
  process.exit(1);
} else {
  console.log('\nall ' + totalTests + ' tests passed\n');
}
