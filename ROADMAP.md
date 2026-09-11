# One More Roll — Roadmap

> **Status:** Phases 0–2 implemented. Phase 3 implemented except bosses, omens and the
> rarity pass. Phase 4 (art identity) mostly implemented — emoji are gone. Phase 5 has
> its shipping half done (the game deploys to GitHub Pages with a CI gate); the touch,
> gamepad and accessibility half is not started. Phase 6 not started.
>
> Everything marked `[x]` is in the build and covered by `node tools/test.js`
> (72 tests), which CI runs before every deploy.

## Honest starting position

What exists today is a **complete, correct, bug-free prototype**: the full loop runs
(8 antes → blinds → shop → death/victory), the scoring pipeline is solid, ~105
automated runs produce a healthy difficulty curve, and it saves and resumes.

That is maybe 15% of the way to Balatro. Balatro is roughly three years of solo work.
The gap is not "more features" — it's four specific things, in this order of impact:

| Gap | Balatro | ONE MORE ROLL (start) |
|---|---|---|
| **Game feel** (audio, juice, choreography) | The entire product | float-up text + a CSS bump |
| **Run variety** (decks, stakes, unlocks) | 15 decks × 8 stakes + unlocks | one deck, one difficulty |
| **Content mass** | 150 jokers, 28 bosses, 32 vouchers, 24 tags | 50 / 19 / 10 / 7 |
| **Art identity** | hand-drawn pixel art, CRT shader | emoji + CSS gradients |

Nothing below is speculative polish. Each phase closes one of those gaps.

---

## Phase 0 — Engineering foundation

*Rationale: you cannot balance a roguelike by playing it. Everything after this phase
needs a way to measure itself.*

- [x] **Headless simulation harness** — load the game logic into Node with stubbed
      `UI`/`localStorage`, so runs can be simulated with no browser.
- [x] **Bot policies** — pluggable strategies (random / greedy / competent) so balance
      claims are stated against a named skill level.
- [x] **Scoring unit tests** — pin down category evaluation, enhancements, editions,
      seals, retriggers, boss debuffs, and preview/commit parity.
- [x] **Save versioning + migration + corruption guard** — a bad save must never brick
      the title screen.
- [x] **Determinism audit** — same seed + same inputs ⇒ same run, verified by test.

**Acceptance:** `node tools/test.js` green; `node tools/sim.js --runs 500` prints a
win-rate table in under a minute.

---

## Phase 1 — Game feel

*Rationale: this is the single biggest quality gap, and it is invisible in a feature
list. Balatro's appeal is that every click is physical.*

- [x] **Procedural audio engine** (WebAudio, zero asset files) — dice tumble, hold
      click, chip ticks that rise in pitch as they accumulate, mult thump, XMult stab,
      coin chime, card flip, shop buy/sell, blind fanfare, defeat sting, UI clicks.
- [x] **Procedural music** — layered chord bed + bass + shaker, tempo/intensity shifts
      between menu, play, shop and boss.
- [x] **Scoring choreography** — dice lift and fire in sequence, charms wobble when they
      trigger, counters roll rather than snap, and the total lands with a slam.
- [x] **Screen shake + flash**, scaled by how hard the hit was.
- [x] **Particles** on blind clear, money gain and shatter.
- [x] **Card physics** — 3D tilt tracking the cursor, lift on hover.
- [x] **Settings** — master/SFX/music volume, screen shake, reduced motion, animation
      speed, high-contrast, all persisted.

**Acceptance:** a blind clear at high score is loud, physical and legible; every setting
is honoured, including `prefers-reduced-motion`.

---

## Phase 2 — Run variety and metaprogression

*Rationale: Balatro's replay value is not 150 jokers, it's 120 deck×stake combinations
with unlock pressure behind them.*

- [x] **Decks** — 12 starting variants that change the run's opening rules, not just
      its numbers (extra dice, pre-enhanced dice, level head-starts, economy swaps).
- [x] **Perils** — 8 escalating difficulty tiers that stack, each unlocked by winning
      the one below.
- [x] **Profile** — per-deck/per-stake win records, best hand, total runs, unlock state.
- [x] **Unlocks** — decks and stakes gated behind concrete achievements.
- [x] **Collection browser** — every charm, omen, rune, voucher, boss, tag and deck,
      with discovery state.
- [x] **Charm reordering** — drag to reorder. Order already changes scoring; the player
      must control it.
- [ ] **Challenge runs** — fixed-seed puzzles with preset restrictions.
- [ ] **Run history** — last 20 runs with their builds.

**Acceptance:** 12 decks × 8 stakes, all reachable, all persisted, all browsable.

---

## Phase 3 — Content to critical mass

*Rationale: builds need enough legal moves to feel like builds. Below ~100 charms the
shop repeats itself inside a single run.*

- [x] **Charms 50 → 90**, with a legendary tier and more scaling engines.
- [x] **Boons 7 → 18**, including shop-modifying and blind-modifying tags.
- [x] **Relics 10 → 20** as ten base + ten tier-2 upgrades.
- [ ] **Bosses 19 → 28**, including mechanically weird ones.
- [ ] **Omens 20 → 30**, including a spectral-equivalent high-risk tier.
- [ ] **Charm rarity pass** — four legendaries never surfaced in 400 sim runs; either
      raise legendary weight or add a dedicated source (a Soul-style rare pack).
- [x] **Rebalance against the sim** — the ante curve was retuned with `tools/tune.js`
      (see below).

**Measured after tuning** (`tools/sim.js --runs 300 --stakes 1,3,5,8`, competent bot):

| Peril | 1 | 3 | 5 | 8 |
|---|---|---|---|---|
| win rate | 15.0% | 10.7% | 3.3% | 0.0% |
| avg ante | 5.45 | 4.86 | 3.20 | 1.59 |

The curve is monotonic across stakes and deaths now spread evenly over antes 3–8
instead of piling up at 4–5. Note the *absolute* number is against a deliberately
unsophisticated bot — it buys the first affordable charm, never sells, never rerolls
the shop and picks categories greedily — so it is a floor, not a human win rate. It is
useful as a **relative** instrument (did this change make the game harder or easier?),
which is what it was built for. Calibrating the human number needs playtesting.

---

## Phase 4 — Art identity

*Rationale: emoji was the loudest "this is a prototype" signal in the build, and the
player feedback that triggered this phase said exactly that: "the graphics look like an
AI model created it."*

**The five tells, and what was done about each:**

| Tell | Fix |
|---|---|
| Emoji as artwork | 104 hand-authored SVG icons in one shape language (`js/icons.js`) |
| No typographic identity | Condensed-grotesque stack + hand-set wordmark |
| Flat CSS gradients, no texture | Three procedural noise textures, vignette, grain |
| Perfect grid symmetry | Per-card and per-die resting rotations |
| Dice as rounded divs | Bevelled stock with real per-enhancement materials |

- [x] **Replace emoji with a coherent icon system** — 104 icons on a 24×24 grid,
      stroke-first, `currentColor` so CSS themes them. Grouped into deliberate families
      (every Fortune charm is in the flame family, every economy charm in the coin family)
      so reuse reads as a taxonomy rather than a shortage. Complete coverage of all 91
      charms, 19 bosses, 20 omens, 20 vouchers, 21 tags, 12 decks and 13 categories.
- [x] **Card frames per rarity** — uncommon/rare get corner notches and inset rules,
      legendaries get a slow sheen sweep. Polychrome dice animate a real hue shift.
- [x] **Texture pass** — procedural `feTurbulence` grain, felt weave and paper fibre
      as inline data URIs; table vignette; a global grain overlay at 5.5%.
- [x] **Material pass on dice** — gold is metallic with a specular band, glass is
      translucent with a highlight streak, steel is brushed, stone is noisy rock.
- [x] **Asymmetry** — cards and dice rest at small fixed rotations so the board looks
      dealt rather than laid out on a grid. Disabled under reduced motion.
- [~] **Display typeface** — moved off the system default to a condensed-grotesque
      stack (Bahnschrift and friends) with a hand-set wordmark. Bundling a licensed
      font would still be an upgrade, and would fix the fallback on Linux.
- [ ] **CRT / bloom post-processing** as an optional canvas overlay (vignette and
      grain are in; scanlines and bloom are not).
- [ ] **Dice as real 3D objects** with a tumbling roll animation rather than a 2D spin.
- [ ] **Per-charm bespoke artwork.** The icon system is a coherent *system*; it is not
      110 individually illustrated cards. That is the next real art investment.

**Acceptance:** a screenshot is recognisable as *this* game, not "a web page".

---

## Phase 5 — Platform and reach

### Shipping — done

- [x] **Identity** — renamed to *One More Roll*, and the vocabulary moved off Balatro's
      exact terms: Chips×Mult → **Pips × Fortune**, Voucher → **Relic**, Tag → **Boon**,
      Stake → **Peril**. Ante and Blind stay: ordinary gambling words, centuries older
      than any of this.
- [x] **Trademark cleanup** — "Yahtzee" is a live Hasbro mark. It was the tagline, a
      scorecard category and several charm descriptions; the category is now
      **Five of a Kind** (`fiveKind` in code) and the tagline is *a dice roguelite*.
      Old saves are migrated, with a test covering it.
- [x] **GitHub Pages deploy** — `.github/workflows/pages.yml` runs the full test suite
      and a balance smoke run, then publishes. A failing test blocks the deploy.
- [x] **Cache busting** — every asset URL carries `?v=`, bumped by `node tools/bump.js`.
      Without this, Pages' caching leaves returning players on an old build.
- [x] **Site metadata** — description, theme colour, Open Graph, SVG favicon, web app
      manifest, a custom 404 that works for both user and project sites.
- [x] **Version stamp** on the title screen, so bug reports name a build.

### Reach — not started

- [ ] **Touch and mobile** — the layout reflows to phone width, but tooltips are
      hover-only and selling is right-click. Both need touch equivalents before the
      public link is genuinely playable on a phone. **Highest-value item left.**
- [ ] **Gamepad support.**
- [ ] **Accessibility** — colourblind palettes, text scaling, full keyboard nav,
      screen-reader labels on interactive elements.
- [ ] **Localisation scaffolding** — externalise all strings.
- [ ] **Export/import a profile** — no backend, so this is the only real backup path.
- [ ] **`og:image`** — link previews are text-only until a share image exists.
- [ ] **Offline play.** Deliberately skipped for now: a service worker on a backendless
      site can strand players on a broken build. Revisit once releases are routine.

---

## Phase 6 — Live quality

- [ ] **Telemetry-free local analytics** — end-of-run summaries that feed balance.
- [ ] **Daily seeded run** with a local leaderboard.
- [ ] **Endless mode scaling** past ante 8 that stays interesting.
- [ ] **Tutorial** — a scripted first blind.

---

## What "better than Balatro" would actually require

Parity is a very high bar. Beating it means finding an axis where dice beat cards:

1. **Dice are physical objects with editable faces.** Balatro's cards have rank, suit,
   enhancement, edition, seal. A die additionally has *six independently editable
   faces* — a whole design space Balatro does not have. Lean into it hard: face
   surgery, dice with 7+ sides, dice that change faces mid-blind, mirrored faces.
2. **The scorecard is a resource.** Thirteen categories, each usable once per blind,
   is a planning layer Balatro lacks — you are managing a budget of hand types, not
   just playing the best hand. Push this: categories that upgrade when scratched,
   bosses that reward using bad categories, charms that pay for scratching.
3. **Push-your-luck rerolls.** Rerolling is a per-turn resource with visible odds.
   That is a tension Balatro's discard mechanic only approximates.

Those three are the design bets worth making. Everything else in this roadmap is
table stakes.
