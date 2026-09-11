/* ============================================================
   tools/sim.js — batch balance simulator

   Runs N seeded runs headlessly and prints how far they got.

   Examples:
     node tools/sim.js
     node tools/sim.js --runs 500 --policy competent
     node tools/sim.js --runs 200 --stakes 1,3,5,8
     node tools/sim.js --runs 200 --deck loaded
     node tools/sim.js --runs 300 --all-decks
   ============================================================ */
'use strict';

const { createGame } = require('./harness');
const { runOne, POLICIES } = require('./policies');

/* ---------- args ---------- */
function parseArgs(argv) {
  const out = { runs: 200, policy: 'competent', stakes: null, deck: null, allDecks: false, seedPrefix: 'SIM' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--runs') out.runs = parseInt(argv[++i], 10);
    else if (a === '--policy') out.policy = argv[++i];
    else if (a === '--stakes') out.stakes = argv[++i].split(',').map(Number);
    else if (a === '--deck') out.deck = argv[++i];
    else if (a === '--all-decks') out.allDecks = true;
    else if (a === '--seed') out.seedPrefix = argv[++i];
    else if (a === '--help' || a === '-h') { out.help = true; }
  }
  return out;
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(fs => '');
  console.log('usage: node tools/sim.js [--runs N] [--policy random|greedy|competent]');
  console.log('                         [--stakes 1,2,..] [--deck ID] [--all-decks]');
  process.exit(0);
}

/* ---------- one batch ---------- */
function batch(label, runs, policy, runOpts) {
  const g = createGame({ quiet: true });
  const deaths = {};       // ante -> count
  let wins = 0, other = 0;
  let bestEver = 0, bestSeed = '';
  let anteSum = 0;
  const charmUse = {};
  const t0 = Date.now();

  for (let i = 0; i < runs; i++) {
    const r = runOne(g, args.seedPrefix + '-' + label + '-' + i, policy, { runOpts: runOpts });
    if (r.outcome === 'won') wins++;
    else if (r.outcome === 'died') deaths[r.ante] = (deaths[r.ante] || 0) + 1;
    else other++;
    anteSum += r.ante;
    if (r.best > bestEver) { bestEver = r.best; bestSeed = args.seedPrefix + '-' + label + '-' + i; }
    r.charms.forEach(function (id) { charmUse[id] = (charmUse[id] || 0) + 1; });
  }

  return {
    label: label, runs: runs, wins: wins, other: other, deaths: deaths,
    avgAnte: anteSum / runs, bestEver: bestEver, bestSeed: bestSeed,
    ms: Date.now() - t0, charmUse: charmUse
  };
}

/* ---------- reporting ---------- */
function bar(n, max, width) {
  const w = max > 0 ? Math.round((n / max) * width) : 0;
  return '#'.repeat(w) + '.'.repeat(width - w);
}

function report(res) {
  const winPct = (res.wins / res.runs) * 100;
  console.log('\n  ' + res.label);
  console.log('  ' + '-'.repeat(58));
  console.log('  runs ' + res.runs +
    '   wins ' + res.wins + ' (' + winPct.toFixed(1) + '%)' +
    '   avg ante ' + res.avgAnte.toFixed(2) +
    '   ' + res.ms + 'ms');
  const maxD = Math.max(1, ...Object.values(res.deaths));
  for (let a = 1; a <= 8; a++) {
    const n = res.deaths[a] || 0;
    console.log('    died ante ' + a + '  ' + bar(n, maxD, 26) + ' ' + String(n).padStart(4));
  }
  if (res.wins) console.log('    WON       ' + bar(res.wins, maxD, 26) + ' ' + String(res.wins).padStart(4));
  if (res.other) console.log('    other     ' + res.other);
  console.log('    best single turn ' + res.bestEver.toLocaleString('en-US') + '  (' + res.bestSeed + ')');
}

/* ---------- main ---------- */
const probe = createGame({ quiet: true });
const DECKS = probe.DK ? probe.DK.DECKS.map(function (d) { return d.id; }) : ['standard'];
const HAS_STAKES = !!(probe.DK && probe.DK.STAKES);

console.log('\nONE MORE ROLL balance simulation');
console.log('policy: ' + args.policy + (POLICIES[args.policy] ? '' : '  (unknown, using competent)'));

const batches = [];

if (args.allDecks) {
  DECKS.forEach(function (id) {
    batches.push(batch('deck:' + id, args.runs, args.policy, { deckId: id, stake: 1 }));
  });
} else if (args.stakes && HAS_STAKES) {
  args.stakes.forEach(function (s) {
    batches.push(batch('stake ' + s, args.runs, args.policy, { deckId: args.deck || 'standard', stake: s }));
  });
} else {
  batches.push(batch(
    (args.deck ? 'deck:' + args.deck : 'standard') + (HAS_STAKES ? ' @ stake 1' : ''),
    args.runs, args.policy, { deckId: args.deck || 'standard', stake: 1 }));
}

batches.forEach(report);

/* charm popularity across everything, as a smell test for dead content */
const combined = {};
batches.forEach(function (b) {
  for (const k in b.charmUse) combined[k] = (combined[k] || 0) + b.charmUse[k];
});
const ranked = Object.keys(combined).sort(function (a, b) { return combined[b] - combined[a]; });
if (ranked.length) {
  console.log('\n  charms most often held at end of run');
  console.log('  ' + '-'.repeat(58));
  ranked.slice(0, 8).forEach(function (id) {
    console.log('    ' + id.padEnd(20) + combined[id]);
  });
  const allCharms = probe.CH.CHARMS.map(function (c) { return c.id; });
  const never = allCharms.filter(function (id) { return !combined[id]; });
  console.log('    never held: ' + never.length + ' of ' + allCharms.length +
    (never.length && never.length <= 12 ? '  (' + never.join(', ') + ')' : ''));
}
console.log('');
