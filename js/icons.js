/* ============================================================
   icons.js — the game's own icon language

   Replaces emoji everywhere. One shape language, hand-authored:
     · 24x24 grid, artwork inside 3..21
     · stroke-first, 1.9 units, round caps and joins
     · monochrome via currentColor, so CSS themes every icon
     · solid accents only where a shape needs weight

   Icons are grouped into families on purpose. A charm that adds Fortune
   is always in the flame family; an economy charm is always in the coin
   family. Reuse across a family reads as a designed taxonomy, which is
   the opposite of 110 scraped emoji.
   ============================================================ */
(function (global) {
  'use strict';

  const F = ' fill="currentColor" stroke="none"';

  const ICONS = {

    /* ---------------- dice ---------------- */
    die: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.2"/>' +
         '<circle cx="8.6" cy="8.6" r="1.35"' + F + '/><circle cx="15.4" cy="8.6" r="1.35"' + F + '/>' +
         '<circle cx="12" cy="12" r="1.35"' + F + '/>' +
         '<circle cx="8.6" cy="15.4" r="1.35"' + F + '/><circle cx="15.4" cy="15.4" r="1.35"' + F + '/>',

    dicePair: '<rect x="2.4" y="8.4" width="12.4" height="12.4" rx="3.2"/>' +
              '<rect x="9.2" y="3.2" width="12.4" height="12.4" rx="3.2"/>' +
              '<circle cx="8.6" cy="14.6" r="1.25"' + F + '/>' +
              '<circle cx="15.4" cy="9.4" r="1.25"' + F + '/>',

    diceThree: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.2"/>' +
               '<circle cx="8" cy="8" r="1.35"' + F + '/><circle cx="12" cy="12" r="1.35"' + F + '/>' +
               '<circle cx="16" cy="16" r="1.35"' + F + '/>',

    diceRoll: '<rect x="4" y="6" width="14" height="14" rx="3.6" transform="rotate(-12 11 13)"/>' +
              '<circle cx="9" cy="11" r="1.3"' + F + '/><circle cx="14" cy="15" r="1.3"' + F + '/>' +
              '<path d="M18.5 4.5c1.4.5 2.4 1.6 2.8 3"/>',

    dieStack: '<path d="M4 9.5 12 5.5l8 4-8 4-8-4Z"/><path d="M4 14l8 4 8-4"/>' +
              '<circle cx="12" cy="9.4" r="1.2"' + F + '/>',

    /* ---------------- mult / fire family ---------------- */
    flame: '<path d="M12 21c3.5 0 6-2.4 6-5.7 0-4.3-4.3-6-3.2-10.5C12 6 10.2 8.4 10.2 10.6c0 1.3.5 1.9.5 2.7 0 .9-.7 1.6-1.6 1.6-1 0-1.7-.9-1.7-2.2C6.2 14 6 15 6 15.6 6 18.7 8.5 21 12 21Z"/>',
    spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.2 6.2l3.2 3.2M14.6 14.6l3.2 3.2M17.8 6.2l-3.2 3.2M9.4 14.6l-3.2 3.2"/>',
    burst: '<path d="M12 2.6 14.1 9l6.7.2-5.3 4 1.9 6.4L12 15.9 6.6 19.6l1.9-6.4-5.3-4L9.9 9 12 2.6Z"/>',
    bolt: '<path d="M13.6 2.5 5.4 13.2h5.2l-1.2 8.3 8.2-10.7h-5.2l1.2-8.3Z"/>',
    twinFlame: '<path d="M8.6 21c2.3 0 3.9-1.7 3.9-3.9 0-3-2.8-4.1-2.1-7.2-1.8.7-3 2.3-3 3.9 0 1.8.5 1.7.5 2.4 0 .6-.5 1-1.1 1-.7 0-1.1-.5-1.1-1.4-.6.9-.8 1.6-.8 2 0 2.1 1.5 3.2 3.7 3.2Z"/>' +
               '<path d="M16 17.5c1.6 0 2.8-1.2 2.8-2.8 0-2.2-2-3-1.5-5.3-1.3.5-2.2 1.7-2.2 2.9 0 1.3.4 1.2.4 1.7 0 .5-.4.8-.8.8-.5 0-.8-.4-.8-1-.5.6-.6 1.1-.6 1.4 0 1.5 1.1 2.3 2.7 2.3Z"/>',

    /* ---------------- chips / economy family ---------------- */
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7.6v8.8M14.4 9.6c-.6-.6-1.5-.9-2.4-.9-1.5 0-2.5.8-2.5 1.9 0 2.6 5 1.3 5 3.9 0 1.1-1.1 1.9-2.6 1.9-1 0-1.9-.3-2.5-1"/>',
    coinStack: '<ellipse cx="12" cy="6.6" rx="7" ry="2.8"/><path d="M5 6.6v4.4c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V6.6"/>' +
               '<path d="M5 11v4.4c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V11"/>',
    gem: '<path d="M6.2 4h11.6l3.2 5.2L12 20.6 3 9.2 6.2 4Z"/><path d="M3 9.2h18M9.2 4 12 20.6 14.8 4"/>',
    ingot: '<path d="M4 16.6 6.8 9h10.4L20 16.6H4Z"/><path d="M6.8 9h10.4"/><path d="M8.4 12.8h7.2"/>',
    vault: '<rect x="3.2" y="4.4" width="17.6" height="15.2" rx="2.2"/><circle cx="10.6" cy="12" r="3.9"/><path d="M10.6 8.1v1.5M10.6 14.4v1.5M6.7 12h1.5M13 12h1.5"/><path d="M17.2 9.2v5.6"/>',
    piggy: '<path d="M3.4 12.6c0-3.4 3.4-6 7.6-6 .9 0 1.8.1 2.6.4l3-2.2v3.4c1.2.9 2 2.1 2.3 3.4h1.7v3.6h-2.2a6.7 6.7 0 0 1-2 2.2v2.2h-3v-1.2a11 11 0 0 1-4.8 0v1.2h-3v-2.4c-1.3-1.2-2.2-2.8-2.2-4.6Z"/>' +
           '<circle cx="8.4" cy="11.8" r="1"' + F + '/>',
    receipt: '<path d="M6 3.4h12v17.2l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.6V3.4Z"/><path d="M9 8.4h6M9 12.4h6"/>',
    handshake: '<path d="M3.6 8.8h13"/><path d="M13.2 5.4 16.6 8.8 13.2 12.2"/><path d="M20.4 15.2h-13"/><path d="M10.8 11.8 7.4 15.2l3.4 3.4"/>',
    ticket: '<path d="M3.4 7.6h17.2v3a2.4 2.4 0 0 0 0 4.8v3H3.4v-3a2.4 2.4 0 0 0 0-4.8v-3Z"/><path d="M12 8.8v1.8M12 13.4v1.8"/>',

    /* ---------------- luck ---------------- */
    clover: '<path d="M12 12c0-2.6-1-4.4-3-4.4-1.6 0-2.8 1.2-2.8 2.8S7.4 13.2 9 13.2c1.6 0 3-.4 3-1.2Z"/>' +
            '<path d="M12 12c2.6 0 4.4-1 4.4-3 0-1.6-1.2-2.8-2.8-2.8S10.8 7.4 10.8 9c0 1.6.4 3 1.2 3Z"/>' +
            '<path d="M12 12c0 2.6 1 4.4 3 4.4 1.6 0 2.8-1.2 2.8-2.8S16.6 10.8 15 10.8c-1.6 0-3 .4-3 1.2Z"/>' +
            '<path d="M12 12c-2.6 0-4.4 1-4.4 3 0 1.6 1.2 2.8 2.8 2.8s2.8-1.2 2.8-2.8c0-1.6-.4-3-1.2-3Z"/>',
    horseshoe: '<path d="M7.4 20.4V14a4.6 4.6 0 0 1 9.2 0v6.4"/><path d="M7.4 20.4h2.8M13.8 20.4h2.8"/>' +
               '<path d="M9 9.2 7.2 6.4M15 9.2l1.8-2.8"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1.2"' + F + '/>',

    /* ---------------- sequence / structure ---------------- */
    stairs: '<path d="M3.6 19.4h4.2v-4.2H12V11h4.2V6.8h4.2"/><path d="M3.6 19.4v-4.2"/>',
    ladder: '<path d="M8 3v18M16 3v18M8 7.4h8M8 12h8M16 16.6H8"/>',
    ruler: '<rect x="2.6" y="8.4" width="18.8" height="7.2" rx="1.6" transform="rotate(-20 12 12)"/>' +
           '<path d="M7.4 9.6l1.2 2M11 7.8l1.2 2M14.6 6l1.2 2"/>',
    chartUp: '<path d="M3.6 18.4h17"/><path d="M6 15l4-4.4 3.4 2.8L20 5.6"/><path d="M20 10V5.6h-4.4"/>',
    chartDown: '<path d="M3.6 18.4h17"/><path d="M6 7l4 4.4 3.4-2.8L20 16.4"/><path d="M20 12v4.4h-4.4"/>',
    infinity: '<path d="M8.4 9.2C6.5 9.2 5 10.4 5 12s1.5 2.8 3.4 2.8c3.6 0 3.6-5.6 7.2-5.6C17.5 9.2 19 10.4 19 12s-1.5 2.8-3.4 2.8c-3.6 0-3.6-5.6-7.2-5.6Z"/>',
    mirror: '<path d="M12 2.8v18.4" stroke-dasharray="2 2.6"/>' +
            '<path d="M9.2 6.4 4.2 12l5 5.6V6.4Z" opacity=".85"' + F + '/>' +
            '<path d="M14.8 6.4 19.8 12l-5 5.6V6.4Z"/>',
    symmetry: '<path d="M12 3.2v17.6" stroke-dasharray="2 2.4"/><path d="M9.6 7.4 5 12l4.6 4.6V7.4Z"/><path d="M14.4 7.4 19 12l-4.6 4.6V7.4Z"/>',

    /* ---------------- sets / house ---------------- */
    house: '<path d="M4 10.6 12 4l8 6.6V20H4v-9.4Z"/><path d="M9.6 20v-5.4h4.8V20"/>',
    crown: '<path d="M4 17.6h16M4.6 17.6 3.4 7.4l4.6 3.4L12 5l4 5.8 4.6-3.4-1.2 10.2"/>' +
           '<circle cx="12" cy="13.4" r="1.1"' + F + '/>',
    pyramid: '<path d="M12 4 21 19.4H3L12 4Z"/><path d="M12 4v15.4M7 12.6h10"/>',
    fourSquare: '<rect x="3.6" y="3.6" width="7.2" height="7.2" rx="1.6"/><rect x="13.2" y="3.6" width="7.2" height="7.2" rx="1.6"/>' +
                '<rect x="3.6" y="13.2" width="7.2" height="7.2" rx="1.6"/><rect x="13.2" y="13.2" width="7.2" height="7.2" rx="1.6"/>',
    rainbow: '<path d="M3.4 19a8.6 8.6 0 0 1 17.2 0"/><path d="M6.6 19a5.4 5.4 0 0 1 10.8 0"/><path d="M9.8 19a2.2 2.2 0 0 1 4.4 0"/>',

    /* ---------------- time / turns ---------------- */
    hourglass: '<path d="M6.4 3.4h11.2M6.4 20.6h11.2"/>' +
               '<path d="M7.6 3.4v3.2c0 2.2 4.4 3.6 4.4 5.4s-4.4 3.2-4.4 5.4v3.2"/>' +
               '<path d="M16.4 3.4v3.2c0 2.2-4.4 3.6-4.4 5.4s4.4 3.2 4.4 5.4v3.2"/>',
    clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.2V12l3.2 2"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.4 4.6v4.6h-4.6"/>',
    rewind: '<path d="M11.4 7.2 4.6 12l6.8 4.8V7.2Z"/><path d="M19.4 7.2 12.6 12l6.8 4.8V7.2Z"/>',
    leaf: '<path d="M20 4c0 9-5.2 13.6-10.6 13.6A5.4 5.4 0 0 1 4 12.2C4 6.8 10.4 4.6 20 4Z"/><path d="M15.6 8.4 5.2 19.8"/>',

    /* ---------------- boss / danger ---------------- */
    skull: '<path d="M6 17.4A7.4 7.4 0 0 1 4.4 12a7.6 7.6 0 0 1 15.2 0 7.4 7.4 0 0 1-1.6 5.4v2.4c0 .7-.6 1.2-1.3 1.2H7.3c-.7 0-1.3-.5-1.3-1.2v-2.4Z"/>' +
           '<circle cx="9.2" cy="11.6" r="1.8"' + F + '/><circle cx="14.8" cy="11.6" r="1.8"' + F + '/>' +
           '<path d="M10.6 17.4v2.6M13.4 17.4v2.6"/>',
    chain: '<path d="M9.4 14.6 6.8 17.2a3.4 3.4 0 0 1-4.8-4.8l2.6-2.6"/>' +
           '<path d="M14.6 9.4l2.6-2.6a3.4 3.4 0 0 1 4.8 4.8l-2.6 2.6"/><path d="M9 15l6-6"/>',
    cage: '<path d="M4.6 8.6h14.8v11.8H4.6V8.6Z"/><path d="M8.4 8.6v11.8M12 8.6v11.8M15.6 8.6v11.8"/>' +
          '<path d="M8 8.6V6.4a4 4 0 0 1 8 0v2.2"/>',
    web: '<path d="M12 3.4v17.2M3.4 12h17.2M5.9 5.9l12.2 12.2M18.1 5.9 5.9 18.1"/><path d="M8.4 12a3.6 3.6 0 0 1 7.2 0"/><path d="M5.4 12a6.6 6.6 0 0 1 13.2 0"/><path d="M8.4 12a3.6 3.6 0 0 0 7.2 0"/>',
    fog: '<path d="M4 9.6h10M16.4 9.6h3.6M6.8 13.2h12M4 16.8h8.4M15 16.8h5"/>',
    bricks: '<path d="M3.4 6.4h17.2v11.2H3.4V6.4Z"/><path d="M3.4 12h17.2"/>' +
            '<path d="M9.2 6.4V12M15 12v5.6"/>',
    scissors: '<circle cx="6.6" cy="17.4" r="2.6"/><circle cx="17.4" cy="17.4" r="2.6"/>' +
              '<path d="M8.4 15.6 18 4.4M15.6 15.6 6 4.4"/>',
    snake: '<path d="M3.6 18.2c2.6 0 2.6-3.4 5.2-3.4s2.6 3.4 5.2 3.4"/>' +
           '<path d="M14 18.2c2.2 0 3.6-1.6 3.6-3.8 0-3.4-4-3.6-4-6.4"/>' +
           '<path d="M13.6 8a3 3 0 1 1 3.4 3"/>' +
           '<circle cx="15.4" cy="6.2" r="1"' + F + '/><path d="M12.6 5.2 10.8 4"/>',
    ox: '<path d="M4 7.4C4 5.6 5.2 4.4 7 4.4c2.6 0 3.4 2.4 5 2.4s2.4-2.4 5-2.4c1.8 0 3 1.2 3 3 0 3.6-2.8 4.4-4.6 4.4"/><path d="M7.6 11.8C5.8 11.8 4 11 4 7.4"/><path d="M8 12.6a4 4 0 0 0 8 0"/><circle cx="12" cy="16.8" r="3.6"/><circle cx="10.6" cy="16.2" r=".85" fill="currentColor" stroke="none"/><circle cx="13.4" cy="16.2" r=".85" fill="currentColor" stroke="none"/>',
    clamp: '<rect x="9" y="9" width="6" height="6" rx="1.2"/><path d="M3.2 6.4v11.2M20.8 6.4v11.2"/><path d="M3.2 12h5.8M15 12h5.8"/>',
    wave: '<path d="M3 8.4c2-1.8 4-1.8 6 0s4 1.8 6 0 4-1.8 6 0"/>' +
          '<path d="M3 13.2c2-1.8 4-1.8 6 0s4 1.8 6 0 4-1.8 6 0"/>' +
          '<path d="M3 18c2-1.8 4-1.8 6 0s4 1.8 6 0 4-1.8 6 0"/>',
    arm: '<path d="M12 3.4v11.4"/><path d="M7 10 12 15l5-5"/><path d="M4.6 19.4h14.8"/>',
    needle: '<path d="M9.4 3.4h5.2M12 3.4v3.2"/><rect x="8.8" y="6.6" width="6.4" height="9.8" rx="1.2"/><path d="M8.8 10.2h6.4M8.8 13.2h6.4"/><path d="M12 16.4v4.2"/>',
    tooth: '<path d="M7 4.4c1.6 0 2.2.8 5 .8s3.4-.8 5-.8c1.8 0 2.6 1.4 2.6 3.4 0 3.4-1.8 4.6-2.4 8.2-.4 2.4-.8 4-2.2 4-1.6 0-1.6-2.4-3-2.4s-1.4 2.4-3 2.4c-1.4 0-1.8-1.6-2.2-4C6.2 12.4 4.4 11.2 4.4 7.8c0-2 .8-3.4 2.6-3.4Z"/>',
    virus: '<circle cx="12" cy="12" r="5.6"/><path d="M12 3.2v2.8M12 18v2.8M3.2 12H6M18 12h2.8"/>' +
           '<path d="M5.8 5.8 7.8 7.8M16.2 16.2l2 2M18.2 5.8l-2 2M7.8 16.2l-2 2"/>' +
           '<circle cx="10.4" cy="10.8" r=".9"' + F + '/><circle cx="13.8" cy="13.2" r=".9"' + F + '/>',
    mask: '<path d="M4.6 5.2h14.8v6.4c0 4.6-3.3 8.4-7.4 8.4s-7.4-3.8-7.4-8.4V5.2Z"/><path d="M8.2 10.4c.7-.9 2-.9 2.7 0M13.1 10.4c.7-.9 2-.9 2.7 0"/><path d="M9.4 15.2c1.6 1.3 3.6 1.3 5.2 0"/>',
    sieve: '<path d="M4 7.6h16l-2.6 4.2H6.6L4 7.6Z"/><path d="M6.6 11.8 12 20.4l5.4-8.6"/>' +
           '<path d="M8.6 7.6v4.2M12 7.6v4.2M15.4 7.6v4.2"/>',

    /* ---------------- tools / craft ---------------- */
    anvil: '<path d="M3.4 9.6h9.2c0 2.4 2.6 3.6 5 3.6h3v1.4c0 1.6-1.6 2.6-3.4 2.6H8.4C5.6 17.2 3.4 15 3.4 12V9.6Z"/>' +
           '<path d="M7.6 17.2v3.2M16 17.2v3.2M5.4 20.4h13"/>',
    hammer: '<path d="M13.6 6.4 9.4 2.2 3.6 8l4.2 4.2 1.8-1.8 1.4 1.4 1.8-1.8-1.4-1.4 2.2-2.2Z"/>' +
            '<path d="M11 12.4 19.4 20.8l2-2-8.4-8.4"/>',
    chisel: '<path d="M15.6 3.4 20.6 8.4 10 19l-5-5L15.6 3.4Z"/><path d="M13 6 18 11"/><path d="M5 14 3.4 20.6 10 19"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/>' +
          '<path d="M12 3v2.6M12 18.4V21M21 12h-2.6M5.6 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6"/>',
    scale: '<path d="M12 4v16M7.4 20.4h9.2M4 8.4h16M8 8.4 4.8 14a3.2 3.2 0 0 0 6.4 0L8 8.4Z"/>' +
           '<path d="M16 8.4 12.8 14a3.2 3.2 0 0 0 6.4 0L16 8.4Z"/>',
    magnet: '<path d="M5.4 20v-8.6a6.6 6.6 0 0 1 13.2 0V20h-4.2v-8.6a2.4 2.4 0 0 0-4.8 0V20H5.4Z"/><path d="M5.4 15.8h4.2M14.4 15.8h4.2"/>',
    prism: '<path d="M12 4.4 20.8 19.6H3.2L12 4.4Z"/><path d="M2.2 11.4h5.6"/><path d="M15.6 12.2l6.2-3M16.2 14.2l6 .2M16.4 16.2l5.4 3"/>',
    glassPane: '<rect x="4.4" y="3.6" width="15.2" height="16.8" rx="1.8"/><path d="M12 3.6v16.8M4.4 12h15.2"/>' +
               '<path d="M6.6 6.2 9 8.6" opacity=".6"/>',
    seal: '<circle cx="12" cy="12" r="6.4"/><path d="M12 5.6 13.6 9l3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6L6.8 9.4 10.4 9 12 5.6Z"/>',
    feather: '<path d="M19.4 4.6c-6 0-12 3-12 9v3l-3 3"/><path d="M7.4 16.6h5c4.6 0 7-3.6 7-12Z"/>' +
             '<path d="M14.4 9.6 9.6 14.4"/>',

    /* ---------------- knowledge / meta ---------------- */
    book: '<path d="M4 4.6h5.4c1.4 0 2.6 1 2.6 2.4v12.4c0-1.2-1-2-2.4-2H4V4.6Z"/>' +
          '<path d="M20 4.6h-5.4c-1.4 0-2.6 1-2.6 2.4v12.4c0-1.2 1-2 2.4-2H20V4.6Z"/>',
    scroll: '<path d="M6.4 4.4h11.2c1.2 0 2 .9 2 2v11.2c0 1.7-1.3 3-3 3H7.4c-1.7 0-3-1.3-3-3V6.4c0-1.1.9-2 2-2Z"/>' +
            '<path d="M8.4 8.6h7.2M8.4 12.2h7.2M8.4 15.8h4.4"/>',
    map: '<path d="M9 4.4 3.6 6.6v13l5.4-2.2 6 2.2 5.4-2.2v-13L15 6.6 9 4.4Z"/><path d="M9 4.4v13M15 6.6v13"/>',
    eye: '<path d="M2.6 12S6 5.6 12 5.6 21.4 12 21.4 12 18 18.4 12 18.4 2.6 12 2.6 12Z"/>' +
         '<circle cx="12" cy="12" r="2.8"/>',
    hand: '<path d="M8.4 12V5.6a1.6 1.6 0 0 1 3.2 0V11"/><path d="M11.6 10.4V4.6a1.6 1.6 0 0 1 3.2 0V11"/>' +
          '<path d="M14.8 11V6.6a1.6 1.6 0 0 1 3.2 0v8c0 3.4-2.4 5.8-6 5.8-3.2 0-5.6-1.8-5.6-5V12a1.6 1.6 0 0 1 3.2 0"/>',
    lock: '<rect x="4.6" y="10.4" width="14.8" height="10" rx="2.2"/><path d="M8 10.4V7.6a4 4 0 0 1 8 0v2.8"/>' +
          '<circle cx="12" cy="15.4" r="1.4"' + F + '/>',
    key: '<circle cx="7.6" cy="8.4" r="3.8"/><path d="M10.4 11.2 20 20.8"/><path d="M16.6 17.4 19 15M13.6 14.4 16 12"/>',
    bag: '<path d="M5.4 8.6h13.2l1.2 10a2.4 2.4 0 0 1-2.4 2.6H6.6a2.4 2.4 0 0 1-2.4-2.6l1.2-10Z"/>' +
         '<path d="M8.8 8.6V6.4a3.2 3.2 0 0 1 6.4 0v2.2"/>',
    shield: '<path d="M12 3.4 19.6 6v6c0 4.4-3.2 7.6-7.6 8.6C7.6 19.6 4.4 16.4 4.4 12V6L12 3.4Z"/>' +
            '<path d="M9 12.2l2 2 4-4.4"/>',
    trophy: '<path d="M8 4.4h8v5.2a4 4 0 0 1-8 0V4.4Z"/><path d="M8 6h-3v1.6a3 3 0 0 0 3 3"/>' +
            '<path d="M16 6h3v1.6a3 3 0 0 1-3 3"/><path d="M12 13.6v3.6M8.6 20.4h6.8M10 17.2h4v3.2h-4z"/>',
    flag: '<path d="M6 20.6V4"/><path d="M6 5.2h11.6l-2.2 3.6 2.2 3.6H6"/>',
    tagIcon: '<path d="M11.4 3.4H20v8.6l-8.8 8.8a1.8 1.8 0 0 1-2.6 0l-6-6a1.8 1.8 0 0 1 0-2.6l8.8-8.8Z"/>' +
             '<circle cx="16.2" cy="7.8" r="1.5"' + F + '/>',
    cart: '<circle cx="9.6" cy="19" r="1.6"/><circle cx="17.4" cy="19" r="1.6"/>' +
          '<path d="M2.6 3.6h2.8l2.6 11.4h11l2.4-8.4H6.4"/>',
    mountain: '<path d="M2.6 19.4 9 8l3.6 5.6L15.4 9l6 10.4H2.6Z"/><path d="M9 8l2.2 3.8"/>',
    moon: '<path d="M20 13.6A8.4 8.4 0 0 1 10.4 4 8.6 8.6 0 1 0 20 13.6Z"/>',
    obelisk: '<path d="M9.4 20.6 10.6 5.4 12 2.6l1.4 2.8 1.2 15.2H9.4Z"/><path d="M9.8 15.4h4.4M10.2 10.2h3.6"/>',
    pit: '<path d="M3.4 8.6c0 5 3.8 9 8.6 9s8.6-4 8.6-9"/><path d="M3.4 8.6h17.2"/>' +
         '<path d="M7.6 3.6v5M12 2.6v6M16.4 3.6v5"/>',

    /* ---------------- categories (also used for Runes) ---------------- */
    catOnes: '<path d="M9.4 7.6 12.6 5v14"/><path d="M9.8 19h5.6"/>',
    catTwos: '<path d="M8.6 8.2a3.4 3.4 0 1 1 6.4 1.6L8.6 19h6.8"/>',
    catThrees: '<path d="M8.8 6.6a3.2 3.2 0 1 1 2.4 5.4h-.6"/><path d="M10.6 12a3.6 3.6 0 1 1-2 6.6"/>',
    catFours: '<path d="M14.4 19V5l-6.6 9.6h9"/>',
    catFives: '<path d="M15 5H9.8l-.8 5.4a3.8 3.8 0 1 1-.6 6.8"/>',
    catSixes: '<path d="M15 5.4c-3.6.6-6.2 3.6-6.2 8.2a3.8 3.8 0 1 0 3.8-3.8c-2 0-3.8 1.6-3.8 3.8"/>',
    catThreeKind: '<circle cx="7" cy="15.4" r="3"/><circle cx="12" cy="8.6" r="3"/><circle cx="17" cy="15.4" r="3"/>',
    catFourKind: '<circle cx="7.4" cy="7.4" r="2.8"/><circle cx="16.6" cy="7.4" r="2.8"/>' +
                 '<circle cx="7.4" cy="16.6" r="2.8"/><circle cx="16.6" cy="16.6" r="2.8"/>',
    catFullHouse: '<circle cx="6.2" cy="8.2" r="2.5"/><circle cx="12" cy="8.2" r="2.5"/><circle cx="17.8" cy="8.2" r="2.5"/><circle cx="9.1" cy="16.6" r="2.5"/><circle cx="14.9" cy="16.6" r="2.5"/>',
    catSmallStraight: '<path d="M5 19.4v-3.6M10 19.4v-6.4M15 19.4v-9.2M20 19.4v-12"/>',
    catLargeStraight: '<path d="M3.6 19.4v-2.4M8 19.4v-5.2M12.4 19.4v-8M16.8 19.4v-10.8M21.2 19.4v-13.6"/><path d="M3.6 16.2 21.2 5.4"/>',
    catFiveKind: '<path d="M12 2.6 14.4 9h6.8l-5.5 4.1 2.1 6.7-5.8-4.1-5.8 4.1 2.1-6.7L2.8 9h6.8L12 2.6Z"/>',
    catChance: '<path d="M4.4 12a7.6 7.6 0 0 1 13-5.4"/><path d="M19.6 12a7.6 7.6 0 0 1-13 5.4"/>' +
               '<path d="M17.4 3v3.6h-3.6M6.6 21v-3.6h3.6"/>',

    /* ---------------- misc ---------------- */
    unknown: '<circle cx="12" cy="12" r="8.4" stroke-dasharray="2.4 2.6"/>' +
             '<path d="M9.8 9.6a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2 1-1.2 1.9"/>' +
             '<circle cx="12" cy="17" r="1.1"' + F + '/>',
    plus: '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
    minus: '<path d="M5.4 12h13.2"/>',
    xmult: '<path d="M6.6 6.6 17.4 17.4M17.4 6.6 6.6 17.4"/>',
    arrowUp: '<path d="M12 20V4.6M5.6 11 12 4.6 18.4 11"/>',
    arrowDown: '<path d="M12 4v15.4M5.6 13 12 19.4 18.4 13"/>',
    sparkle: '<path d="M12 3.4 13.6 9 19 10.6 13.6 12.2 12 17.8 10.4 12.2 5 10.6 10.4 9 12 3.4Z"/>' +
             '<path d="M18.4 15.4l.8 2.6 2.6.8-2.6.8-.8 2.6-.8-2.6-2.6-.8 2.6-.8.8-2.6Z"' + F + '/>'
  };

  /* ============================================================
     content id -> icon, grouped by family
     ============================================================ */
  const CHARM_ICONS = {
    /* flat mult / chips */
    lucky_seven: 'clover', pip_counter: 'coinStack', double_down: 'arrowUp',
    chip_stack: 'coinStack', sum_total: 'plus',
    /* faces */
    snake_eyes: 'snake', boxcars: 'dieStack', odd_job: 'mask', even_steven: 'scale',
    prime_time: 'bolt', high_roller: 'diceRoll', low_roller: 'arrowDown',
    /* categories */
    the_trio: 'catThreeKind', quads: 'catFourKind', house_rules: 'catFullHouse',
    straight_edge: 'ruler', big_five: 'catFiveKind', upper_hand: 'arrowUp',
    ace_high: 'catOnes', chancer: 'catChance', pairs_well: 'dicePair',
    full_send: 'burst', minimalist: 'gem', bakers_dozen: 'pyramid',
    understated: 'chartDown', housekeeper: 'house', purist: 'obelisk',
    bookkeeper: 'book', ladder: 'ladder',
    /* tempo */
    gamblers_charm: 'diceRoll', cold_streak: 'sparkle', blind_luck: 'eye',
    last_stand: 'shield', momentum: 'chartUp', tally_mark: 'scroll',
    ivory_tower: 'obelisk', hot_hand: 'flame', second_wind: 'leaf', deadeye: 'target',
    /* retriggers */
    duplicator: 'hand', echo: 'wave', mirror_die: 'mirror', stutter: 'rewind',
    twin_flame: 'twinFlame', bookends: 'book', polish: 'sparkle', understudy: 'mask',
    /* dice synergy */
    glassblower: 'glassPane', rabbits_foot: 'clover', steel_nerves: 'shield',
    quarry: 'mountain', midas: 'crown',
    /* economy */
    hoarder: 'bag', golden_touch: 'coin', ledger_charm: 'receipt', scorekeeper: 'receipt',
    debt_collector: 'receipt', fat_stacks: 'coinStack', overkill: 'burst',
    usurer: 'coin', tax_haven: 'vault', piggy_bank: 'piggy', broker: 'handshake',
    /* slots / meta */
    collector: 'bag', vacancy: 'pit', sixth_sense: 'eye', extra_roll: 'refresh',
    time_keeper: 'clock', scratchproof: 'shield', loaded_dice: 'target',
    weighted: 'scale', the_archivist: 'book', wildcard: 'sparkle',
    the_obelisk: 'obelisk', perfectionist: 'gem',
    /* expansion */
    ratchet: 'gear', cartographer: 'map', tithe: 'seal', scrivener: 'feather',
    vulture: 'feather', hoard: 'gem', monotone: 'fourSquare', rainbow: 'rainbow',
    ascending: 'stairs', symmetry: 'symmetry', seven_up: 'clover',
    overflow: 'wave', the_pit: 'pit', colossus: 'obelisk', ouroboros: 'infinity',
    the_mint: 'vault'
  };

  const BOSS_ICONS = {
    cage: 'cage', vise: 'scissors', mirror: 'mirror', serpent: 'snake',
    sieve: 'sieve', fog: 'fog', wall: 'bricks', miser: 'coin', chain: 'chain',
    hook: 'magnet', ox: 'ox', clamp: 'clamp', flint: 'mountain', plague: 'virus',
    water: 'wave', arm: 'arm', needle: 'needle', tooth: 'tooth', grand: 'crown'
  };

  const OMEN_ICONS = {
    forge: 'hammer', ember: 'flame', pane: 'glassPane', vault: 'vault',
    anvil: 'anvil', clover: 'clover', monolith: 'obelisk', gilder: 'sparkle',
    spectre: 'moon', prism: 'prism', wax: 'seal', ledger: 'receipt',
    chisel: 'chisel', lathe: 'gear', twins: 'dicePair', reaper: 'skull',
    hermit: 'moon', beggar: 'bag', judge: 'scale', echoOmen: 'refresh'
  };

  const VOUCHER_ICONS = {
    v_reroll: 'refresh', v_turn: 'hourglass', v_die: 'die', v_slot: 'bag',
    v_pouch: 'bag', v_discount: 'tagIcon', v_interest: 'coinStack',
    v_shopwide: 'cart', v_cheapre: 'ticket', v_omen: 'moon',
    v_reroll2: 'refresh', v_turn2: 'hourglass', v_die2: 'dicePair', v_slot2: 'vault',
    v_pouch2: 'bag', v_discount2: 'tagIcon', v_interest2: 'chartUp',
    v_shopwide2: 'cart', v_cheapre2: 'ticket', v_omen2: 'prism'
  };

  const TAG_ICONS = {
    t_cash: 'coin', t_charm: 'sparkle', t_rune: 'scroll', t_omen: 'moon',
    t_double: 'arrowDown', t_reroll: 'refresh', t_level: 'chartUp',
    t_boss: 'skull', t_voucher: 'tagIcon', t_charmpack: 'bag',
    t_omenpack: 'moon', t_runepack: 'scroll', t_foundry: 'anvil',
    t_invest: 'chartUp', t_juggle: 'dicePair', t_slot: 'key',
    t_polish: 'sparkle', t_wax: 'seal', t_ethereal: 'burst',
    t_handshake: 'handshake', t_meteor: 'burst'
  };

  const DECK_ICONS = {
    standard: 'die', loaded: 'target', gambler: 'diceRoll', quarry: 'mountain',
    scholar: 'book', miser: 'vault', glass: 'glassPane', abacus: 'coinStack',
    wide: 'fourSquare', plated: 'ingot', magpie: 'feather', anarchy: 'burst'
  };

  const CATEGORY_ICONS = {
    ones: 'catOnes', twos: 'catTwos', threes: 'catThrees', fours: 'catFours',
    fives: 'catFives', sixes: 'catSixes', threeKind: 'catThreeKind',
    fourKind: 'catFourKind', fullHouse: 'catFullHouse',
    smallStraight: 'catSmallStraight', largeStraight: 'catLargeStraight',
    fiveKind: 'catFiveKind', chance: 'catChance'
  };

  const ENH_ICONS = {
    bonus: 'coinStack', mult: 'flame', glass: 'glassPane', gold: 'ingot',
    steel: 'shield', lucky: 'clover', stone: 'mountain'
  };

  /* ============================================================
     rendering
     ============================================================ */
  function markup(name, extraClass) {
    const body = ICONS[name] || ICONS.unknown;
    return '<svg class="icn ' + (extraClass || '') + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  }

  function node(name, extraClass) {
    const span = document.createElement('span');
    span.className = 'iconwrap';
    span.innerHTML = markup(name, extraClass);
    return span;
  }

  function lookup(kind, id) {
    switch (kind) {
      case 'charm':    return CHARM_ICONS[id];
      case 'boss':     return BOSS_ICONS[id];
      case 'omen':     return OMEN_ICONS[id];
      case 'voucher':  return VOUCHER_ICONS[id];
      case 'tag':      return TAG_ICONS[id];
      case 'deck':     return DECK_ICONS[id];
      case 'category': return CATEGORY_ICONS[id];
      case 'enh':      return ENH_ICONS[id];
      case 'rune': {
        // "rune_sixes" -> the category's own mark; the wild rune gets a sparkle
        const cat = String(id).replace(/^rune_/, '');
        return CATEGORY_ICONS[cat] || 'sparkle';
      }
      default: return null;
    }
  }

  /** The icon for a piece of content, falling back to a generic mark. */
  function forContent(kind, id) {
    return lookup(kind, id) || 'unknown';
  }

  function has(name) { return !!ICONS[name]; }

  global.Icons = {
    ICONS: ICONS,
    markup: markup, node: node, forContent: forContent, has: has,
    names: function () { return Object.keys(ICONS); },
    maps: {
      charm: CHARM_ICONS, boss: BOSS_ICONS, omen: OMEN_ICONS,
      voucher: VOUCHER_ICONS, tag: TAG_ICONS, deck: DECK_ICONS,
      category: CATEGORY_ICONS, enh: ENH_ICONS
    }
  };
})(window);
