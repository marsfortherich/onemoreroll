/* ============================================================
   main.js — boot, title screen, deck/stake select, resume
   ============================================================ */
(function (global) {
  'use strict';

  const el = U.el;

  /** Hand-set wordmark: each letter sits slightly differently, and the
      first O is a die. */
  function wordmark() {
    const wrap = el('div', 'wordmark');

    // "ONE MORE" sits small above "R[die]LL" — a two-line logo lockup
    const top = el('div', 'wm-line wm-top');
    'ONE MORE'.split('').forEach(function (ch) {
      top.appendChild(el('span', 'wm', ch === ' ' ? ' ' : ch));
    });

    const bottom = el('div', 'wm-line wm-bottom');
    ['R', null, 'L', 'L'].forEach(function (ch) {
      if (ch === null) {
        const d = el('span', 'wm-die');
        d.appendChild(Icons.node('die'));
        bottom.appendChild(d);
      } else {
        bottom.appendChild(el('span', 'wm', ch));
      }
    });

    wrap.appendChild(top);
    wrap.appendChild(bottom);
    return wrap;
  }

  /** Version string, read from the meta tag `tools/bump.py` maintains. */
  function appVersion() {
    const m = document.querySelector('meta[name="app-version"]');
    return m ? m.getAttribute('content') : '';
  }

  /* ================= title ================= */
  function title() {
    Sfx.music('menu');
    UI.openOverlay(function (root) {
      root.appendChild(wordmark());
      root.appendChild(el('div', 'title-rule'));
      root.appendChild(el('div', 'title-tag', 'A dice roguelite'));

      const p = Profile.get();
      const stats = el('div', 'title-stats');
      [['Runs', p.runs], ['Wins', p.wins], ['Best ante', p.bestAnte || '-'],
       ['Best turn', U.fmt(p.bestHand || 0)],
       ['Peril', DK.stakeByLevel(p.unlockedStake).name.replace(' Peril', '')]
      ].forEach(function (pair) {
        const b = el('div', 'title-stat');
        b.appendChild(el('span', 'ts-v', String(pair[1])));
        b.appendChild(el('span', 'ts-k', pair[0]));
        stats.appendChild(b);
      });
      root.appendChild(stats);

      const acts = el('div', 'ov-actions');
      if (Game.hasSave()) acts.appendChild(UI.btn('Continue Run', 'gold', resume));
      acts.appendChild(UI.btn('New Run', Game.hasSave() ? 'alt' : 'gold', function () { chooseStart(); }));
      root.appendChild(acts);

      const acts2 = el('div', 'ov-actions');
      acts2.appendChild(UI.btn('Collection', 'alt small', function () { Collection.show(title); }));
      acts2.appendChild(UI.btn('Settings', 'alt small', function () { UI.showSettings(true); }));
      acts2.appendChild(UI.btn('How to Play', 'alt small', function () { UI.showHelp(true); }));
      root.appendChild(acts2);

      const foot = el('div', 'ov-sub');
      foot.style.marginTop = '14px';
      foot.textContent = 'Same seed = same run. Everything is stored locally in your browser.';
      root.appendChild(foot);

      const ver = el('div', 'ov-sub version-stamp');
      ver.textContent = 'v' + appVersion();
      root.appendChild(ver);

      UI.arcadeRow(root);
      if (global.Arcade && global.Arcade.dealer) global.Arcade.dealer.greet('onemoreroll');
    });
  }

  /* ================= deck + stake select ================= */
  function chooseStart() {
    const p = Profile.get();
    let deckId = DK.deckById(p.lastDeck).id;
    if (!Profile.deckUnlocked(DK.deckById(deckId))) deckId = 'standard';
    let stake = Math.min(p.lastStake || 1, Profile.unlockedStake());
    let seed = '';

    function draw() {
      UI.openOverlay(function (root) {
        root.appendChild(el('div', 'ov-title', 'Choose your start'));
        const deck = DK.deckById(deckId);
        root.appendChild(el('div', 'ov-sub', Profile.get().deckWins[deckId]
          ? 'Best result with this deck: won at ' + DK.stakeByLevel(Profile.get().deckWins[deckId]).name
          : 'No win recorded with this deck yet'));

        /* --- decks --- */
        const grid = el('div', 'deck-grid');
        DK.DECKS.forEach(function (d) {
          const unlocked = Profile.deckUnlocked(d);
          const box = el('div', 'deck-card' + (d.id === deckId ? ' on' : '') + (unlocked ? '' : ' locked'));
          const dkIcon = el('div', 'dk-icon');
          dkIcon.appendChild(Icons.node(unlocked ? Icons.forContent('deck', d.id) : 'lock'));
          box.appendChild(dkIcon);
          box.appendChild(el('div', 'dk-name', unlocked ? d.name : 'Locked'));
          UI.attachTip(box, {
            name: unlocked ? d.name : 'Locked deck',
            rar: 'deck',
            desc: unlocked ? d.desc : '<b>Unlock:</b> ' + DK.unlockText(d)
          });
          if (unlocked) {
            box.addEventListener('click', function () { deckId = d.id; Sfx.play('cardFlip'); draw(); });
          }
          grid.appendChild(box);
        });
        root.appendChild(grid);

        /* --- selected deck blurb --- */
        const blurb = el('div', 'deck-blurb');
        blurb.innerHTML = '<b>' + deck.name + '</b> — ' + deck.desc;
        root.appendChild(blurb);

        /* --- stakes --- */
        root.appendChild(el('div', 'shelf-label', 'Peril — difficulty. Each one stacks on the last.'));
        const srow = el('div', 'stake-row');
        DK.STAKES.forEach(function (st) {
          const unlocked = st.level <= Profile.unlockedStake();
          const chip = el('div', 'stake-chip' + (st.level === stake ? ' on' : '') + (unlocked ? '' : ' locked'));
          chip.style.setProperty('--stake-color', st.color);
          chip.appendChild(el('span', 'sk-n', String(st.level)));
          UI.attachTip(chip, {
            name: st.name, rar: 'peril ' + st.level,
            desc: unlocked ? st.desc : 'Win at ' + DK.stakeByLevel(st.level - 1).name + ' to unlock.',
            foot: unlocked ? 'All lower stakes also apply' : null
          });
          if (unlocked) chip.addEventListener('click', function () { stake = st.level; Sfx.play('click'); draw(); });
          srow.appendChild(chip);
        });
        root.appendChild(srow);

        const sd = el('div', 'deck-blurb');
        sd.innerHTML = '<b>' + DK.stakeByLevel(stake).name + '</b> — ' + DK.stakeByLevel(stake).desc;
        root.appendChild(sd);

        /* --- seed --- */
        const seedWrap = el('div', 'ov-actions');
        const input = el('input', 'seed-input');
        input.placeholder = 'seed (optional)';
        input.maxLength = 16;
        input.value = seed;
        input.addEventListener('input', function () { seed = input.value; });
        seedWrap.appendChild(input);
        root.appendChild(seedWrap);

        const acts = el('div', 'ov-actions');
        acts.appendChild(UI.btn('Start Run', 'gold', function () { startNew(seed, { deckId: deckId, stake: stake }); }));
        acts.appendChild(UI.btn('Back', 'alt', title));
        root.appendChild(acts);
      });
    }
    draw();
  }

  /* ================= run lifecycle ================= */
  function startNew(seed, opts, skipConfirm) {
    if (!skipConfirm && Game.hasSave() &&
        !global.confirm('Start a new run? Your saved run will be discarded.')) return;
    Game.abandon();
    Game.newRun(seed, opts || {});
    UI.render();
    UI.showBlindSelect();
  }

  /** Restart with the same deck and stake as the run that just ended. */
  function retry(seed) {
    const prev = Game.run;
    const opts = prev ? { deckId: prev.deckId, stake: prev.stake } : {};
    startNew(seed, opts, true);
  }

  function resume() {
    if (!Game.load()) { title(); return; }
    const run = Game.run;
    UI.render();
    switch (run.phase) {
      case 'playing':
        Sfx.music(run.blind && run.blind.bossId ? 'boss' : 'play');
        UI.enterPlay();
        break;
      case 'shop':
        Sfx.music('shop');
        Shop.show();
        break;
      case 'cashout': {
        const co = run.lastCashout || { lines: [], total: 0, noMoney: false };
        UI.showCashout(co.lines, co.total, co.noMoney);
        break;
      }
      case 'won': UI.showVictory(); break;
      default: UI.showBlindSelect();
    }
  }

  function boot() {
    // Shared account + leaderboard layer. Resolves the signed-in player before
    // the title screen draws, so the arcade bar is never wrong on first paint.
    if (global.Arcade) {
      global.Arcade.init({ gameId: 'onemoreroll' });
      global.Arcade.ui.setSound({
        ui: function () { Sfx.play('click'); },
        success: function () { Sfx.play('coin'); },
        deny: function () { Sfx.play('denied'); },
        achievement: function () { Sfx.play('unlock'); }
      });
    }
    UI.init();
    title();
  }

  global.Main = { title: title, startNew: startNew, retry: retry, resume: resume, chooseStart: chooseStart };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
