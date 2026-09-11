/* ============================================================
   collection.js — browse every piece of content in the game

   Items the player has never seen are shown as silhouettes, so the
   collection doubles as a discovery tracker.
   ============================================================ */
(function (global) {
  'use strict';

  const el = U.el;
  let activeTab = 'charm';
  let backFn = null;

  const TABS = [
    { id: 'charm',   label: 'Charms' },
    { id: 'omen',    label: 'Omens' },
    { id: 'rune',    label: 'Runes' },
    { id: 'voucher', label: 'Relics' },
    { id: 'boss',    label: 'Bosses' },
    { id: 'tag',     label: 'Boons' },
    { id: 'deck',    label: 'Decks' },
    { id: 'dice',    label: 'Dice' }
  ];

  function entriesFor(tab) {
    switch (tab) {
      case 'charm':
        return CH.CHARMS.map(function (c) {
          return {
            id: c.id, name: c.name, icon: c.icon, rarity: c.rarity,
            desc: c.desc({ id: c.id, state: c.init ? c.init() : {} }, Game.run),
            foot: '$' + c.cost, cls: 'rar-' + c.rarity, kind: 'charm'
          };
        });
      case 'omen':
        return C.OMENS.map(function (o) {
          return { id: o.id, name: o.name, icon: o.icon, rarity: 'omen', desc: o.desc, foot: '$' + o.cost, cls: 'kind-omen', kind: 'omen' };
        });
      case 'rune':
        return C.RUNES.map(function (r) {
          return { id: r.id, name: r.name, icon: r.icon, rarity: 'rune', desc: r.desc, foot: '$' + r.cost, cls: 'kind-rune', kind: 'rune' };
        });
      case 'voucher':
        return C.VOUCHERS.map(function (v) {
          return { id: v.id, name: v.name, icon: v.icon, rarity: 'relic', desc: v.desc, foot: '$' + v.cost, cls: 'kind-voucher', kind: 'voucher' };
        });
      case 'boss':
        return C.BOSSES.map(function (b) {
          return {
            id: b.id, name: b.name, icon: b.icon, rarity: 'boss blind',
            desc: b.desc, foot: 'ante ' + b.minAnte + '+', cls: 'kind-boss', kind: 'boss'
          };
        });
      case 'tag':
        return C.TAGS.map(function (t) {
          return { id: t.id, name: t.name, icon: t.icon, rarity: 'boon', desc: t.desc, foot: '', cls: 'kind-tag', kind: 'tag' };
        });
      case 'deck':
        return DK.DECKS.map(function (d) {
          const unlocked = Profile.deckUnlocked(d);
          const wins = Profile.get().deckWins[d.id] || 0;
          return {
            id: d.id, name: d.name, icon: d.icon, rarity: 'deck',
            desc: d.desc + (unlocked ? '' : '<br><br><b>Locked:</b> ' + DK.unlockText(d)),
            foot: wins ? 'won @ peril ' + wins : (unlocked ? 'unlocked' : 'locked'),
            cls: 'kind-voucher', forceKnown: unlocked, kind: 'deck'
          };
        });
      case 'dice': {
        const out = [];
        for (const k in C.ENHANCEMENTS) {
          const e = C.ENHANCEMENTS[k];
          out.push({ id: k, name: e.name, icon: '', rarity: 'enhancement', desc: e.desc, foot: e.short, cls: '', forceKnown: true, kind: 'enh' });
        }
        for (const k in C.EDITIONS) {
          const e = C.EDITIONS[k];
          out.push({ id: 'ed_' + k, name: e.name, icon: '', rarity: 'edition', desc: e.desc, foot: e.short, cls: '', forceKnown: true, iconName: 'sparkle' });
        }
        for (const k in C.SEALS) {
          const e = C.SEALS[k];
          out.push({ id: 'seal_' + k, name: e.name, icon: '', rarity: 'seal', desc: e.desc, foot: 'seal', cls: '', forceKnown: true, iconName: 'seal' });
        }
        return out;
      }
      default: return [];
    }
  }

  function known(tab, entry) {
    if (entry.forceKnown) return true;
    if (tab === 'dice') return true;
    return Profile.isDiscovered(tab, entry.id);
  }

  function show(back) {
    if (back) backFn = back;
    UI.openOverlay(function (root) {
      root.appendChild(el('div', 'ov-title', 'Collection'));

      const entries = entriesFor(activeTab);
      const seen = entries.filter(function (e) { return known(activeTab, e); }).length;
      root.appendChild(el('div', 'ov-sub', seen + ' of ' + entries.length + ' discovered'));

      /* tabs */
      const tabs = el('div', 'coll-tabs');
      TABS.forEach(function (t) {
        const b = el('button', 'coll-tab' + (t.id === activeTab ? ' on' : ''), t.label);
        b.addEventListener('click', function () { activeTab = t.id; show(); });
        tabs.appendChild(b);
      });
      root.appendChild(tabs);

      /* grid */
      const grid = el('div', 'coll-grid');
      entries.forEach(function (entry) {
        const isKnown = known(activeTab, entry);
        const card = el('div', 'card ' + (entry.cls || '') + (isKnown ? '' : ' unknown'));
        card.appendChild(el('div', 'cname', isKnown ? entry.name : '???'));
        const art = el('div', 'cart');
        const iconName = entry.iconName ||
          (entry.kind ? Icons.forContent(entry.kind, entry.id) : 'unknown');
        art.appendChild(Icons.node(isKnown ? iconName : 'unknown'));
        card.appendChild(art);
        card.appendChild(el('div', 'cfoot', isKnown ? entry.foot : ''));
        UI.attachTip(card, {
          name: isKnown ? entry.name : 'Not yet discovered',
          rar: entry.rarity,
          desc: isKnown ? entry.desc : 'Find this during a run to add it to your collection.'
        });
        grid.appendChild(card);
      });
      root.appendChild(grid);

      const acts = el('div', 'ov-actions');
      acts.appendChild(UI.btn('Back', 'alt', function () {
        if (backFn) backFn(); else Main.title();
      }));
      root.appendChild(acts);
    });
  }

  global.Collection = { show: show };
})(window);
