/* ============================================================
   fx.js — screen shake, particles, rolling counters, card tilt

   All of it is gated on Settings, so a player who wants a calm,
   still board gets one.
   ============================================================ */
(function (global) {
  'use strict';

  let canvas = null, g2d = null;
  let particles = [];
  let rafId = null;
  let shakeUntil = 0, shakePower = 0;
  let appEl = null, flashEl = null;

  function init() {
    appEl = document.getElementById('app');

    canvas = document.createElement('canvas');
    canvas.id = 'fxCanvas';
    document.body.appendChild(canvas);
    g2d = canvas.getContext('2d');

    flashEl = document.createElement('div');
    flashEl.id = 'fxFlash';
    document.body.appendChild(flashEl);

    resize();
    global.addEventListener('resize', resize);
    installTilt();
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(global.innerWidth * dpr);
    canvas.height = Math.floor(global.innerHeight * dpr);
    canvas.style.width = global.innerWidth + 'px';
    canvas.style.height = global.innerHeight + 'px';
    g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function motionOff() { return Settings.get('reducedMotion'); }

  /* ---------------------------------------------------------
     particles
     --------------------------------------------------------- */
  const PALETTE = {
    chip: ['#0090ff', '#5cc0ff', '#b9e4ff'],
    mult: ['#fe5f55', '#ff9a92', '#ffd0cc'],
    gold: ['#f0a92c', '#ffd479', '#fff0c4'],
    glass: ['#ffffff', '#cfefff', '#9fd8ff'],
    win: ['#57d17a', '#f0a92c', '#0090ff', '#fe5f55', '#ffffff']
  };

  /**
   * @param {number} x,y      viewport coordinates
   * @param {object} o        {kind, count, power, spread, gravity, life}
   */
  function burst(x, y, o) {
    if (!canvas || !Settings.get('particles') || motionOff()) return;
    o = o || {};
    const kind = o.kind || 'chip';
    const colors = PALETTE[kind] || PALETTE.chip;
    const count = Math.min(o.count || 14, 90);
    const power = o.power || 1;
    const spread = o.spread === undefined ? Math.PI * 2 : o.spread;
    const dir = o.dir === undefined ? -Math.PI / 2 : o.dir;

    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const sp = (1.6 + Math.random() * 4.2) * power;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (o.lift || 1.2),
        g: o.gravity === undefined ? 0.16 : o.gravity,
        life: (o.life || 46) * (0.6 + Math.random() * 0.8),
        age: 0,
        size: (o.size || 5) * (0.5 + Math.random()),
        color: colors[(Math.random() * colors.length) | 0],
        spin: (Math.random() - 0.5) * 0.35,
        rot: Math.random() * Math.PI,
        shape: o.shape || (kind === 'gold' ? 'circle' : 'square')
      });
    }
    start();
  }

  function burstAt(el, o) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, o);
  }

  /** Celebration shower from the top of the screen. */
  function confetti(count) {
    if (!canvas || !Settings.get('particles') || motionOff()) return;
    const n = Math.min(count || 80, 160);
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * global.innerWidth,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 1.5 + Math.random() * 3,
        g: 0.06,
        life: 200, age: 0,
        size: 4 + Math.random() * 6,
        color: PALETTE.win[(Math.random() * PALETTE.win.length) | 0],
        spin: (Math.random() - 0.5) * 0.4,
        rot: Math.random() * Math.PI,
        shape: 'square'
      });
    }
    start();
  }

  /* ---------------------------------------------------------
     shake + flash
     --------------------------------------------------------- */
  function shake(power, ms) {
    if (!Settings.get('shake') || motionOff()) return;
    shakePower = Math.max(shakePower, Math.min(power || 0.5, 1));
    shakeUntil = Math.max(shakeUntil, performance.now() + (ms || 260));
    start();
  }

  function flash(color, power) {
    if (!flashEl || motionOff()) return;
    flashEl.style.background = color || '#ffffff';
    flashEl.style.opacity = String(Math.min(power === undefined ? 0.25 : power, 0.6));
    flashEl.style.transition = 'none';
    requestAnimationFrame(function () {
      flashEl.style.transition = 'opacity 320ms ease';
      flashEl.style.opacity = '0';
    });
  }

  /* ---------------------------------------------------------
     the loop
     --------------------------------------------------------- */
  function start() { if (rafId === null) rafId = requestAnimationFrame(frame); }

  function frame() {
    rafId = null;
    const now = performance.now();

    // shake
    if (appEl) {
      if (now < shakeUntil) {
        const remain = (shakeUntil - now) / 260;
        const amp = 11 * shakePower * Math.min(remain, 1);
        const dx = (Math.random() - 0.5) * amp;
        const dy = (Math.random() - 0.5) * amp;
        const rot = (Math.random() - 0.5) * amp * 0.08;
        appEl.style.transform = 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) rotate(' + rot.toFixed(3) + 'deg)';
      } else if (appEl.style.transform) {
        appEl.style.transform = '';
        shakePower = 0;
      }
    }

    // particles
    if (g2d) {
      g2d.clearRect(0, 0, global.innerWidth, global.innerHeight);
      const alive = [];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age++;
        p.vy += p.g;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        if (p.age < p.life && p.y < global.innerHeight + 40) {
          const a = 1 - (p.age / p.life);
          g2d.save();
          g2d.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
          g2d.translate(p.x, p.y);
          g2d.rotate(p.rot);
          g2d.fillStyle = p.color;
          if (p.shape === 'circle') {
            g2d.beginPath();
            g2d.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            g2d.fill();
          } else {
            g2d.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.72);
          }
          g2d.restore();
          alive.push(p);
        }
      }
      particles = alive;
    }

    if (particles.length || now < shakeUntil) start();
  }

  function clear() {
    particles = [];
    if (g2d) g2d.clearRect(0, 0, global.innerWidth, global.innerHeight);
    if (appEl) appEl.style.transform = '';
    shakeUntil = 0; shakePower = 0;
  }

  /* ---------------------------------------------------------
     rolling number counters
     --------------------------------------------------------- */
  function countUp(el, from, to, ms, fmt) {
    if (!el) return Promise.resolve();
    const format = fmt || function (v) { return String(Math.round(v)); };
    const dur = Settings.get('reducedMotion') ? 0 : Settings.ms(ms === undefined ? 420 : ms);
    if (dur <= 0) { el.textContent = format(to); return Promise.resolve(); }
    return new Promise(function (resolve) {
      const t0 = performance.now();
      (function tick(now) {
        const t = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        el.textContent = format(from + (to - from) * e);
        if (t < 1) requestAnimationFrame(tick);
        else { el.textContent = format(to); resolve(); }
      })(t0);
    });
  }

  function pulse(el, cls) {
    if (!el || motionOff()) return;
    const c = cls || 'bump';
    el.classList.remove(c);
    void el.offsetWidth;
    el.classList.add(c);
  }

  /* ---------------------------------------------------------
     cursor-following 3D tilt for cards and dice
     --------------------------------------------------------- */
  function installTilt() {
    let current = null;

    document.addEventListener('mousemove', function (e) {
      if (motionOff()) return;
      const el = e.target && e.target.closest ? e.target.closest('.card, .die') : null;
      if (el !== current) {
        if (current) {
          current.classList.remove('tilting');
          current.style.removeProperty('--tx');
          current.style.removeProperty('--ty');
        }
        current = el;
        if (current) current.classList.add('tilting');
      }
      if (!current) return;
      const r = current.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      current.style.setProperty('--tx', (px * 18).toFixed(2) + 'deg');
      current.style.setProperty('--ty', (-py * 18).toFixed(2) + 'deg');
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      if (current) {
        current.classList.remove('tilting');
        current = null;
      }
    }, true);
  }

  Settings.on(function (key) {
    if (key === 'reducedMotion' || key === 'particles') clear();
  });

  global.FX = {
    init: init, burst: burst, burstAt: burstAt, confetti: confetti,
    shake: shake, flash: flash, countUp: countUp, pulse: pulse, clear: clear
  };
})(window);
