/* ORRERY — page wiring */
(function () {
  'use strict';
  const ORR = window.ORR; const u = ORR.u;
  const $ = s => document.querySelector(s); const $$ = s => Array.from(document.querySelectorAll(s));
  const reduced = ORR.reduced, touch = ORR.touch;
  const isMobile = () => window.innerWidth <= 900;
  const P = ORR.pointer, SC = ORR.scroll, VP = ORR.vp;

  /* =====================================================================
     Text: split headings, manifesto scrub, reveals
     ===================================================================== */
  const heroTitle = $('#heroTitle');
  ORR.split(heroTitle, 'chars');
  for (const sel of ['.anatomy__title', '.collection__title', '.planetarium__title', '.atelier__title', '.reserve__title']) {
    const el = $(sel); if (!el) continue;
    ORR.split(el, 'words'); el.classList.add('split-lines'); el.removeAttribute('data-reveal'); ORR.reveal(el);
  }
  const manifesto = $('#manifestoText');
  ORR.split(manifesto, 'words');
  if (reduced) manifesto.style.setProperty('--p', 1);
  else ORR.scrub(manifesto, p => manifesto.style.setProperty('--p', p.toFixed(4)), { start: 0.28, end: 0.5 });
  $$('[data-reveal]').forEach(ORR.reveal);
  const wordmark = $('.footer__wordmark'); if (wordmark) ORR.reveal(wordmark);

  /* =====================================================================
     Hero: shader, watch, title repulsion
     ===================================================================== */
  const hero = $('#top'), heroInner = $('.hero__inner'), heroCanvas = $('#heroGL');
  const gl = ORR.initHeroGL(heroCanvas);
  if (!gl) heroCanvas.style.display = 'none';
  let heroVisible = true;
  new IntersectionObserver(en => { heroVisible = en[0].isIntersecting; gl && gl.setVisible(heroVisible); }, { threshold: 0 }).observe(hero);
  hero.addEventListener('pointerdown', e => { if (gl && !e.target.closest('a, button')) gl.ripple(e.clientX, e.clientY, 1); });

  const heroWatchWrap = $('#heroWatch');
  const heroWatch = ORR.makeWatch('perihelion');
  heroWatchWrap.appendChild(heroWatch);
  ORR.animateWatch(heroWatch);
  const heroGlare = heroWatch.querySelector('.glare');
  const heroChars = Array.from(heroTitle.querySelectorAll('.c'));
  let titleSettled = false;

  let heroOver = 0; const measureHero = () => { heroOver = Math.max(0, hero.offsetHeight - VP.h); }; measureHero(); ORR.on('resize', measureHero);
  ORR.onFrame((dt, t) => {
    const hp = u.clamp((SC.y - heroOver) / VP.h, 0, 1); // fade starts once the hero's own bottom has reached the viewport
    if (gl) { gl.setScroll(hp); gl.render(dt); }
    if (!heroVisible) return;
    if (!reduced) {
      heroInner.style.transform = `translate3d(0, ${(hp * VP.h * 0.32).toFixed(1)}px, 0)`;
      heroInner.style.opacity = (1 - hp * 1.25).toFixed(3);
    }
    // watch tilt + float
    const rx = -P.sny * 11 + Math.sin(t * 0.7) * 1.5, ry = P.snx * 15 + Math.cos(t * 0.5) * 1.5;
    heroWatch.style.transform = reduced ? '' : `translate3d(0, ${(Math.sin(t * 0.8) * 8).toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    if (heroGlare) { const gx = 380 + P.snx * 140, gy = 300 + P.sny * 120; heroGlare.setAttribute('cx', gx.toFixed(1)); heroGlare.setAttribute('cy', gy.toFixed(1)); heroGlare.setAttribute('transform', `rotate(-32 ${gx.toFixed(1)} ${gy.toFixed(1)})`); }
    // letters flee the cursor
    if (titleSettled && !touch) {
      for (const c of heroChars) {
        const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = cx - P.x, dy = cy - P.y; const d = Math.hypot(dx, dy); const R = 300;
        let tx = 0, ty = 0, rot = 0;
        if (d < R) { const f = (1 - d / R); const f2 = f * f; tx = (dx / d) * f2 * 46; ty = (dy / d) * f2 * 46; rot = (dx / d) * f2 * -6; }
        c.__x = u.damp(c.__x || 0, tx, 10, dt); c.__y = u.damp(c.__y || 0, ty, 10, dt); c.__r = u.damp(c.__r || 0, rot, 10, dt);
        c.style.transform = `translate3d(${c.__x.toFixed(2)}px, ${c.__y.toFixed(2)}px, 0) rotate(${c.__r.toFixed(2)}deg)`;
      }
    }
  });

  /* =====================================================================
     Section grounds (measured early: the loader needs them)
     ===================================================================== */
  const sections = $$('[data-bg]').map(el => ({ el, rgb: ORR.hexToRgb(el.dataset.bg), top: 0 }));
  let bg = sections[0].rgb.slice();
  function measureSections() { for (const s of sections) s.top = s.el.getBoundingClientRect().top + window.scrollY; }
  measureSections(); ORR.on('resize', measureSections);
  if (gl) ORR.on('resize', gl.resize);
  const inertWhileLoading = [$('#nav'), $('#main'), $('.footer')].filter(Boolean);
  for (const el of inertWhileLoading) { try { el.inert = true; } catch (e) { /* older engines */ } }

  /* =====================================================================
     Loader
     ===================================================================== */
  const loader = $('#loader'), lCount = $('#loaderCount'), lStatus = $('#loaderStatus'), lArc = loader.querySelector('.loader__arc'), lPlanet = loader.querySelector('.loader__planet');
  const MSG = ['Calibrating escapement', 'Polishing the bevels', 'Setting the planets', 'Regulating the balance', 'Sealing the case'];
  const fontsReady = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());
  const minWait = new Promise(r => setTimeout(r, reduced ? 0 : 2000));
  function finishLoader() {
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading'); document.documentElement.classList.remove('is-loading');
    for (const el of inertWhileLoading) { try { el.inert = false; } catch (e) { /* ignore */ } }
    ORR.unlock(); ORR.relayout(); measureSections(); measureTrack();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) ORR.scrollTo(t.getBoundingClientRect().top + window.scrollY, true); }
    heroTitle.classList.add('is-in');
    ORR.scramble($('#heroEyebrow'), null, 1200);
    setTimeout(() => { titleSettled = true; heroTitle.classList.add('is-settled'); }, reduced ? 0 : 2400);
    setTimeout(() => loader.classList.add('is-gone'), reduced ? 0 : 1300);
    if (gl) gl.setIntro(1);
  }
  if (reduced) { setTimeout(finishLoader, 0); } // deferred so every const below is initialised first
  else {
    const start = performance.now(), dur = 1900; let mi = -1;
    (function step(now) {
      const t = u.clamp((now - start) / dur, 0, 1), e = u.ease.inOutCubic(t);
      lCount.textContent = String(Math.round(e * 100)).padStart(3, '0');
      lArc.style.strokeDashoffset = (339.3 * (1 - e)).toFixed(1);
      lPlanet.style.transform = `rotate(${(e * 360).toFixed(1)}deg)`;
      const m = Math.min(MSG.length - 1, Math.floor(t * MSG.length));
      if (m !== mi) { mi = m; ORR.scramble(lStatus, MSG[m], 520); }
      if (t < 1) requestAnimationFrame(step);
    })(start);
    Promise.all([Promise.race([fontsReady, new Promise(r => setTimeout(r, 3500))]), minWait]).then(() => setTimeout(finishLoader, 150));
  }

  /* =====================================================================
     Nav: clock, hide on scroll, scramble, anchors, menu, sound
     ===================================================================== */
  const nav = $('#nav'), navTime = $('#navTime');
  const fmtTime = tz => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const gvaFmt = fmtTime('Europe/Zurich');
  const clocks = $$('.clock').map(el => ({ el: el.querySelector('.clock__time'), f: fmtTime(el.dataset.tz) }));
  function tickClocks() {
    const d = new Date();
    navTime.textContent = 'GVA ' + gvaFmt.format(d);
    for (const c of clocks) c.el.textContent = c.f.format(d);
  }
  tickClocks(); setInterval(tickClocks, 1000);

  let navPrevY = SC.y, navDown = 0, navUp = 0, navHidden = false;
  ORR.onFrame(() => {
    const dy = SC.y - navPrevY; navPrevY = SC.y;
    if (dy > 0) { navDown += dy; navUp = 0; } else if (dy < 0) { navUp -= dy; navDown = 0; }
    if (SC.y < 140 || document.body.classList.contains('menu-open')) navHidden = false;
    else if (navDown > 80) navHidden = true;
    else if (navUp > 40) navHidden = false;
    nav.classList.toggle('is-hidden', navHidden);
  });
  $$('[data-scramble]').forEach(a => { a.dataset.text = a.textContent; a.addEventListener('mouseenter', () => ORR.scramble(a, a.dataset.text, 600)); });

  const menu = $('#menu'), menuToggle = $('#menuToggle'), menuClose = $('#menuClose');
  function setMenu(open) {
    if (open === menu.classList.contains('is-open')) return;
    menu.classList.toggle('is-open', open); menu.setAttribute('aria-hidden', String(!open));
    menuToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open); document.documentElement.classList.toggle('menu-open', open);
    SC.lock = open;
    if (open) setTimeout(() => menuClose.focus(), 350); else menuToggle.focus();
  }
  menuToggle.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  menuClose.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1); const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault(); setMenu(false);
    const y = target.getBoundingClientRect().top + window.scrollY;
    ORR.scrollTo(y, reduced);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  }));

  // Sound: a synthesised escapement tick, opt-in
  const soundBtn = $('#soundToggle'); let audio = null, soundOn = false, lastTickSec = -1;
  function tick(strong) {
    if (!audio) return;
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain(), f = audio.createBiquadFilter();
    o.type = 'square'; o.frequency.setValueAtTime(strong ? 3200 : 2600, t);
    f.type = 'bandpass'; f.frequency.value = strong ? 3000 : 2400; f.Q.value = 8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(strong ? 0.09 : 0.06, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(f); f.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.06);
  }
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn; soundBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) { soundOn = false; soundBtn.setAttribute('aria-pressed', 'false'); } }
  });
  ORR.onFrame(() => {
    if (!soundOn || !audio) return;
    const s = Math.floor(Date.now() / 1000);
    if (s !== lastTickSec) { lastTickSec = s; tick(s % 5 === 0); }
  });

  /* =====================================================================
     Ground colour lerp + progress bar
     ===================================================================== */
  const progressBar = $('.progress i');
  ORR.onFrame(dt => {
    const y = SC.y + VP.h * 0.6; let active = sections[0];
    for (const s of sections) if (s.top <= y) active = s;
    const T = active.rgb;
    if (reduced) { bg[0] = T[0]; bg[1] = T[1]; bg[2] = T[2]; }
    else { bg[0] = u.damp(bg[0], T[0], 5, dt); bg[1] = u.damp(bg[1], T[1], 5, dt); bg[2] = u.damp(bg[2], T[2], 5, dt); }
    document.body.style.backgroundColor = `rgb(${bg[0].toFixed(1)},${bg[1].toFixed(1)},${bg[2].toFixed(1)})`;
    progressBar.style.transform = `scaleX(${SC.max ? (SC.y / SC.max).toFixed(4) : 0})`;
  });

  /* =====================================================================
     Anatomy: exploded view
     ===================================================================== */
  const ANATOMY = [
    { name: 'Sapphire crystal', desc: 'Box-domed and double anti-reflective. Nine on the Mohs scale; only diamond will cut it.' },
    { name: 'Bezel', desc: 'Hand-polished 18k gold with a 0.6 mm chamfer. One artisan, four hours, no machine.' },
    { name: 'Hands', desc: 'Dauphine hands in flame-blued steel, 0.18 mm at the tip. The seconds hand sweeps at 3 Hz.' },
    { name: 'Dial', desc: 'Muonionalusta meteorite, etched to reveal a 4.5-billion-year-old crystal pattern, then cut on the rose engine in 1,440 passes.' },
    { name: 'Planetarium module', desc: 'Six planets at their true heliocentric positions. Set once, at the atelier. One day of error in 1,142 years.' },
    { name: 'Calibre OR-01', desc: '412 components. 72-hour reserve. Free-sprung balance at 3 Hz, every interior angle bevelled by hand.' },
    { name: 'Caseback', desc: 'Sapphire exhibition back. Numbered 001 to 009 and engraved by hand in the Vallée de Joux.' },
  ];
  const stage = $('#anatomyStage');
  const layers = ORR.WATCH_LAYERS.map((name, i) => { const svg = ORR.makeLayer('perihelion', name); stage.appendChild(svg); if (name === 'hands' || name === 'module' || name === 'movement') ORR.animateWatch(svg); return { name, svg, i }; });
  const aIndex = $('#anatomyIndex'), aName = $('#anatomyName'), aDesc = $('#anatomyDesc'), aLine = $('#anatomyLine'), aList = $$('#anatomyList li'), aHint = $('.anatomy__hint');
  let aCur = -1;
  function setAnatomy(i) {
    if (i === aCur) return; aCur = i;
    aIndex.textContent = String(i + 1).padStart(2, '0');
    ORR.scramble(aName, ANATOMY[i].name, 700);
    aDesc.style.opacity = '0'; aDesc.style.transform = 'translateY(8px)';
    setTimeout(() => { aDesc.textContent = ANATOMY[i].desc; aDesc.style.transition = 'opacity .6s, transform .8s cubic-bezier(.16,1,.3,1)'; aDesc.style.opacity = '1'; aDesc.style.transform = 'none'; }, 180);
    aLine.style.transform = `scaleX(${((i + 1) / 7).toFixed(3)})`; aLine.style.transition = 'transform .8s cubic-bezier(.16,1,.3,1)';
    aList.forEach((li, k) => { li.classList.toggle('is-active', k === i); li.classList.toggle('is-past', k < i); });
  }
  setAnatomy(0);
  let stageSize = 0; ORR.on('resize', () => { stageSize = stage.offsetWidth; });
  ORR.scrub($('#anatomy'), (p, s, dt) => {
    if (!stageSize) stageSize = stage.offsetWidth || 400;
    const e = u.smoothstep(0.04, 0.5, p) * (1 - u.smoothstep(0.86, 1, p));
    const mobile = isMobile();
    const tiltX = touch ? 0 : -P.sny * 5, tiltY = touch ? 0 : P.snx * 6;
    const tilt = mobile ? 52 : 58, shrink = mobile ? 0.3 : 0.22;
    stage.style.transform = reduced ? `rotateY(-16deg) rotateX(${tilt}deg) scale(${1 - shrink})` : `rotateY(${(-16 * e + tiltY).toFixed(2)}deg) rotateX(${(tilt * e + tiltX).toFixed(2)}deg) scale(${(1 - shrink * e).toFixed(3)})`;
    const spacing = stageSize * (mobile ? 0.2 : 0.22);
    const fi = u.clamp((p - 0.16) / 0.78, 0, 0.9999) * 7; const idx = Math.floor(fi);
    for (const L of layers) {
      const z = (3 - L.i) * spacing * e;
      const active = L.i === idx;
      const dim = e > 0.6 ? (active ? 1 : 0.42) : 1;
      L.svg.style.transform = `translate3d(0,0,${z.toFixed(1)}px)`;
      L.svg.style.opacity = dim;
      L.svg.style.transition = 'opacity .5s';
    }
    setAnatomy(idx);
    aHint.classList.toggle('is-hidden', p > 0.04);
  }, { pin: true, always: true });

  /* =====================================================================
     Collection: horizontal glide, skew, card tilt
     ===================================================================== */
  const track = $('#collectionTrack'); const cards = $$('.card[data-variant]');
  for (const card of cards) {
    const w = ORR.makeWatch(card.dataset.variant); card.querySelector('.card__watch').appendChild(w); ORR.animateWatch(w);
    card.__w = w; card.__rx = 0; card.__ry = 0; card.__hover = false;
    card.addEventListener('pointerenter', () => { card.__hover = true; });
    card.addEventListener('pointerleave', () => { card.__hover = false; });
    const cta = card.querySelector('.card__cta');
    cta.addEventListener('click', () => { const y = $('#reserve').getBoundingClientRect().top + window.scrollY; ORR.scrollTo(y, reduced); setTimeout(() => $('#reserveEmail').focus({ preventScroll: true }), 900); });
  }
  const cardEnquire = $('.card--end .btn');
  ORR.onFrame(dt => {
    for (const card of cards) {
      let tx = 0, ty = 0;
      if (card.__hover && !touch) { const r = card.getBoundingClientRect(); tx = ((P.y - r.top) / r.height - 0.5) * -18; ty = ((P.x - r.left) / r.width - 0.5) * 22; }
      card.__rx = u.damp(card.__rx, tx, 8, dt); card.__ry = u.damp(card.__ry, ty, 8, dt);
      card.__s = u.damp(card.__s || 1, card.__hover && !touch ? 1.045 : 1, 6, dt);
      if (Math.abs(card.__rx) > 0.01 || Math.abs(card.__ry) > 0.01 || Math.abs(card.__s - 1) > 0.001) card.__w.style.transform = `rotateX(${card.__rx.toFixed(2)}deg) rotateY(${card.__ry.toFixed(2)}deg) scale(${card.__s.toFixed(4)})`;
    }
  });
  let trackMax = 0;
  function measureTrack() { const pr = parseFloat(getComputedStyle(track).paddingRight) || 0; trackMax = Math.max(0, track.scrollWidth + pr - VP.w); }
  ORR.on('resize', measureTrack); setTimeout(measureTrack, 50);
  ORR.scrub($('#collection'), (p) => {
    if (isMobile()) { track.style.transform = ''; return; }
    if (!trackMax) measureTrack();
    const x = -trackMax * u.clamp((p - 0.05) / 0.92, 0, 1);
    const skew = reduced ? 0 : -SC.nvel * 7;
    track.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
    for (let i = 0; i < cards.length; i++) { const inner = cards[i].querySelector('.card__watch'); inner.style.transform = reduced ? '' : `translate3d(${(SC.nvel * -26).toFixed(1)}px,0,0)`; }
  }, { pin: true, always: true });

  /* =====================================================================
     Planetarium
     ===================================================================== */
  const plCanvas = $('#planetariumCanvas');
  const planetarium = ORR.initPlanetarium(plCanvas, { epoch: $('#hudEpoch'), rate: $('#hudRate'), lon: $('#hudLon') });
  new IntersectionObserver(en => planetarium.setVisible(en[0].isIntersecting), { threshold: 0 }).observe($('#planetarium'));
  ORR.on('resize', planetarium.resize);
  ORR.onFrame(dt => planetarium.render(dt));

  /* =====================================================================
     Counters
     ===================================================================== */
  const cio = new IntersectionObserver(en => { for (const e of en) if (e.isIntersecting) { const el = e.target; ORR.countTo(el, parseFloat(el.dataset.count), 1800 + Math.random() * 600, parseInt(el.dataset.decimals || '0', 10)); cio.unobserve(el); } }, { threshold: 0.5 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* =====================================================================
     Guilloché engine
     ===================================================================== */
  (function initGuilloche() {
    const canvas = $('#guillocheCanvas'); const ctx = canvas.getContext('2d');
    let w = 1, h = 1, dpr = 1, visible = false, phase = 0, mx = -1e4, my = -1e4, press = 0;
    function resize() { const r = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2); w = Math.max(1, r.width); h = Math.max(1, r.height); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    resize(); ORR.on('resize', resize);
    new IntersectionObserver(en => { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(canvas);
    ORR.onFrame((dt, t) => {
      if (!visible || document.hidden) return;
      const r = canvas.getBoundingClientRect();
      const inside = ORR.pointerLive() && P.x >= r.left && P.x <= r.right && P.y >= r.top && P.y <= r.bottom;
      const tx = inside ? P.x - r.left : w / 2, ty = inside ? P.y - r.top : h / 2;
      mx = mx < -5e3 ? tx : u.damp(mx, tx, 8, dt); my = my < -5e3 ? ty : u.damp(my, ty, 8, dt);
      press = u.damp(press, inside ? 1 : 0, 4, dt);
      phase += dt * (0.25 + Math.abs(SC.svel) * 0.0008);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0a0907'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();
      const sig = R * 0.38, amp = R * 0.08 * press;
      const fam = [{ n: 46, waves: 36, a: 0.012, alpha: 0.30, r0: 0.08, r1: 0.95 }, { n: 22, waves: 11, a: 0.03, alpha: 0.13, r0: 0.2, r1: 0.9 }];
      for (const F of fam) {
        ctx.strokeStyle = `rgba(201,164,92,${F.alpha})`; ctx.lineWidth = 0.8;
        for (let i = 0; i < F.n; i++) {
          const rr = R * (F.r0 + (F.r1 - F.r0) * i / (F.n - 1));
          const N = 200; ctx.beginPath();
          for (let k = 0; k <= N; k++) {
            const th = (k / N) * Math.PI * 2;
            const wave = rr + R * F.a * Math.sin(F.waves * th + i * 0.5 + phase * (i % 2 ? 1 : -1));
            let x = cx + wave * Math.cos(th), y = cy + wave * Math.sin(th);
            const dx = x - mx, dy = y - my; const d2 = dx * dx + dy * dy; const g = Math.exp(-d2 / (sig * sig)) * amp; const d = Math.sqrt(d2) || 1;
            x += (dx / d) * g; y += (dy / d) * g;
            if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      }
      // the stylus
      if (press > 0.02) { ctx.strokeStyle = `rgba(241,212,140,${(0.6 * press).toFixed(2)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx, my, 6, 0, 6.283); ctx.stroke(); ctx.beginPath(); ctx.moveTo(mx - 14, my); ctx.lineTo(mx + 14, my); ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my + 14); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(236,230,218,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, 0, 6.283); ctx.stroke();
    });
  })();

  /* =====================================================================
     Marquee
     ===================================================================== */
  (function initMarquee() {
    const mq = $('#marquee'), tr = $('#marqueeTrack'); const base = tr.innerHTML; const perCopy = tr.children.length;
    let copies = 1, unit = 0, x = 0, visible = false;
    function fill() {
      while ((copies < 2 || tr.scrollWidth < VP.w * 2.2) && copies < 10) { tr.insertAdjacentHTML('beforeend', base); copies++; }
      unit = tr.children[perCopy].offsetLeft - tr.children[0].offsetLeft; // one full period including the gap
    }
    fill(); ORR.on('resize', fill);
    new IntersectionObserver(en => { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(mq);
    ORR.onFrame(dt => {
      if (!visible || reduced) return;
      x -= (70 + SC.svel * 0.35) * dt;
      if (x < -unit) x += unit; if (x > 0) x -= unit;
      tr.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      tr.style.fontVariationSettings = `"wght" ${Math.round(400 + Math.abs(SC.nvel) * 500)}`;
    });
  })();

  /* =====================================================================
     Reserve: glow + form
     ===================================================================== */
  const reserve = $('#reserve'), form = $('#reserveForm'), email = $('#reserveEmail'), note = $('#reserveNote'), submit = $('#reserveSubmit');
  ORR.onFrame(() => {
    const r = reserve.getBoundingClientRect(); if (r.bottom < 0 || r.top > VP.h) return;
    reserve.style.setProperty('--mx', ((P.sx - r.left) / r.width * 100).toFixed(2) + '%');
    reserve.style.setProperty('--my', ((P.sy - r.top) / r.height * 100).toFixed(2) + '%');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { ORR.scramble(note, 'That address does not look right. Try again.', 600); email.focus(); return; }
    form.classList.add('is-sent');
    ORR.scramble(submit.querySelector('.btn__label'), 'Received', 700);
    ORR.scramble(note, 'Received. Expect a letter within the month, addressed by hand.', 900);
  });

  /* =====================================================================
     Magnetic + init
     ===================================================================== */
  ORR.magnetize($$('.magnetic'));
  window.addEventListener('load', () => { ORR.relayout(); measureSections(); measureTrack(); });
  const pageTitle = document.title;
  document.addEventListener('visibilitychange', () => { document.title = document.hidden ? 'Still keeping time — Orrery' : pageTitle; });
})();
