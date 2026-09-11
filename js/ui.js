/* ============================================================
   ui.js — rendering, animation, tooltips, overlays
   ============================================================ */
(function (global) {
  'use strict';

  const $ = U.$, el = U.el, clear = U.clear;

  let selectedCat = null;
  let busy = false;
  let pendingConsumable = null;   // uid of a consumable waiting for a die target

  const dom = {};
  function cache() {
    ['blindPlate', 'blindName', 'blindSub', 'blindTarget', 'blindReward',
     'roundScore', 'handTitle', 'handLevel', 'handChips', 'handMult',
     'statTurns', 'statRerolls', 'statMoney', 'statAnte', 'statRound',
     'charmRow', 'consumableRow', 'charmCount', 'consumableCount',
     'diceRow', 'diceHint', 'btnRoll', 'btnScore', 'btnSort', 'handPanel',
     'scUpper', 'scLower', 'overlay', 'overlayInner', 'tooltip', 'toasts',
     'scoreFx', 'bossBanner', 'btnRunInfo', 'btnOptions'
    ].forEach(function (id) { dom[id] = document.getElementById(id); });
    dom.scoreFx.style.position = 'fixed';
    dom.scoreFx.style.inset = '0';
  }

  /* ================= toasts ================= */
  function toast(text, kind) {
    const t = el('div', 'toast ' + (kind || ''), text);
    dom.toasts.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }

  /* ================= tooltips ================= */
  function attachTip(node, tip) {
    node._tip = tip;
    node.addEventListener('mouseenter', showTip);
    node.addEventListener('mousemove', moveTip);
    node.addEventListener('mouseleave', hideTip);
  }
  function showTip(e) {
    const tip = e.currentTarget._tip;
    if (!tip) return;
    const t = dom.tooltip;
    clear(t);
    t.appendChild(el('div', 'tt-name', tip.name));
    if (tip.rar) t.appendChild(el('div', 'tt-rar', tip.rar));
    const d = el('div', 'tt-desc');
    d.innerHTML = tip.desc || '';
    t.appendChild(d);
    if (tip.foot) t.appendChild(el('div', 'tt-foot', tip.foot));
    t.classList.remove('hidden');
    moveTip(e);
  }
  function moveTip(e) {
    const t = dom.tooltip;
    if (t.classList.contains('hidden')) return;
    const r = t.getBoundingClientRect();
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 16;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    t.style.left = Math.max(6, x) + 'px';
    t.style.top = Math.max(6, y) + 'px';
  }
  function hideTip() { dom.tooltip.classList.add('hidden'); }

  /** The game's own mark for a piece of content. */
  function iconNode(kind, id, cls) {
    return Icons.node(Icons.forContent(kind, id), cls);
  }
  function iconArt(kind, id) {
    const art = el('div', 'cart');
    art.appendChild(iconNode(kind, id));
    return art;
  }

  /* ================= dice rendering ================= */
  const PIPS = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]
  };

  function dieTip(d) {
    const bits = [];
    if (d.enhancement) bits.push('<b>' + C.ENHANCEMENTS[d.enhancement].name + '</b><br>' + C.ENHANCEMENTS[d.enhancement].desc);
    if (d.edition) bits.push('<b>' + C.EDITIONS[d.edition].name + '</b><br>' + C.EDITIONS[d.edition].desc);
    if (d.seal) bits.push('<b>' + C.SEALS[d.seal].name + '</b><br>' + C.SEALS[d.seal].desc);
    const std = d.faces.join('') === '123456';
    if (!std) bits.push('Faces: <b>' + d.faces.join(' · ') + '</b>');
    if (!bits.length) bits.push('A plain six-sided die.');
    return { name: 'Die showing ' + d.value, desc: bits.join('<br><br>') };
  }

  function buildDie(d, i, opts) {
    opts = opts || {};
    const run = Game.run;
    const node = el('div', 'die');
    if (d.enhancement) node.classList.add('enh-' + d.enhancement);
    if (d.edition) node.classList.add('ed-' + d.edition);
    if (d.held) node.classList.add('held');
    if (d.hidden) node.classList.add('hiddenface');

    const v = d.value;
    if (PIPS[v]) {
      PIPS[v].forEach(function (p) {
        const pip = el('div', 'pip');
        pip.style.gridRow = p[0];
        pip.style.gridColumn = p[1];
        node.appendChild(pip);
      });
    } else {
      node.appendChild(el('div', 'numface', String(v)));
    }
    if (d.seal) {
      const s = el('div', 'seal');
      s.style.background = C.SEALS[d.seal].color;
      node.appendChild(s);
    }
    if (d.enhancement) node.appendChild(el('div', 'dtag', C.ENHANCEMENTS[d.enhancement].short));
    else if (d.edition) node.appendChild(el('div', 'dtag', C.EDITIONS[d.edition].short));

    attachTip(node, dieTip(d));
    node.dataset.index = i;
    if (opts.onClick) node.addEventListener('click', function () { opts.onClick(i); });
    return node;
  }

  function renderDice() {
    const run = Game.run;
    clear(dom.diceRow);
    if (!run || !run.blind) return;

    let willScore = [];
    if (selectedCat && E.catStatus(run, selectedCat) === 'open') {
      const p = E.preview(run, selectedCat);
      if (p.valid && !p.dead) willScore = p.scoringIdx;
    }

    run.dice.forEach(function (d, i) {
      const node = buildDie(d, i, {
        onClick: function (idx) {
          if (busy) return;
          if (pendingConsumable) {
            const r = Game.useConsumable(pendingConsumable, idx);
            pendingConsumable = null;
            dom.diceHint.textContent = '';
            render();
            return;
          }
          Sfx.play(run.dice[idx].held ? 'release' : 'hold');
          Game.toggleHold(idx);
        }
      });
      if (Settings.get('showPreview') && willScore.indexOf(i) !== -1) node.classList.add('willscore');
      dom.diceRow.appendChild(node);
    });
  }

  function animateRoll(indices) {
    const nodes = dom.diceRow.children;
    indices.forEach(function (i) {
      const n = nodes[i];
      if (!n) return;
      n.classList.remove('rolling');
      void n.offsetWidth;
      n.classList.add('rolling');
    });
    setTimeout(render, 60);
  }

  /* ================= cards (charms / consumables / shop) ================= */
  function charmCard(inst, opts) {
    opts = opts || {};
    const def = CH.CHARM_BY_ID[inst.id];
    const node = el('div', 'card rar-' + def.rarity);
    node.appendChild(el('div', 'cname', def.name));
    node.appendChild(iconArt('charm', def.id));
    node.appendChild(el('div', 'cfoot', opts.foot !== undefined ? opts.foot : (inst.sell ? 'sell $' + inst.sell : '')));
    attachTip(node, {
      name: def.name, rar: def.rarity,
      desc: def.desc(inst, Game.run),
      foot: opts.tipFoot || (inst.sell ? 'Right-click to sell for $' + inst.sell : null)
    });
    if (opts.onClick) node.addEventListener('click', opts.onClick);
    if (opts.onRight) node.addEventListener('contextmenu', function (e) { e.preventDefault(); opts.onRight(e); });
    return node;
  }

  function consumableCard(item, opts) {
    opts = opts || {};
    const isRune = item.kind === 'rune';
    const def = isRune ? C.RUNE_BY_ID[item.id] : C.OMEN_BY_ID[item.id];
    const node = el('div', 'card kind-' + item.kind);
    node.appendChild(el('div', 'cname', def.name));
    node.appendChild(iconArt(item.kind, item.id));
    let foot = '';
    if (isRune && def.cat) foot = 'lvl ' + (Game.run.levels[def.cat] || 1) + '→' + ((Game.run.levels[def.cat] || 1) + 1);
    node.appendChild(el('div', 'cfoot', opts.foot !== undefined ? opts.foot : foot));
    attachTip(node, {
      name: def.name, rar: item.kind,
      desc: def.desc,
      foot: opts.tipFoot || 'Click to use'
    });
    if (opts.onClick) node.addEventListener('click', opts.onClick);
    return node;
  }

  function genericCard(kind, id, opts) {
    opts = opts || {};
    if (kind === 'charm') return charmCard({ uid: 'x', id: id, state: (CH.CHARM_BY_ID[id].init ? CH.CHARM_BY_ID[id].init() : {}) }, opts);
    if (kind === 'rune' || kind === 'omen') return consumableCard({ uid: 'x', kind: kind, id: id }, opts);
    if (kind === 'voucher') {
      const v = C.VOUCHER_BY_ID[id];
      const n = el('div', 'card kind-voucher');
      n.appendChild(el('div', 'cname', v.name));
      n.appendChild(iconArt('voucher', v.id));
      n.appendChild(el('div', 'cfoot', 'relic'));
      attachTip(n, { name: v.name, rar: 'relic', desc: v.desc, foot: 'Permanent for this run' });
      if (opts.onClick) n.addEventListener('click', opts.onClick);
      return n;
    }
    if (kind === 'pack') {
      const p = C.PACKS.filter(function (x) { return x.id === id; })[0];
      const n = el('div', 'card kind-pack');
      n.appendChild(el('div', 'cname', p.name));
      const packArt = el('div', 'cart');
      packArt.appendChild(Icons.node(
        p.kindOf === 'charm' ? 'sparkle' :
        p.kindOf === 'rune' ? 'scroll' :
        p.kindOf === 'omen' ? 'moon' : 'anvil'));
      n.appendChild(packArt);
      n.appendChild(el('div', 'cfoot', 'pick ' + p.pick + ' of ' + p.size));
      attachTip(n, { name: p.name, rar: 'booster', desc: 'Choose <b>' + p.pick + '</b> of <b>' + p.size + '</b> ' + p.kindOf + ' options.' });
      if (opts.onClick) n.addEventListener('click', opts.onClick);
      return n;
    }
    if (kind === 'dieupg') {
      const du = C.DIE_UPGRADES.filter(function (x) { return x.id === id; })[0];
      const enh = C.ENHANCEMENTS[du.enh];
      const n = el('div', 'card');
      n.appendChild(el('div', 'cname', du.name));
      const duArt = el('div', 'cart');
      duArt.appendChild(Icons.node(Icons.forContent('enh', du.enh)));
      n.appendChild(duArt);
      n.appendChild(el('div', 'cfoot', enh.short));
      attachTip(n, { name: du.name, rar: 'die upgrade', desc: 'Turn one die into a <b>' + enh.name + '</b>.<br><br>' + enh.desc });
      if (opts.onClick) n.addEventListener('click', opts.onClick);
      return n;
    }
    return el('div', 'card');
  }

  function renderTrays() {
    const run = Game.run;
    clear(dom.charmRow); clear(dom.consumableRow);
    dom.charmCount.textContent = run.charms.length + '/' + run.charmSlots;
    dom.consumableCount.textContent = run.consumables.length + '/' + run.consumableSlots;

    run.charms.forEach(function (inst, i) {
      const node = charmCard(inst, {
        onRight: function () {
          if (busy) return;
          Sfx.play('sell');
          Game.sellCharm(inst.uid);
        }
      });
      makeReorderable(node, i);
      dom.charmRow.appendChild(node);
    });
    run.consumables.forEach(function (item) {
      dom.consumableRow.appendChild(consumableCard(item, {
        onClick: function () {
          if (busy) return;
          const r = Game.useConsumable(item.uid);
          if (r === 'needsDie') {
            if (Game.run.phase === 'playing') {
              pendingConsumable = item.uid;
              dom.diceHint.textContent = 'Choose a die to target — click any die.';
              toast('Select a target die', 'good');
            } else {
              openDicePicker('Choose a target die', function (idx) {
                Game.useConsumable(item.uid, idx);
              });
            }
          }
        }
      }));
    });
  }

  /* ---- charm order changes scoring, so the player must control it ---- */
  let dragFrom = null;

  function makeReorderable(node, index) {
    node.draggable = true;
    node.dataset.charmIndex = index;
    node.addEventListener('dragstart', function (e) {
      if (busy) { e.preventDefault(); return; }
      dragFrom = index;
      node.classList.add('dragging');
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      } catch (err) {}
    });
    node.addEventListener('dragend', function () {
      node.classList.remove('dragging');
      dragFrom = null;
      Array.prototype.forEach.call(dom.charmRow.children, function (c) { c.classList.remove('dragover'); });
    });
    node.addEventListener('dragover', function (e) {
      if (dragFrom === null || dragFrom === index) return;
      e.preventDefault();
      node.classList.add('dragover');
    });
    node.addEventListener('dragleave', function () { node.classList.remove('dragover'); });
    node.addEventListener('drop', function (e) {
      e.preventDefault();
      node.classList.remove('dragover');
      if (dragFrom === null || dragFrom === index) return;
      const charms = Game.run.charms;
      const moved = charms.splice(dragFrom, 1)[0];
      charms.splice(index, 0, moved);
      dragFrom = null;
      Sfx.play('cardFlip');
      Game.save();
      render();
    });
  }

  /* ================= scorecard ================= */
  function catRow(cat) {
    const run = Game.run;
    const status = E.catStatus(run, cat.id);
    const row = el('div', 'sc-row');
    const lv = E.levelOf(run, cat.id);
    const mark = iconNode('category', cat.id);
    mark.className = 'catmark';
    row.appendChild(mark);
    row.appendChild(el('div', 'nm', cat.name));
    row.appendChild(el('div', 'lv', 'L' + lv));
    const pv = el('div', 'pv', '—');
    row.appendChild(pv);

    const bv = E.baseValues(run, cat.id);
    let tipDesc = 'Base <span class="c">' + bv.chips + ' Pips</span> <b>X</b> <span class="m">' + bv.mult + ' Fortune</span>';

    if (status === 'used') {
      row.classList.add('used');
      pv.textContent = 'used';
    } else if (status === 'locked') {
      row.classList.add('locked');
      pv.textContent = '✕';
      tipDesc += '<br><br><b>Disabled by the Boss Blind.</b>';
    } else if (run.blind) {
      const p = E.preview(run, cat.id);
      if (p.valid && !p.dead) {
        row.classList.add('can');
        pv.textContent = U.fmt(p.total);
        tipDesc += '<br><br>With these dice: <span class="c">' + U.fmt(p.chips) + '</span> <b>X</b> <span class="m">' + U.fmtMult(p.mult) + '</span> = <b>' + U.fmt(p.total) + '</b>';
      } else {
        row.classList.add('zero');
        pv.textContent = '0';
        tipDesc += '<br><br>' + (p.dead ? 'Nullified by the Boss Blind.' : 'These dice do not satisfy this category — scoring it here scratches for <b>0</b>.');
      }
      if (selectedCat === cat.id) row.classList.add('sel');
      row.addEventListener('click', function () {
        if (busy) return;
        if (selectedCat === cat.id) doScore(cat.id);
        else { selectedCat = cat.id; render(); }
      });
    }
    attachTip(row, { name: cat.name, rar: cat.section + ' section · level ' + lv, desc: tipDesc, foot: 'Level: +' + cat.cpl + ' Pips, +' + cat.mpl + ' Fortune' });
    return row;
  }

  function renderScorecard() {
    clear(dom.scUpper); clear(dom.scLower);
    C.CATEGORIES.forEach(function (cat) {
      const row = catRow(cat);
      (cat.section === 'upper' ? dom.scUpper : dom.scLower).appendChild(row);
    });
  }

  /* ================= sidebar ================= */
  function refreshStats() {
    const run = Game.run;
    if (!run) return;
    dom.statMoney.textContent = '$' + run.money;
    dom.statAnte.textContent = run.ante + '/8';
    dom.statRound.textContent = run.roundNum;
    if (run.blind) {
      dom.statTurns.textContent = run.blind.turnsLeft;
      dom.statRerolls.textContent = run.blind.rerollsLeft;
      dom.roundScore.textContent = U.fmt(run.blind.score);
    } else {
      dom.statTurns.textContent = '-';
      dom.statRerolls.textContent = '-';
      dom.roundScore.textContent = '0';
    }
  }

  function renderBlindPlate() {
    const run = Game.run;
    const b = run.blind;
    dom.blindPlate.classList.toggle('boss', !!(b && b.bossId));
    if (!b) {
      dom.blindName.textContent = 'Between blinds';
      dom.blindTarget.textContent = '—';
      dom.blindReward.textContent = '';
      dom.bossBanner.classList.add('hidden');
      return;
    }
    dom.blindName.textContent = b.name;
    dom.blindTarget.textContent = U.fmt(b.target);
    dom.blindReward.textContent = 'Reward: ' + '$'.repeat(Math.max(1, b.reward));
    const old = dom.blindPlate.querySelector('.blind-debuff');
    if (old) old.remove();
    if (b.bossId) {
      const boss = C.BOSS_BY_ID[b.bossId];
      const d = el('div', 'blind-debuff');
      d.appendChild(iconNode('boss', boss.id));
      d.appendChild(document.createTextNode(' ' + boss.desc));
      dom.blindPlate.appendChild(d);
      U.clear(dom.bossBanner);
      dom.bossBanner.appendChild(iconNode('boss', boss.id));
      dom.bossBanner.appendChild(document.createTextNode('  ' + boss.name + ' — ' + boss.desc));
      dom.bossBanner.classList.remove('hidden');
    } else {
      dom.bossBanner.classList.add('hidden');
    }
  }

  function renderHandPanel() {
    const run = Game.run;
    if (!selectedCat || !run.blind) {
      dom.handTitle.textContent = '—';
      dom.handLevel.textContent = '';
      dom.handChips.textContent = '0';
      dom.handMult.textContent = '0';
      return;
    }
    const cat = C.CAT_BY_ID[selectedCat];
    const p = E.preview(run, selectedCat);
    dom.handTitle.textContent = cat.name;
    dom.handLevel.textContent = 'lvl.' + E.levelOf(run, selectedCat);
    if (p.valid && !p.dead) {
      dom.handChips.textContent = U.fmt(p.chips);
      dom.handMult.textContent = U.fmtMult(p.mult);
    } else {
      dom.handChips.textContent = '0';
      dom.handMult.textContent = '0';
    }
  }

  function renderButtons() {
    const run = Game.run;
    const playing = run && run.blind && run.phase === 'playing' && !busy;
    const anyLoose = playing && run.dice.some(function (d) { return !d.held; });
    dom.btnRoll.disabled = !playing || run.blind.rerollsLeft <= 0 || !anyLoose;
    dom.btnRoll.textContent = playing ? 'Reroll (' + run.blind.rerollsLeft + ')' : 'Reroll';
    dom.btnScore.disabled = !playing || !selectedCat || E.catStatus(run, selectedCat) !== 'open';
    dom.btnSort.disabled = !playing;
  }

  function render() {
    const run = Game.run;
    if (!run) return;
    if (selectedCat && run.blind && E.catStatus(run, selectedCat) !== 'open') selectedCat = null;
    renderBlindPlate();
    refreshStats();
    renderHandPanel();
    renderTrays();
    renderDice();
    renderScorecard();
    renderButtons();
  }

  function enterPlay() {
    selectedCat = null;
    closeOverlay();
    dom.diceHint.textContent = 'Click dice to hold, Reroll to change the rest, then pick a category.';
    render();
  }

  /* ================= score animation ================= */
  function fxAt(node, text, kind) {
    if (!node) return;
    const r = node.getBoundingClientRect();
    const f = el('div', 'fx ' + kind, text);
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top - 6) + 'px';
    dom.scoreFx.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1000);
  }

  /** Make a die or charm visibly "go off". */
  function fire(node) {
    if (!node) return;
    const cls = node.classList.contains('die') ? 'firing' : 'firing';
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(function () { node.classList.remove(cls); }, 400);
  }

  function srcKey(src) {
    if (!src) return 'base';
    return src.kind === 'die' ? 'd' + src.index : 'c' + src.uid;
  }

  function nodeForSrc(src) {
    if (!src) return dom.handPanel;
    if (src.kind === 'die') return dom.diceRow.children[src.index] || null;
    // charm instance
    const idx = Game.run.charms.findIndex(function (c) { return c.uid === src.uid; });
    return idx >= 0 ? dom.charmRow.children[idx] : null;
  }

  async function doScore(catId) {
    const run = Game.run;
    if (busy || !run.blind) return;
    if (E.catStatus(run, catId) !== 'open') return;
    busy = true;
    pendingConsumable = null;
    renderButtons();
    Sfx.play('click');

    const res = Game.scoreCategory(catId);
    if (!res) { busy = false; render(); return; }

    const cat = C.CAT_BY_ID[catId];
    dom.handTitle.textContent = cat.name;
    dom.handLevel.textContent = 'lvl.' + (res.level || E.levelOf(run, catId));

    /* ---- a scratch: no fireworks, just a thud ---- */
    if (!res.valid || res.dead) {
      dom.handChips.textContent = '0';
      dom.handMult.textContent = '0';
      dom.diceHint.textContent = res.dead ? 'Nullified by the Boss Blind — 0 points.' : 'Scratched — 0 points.';
      Sfx.play('scratch');
      FX.shake(0.3, 220);
      FX.flash('#e35d5d', 0.14);
      toast(res.dead ? 'Nullified! 0 points' : 'Scratch! 0 points', 'bad');
      await U.sleep(Settings.ms(650));
      finishScore(res);
      return;
    }

    /* ---- lift the dice that are about to fire ---- */
    const nodes = dom.diceRow.children;
    res.scoringIdx.forEach(function (i) { if (nodes[i]) nodes[i].classList.add('scoring'); });
    dom.handChips.classList.add('hot');
    dom.handMult.classList.add('hot');
    dom.handChips.textContent = U.fmt(res.baseChips);
    dom.handMult.textContent = U.fmtMult(res.baseMult);
    dom.diceHint.textContent = '';
    await U.sleep(Settings.ms(180));

    /* ---- walk the scoring log ---- */
    const n = res.log.length;
    const pace = Settings.ms(U.clamp(1500 / Math.max(1, n), 26, 118));
    let lastKey = null;
    let chipTicks = 0, multTicks = 0;
    let prevChips = res.baseChips, prevMult = res.baseMult;

    for (let i = 0; i < n; i++) {
      const ev = res.log[i];
      const node = nodeForSrc(ev.src);
      const key = srcKey(ev.src);
      if (key !== lastKey) { fire(node); lastKey = key; }

      if (ev.t === 'c') {
        fxAt(node, '+' + U.fmt(ev.v), 'c');
        Sfx.play('chip', { index: chipTicks++ });
      } else if (ev.t === 'm') {
        fxAt(node, '+' + U.fmtMult(ev.v), 'm');
        Sfx.play('mult', { index: multTicks++ });
      } else if (ev.t === 'x') {
        fxAt(node, 'X' + U.fmtMult(ev.v), 'x');
        Sfx.play('xmult');
        FX.shake(0.22, 180);
        FX.burstAt(node, { kind: 'mult', count: 10, power: 0.8 });
      } else if (ev.t === 'g') {
        fxAt(node, '+$' + ev.v, 'g');
        Sfx.play('coin');
        FX.burstAt(node, { kind: 'gold', count: 8, power: 0.7 });
      } else if (ev.t === 'n') {
        fxAt(node, ev.txt, 'n');
      }

      // counters roll rather than snap
      FX.countUp(dom.handChips, prevChips, ev.chips, Math.min(pace, 110), U.fmt);
      FX.countUp(dom.handMult, prevMult, ev.mult, Math.min(pace, 110), U.fmtMult);
      prevChips = ev.chips; prevMult = ev.mult;

      await U.sleep(pace);
    }
    dom.handChips.textContent = U.fmt(res.chips);
    dom.handMult.textContent = U.fmtMult(res.mult);

    /* ---- the slam ---- */
    await U.sleep(Settings.ms(220));
    const ratio = run.blind.target > 0 ? res.total / run.blind.target : 0;
    const power = U.clamp(0.25 + ratio * 0.9, 0.25, 1);
    Sfx.play('slam', { power: power });
    FX.shake(power, 340);
    FX.flash('#f0a92c', 0.1 + power * 0.16);
    FX.burstAt(dom.roundScore, { kind: 'gold', count: Math.round(16 + power * 44), power: 1 + power });
    FX.pulse(dom.roundScore, 'slam');

    const from = run.blind.score;
    await FX.countUp(dom.roundScore, from, from + res.total, 520, U.fmt);

    dom.handChips.classList.remove('hot');
    dom.handMult.classList.remove('hot');
    toast(cat.name + ' scored ' + U.fmt(res.total), 'good');
    finishScore(res);
  }

  /** Shared tail for both the scored and scratched paths. */
  function finishScore(res) {
    if (res.shattered && res.shattered.length) {
      Sfx.play('shatter');
      res.shattered.forEach(function (i) {
        const node = dom.diceRow.children[i];
        if (node) FX.burstAt(node, { kind: 'glass', count: 22, power: 1.3 });
      });
    }
    const outcome = Game.applyScore(res);
    busy = false;
    selectedCat = null;
    if (outcome === 'win' || outcome === 'lose') return;
    render();
  }

  /* ================= overlay plumbing ================= */
  function openOverlay(build) {
    clear(dom.overlayInner);
    build(dom.overlayInner);
    dom.overlay.classList.remove('hidden');
    hideTip();
  }
  function closeOverlay() { dom.overlay.classList.add('hidden'); }

  function btn(label, cls, fn) {
    const b = el('button', 'ov-btn ' + (cls || ''), label);
    b.addEventListener('click', fn);
    return b;
  }

  /* ================= blind select ================= */
  function showBlindSelect() {
    const run = Game.run;
    Sfx.music('menu');
    openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'Ante ' + run.ante + ' of 8'));
      root.appendChild(el('div', 'ov-sub', 'Choose your next blind — you may skip the Small and Big Blind for a Boon.'));
      const row = el('div', 'ov-row');
      C.BLIND_KINDS.forEach(function (kind, i) {
        const boss = i === 2 ? C.BOSS_BY_ID[run.bossId] : null;
        const box = el('div', 'blind-choice' + (i === run.blindIndex ? ' current' : '') + (i < run.blindIndex ? ' done' : '') + (i === 2 ? ' boss' : ''));
        const nameRow = el('div', 'bc-name');
        if (boss) nameRow.appendChild(iconNode('boss', boss.id));
        nameRow.appendChild(document.createTextNode(boss ? ' ' + boss.name : kind.name));
        box.appendChild(nameRow);
        box.appendChild(el('div', 'bc-target', U.fmt(Game.blindTarget(i))));
        box.appendChild(el('div', 'bc-reward', 'Reward ' + '$'.repeat(kind.reward)));
        box.appendChild(el('div', 'bc-desc', boss ? boss.desc : (i < run.blindIndex ? 'Defeated' : 'No special rule')));
        if (i === run.blindIndex) {
          box.appendChild(btnPlain('Play', 'bc-btn', function () { closeOverlay(); Game.startBlind(); }));
          if (i < 2) box.appendChild(btnPlain('Skip for a Boon', 'bc-btn skip', function () { Game.skipBlind(); }));
        }
        row.appendChild(box);
      });
      root.appendChild(row);
      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Run Info', 'alt small', showRunInfo));
      acts.appendChild(btn('Options', 'alt small', showOptions));
      root.appendChild(acts);
    });
    render();
  }
  function btnPlain(label, cls, fn) {
    const b = el('button', cls, label);
    b.addEventListener('click', fn);
    return b;
  }

  /* ================= cashout ================= */
  function showCashout(lines, total, noMoney) {
    openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'Blind Defeated'));
      root.appendChild(el('div', 'ov-sub', Game.run.blind.name + ' — scored ' + U.fmt(Game.run.blind.score) + ' of ' + U.fmt(Game.run.blind.target)));
      const box = el('div', 'cash-lines');
      if (noMoney) {
        const l = el('div', 'cash-line');
        l.appendChild(el('span', '', 'The Miser took your winnings'));
        l.appendChild(el('span', 'amt', '$0'));
        box.appendChild(l);
      }
      lines.forEach(function (ln) {
        const l = el('div', 'cash-line');
        l.appendChild(el('span', '', ln.label));
        l.appendChild(el('span', 'amt', '$' + ln.amt));
        box.appendChild(l);
      });
      const tot = el('div', 'cash-line cash-total');
      tot.appendChild(el('span', '', 'Total earned'));
      tot.appendChild(el('span', 'amt', '$' + total));
      box.appendChild(tot);
      root.appendChild(box);
      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Cash Out', 'gold', function () { Game.advanceAfterCashout(); }));
      root.appendChild(acts);
    });
    refreshStats();
  }

  /* ================= game over / victory ================= */
  function showGameOver() {
    const run = Game.run;
    openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'Game Over'));
      root.appendChild(el('div', 'ov-sub',
        'You could not beat the ' + run.blind.name + ' of Ante ' + run.ante +
        '  ·  ' + DK.deckById(run.deckId).name + '  ·  ' + DK.stakeByLevel(run.stake).name));
      const box = el('div', 'cash-lines');
      [['Reached', 'Ante ' + run.ante + ', Round ' + run.roundNum],
       ['Final score this blind', U.fmt(run.blind.score) + ' / ' + U.fmt(run.blind.target)],
       ['Best single turn', U.fmt(run.stats.best) + ' (' + run.stats.bestCat + ')'],
       ['Turns played', String(run.stats.turns)],
       ['Seed', run.seed]].forEach(function (p) {
        const l = el('div', 'cash-line');
        l.appendChild(el('span', '', p[0]));
        l.appendChild(el('span', 'amt', p[1]));
        box.appendChild(l);
      });
      root.appendChild(box);
      appendUnlocks(root, run.unlocks);
      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Same Deck', 'gold', function () { Main.retry(); }));
      acts.appendChild(btn('Same Seed', 'alt', function () { Main.retry(run.seed); }));
      acts.appendChild(btn('Change Deck', 'alt', function () { Main.chooseStart(); }));
      acts.appendChild(btn('Main Menu', 'alt', function () { Main.title(); }));
      root.appendChild(acts);
    });
  }

  function showVictory() {
    const run = Game.run;
    FX.confetti(120);
    setTimeout(function () { FX.confetti(80); }, 700);
    openOverlay(function (root) {
      root.appendChild(el('div', 'title-logo', 'YOU WIN'));
      root.appendChild(el('div', 'ov-sub',
        'You beat The Grand with the ' + DK.deckById(run.deckId).name +
        ' at ' + DK.stakeByLevel(run.stake).name + '.'));
      const box = el('div', 'cash-lines');
      [['Best single turn', U.fmt(run.stats.best) + ' (' + run.stats.bestCat + ')'],
       ['Turns played', String(run.stats.turns)],
       ['Money earned', '$' + run.stats.moneyEarned],
       ['Seed', run.seed]].forEach(function (p) {
        const l = el('div', 'cash-line');
        l.appendChild(el('span', '', p[0]));
        l.appendChild(el('span', 'amt', p[1]));
        box.appendChild(l);
      });
      root.appendChild(box);
      appendUnlocks(root, run.unlocks);
      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Keep Going (Endless)', 'gold', function () { Game.goEndless(); }));
      acts.appendChild(btn('New Run', 'alt', function () { Main.chooseStart(); }));
      root.appendChild(acts);
    });
  }

  /** Show anything this run unlocked, on the end screens. */
  function appendUnlocks(root, unlocks) {
    if (!unlocks) return;
    const bits = [];
    (unlocks.decks || []).forEach(function (id) {
      bits.push(DK.deckById(id).name + ' unlocked');
    });
    if (unlocks.stake) bits.push(DK.stakeByLevel(unlocks.stake).name + ' unlocked');
    if (!bits.length) return;
    const box = el('div', 'unlock-banner');
    box.appendChild(el('div', 'ub-title', 'New unlocks'));
    bits.forEach(function (t) { box.appendChild(el('div', 'ub-line', t)); });
    root.appendChild(box);
    FX.confetti(50);
    Sfx.play('win');
  }

  /* ================= run info ================= */
  function showRunInfo() {
    const run = Game.run;
    openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'Run Info'));
      root.appendChild(el('div', 'ov-sub',
        DK.deckById(run.deckId).name + ' · ' + DK.stakeByLevel(run.stake).name +
        ' · Seed ' + run.seed + ' · Ante ' + run.ante + ' · Round ' + run.roundNum + ' · $' + run.money));
      const grid = el('div', 'info-grid');

      const lv = el('div', 'info-box');
      lv.appendChild(el('h3', '', 'Category levels'));
      C.CATEGORIES.forEach(function (c) {
        const bv = E.baseValues(run, c.id);
        const l = el('div', 'info-line');
        l.appendChild(el('span', '', c.name));
        l.appendChild(el('span', 'r', 'L' + bv.level + '  ·  ' + bv.chips + ' × ' + bv.mult + '  ·  played ' + (run.catPlays[c.id] || 0)));
        lv.appendChild(l);
      });
      grid.appendChild(lv);

      const right = el('div');
      const st = el('div', 'info-box');
      st.appendChild(el('h3', '', 'Run stats'));
      [['Turns per blind', String(Game.turnsForBlind())],
       ['Rerolls per turn', String(Game.rerollsPerTurn())],
       ['Dice in pool', String(run.dice.length)],
       ['Charm slots', run.charms.length + ' / ' + run.charmSlots],
       ['Consumable slots', run.consumables.length + ' / ' + run.consumableSlots],
       ['Interest cap', '$' + Game.interestCap()],
       ['Best single turn', U.fmt(run.stats.best) + ' (' + run.stats.bestCat + ')']
      ].forEach(function (p) {
        const l = el('div', 'info-line');
        l.appendChild(el('span', '', p[0]));
        l.appendChild(el('span', 'r', p[1]));
        st.appendChild(l);
      });
      right.appendChild(st);

      const vb = el('div', 'info-box');
      vb.style.marginTop = '12px';
      vb.appendChild(el('h3', '', 'Relics'));
      if (!run.vouchers.length) vb.appendChild(el('div', 'info-line', 'None yet'));
      run.vouchers.forEach(function (id) {
        const v = C.VOUCHER_BY_ID[id];
        const l = el('div', 'info-line');
        const nameCell = el('span', 'vname');
        nameCell.appendChild(iconNode('voucher', v.id));
        nameCell.appendChild(document.createTextNode(' ' + v.name));
        l.appendChild(nameCell);
        const r = el('span', 'r'); r.innerHTML = v.desc;
        l.appendChild(r);
        vb.appendChild(l);
      });
      right.appendChild(vb);
      grid.appendChild(right);
      root.appendChild(grid);

      const diceBox = el('div', 'info-box');
      diceBox.style.marginTop = '12px';
      diceBox.appendChild(el('h3', '', 'Your dice (' + run.dice.length + ')'));
      const dr = el('div', 'ov-row');
      dr.style.padding = '10px 0 4px';
      run.dice.forEach(function (d, i) { dr.appendChild(buildDie(d, i, {})); });
      diceBox.appendChild(dr);
      root.appendChild(diceBox);

      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Back', 'alt', function () {
        if (run.phase === 'blindSelect') showBlindSelect();
        else if (run.phase === 'shop') Shop.show();
        else closeOverlay();
      }));
      root.appendChild(acts);
    });
  }

  function showOptions() {
    const run = Game.run;
    openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'Options'));
      root.appendChild(el('div', 'ov-sub', 'Progress saves automatically after every action.'));
      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Back', 'alt', function () {
        if (!run) { Main.title(); return; }
        if (run.phase === 'blindSelect') showBlindSelect();
        else if (run.phase === 'shop') Shop.show();
        else closeOverlay();
      }));
      acts.appendChild(btn('Settings', 'alt', function () { showSettings(false); }));
      acts.appendChild(btn('Collection', 'alt', function () { Collection.show(function () { showOptions(); }); }));
      acts.appendChild(btn('How to Play', 'alt', showHelp));
      acts.appendChild(btn('Abandon Run', 'danger', function () {
        if (confirm('Abandon this run? Progress is lost.')) { Game.abandon(); Main.title(); }
      }));
      root.appendChild(acts);
    });
  }

  /* ================= settings ================= */
  function showSettings(fromTitle) {
    openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'Settings'));
      root.appendChild(el('div', 'ov-sub', 'Saved automatically. Audio starts on your first click.'));
      const grid = el('div', 'set-grid');

      function slider(key, label, hint) {
        const row = el('div', 'set-row');
        const lab = el('div', 'set-label', label);
        if (hint) lab.appendChild(el('span', 'set-hint', hint));
        row.appendChild(lab);
        const input = document.createElement('input');
        input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '5';
        input.value = String(Math.round(Settings.get(key) * 100));
        const val = el('div', 'set-val', input.value + '%');
        input.addEventListener('input', function () {
          val.textContent = input.value + '%';
          Settings.set(key, Number(input.value) / 100);
        });
        input.addEventListener('change', function () { Sfx.unlock(); Sfx.play('chip', { index: 6 }); });
        row.appendChild(input); row.appendChild(val);
        grid.appendChild(row);
      }

      function toggle(key, label, hint) {
        const row = el('div', 'set-row');
        const lab = el('div', 'set-label', label);
        if (hint) lab.appendChild(el('span', 'set-hint', hint));
        row.appendChild(lab);
        const t = el('div', 'toggle' + (Settings.get(key) ? ' on' : ''));
        t.addEventListener('click', function () {
          const v = !Settings.get(key);
          Settings.set(key, v);
          t.classList.toggle('on', v);
          Sfx.play('click');
        });
        row.appendChild(t);
        grid.appendChild(row);
      }

      slider('master', 'Master volume');
      slider('sfx', 'Sound effects');
      slider('music', 'Music', 'Generated live, never the same twice');

      const speedRow = el('div', 'set-row');
      const sl = el('div', 'set-label', 'Animation speed');
      sl.appendChild(el('span', 'set-hint', 'How fast scoring plays out'));
      speedRow.appendChild(sl);
      const seg = el('div', 'seg');
      [['Normal', 1], ['Fast', 1.75], ['Instant', 3]].forEach(function (pair) {
        const b = el('button', Settings.get('speed') === pair[1] ? 'on' : '', pair[0]);
        b.addEventListener('click', function () {
          Settings.set('speed', pair[1]);
          Sfx.play('click');
          showSettings(fromTitle);
        });
        seg.appendChild(b);
      });
      speedRow.appendChild(seg);
      grid.appendChild(speedRow);

      toggle('shake', 'Screen shake');
      toggle('particles', 'Particles');
      toggle('reducedMotion', 'Reduced motion', 'Cuts animation to a minimum');
      toggle('highContrast', 'High contrast');
      toggle('showPreview', 'Highlight scoring dice', 'Outlines the dice a category would use');

      root.appendChild(grid);

      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Back', 'alt', function () {
        if (fromTitle) Main.title(); else showOptions();
      }));
      acts.appendChild(btn('Reset to defaults', 'alt small', function () {
        Settings.reset(); Sfx.setVolumes(); showSettings(fromTitle);
      }));
      root.appendChild(acts);
    });
  }

  function showHelp(fromTitle) {
    openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'How to Play'));
      const r = el('div', 'rules');
      r.innerHTML =
        '<p>Beat <b>8 Antes</b>. Each Ante has a Small, Big and <b>Boss Blind</b> — score at least the target before you run out of turns.</p>' +
        '<ul>' +
        '<li>Every <b>turn</b> your dice are rolled. Click dice to <b>hold</b> them, then <b>Reroll</b> the rest (2 rerolls by default).</li>' +
        '<li>Pick a <b>category</b> on the scorecard to score it. Click once to preview, again (or press <b>Score</b>) to commit.</li>' +
        '<li>Each category can only be used <b>once per blind</b>. Scoring one your dice do not satisfy scratches it for <b>0</b>.</li>' +
        '<li>Score = <span class="c">Pips</span> <b>×</b> <span class="m">Fortune</span>. The category supplies the base; every scoring die adds its pips; Charms and die upgrades do the rest.</li>' +
        '<li><b>Runes</b> permanently level up a category. <b>Omens</b> upgrade individual dice. <b>Charms</b> are your build.</li>' +
        '<li>Right-click a Charm to sell it. Click a Rune/Omen to use it.</li>' +
        '<li><b>Charms fire left to right, and order matters</b> — drag them to rearrange. ' +
        'Put <span class="m">+Fortune</span> before <span class="m">XMult</span> to get the most out of both.</li>' +
        '<li><b>Decks</b> change how a run opens; <b>Perils</b> pile on difficulty. Win to unlock more of both.</li>' +
        '<li>Money: blind rewards, $1 per unused turn, and <b>interest</b> of $1 per $5 held (capped).</li>' +
        '</ul>' +
        '<p><b>Keys:</b> 1–8 hold a die · <b>R</b> or Space reroll · <b>Enter</b> score the selected category · <b>Esc</b> close.</p>';
      root.appendChild(r);
      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Back', 'alt', function () {
        if (fromTitle || !Game.run) Main.title();
        else showOptions();
      }));
      root.appendChild(acts);
    });
  }

  /* ================= die picker ================= */
  function openDicePicker(title, cb) {
    const run = Game.run;
    openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', title));
      root.appendChild(el('div', 'ov-sub', 'Click a die to choose it.'));
      const row = el('div', 'ov-row');
      run.dice.forEach(function (d, i) {
        row.appendChild(buildDie(d, i, {
          onClick: function (idx) {
            closeOverlay();
            cb(idx);
            if (run.phase === 'shop') Shop.show();
            else if (run.phase === 'blindSelect') showBlindSelect();
            else render();
          }
        }));
      });
      root.appendChild(row);
      const acts = el('div', 'ov-actions');
      acts.appendChild(btn('Cancel', 'alt', function () {
        closeOverlay();
        if (run.phase === 'shop') Shop.show();
        else if (run.phase === 'blindSelect') showBlindSelect();
      }));
      root.appendChild(acts);
    });
  }

  /* ================= wiring ================= */
  /** Browsers require a gesture before audio may start. */
  function installAudioUnlock() {
    function go() {
      Sfx.unlock();
      const run = Game.run;
      let mode = 'menu';
      if (run) {
        if (run.phase === 'playing') mode = (run.blind && run.blind.bossId) ? 'boss' : 'play';
        else if (run.phase === 'shop') mode = 'shop';
      }
      Sfx.music(mode);
      document.removeEventListener('pointerdown', go);
      document.removeEventListener('keydown', go);
    }
    document.addEventListener('pointerdown', go);
    document.addEventListener('keydown', go);
  }

  function bind() {
    installAudioUnlock();
    // every button gets a click without wiring each one individually
    document.addEventListener('click', function (e) {
      const b = e.target && e.target.closest ? e.target.closest('button') : null;
      if (b && !b.disabled) {
        Sfx.play(b.classList.contains('ov-btn') || b.classList.contains('bc-btn') ? 'click' : 'tick');
      }
    }, true);
    dom.btnRoll.addEventListener('click', function () { if (!busy) Game.reroll(); });
    dom.btnScore.addEventListener('click', function () { if (selectedCat) doScore(selectedCat); });
    dom.btnSort.addEventListener('click', function () {
      const run = Game.run;
      if (!run || busy) return;
      run.dice.sort(function (a, b) { return a.value - b.value; });
      render();
    });
    dom.btnRunInfo.addEventListener('click', showRunInfo);
    dom.btnOptions.addEventListener('click', showOptions);

    document.addEventListener('keydown', function (e) {
      const run = Game.run;
      if (e.key === 'Escape') { if (run && run.phase === 'playing') closeOverlay(); return; }
      if (!run || run.phase !== 'playing' || busy) return;
      if (e.key >= '1' && e.key <= '9') {
        const i = parseInt(e.key, 10) - 1;
        if (run.dice[i]) Game.toggleHold(i);
      } else if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
        e.preventDefault();
        Game.reroll();
      } else if (e.key === 'Enter') {
        if (selectedCat) doScore(selectedCat);
      } else if (e.key === 's' || e.key === 'S') {
        run.dice.sort(function (a, b) { return a.value - b.value; });
        render();
      }
    });
  }

  global.UI = {
    init: function () { cache(); FX.init(); Settings.apply(); bind(); },
    render: render, refreshStats: refreshStats, enterPlay: enterPlay,
    animateRoll: animateRoll, toast: toast,
    openOverlay: openOverlay, closeOverlay: closeOverlay, btn: btn,
    genericCard: genericCard, charmCard: charmCard, consumableCard: consumableCard,
    buildDie: buildDie, attachTip: attachTip, iconNode: iconNode, iconArt: iconArt,
    showBlindSelect: showBlindSelect, showCashout: showCashout,
    showGameOver: showGameOver, showVictory: showVictory,
    showRunInfo: showRunInfo, showOptions: showOptions, showHelp: showHelp,
    showSettings: showSettings,
    openDicePicker: openDicePicker,
    showShop: function () { Shop.show(); },
    showPack: function (pack, options, pick) { Shop.showPack(pack, options, pick); },
    get busy() { return busy; }
  };
})(window);
