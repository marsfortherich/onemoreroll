/* ============================================================
   shop.js — the between-blinds shop and booster packs
   ============================================================ */
(function (global) {
  'use strict';

  const el = U.el;

  function priceTag(item) {
    const free = Game.run.freeItems > 0;
    return free ? 'FREE' : '$' + item.cost;
  }

  function shopItem(item, where, index) {
    const run = Game.run;
    const wrap = el('div', 'shop-item');
    if (!item) {
      wrap.appendChild(el('div', 'sold', 'sold out'));
      return wrap;
    }
    const cost = Game.costFor(item);
    const affordable = run.money >= cost;
    if (!affordable) wrap.classList.add('cant');

    const card = UI.genericCard(item.kind, item.id, {});
    wrap.appendChild(card);
    wrap.appendChild(el('div', 'price', priceTag(item)));

    const buy = el('button', 'buy', item.kind === 'pack' ? 'Open' : 'Buy');
    buy.disabled = !affordable;
    buy.addEventListener('click', function () { Game.buy(where, index); });
    wrap.appendChild(buy);
    return wrap;
  }

  function ownedStrip(root) {
    const run = Game.run;
    const box = el('div', 'shop-shelf');
    box.appendChild(el('div', 'shelf-label',
      'Your Charms (' + run.charms.length + '/' + run.charmSlots + ') — right-click to sell   ·   ' +
      'Consumables (' + run.consumables.length + '/' + run.consumableSlots + ') — click to use'));
    const row = el('div', 'ov-row');
    run.charms.forEach(function (inst) {
      row.appendChild(UI.charmCard(inst, {
        onRight: function () { Game.sellCharm(inst.uid); show(); }
      }));
    });
    run.consumables.forEach(function (item) {
      row.appendChild(UI.consumableCard(item, {
        onClick: function () {
          const r = Game.useConsumable(item.uid);
          if (r === 'needsDie') {
            UI.openDicePicker('Choose a target die', function (idx) { Game.useConsumable(item.uid, idx); });
          } else {
            show();
          }
        }
      }));
    });
    if (!run.charms.length && !run.consumables.length) {
      row.appendChild(el('div', 'sold', 'nothing yet'));
    }
    box.appendChild(row);
    root.appendChild(box);
  }

  function show() {
    const run = Game.run;
    if (!run.shop) return;
    UI.openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'The Shop'));
      root.appendChild(el('div', 'ov-sub',
        'Ante ' + run.ante + ' · You have $' + run.money +
        (run.freeItems > 0 ? ' · Next item is FREE' : '')));

      /* --- main shelf --- */
      const shelf = el('div', 'shop-shelf');
      shelf.appendChild(el('div', 'shelf-label', 'For sale'));
      const row = el('div', 'ov-row');
      run.shop.items.forEach(function (it, i) { row.appendChild(shopItem(it, 'item', i)); });
      if (run.shop.voucher) row.appendChild(shopItem(run.shop.voucher, 'voucher', 0));
      shelf.appendChild(row);
      root.appendChild(shelf);

      /* --- boosters --- */
      const pshelf = el('div', 'shop-shelf');
      pshelf.appendChild(el('div', 'shelf-label', 'Booster packs'));
      const prow = el('div', 'ov-row');
      run.shop.packs.forEach(function (p, i) { prow.appendChild(shopItem(p, 'pack', i)); });
      pshelf.appendChild(prow);
      root.appendChild(pshelf);

      ownedStrip(root);

      /* --- actions --- */
      const acts = el('div', 'ov-actions');
      const rc = Game.rerollCost();
      const rb = UI.btn('Reroll  $' + rc, 'alt', function () { Game.rerollShop(); });
      rb.disabled = run.money < rc;
      acts.appendChild(rb);
      acts.appendChild(UI.btn('Next Blind', 'gold', function () { Game.leaveShop(); }));
      acts.appendChild(UI.btn('Run Info', 'alt small', function () { UI.showRunInfo(); }));
      root.appendChild(acts);
    });
    UI.render();
  }

  function showPack(pack, options, pick) {
    const taken = {};
    let left = pick;

    function close() {
      if (Game.run.phase === 'shop') show();
      else UI.closeOverlay();
    }

    function draw() {
      UI.openOverlay(function (root) {
        root.appendChild(el('div', 'ov-title', pack.name));
        root.appendChild(el('div', 'ov-sub',
          left > 0 ? 'Choose ' + left + ' of ' + options.length : 'Nothing left to choose'));
        const row = el('div', 'ov-row');
        options.forEach(function (opt, i) {
          const wrap = el('div', 'shop-item');
          const card = UI.genericCard(opt.kind, opt.id, {});
          if (taken[i] || left <= 0) card.classList.add('disabled');
          card.addEventListener('click', function () {
            if (taken[i] || left <= 0) return;
            if (Game.takePackOption(opt)) {
              taken[i] = true;
              left--;
              Game.save();
              // die-upgrade options hand control to the die picker themselves
              if (opt.kind === 'dieupg') return;
              if (left <= 0) close(); else draw();
            }
          });
          wrap.appendChild(card);
          row.appendChild(wrap);
        });
        root.appendChild(row);
        const acts = el('div', 'ov-actions');
        acts.appendChild(UI.btn(left < pick ? 'Done' : 'Skip', 'alt', close));
        root.appendChild(acts);
      });
    }
    draw();
  }

  global.Shop = { show: show, showPack: showPack };
})(window);
