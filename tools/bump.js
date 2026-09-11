/* ============================================================
   tools/bump.js — bump the asset version

   GitHub Pages serves js/ and css/ with caching headers, so a player
   who has loaded the site once can keep running the old build after you
   push. Every asset URL in index.html carries a ?v= token; this bumps it.

     node tools/bump.js 1.0.1
     node tools/bump.js            # auto-increment the patch number
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

function currentVersion(html) {
  const m = html.match(/<meta name="app-version" content="([^"]+)">/);
  return m ? m[1] : '0.0.0';
}

function bumpPatch(v) {
  const parts = v.split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

let html = fs.readFileSync(INDEX, 'utf8');
const from = currentVersion(html);
const to = process.argv[2] || bumpPatch(from);

if (!/^\d+\.\d+\.\d+$/.test(to)) {
  console.error('version must look like 1.2.3, got: ' + to);
  process.exit(1);
}

html = html.replace(/<meta name="app-version" content="[^"]+">/,
                    '<meta name="app-version" content="' + to + '">');
html = html.replace(/\?v=[0-9]+\.[0-9]+\.[0-9]+/g, '?v=' + to);
fs.writeFileSync(INDEX, html);

const stamped = (html.match(/\?v=/g) || []).length;
console.log('version ' + from + ' -> ' + to + '  (' + stamped + ' asset urls stamped)');
console.log('commit and push to deploy.');
