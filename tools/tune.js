/* Balance experiment: try several ante curves against the competent bot.
   Patches C.ANTE_BASE in the loaded sandbox, so nothing on disk changes. */
'use strict';
const { createGame } = require('./harness');
const { runOne } = require('./policies');

const CURVES = {
  'current      ': [0, 300, 800, 2000, 5000, 11000, 20000, 35000, 50000],
  'softer mid   ': [0, 300, 750, 1700, 3800, 8000, 15000, 26000, 40000],
  'softer still ': [0, 280, 700, 1500, 3200, 6500, 12000, 21000, 33000],
  'gentle       ': [0, 250, 600, 1300, 2700, 5400, 9800, 17000, 27000]
};

const RUNS = Number(process.argv[2] || 300);

console.log('\nante curve experiment — competent bot, ' + RUNS + ' runs each\n');
console.log('  curve            win%   avgAnte   deaths by ante 1..8');
console.log('  ' + '-'.repeat(66));

for (const label in CURVES) {
  const g = createGame({ quiet: true });
  // patch the table in place (anteBase reads it by closure)
  const base = g.C.ANTE_BASE;
  base.length = 0;
  CURVES[label].forEach(function (v) { base.push(v); });

  const deaths = {};
  let wins = 0, anteSum = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = runOne(g, 'TUNE-' + i, 'competent');
    if (r.outcome === 'won') wins++;
    else deaths[r.ante] = (deaths[r.ante] || 0) + 1;
    anteSum += r.ante;
  }
  const row = [];
  for (let a = 1; a <= 8; a++) row.push(String(deaths[a] || 0).padStart(3));
  console.log('  ' + label + '  ' +
    ((wins / RUNS) * 100).toFixed(1).padStart(5) + '   ' +
    (anteSum / RUNS).toFixed(2).padStart(6) + '    ' + row.join(' '));
}
console.log('');
