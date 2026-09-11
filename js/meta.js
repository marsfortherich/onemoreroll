/* ============================================================
   meta.js — the player profile: unlocks, records, discovery

   Survives runs. Drives which decks and stakes are selectable and
   what the Collection screen is allowed to show.
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'onemoreroll.profile.v1';
  // pre-rename keys, read once so an existing profile survives the rename
  const LEGACY_KEYS = ['rollatro.profile.v1'];
  const LEGACY_META = 'onemoreroll.meta.v1';
  const LEGACY_META_OLD = 'rollatro.meta.v1';

  function blank() {
    return {
      version: 1,
      runs: 0,
      wins: 0,
      bestAnte: 0,
      bestHand: 0,
      bestHandCat: '-',
      maxMoney: 0,
      totalTurns: 0,
      unlockedStake: 1,          // highest stake the player may select
      deckWins: {},              // deckId -> highest stake beaten
      deckPlays: {},             // deckId -> runs started
      discovered: {              // id -> true, for the collection browser
        charm: {}, omen: {}, rune: {}, voucher: {}, boss: {}, tag: {}, deck: { standard: true }
      },
      lastDeck: 'standard',
      lastStake: 1,
      history: []                // most recent runs, newest first
    };
  }

  let data = null;

  function load() {
    let raw = null;
    try {
      raw = global.localStorage.getItem(KEY);
      for (let i = 0; !raw && i < LEGACY_KEYS.length; i++) {
        raw = global.localStorage.getItem(LEGACY_KEYS[i]);
      }
    } catch (e) { raw = null; }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          data = Object.assign(blank(), parsed);
          data.discovered = Object.assign(blank().discovered, parsed.discovered || {});
          return data;
        }
      } catch (e) { /* fall through to a fresh profile */ }
    }
    data = blank();
    // fold in the old v1 meta blob if it exists
    try {
      const legacy = JSON.parse(
        global.localStorage.getItem(LEGACY_META) ||
        global.localStorage.getItem(LEGACY_META_OLD));
      if (legacy) {
        data.runs = legacy.runs || 0;
        data.wins = legacy.wins || 0;
        data.bestAnte = legacy.bestAnte || 0;
        data.bestHand = legacy.bestHand || 0;
      }
    } catch (e) {}
    return data;
  }

  function get() { if (!data) load(); return data; }
  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(get())); } catch (e) {}
  }

  /* ---------------------------------------------------------
     discovery — what the player has actually seen
     --------------------------------------------------------- */
  function discover(kind, id) {
    const d = get();
    if (!d.discovered[kind]) d.discovered[kind] = {};
    if (d.discovered[kind][id]) return false;
    d.discovered[kind][id] = true;
    save();
    return true;
  }
  function isDiscovered(kind, id) {
    const d = get();
    return !!(d.discovered[kind] && d.discovered[kind][id]);
  }
  function discoveredCount(kind) {
    const d = get();
    return Object.keys(d.discovered[kind] || {}).length;
  }

  /* ---------------------------------------------------------
     unlocks
     --------------------------------------------------------- */
  function deckUnlocked(deck) {
    if (!deck.unlock) return true;
    const d = get();
    switch (deck.unlock.type) {
      case 'ante':  return d.bestAnte >= deck.unlock.value;
      case 'wins':  return d.wins >= deck.unlock.value;
      case 'best':  return d.bestHand >= deck.unlock.value;
      case 'money': return d.maxMoney >= deck.unlock.value;
      default:      return false;
    }
  }
  function unlockedStake() { return get().unlockedStake; }

  /* ---------------------------------------------------------
     recording
     --------------------------------------------------------- */
  function startRun(deckId, stake) {
    const d = get();
    d.lastDeck = deckId;
    d.lastStake = stake;
    d.deckPlays[deckId] = (d.deckPlays[deckId] || 0) + 1;
    discover('deck', deckId);
    save();
  }

  /** Called once per finished run, win or lose. Returns newly unlocked decks. */
  function endRun(run, won) {
    const d = get();
    const before = DK.DECKS.filter(deckUnlocked).map(function (x) { return x.id; });
    const beforeStake = d.unlockedStake;

    d.runs++;
    d.totalTurns += (run.stats && run.stats.turns) || 0;
    if (won) d.wins++;
    if (run.ante > d.bestAnte) d.bestAnte = run.ante;
    if (run.stats && run.stats.best > d.bestHand) {
      d.bestHand = run.stats.best;
      d.bestHandCat = run.stats.bestCat || '-';
    }
    if (run.money > d.maxMoney) d.maxMoney = run.money;

    if (won) {
      const stake = run.stake || 1;
      if ((d.deckWins[run.deckId] || 0) < stake) d.deckWins[run.deckId] = stake;
      if (stake >= d.unlockedStake && d.unlockedStake < DK.STAKES.length) d.unlockedStake = stake + 1;
    }

    d.history.unshift({
      at: Date.now(), seed: run.seed, deck: run.deckId, stake: run.stake || 1,
      won: !!won, ante: run.ante, round: run.roundNum,
      best: (run.stats && run.stats.best) || 0,
      charms: run.charms.map(function (c) { return c.id; })
    });
    if (d.history.length > 20) d.history.length = 20;

    save();

    const after = DK.DECKS.filter(deckUnlocked).map(function (x) { return x.id; });
    return {
      decks: after.filter(function (id) { return before.indexOf(id) === -1; }),
      stake: d.unlockedStake > beforeStake ? d.unlockedStake : null
    };
  }

  function reset() {
    data = blank();
    save();
  }

  load();

  global.Profile = {
    get: get, save: save, reset: reset, reload: load,
    discover: discover, isDiscovered: isDiscovered, discoveredCount: discoveredCount,
    deckUnlocked: deckUnlocked, unlockedStake: unlockedStake,
    startRun: startRun, endRun: endRun
  };
})(window);
