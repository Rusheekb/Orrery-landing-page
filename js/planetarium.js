/* ORRERY — planetarium: six planets on true relative orbits, a cursor that bends
   space, and the Earth–Venus pentagram drawn over time onto a persistent trail. */
(function () {
  'use strict';
  const ORR = (window.ORR = window.ORR || {});
  const PL = [
    { n: 'Mercury', a: 0.387, T: 0.2408, r: 2.2, c: '#d2c9bb', ph: 3.1 },
    { n: 'Venus',   a: 0.723, T: 0.6152, r: 3.6, c: '#f0ddb2', ph: 1.1 },
    { n: 'Earth',   a: 1.000, T: 1.0000, r: 3.9, c: '#9ec0ea', ph: 0.2 },
    { n: 'Mars',    a: 1.524, T: 1.8809, r: 2.8, c: '#d6906a', ph: 4.0 },
    { n: 'Jupiter', a: 5.203, T: 11.862, r: 9.0, c: '#dcc7a3', ph: 2.3 },
    { n: 'Saturn',  a: 9.537, T: 29.457, r: 7.4, c: '#e6d7b4', ph: 5.2, ring: true },
  ];
  const YEAR_S = 31557600;

  ORR.initPlanetarium = function (canvas, hud) {
    const ctx = canvas.getContext('2d');
    const trail = document.createElement('canvas');
    const tctx = trail.getContext('2d');
    const S = { w: 1, h: 1, dpr: 1, cx: 0, cy: 0, R: 100, t: 2026.8, lastLine: 0, mx: -1e4, my: -1e4, tmx: -1e4, tmy: -1e4, visible: false, stars: [], rate: 0.16, lastHud: 0, frame: 0 };
    const u = ORR.u;

    for (let i = 0; i < 320; i++) S.stars.push({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.3, a: 0.15 + Math.random() * 0.6, d: 0.3 + Math.random() * 0.7, tw: Math.random() * 6.28 });

    function resize() {
      const r = canvas.getBoundingClientRect();
      S.dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
      canvas.width = Math.round(S.w * S.dpr); canvas.height = Math.round(S.h * S.dpr);
      trail.width = canvas.width; trail.height = canvas.height;
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); tctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      const mobile = S.w <= 900;
      const inner = canvas.parentElement && canvas.parentElement.querySelector('.planetarium__inner');
      const band = mobile ? ((inner && parseFloat(getComputedStyle(inner).paddingBottom)) || S.h * 0.5) : 0; // the strip reserved for the orrery under the copy
      S.cx = mobile ? S.w * 0.5 : S.w * 0.64;
      S.cy = mobile ? S.h - band * 0.5 : S.h * 0.52;
      S.R = mobile ? Math.min(S.w * 0.44, band * 0.4) : Math.min(S.w * 0.3, S.h * 0.42);
    }
    resize();

    const orbitR = a => S.R * (0.2 + 0.8 * Math.sqrt(a / 9.537));
    function warp(x, y) {
      const dx = x - S.mx, dy = y - S.my; const d2 = dx * dx + dy * dy; const sig = S.R * 0.5;
      const f = 0.45 / (d2 / (sig * sig) + 1);
      return [x - dx * f, y - dy * f];
    }
    function planetPos(p, t) {
      const ang = p.ph + (t / p.T) * Math.PI * 2; const r = orbitR(p.a);
      return [S.cx + r * Math.cos(ang), S.cy + r * Math.sin(ang) * 0.985];
    }

    function render(dt) {
      if (!S.visible || document.hidden) return;
      const P = ORR.pointer; const rect = canvas.getBoundingClientRect();
      const inside = ORR.pointerLive() && P.x >= rect.left && P.x <= rect.right && P.y >= rect.top && P.y <= rect.bottom;
      S.tmx = inside ? P.x - rect.left : -1e4; S.tmy = inside ? P.y - rect.top : -1e4;
      if (S.tmx < -5e3) { S.mx = u.damp(S.mx, S.tmx, 2.5, dt); S.my = u.damp(S.my, S.tmy, 2.5, dt); }
      else if (S.mx < -5e3) { S.mx = S.tmx; S.my = S.tmy; }
      else { S.mx = u.damp(S.mx, S.tmx, 7, dt); S.my = u.damp(S.my, S.tmy, 7, dt); }

      const sv = Math.abs(ORR.scroll.svel);
      S.rate = u.damp(S.rate, 0.16 + sv * 0.0006, 3, dt);
      const prevT = S.t; S.t += dt * S.rate;

      // Earth–Venus chord onto the trail
      if (S.t - S.lastLine > 0.0045) {
        S.lastLine = S.t;
        const e = warp(...planetPos(PL[2], S.t)), v = warp(...planetPos(PL[1], S.t));
        tctx.globalCompositeOperation = 'source-over';
        tctx.strokeStyle = 'rgba(201,164,92,0.3)'; tctx.lineWidth = 0.7;
        tctx.beginPath(); tctx.moveTo(e[0], e[1]); tctx.lineTo(v[0], v[1]); tctx.stroke();
      }
      // 8-bit alpha cannot fade by 0.6% a frame, so fade a little every 30 frames instead
      if (++S.frame % 30 === 0) { tctx.globalCompositeOperation = 'destination-out'; tctx.fillStyle = 'rgba(0,0,0,0.03)'; tctx.fillRect(0, 0, S.w, S.h); }

      ctx.clearRect(0, 0, S.w, S.h);
      // stars
      const px = P.snx * 14, py = P.sny * 14;
      for (const s of S.stars) {
        const tw = 0.6 + 0.4 * Math.sin(ORR.time * 1.3 + s.tw);
        ctx.globalAlpha = s.a * tw; ctx.fillStyle = '#ece6da';
        ctx.beginPath(); ctx.arc(s.x * S.w - px * s.d, s.y * S.h - py * s.d, s.s, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(trail, 0, 0, S.w, S.h);

      // orbits (bent)
      for (let i = 0; i < PL.length; i++) {
        const p = PL[i]; const r = orbitR(p.a); const N = 160;
        ctx.beginPath();
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * Math.PI * 2; const [x, y] = warp(S.cx + r * Math.cos(a), S.cy + r * Math.sin(a) * 0.985);
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = i === 2 ? 'rgba(201,164,92,0.5)' : 'rgba(236,230,218,0.16)'; ctx.lineWidth = i === 2 ? 1 : 0.8; ctx.stroke();
      }
      // sun
      const [sx, sy] = warp(S.cx, S.cy);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, S.R * 0.16);
      g.addColorStop(0, 'rgba(255,242,194,1)'); g.addColorStop(0.25, 'rgba(241,212,140,0.9)'); g.addColorStop(1, 'rgba(201,164,92,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, S.R * 0.16, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 6.283); ctx.fill();
      // planets
      ctx.font = '500 9px "Geist Mono", "DM Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle';
      for (const p of PL) {
        const [x, y] = warp(...planetPos(p, S.t));
        const gg = ctx.createRadialGradient(x, y, 0, x, y, p.r * 4);
        gg.addColorStop(0, p.c); gg.addColorStop(0.3, p.c + '66'); gg.addColorStop(1, p.c + '00');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, p.r * 4, 0, 6.283); ctx.fill();
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
        if (p.ring) { ctx.strokeStyle = p.c; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y, p.r * 2.1, p.r * 0.7, -0.4, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.fillStyle = 'rgba(236,230,218,0.55)'; ctx.fillText(p.n.toUpperCase(), x + p.r + 7, y);
      }
      // cursor anomaly marker
      if (S.mx > -5e3) {
        ctx.strokeStyle = 'rgba(201,164,92,0.35)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(S.mx, S.my, S.R * 0.5, 0, 6.283); ctx.stroke();
        ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.arc(S.mx, S.my, S.R * 0.5 * (1 + 0.08 * Math.sin(ORR.time * 2)), 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      }
      // HUD
      if (hud && ORR.time - S.lastHud > 0.12) {
        S.lastHud = ORR.time;
        const earthAng = ((PL[2].ph + (S.t / PL[2].T) * Math.PI * 2) * 180 / Math.PI) % 360;
        if (hud.epoch) hud.epoch.textContent = 'J' + S.t.toFixed(2);
        if (hud.rate) hud.rate.textContent = '×' + (S.rate * YEAR_S / 1e6).toFixed(2) + 'M';
        if (hud.lon) hud.lon.textContent = String(Math.round((earthAng + 360) % 360)).padStart(3, '0') + '°';
      }
      void prevT;
    }
    return { resize, render, setVisible: v => { S.visible = v; }, state: S };
  };
})();
