/* ORRERY engine — scroll lerp, scrub registry, pointer, cursor, text utilities.
   Zero dependencies. Everything hangs off window.ORR. */
(function () {
  'use strict';
  const ORR = (window.ORR = window.ORR || {});
  const doc = document.documentElement;

  /* ---------- environment ---------- */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  ORR.reduced = reduced;
  ORR.touch = touch;

  /* ---------- math ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const map = (v, a, b, c, d) => c + (d - c) * ((v - a) / (b - a));
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = {
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutQuint: t => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
    outQuart: t => 1 - Math.pow(1 - t, 4),
  };
  ORR.u = { lerp, clamp, damp, map, smoothstep, ease };

  /* ---------- viewport ---------- */
  const vp = (ORR.vp = { w: window.innerWidth, h: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) });

  /* ---------- pointer ---------- */
  const pointer = (ORR.pointer = {
    x: vp.w / 2, y: vp.h / 2,     // raw, viewport px
    sx: vp.w / 2, sy: vp.h / 2,   // smoothed
    nx: 0, ny: 0,                 // normalized -1..1
    snx: 0, sny: 0,
    down: false, active: false, inside: true,
    vx: 0, vy: 0,                 // velocity px/s (smoothed)
  });
  let lastPX = pointer.x, lastPY = pointer.y;
  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; pointer.inside = true;
    pointer.nx = (e.clientX / vp.w) * 2 - 1; pointer.ny = (e.clientY / vp.h) * 2 - 1;
  }, { passive: true });
  window.addEventListener('pointerdown', e => { pointer.down = true; ORR.emit('pointerdown', e); }, { passive: true });
  // touch: a finger counts as a live pointer only while it is on the glass
  const setTouch = t => { pointer.x = t.clientX; pointer.y = t.clientY; pointer.nx = (t.clientX / vp.w) * 2 - 1; pointer.ny = (t.clientY / vp.h) * 2 - 1; };
  window.addEventListener('touchstart', e => { if (e.touches[0]) { pointer.touchActive = true; setTouch(e.touches[0]); } }, { passive: true });
  window.addEventListener('touchmove', e => { if (e.touches[0]) setTouch(e.touches[0]); }, { passive: true });
  window.addEventListener('touchend', e => { if (!e.touches.length) pointer.touchActive = false; }, { passive: true });
  window.addEventListener('touchcancel', () => { pointer.touchActive = false; }, { passive: true });
  ORR.pointerLive = () => (touch ? !!pointer.touchActive : (pointer.active && pointer.inside));
  window.addEventListener('pointerup', () => { pointer.down = false; }, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.inside = false; });
  document.addEventListener('mouseenter', () => { pointer.inside = true; });

  /* ---------- tiny event bus ---------- */
  const listeners = {};
  ORR.on = (name, fn) => ((listeners[name] = listeners[name] || []).push(fn), () => ORR.off(name, fn));
  ORR.off = (name, fn) => { const l = listeners[name]; if (l) l.splice(l.indexOf(fn) >>> 0, 1); };
  ORR.emit = (name, data) => { const l = listeners[name]; if (l) for (const fn of l.slice()) fn(data); };

  /* ---------- scroll engine (Lenis-style lerp on native scroll) ---------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);
  if (document.body.classList.contains('is-loading')) doc.classList.add('is-loading');
  const scroll = (ORR.scroll = {
    y: window.scrollY, target: window.scrollY, max: 0,
    vel: 0, svel: 0, nvel: 0, dir: 1,
    lock: true, smooth: !reduced && !touch, lambda: 7.5,
  });
  function measureMax() { scroll.max = Math.max(0, doc.scrollHeight - vp.h); }
  measureMax();

  window.addEventListener('wheel', e => {
    if (!scroll.smooth || e.ctrlKey) return;
    e.preventDefault();
    if (scroll.lock) return;
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 40; else if (e.deltaMode === 2) d *= vp.h;
    d = clamp(d, -vp.h, vp.h);
    scroll.target = clamp(scroll.target + d, 0, scroll.max);
  }, { passive: false });

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (Math.abs(y - scroll.y) > 2) { scroll.y = scroll.target = y; } // keyboard / scrollbar / touch / anchor
  }, { passive: true });

  ORR.scrollTo = (y, immediate) => {
    scroll.target = clamp(y, 0, scroll.max);
    if (immediate) { scroll.y = scroll.target; window.scrollTo(0, scroll.y); }
    else if (!scroll.smooth) { try { window.scrollTo({ top: scroll.target, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, scroll.target); } }
  };
  ORR.unlock = () => { scroll.lock = false; };

  /* ---------- scrub registry ---------- */
  const scrubs = [];
  function measureScrub(s) {
    const r = s.el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    if (s.opts.pin) { s.start = top; s.end = top + r.height - vp.h; }
    else {
      const so = s.opts.start || 0, eo = s.opts.end || 0;   // fractions of viewport height
      s.start = top - vp.h * (1 - so); s.end = top + r.height - vp.h * eo;
    }
    if (s.end <= s.start) s.end = s.start + 1;
  }
  ORR.scrub = (el, fn, opts) => {
    const s = { el, fn, opts: opts || {}, start: 0, end: 1, p: -1 };
    scrubs.push(s); measureScrub(s); return s;
  };
  ORR.progressOf = el => {
    const r = el.getBoundingClientRect();
    return clamp((vp.h - r.top) / (vp.h + r.height), 0, 1);
  };

  /* ---------- frame loop ---------- */
  const tickers = new Set();
  ORR.onFrame = fn => { tickers.add(fn); return () => tickers.delete(fn); };
  let last = performance.now();
  let frames = 0;
  ORR.time = 0;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1; if (dt <= 0) dt = 0.0001;
    ORR.time += dt; frames++;

    // scroll
    const prevY = scroll.y;
    if (scroll.smooth) {
      if (Math.abs(scroll.target - scroll.y) > 0.05) {
        scroll.y = damp(scroll.y, scroll.target, scroll.lambda, dt);
        if (Math.abs(scroll.target - scroll.y) < 0.05) scroll.y = scroll.target;
        window.scrollTo(0, scroll.y);
      }
    } else { scroll.y = window.scrollY; }
    const vel = (scroll.y - prevY) / dt;
    scroll.vel = vel;
    scroll.svel = damp(scroll.svel, vel, 9, dt);
    scroll.nvel = clamp(scroll.svel / 2600, -1, 1);
    if (Math.abs(vel) > 1) scroll.dir = vel > 0 ? 1 : -1;

    // pointer
    pointer.sx = damp(pointer.sx, pointer.x, 11, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 11, dt);
    pointer.snx = damp(pointer.snx, pointer.nx, 6, dt);
    pointer.sny = damp(pointer.sny, pointer.ny, 6, dt);
    pointer.vx = damp(pointer.vx, (pointer.x - lastPX) / dt, 10, dt);
    pointer.vy = damp(pointer.vy, (pointer.y - lastPY) / dt, 10, dt);
    lastPX = pointer.x; lastPY = pointer.y;

    // scrubs
    for (let i = 0; i < scrubs.length; i++) {
      const s = scrubs[i];
      const p = clamp((scroll.y - s.start) / (s.end - s.start), 0, 1);
      if (p !== s.p || s.opts.always) { s.p = p; s.fn(p, s, dt); }
    }
    for (const fn of tickers) fn(dt, ORR.time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- resize / relayout ---------- */
  let resizeT = 0;
  function relayout() {
    vp.w = window.innerWidth; vp.h = window.innerHeight;
    measureMax();
    for (const s of scrubs) measureScrub(s);
    ORR.emit('resize', vp);
  }
  ORR.relayout = relayout;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(relayout, 120); });
  if (window.ResizeObserver) {
    let h = 0;
    new ResizeObserver(() => { const nh = doc.scrollHeight; if (nh !== h) { h = nh; measureMax(); for (const s of scrubs) measureScrub(s); } }).observe(document.body);
  }

  /* ---------- reveal ---------- */
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  ORR.reveal = el => { if (reduced) el.classList.add('is-in'); else io.observe(el); };

  /* ---------- split text ---------- */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  ORR.split = (el, mode) => {
    mode = mode || 'chars';
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', label);
    let i = 0, html = '';
    const walk = node => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          for (const w of parts) {
            if (!w) continue;
            if (/^\s+$/.test(w)) { html += ' '; continue; }
            if (mode === 'words') html += `<span class="w"><span class="w__i" style="--i:${i++}">${esc(w)}</span></span>`;
            else html += `<span class="w">${Array.from(w).map(ch => `<span class="c" style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`;
          }
        } else if (child.nodeType === 1) {
          const tag = child.tagName.toLowerCase(); const cls = child.getAttribute('class');
          html += `<${tag}${cls ? ` class="${esc(cls)}"` : ''}>`; walk(child); html += `</${tag}>`;
        }
      }
    };
    walk(el);
    el.innerHTML = html;
    el.querySelectorAll('.w').forEach(s => s.setAttribute('aria-hidden', 'true'));
    el.style.setProperty('--n', i);
    el.dataset.splitCount = i;
    return el;
  };

  /* ---------- scramble ---------- */
  const CH = 'ORRERY0123456789·—◇ΔΩ';
  ORR.scramble = (el, text, dur) => {
    dur = dur || 900;
    text = text != null ? text : (el.dataset.text || el.textContent);
    if (reduced) { el.textContent = text; return; }
    const start = performance.now(); const len = text.length;
    el.__scr = start;
    const step = now => {
      if (el.__scr !== start) return;
      const t = clamp((now - start) / dur, 0, 1); let out = '';
      for (let i = 0; i < len; i++) {
        const ch = text[i];
        if (ch === ' ' || ch === '\n') { out += ch; continue; }
        out += t >= (i / len) * 0.8 + 0.12 ? ch : CH[(Math.random() * CH.length) | 0];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(step); else el.textContent = text;
    };
    requestAnimationFrame(step);
  };

  /* ---------- counters ---------- */
  ORR.countTo = (el, to, dur, decimals) => {
    const from = parseFloat(el.textContent) || 0; const start = performance.now();
    dur = dur || 1600; decimals = decimals || 0;
    const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (reduced) { el.textContent = fmt(to); return; }
    const step = now => {
      const t = clamp((now - start) / dur, 0, 1);
      el.textContent = fmt(from + (to - from) * ease.outExpo(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- custom cursor ---------- */
  if (!touch) {
    const cur = document.querySelector('.cursor');
    if (cur) {
      const dot = cur.querySelector('.cursor__dot');
      const ring = cur.querySelector('.cursor__ring');
      const label = cur.querySelector('.cursor__label');
      let hoverEl = null, rx = pointer.x, ry = pointer.y;
      const SEL = '[data-cursor], a, button, input, textarea, select, label, .magnetic';
      document.body.classList.add('has-cursor');
      document.addEventListener('mouseover', e => {
        const t = e.target.closest && e.target.closest(SEL);
        if (!t) return;
        hoverEl = t;
        const l = t.getAttribute('data-cursor');
        label.textContent = l || '';
        cur.classList.toggle('has-label', !!l);
        cur.classList.toggle('is-text', t.matches('input, textarea'));
        cur.classList.add('is-hover');
      });
      document.addEventListener('mouseout', e => {
        const t = e.target.closest && e.target.closest(SEL);
        if (t && t === hoverEl) { hoverEl = null; cur.classList.remove('is-hover', 'has-label', 'is-text'); }
      });
      window.addEventListener('pointermove', () => cur.classList.remove('is-hidden'), { once: true });
      document.addEventListener('mouseleave', () => cur.classList.add('is-hidden'));
      document.addEventListener('mouseenter', () => cur.classList.remove('is-hidden'));
      window.addEventListener('pointerdown', () => cur.classList.add('is-down'), { passive: true });
      window.addEventListener('pointerup', () => cur.classList.remove('is-down'), { passive: true });
      ORR.onFrame(dt => {
        rx = damp(rx, pointer.x, 16, dt); ry = damp(ry, pointer.y, 16, dt);
        const speed = Math.hypot(pointer.vx, pointer.vy);
        const k = hoverEl ? 0 : clamp(speed / 6000, 0, 0.35);
        const press = pointer.down ? 0.82 : 1;
        const upright = cur.classList.contains('has-label') || cur.classList.contains('is-text'); // labels and the caret never rotate
        const ang = upright ? 0 : Math.atan2(pointer.vy, pointer.vx) * 180 / Math.PI;
        const kk = upright ? 0 : k;
        dot.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0) scale(${pointer.down ? 1.6 : 1})`;
        ring.style.transform = `translate3d(${rx}px,${ry}px,0) rotate(${ang.toFixed(1)}deg) scale(${((1 + kk) * press).toFixed(3)}, ${((1 - kk * 0.5) * press).toFixed(3)})`;
      });
    }
  }

  /* ---------- magnetic elements ---------- */
  ORR.magnetize = (els) => {
    if (touch) return;
    const items = Array.from(els).map(el => ({ el, label: el.querySelector('.btn__label'), x: 0, y: 0 }));
    ORR.onFrame(dt => {
      const rects = items.map(it => it.el.getBoundingClientRect()); // all reads before any write
      for (let i = 0; i < items.length; i++) {
        const it = items[i], r = rects[i];
        if (r.bottom < -100 || r.top > vp.h + 100) { if (it.x || it.y) { it.x = it.y = 0; it.el.style.transform = ''; if (it.label) it.label.style.transform = ''; } continue; }
        const cx = r.left + r.width / 2 - it.x, cy = r.top + r.height / 2 - it.y; // rest position, not the pulled one
        const dx = pointer.x - cx, dy = pointer.y - cy;
        const R = Math.max(r.width, r.height) * 0.85 + 36;
        const d = Math.hypot(dx, dy);
        let tx = 0, ty = 0;
        if (d < R && pointer.inside) { const f = 1 - smoothstep(R * 0.55, R, d); tx = dx * 0.42 * f; ty = dy * 0.42 * f; }
        it.x = damp(it.x, tx, 14, dt); it.y = damp(it.y, ty, 14, dt);
        it.el.style.transform = `translate3d(${it.x.toFixed(2)}px,${it.y.toFixed(2)}px,0)`;
        if (it.label) it.label.style.transform = `translate3d(${(it.x * 0.35).toFixed(2)}px,${(it.y * 0.35).toFixed(2)}px,0)`;
      }
    });
  };

  /* ---------- colour helpers ---------- */
  ORR.hexToRgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
})();
