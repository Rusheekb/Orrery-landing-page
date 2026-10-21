/* ORRERY — procedural SVG watch. Every watch on the page is generated here:
   case, bezel, dial (with rose-engine guilloché), planetarium module, hands,
   crystal, calibre and caseback. Layers can be requested separately for the
   exploded view. ViewBox is 1000×1000, centre 500,500. */
(function () {
  'use strict';
  const ORR = (window.ORR = window.ORR || {});
  let uid = 0;
  const C = 500;

  const VARIANTS = {
    perihelion: { name: 'Perihelion', metal: ['#f6e6b8', '#c0923f', '#5c4016', '#dcb86a', '#8a6a2e'], dial: ['#1c1814', '#07070a'], dialRim: '#2a241c', hands: ['#f7e6b9', '#a67c2e'], index: '#e8cf8f', text: '#d9c28a', accent: '#f1d48c', guil: 'rgba(201,164,92,0.26)', seconds: '#f1d48c' },
    aphelion:   { name: 'Aphelion',   metal: ['#ffffff', '#b8bec9', '#565c69', '#e1e5ec', '#7d8594'], dial: ['#22304a', '#0a101b'], dialRim: '#2c3a52', hands: ['#f3f6fa', '#8d96a5'], index: '#eef2f7', text: '#c6d2e3', accent: '#dfe7f2', guil: 'rgba(190,205,230,0.24)', seconds: '#cfe3ff' },
    umbra:      { name: 'Umbra',      metal: ['#55555a', '#1a1a1e', '#050506', '#303036', '#121215'], dial: ['#17171a', '#030304'], dialRim: '#202024', hands: ['#f7e6b9', '#a67c2e'], index: '#d6bb7a', text: '#9c8a5a', accent: '#c9a45c', guil: 'rgba(201,164,92,0.16)', seconds: '#c9a45c' },
    syzygy:     { name: 'Syzygy',     metal: ['#fbe0cc', '#cd8f6b', '#6b3f2b', '#eabb9f', '#9a5f44'], dial: ['#f1e8d8', '#cdbfa6'], dialRim: '#d9ccb4', hands: ['#5a3a2a', '#2a1a12'], index: '#5a3a2a', text: '#5a4634', accent: '#b87756', guil: 'rgba(90,58,42,0.22)', seconds: '#b14d35' },
  };
  ORR.WATCH_VARIANTS = VARIANTS;

  const f1 = n => (Math.round(n * 10) / 10).toString();

  /* ---- geometry helpers ---- */
  function gearPath(cx, cy, r, teeth, depth, windows) {
    const step = (Math.PI * 2) / teeth; let d = '';
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      const pts = [[r, a], [r, a + step * 0.22], [r + depth, a + step * 0.32], [r + depth, a + step * 0.62], [r, a + step * 0.72]];
      for (const [rr, aa] of pts) { d += (d ? 'L' : 'M') + f1(cx + rr * Math.cos(aa)) + ',' + f1(cy + rr * Math.sin(aa)); }
    }
    d += 'Z';
    // cut-out windows between spokes (evenodd)
    const n = windows || 0; const wr = r * 0.52, ww = r * 0.2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const x = cx + wr * Math.cos(a), y = cy + wr * Math.sin(a);
      d += ` M${f1(x - ww)},${f1(y)} a${f1(ww)},${f1(ww)} 0 1,0 ${f1(ww * 2)},0 a${f1(ww)},${f1(ww)} 0 1,0 ${f1(-ww * 2)},0 Z`;
    }
    // hub hole
    const hr = r * 0.11;
    d += ` M${f1(cx - hr)},${f1(cy)} a${f1(hr)},${f1(hr)} 0 1,0 ${f1(hr * 2)},0 a${f1(hr)},${f1(hr)} 0 1,0 ${f1(-hr * 2)},0 Z`;
    return d;
  }
  function spiralPath(cx, cy, r0, r1, turns) {
    const N = Math.round(turns * 48); let d = '';
    for (let i = 0; i <= N; i++) { const t = i / N; const a = t * turns * Math.PI * 2; const r = r0 + (r1 - r0) * t; d += (i ? 'L' : 'M') + f1(cx + r * Math.cos(a)) + ',' + f1(cy + r * Math.sin(a)); }
    return d;
  }
  function guilloche(cx, cy, rMin, rMax, count, waves, amp, color, clipId) {
    let out = '';
    for (let i = 0; i < count; i++) {
      const r = rMin + ((rMax - rMin) * i) / (count - 1);
      const a = amp * (0.55 + 0.45 * Math.sin(i * 0.9));
      const N = 150; let d = '';
      for (let k = 0; k <= N; k++) {
        const th = (k / N) * Math.PI * 2; const rr = r + a * Math.sin(waves * th + i * 0.42);
        d += (k ? 'L' : 'M') + f1(cx + rr * Math.cos(th)) + ',' + f1(cy + rr * Math.sin(th));
      }
      out += `<path d="${d}Z"/>`;
    }
    return `<g fill="none" stroke="${color}" stroke-width="0.9"${clipId ? ` clip-path="url(#${clipId})"` : ''}>${out}</g>`;
  }
  function ring(r, w, fill, extra) { const ro = r + w / 2, ri = r - w / 2; return `<path fill-rule="evenodd" fill="${fill}" ${extra || ''} d="M${C - ro},${C} a${ro},${ro} 0 1,0 ${ro * 2},0 a${ro},${ro} 0 1,0 ${-ro * 2},0 Z M${C - ri},${C} a${ri},${ri} 0 1,0 ${ri * 2},0 a${ri},${ri} 0 1,0 ${-ri * 2},0 Z"/>`; }

  /* ---- defs per svg ---- */
  function defs(u, v) {
    const m = v.metal;
    return `<defs>
<linearGradient id="${u}-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset=".32" stop-color="${m[1]}"/><stop offset=".55" stop-color="${m[2]}"/><stop offset=".74" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[3]}"/></linearGradient>
<linearGradient id="${u}-metal2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m[3]}"/><stop offset=".3" stop-color="${m[1]}"/><stop offset=".52" stop-color="${m[0]}"/><stop offset=".75" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></linearGradient>
<linearGradient id="${u}-metal3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset=".5" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></linearGradient>
<radialGradient id="${u}-dial" cx=".5" cy=".38" r=".68"><stop offset="0" stop-color="${v.dial[0]}"/><stop offset="1" stop-color="${v.dial[1]}"/></radialGradient>
<linearGradient id="${u}-hand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${v.hands[1]}"/><stop offset=".5" stop-color="${v.hands[0]}"/><stop offset=".5" stop-color="${v.hands[1]}"/><stop offset="1" stop-color="${v.hands[0]}"/></linearGradient>
<radialGradient id="${u}-glass" cx=".34" cy=".28" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2c2"/><stop offset=".35" stop-color="#f1d48c"/><stop offset="1" stop-color="#c9a45c" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}-ruby" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ff9aa8"/><stop offset=".5" stop-color="#c8173a"/><stop offset="1" stop-color="#5a0014"/></radialGradient>
<pattern id="${u}-cotes" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="24" height="24" fill="#26262b"/><rect width="12" height="24" fill="#303037"/><rect x="11" width="1" height="24" fill="#3c3c44"/></pattern>
<pattern id="${u}-perlage" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="11" fill="none" stroke="#3a3a40" stroke-width="2"/></pattern>
<clipPath id="${u}-dialclip"><path fill-rule="evenodd" clip-rule="evenodd" d="M${C - 388},${C} a388,388 0 1,0 776,0 a388,388 0 1,0 -776,0 Z M${C - 112},655 a112,112 0 1,0 224,0 a112,112 0 1,0 -224,0 Z"/></clipPath>
<path id="${u}-arc" d="M${C},${C} m-370,0 a370,370 0 1,1 740,0 a370,370 0 1,1 -740,0"/>
<path id="${u}-arcin" d="M${C},${C} m-245,0 a245,245 0 1,1 490,0 a245,245 0 1,1 -490,0"/>
</defs>`;
  }

  /* ---- layers ---- */
  const L = {};
  L.case = (u, v) => `<g class="l-case">
<rect x="338" y="34" width="324" height="150" rx="46" fill="url(#${u}-metal3)"/>
<rect x="338" y="816" width="324" height="150" rx="46" fill="url(#${u}-metal3)"/>
<rect x="912" y="462" width="60" height="76" rx="12" fill="url(#${u}-metal3)"/>
<g stroke="rgba(0,0,0,.35)" stroke-width="3">${[0, 1, 2, 3, 4].map(i => `<line x1="${930 + i * 9}" y1="470" x2="${930 + i * 9}" y2="530"/>`).join('')}</g>
<circle cx="${C}" cy="${C}" r="446" fill="url(#${u}-metal)"/>
<circle cx="${C}" cy="${C}" r="446" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>
<circle cx="${C}" cy="${C}" r="410" fill="#0a0a0c"/>
<circle cx="${C}" cy="${C}" r="410" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="6"/>
<circle cx="${C}" cy="${C}" r="398" fill="url(#${u}-perlage)" opacity=".5"/>
</g>`;

  L.caseback = (u, v) => `<g class="l-caseback">
<rect x="338" y="34" width="324" height="150" rx="46" fill="url(#${u}-metal3)"/>
<rect x="338" y="816" width="324" height="150" rx="46" fill="url(#${u}-metal3)"/>
<circle cx="${C}" cy="${C}" r="446" fill="url(#${u}-metal2)"/>
<circle cx="${C}" cy="${C}" r="446" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.5"/>
<circle cx="${C}" cy="${C}" r="330" fill="rgba(10,10,14,.92)"/>
<circle cx="${C}" cy="${C}" r="330" fill="url(#${u}-glass)"/>
<circle cx="${C}" cy="${C}" r="330" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
<text class="back-text" fill="${v.metal[2]}" opacity=".9"><textPath href="#${u}-arc" startOffset="0">Orrery · Genève · Calibre OR-01 · 412 composants · 72 heures · N° 001 / 009 · Swiss made ·</textPath></text>
${[30, 90, 150, 210, 270, 330].map(a => { const x = C + 405 * Math.cos((a * Math.PI) / 180), y = C + 405 * Math.sin((a * Math.PI) / 180); return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${a * 1.7})"><circle r="11" fill="url(#${u}-metal3)"/><line x1="-7" y1="0" x2="7" y2="0" stroke="rgba(0,0,0,.7)" stroke-width="2.5"/></g>`; }).join('')}
</g>`;

  L.bezel = (u, v) => `<g class="l-bezel">
${ring(421, 50, `url(#${u}-metal2)`)}
<circle cx="${C}" cy="${C}" r="446" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.2"/>
<circle cx="${C}" cy="${C}" r="396" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="2"/>
<circle cx="${C}" cy="${C}" r="420" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1"/>
</g>`;

  L.dial = (u, v) => {
    const ticks = []; for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; const long = i % 5 === 0; const r0 = long ? 350 : 358, r1 = 370; ticks.push(`<line x1="${f1(C + r0 * Math.cos(a))}" y1="${f1(C + r0 * Math.sin(a))}" x2="${f1(C + r1 * Math.cos(a))}" y2="${f1(C + r1 * Math.sin(a))}" stroke="${v.index}" stroke-width="${long ? 2 : 1}" opacity="${long ? 0.9 : 0.5}"/>`); }
    const idx = []; for (let i = 0; i < 12; i++) { if (i === 6) continue; const a = i * 30; const double = i === 0; idx.push(`<g transform="rotate(${a} ${C} ${C})">${double ? `<rect x="${C - 15}" y="${C - 342}" width="10" height="38" rx="2" fill="url(#${u}-metal3)"/><rect x="${C + 5}" y="${C - 342}" width="10" height="38" rx="2" fill="url(#${u}-metal3)"/>` : `<rect x="${C - 5}" y="${C - 342}" width="10" height="38" rx="2" fill="url(#${u}-metal3)"/>`}</g>`); }
    return `<g class="l-dial">
<path fill-rule="evenodd" fill="url(#${u}-dial)" d="M${C - 396},${C} a396,396 0 1,0 792,0 a396,396 0 1,0 -792,0 Z M${C - 112},655 a112,112 0 1,0 224,0 a112,112 0 1,0 -224,0 Z"/>
<circle cx="${C}" cy="${C}" r="396" fill="none" stroke="${v.dialRim}" stroke-width="3"/>
${guilloche(C, C, 60, 332, 36, 28, 4.2, v.guil, u + '-dialclip')}
<circle cx="${C}" cy="655" r="112" fill="none" stroke="${v.guil}" stroke-width="2"/>
<circle cx="${C}" cy="655" r="118" fill="none" stroke="${v.index}" stroke-width="1" opacity=".55"/>
<circle cx="${C}" cy="${C}" r="340" fill="none" stroke="${v.index}" stroke-width=".8" opacity=".35"/>
${ticks.join('')}${idx.join('')}
<text class="dial-brand" x="${C}" y="318" text-anchor="middle" fill="${v.text}">Orrery</text>
<text class="dial-small" x="${C}" y="348" text-anchor="middle" fill="${v.text}" opacity=".75">Genève</text>
<text class="dial-small" x="${C}" y="796" text-anchor="middle" fill="${v.text}" opacity=".7">Planetarium</text>
</g>`;
  };

  L.module = (u, v) => {
    const orbits = [38, 62, 86]; const cx = C, cy = 655;
    return `<g class="l-module">
<circle cx="${C}" cy="${C}" r="392" fill="#121216"/>
<circle cx="${C}" cy="${C}" r="392" fill="url(#${u}-perlage)" opacity=".45"/>
<circle cx="${C}" cy="${C}" r="392" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
<path data-cx="270" data-cy="300" d="${gearPath(270, 300, 58, 20, 10, 4)}" fill-rule="evenodd" fill="url(#${u}-metal3)" class="gear" data-rate="1.4"/>
<path data-cx="740" data-cy="280" d="${gearPath(740, 280, 44, 16, 9, 3)}" fill-rule="evenodd" fill="url(#${u}-metal3)" class="gear" data-rate="-1.9"/>
<path data-cx="760" data-cy="700" d="${gearPath(760, 700, 36, 14, 8, 0)}" fill-rule="evenodd" fill="url(#${u}-metal3)" class="gear" data-rate="2.6"/>
<circle cx="${cx}" cy="${cy}" r="124" fill="#0b0b0f"/>
<circle cx="${cx}" cy="${cy}" r="124" fill="none" stroke="${v.accent}" stroke-width="1" opacity=".5"/>
${orbits.map(r => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${v.accent}" stroke-width=".9" opacity=".45"/>`).join('')}
<circle cx="${cx}" cy="${cy}" r="24" fill="url(#${u}-sun)"/>
<circle cx="${cx}" cy="${cy}" r="7" fill="#fff4cf"/>
<g class="planet" data-r="38" data-rate="4.15" data-cx="${cx}" data-cy="${cy}"><circle r="3.4" fill="#d9d2c6"/></g>
<g class="planet" data-r="62" data-rate="1.63" data-cx="${cx}" data-cy="${cy}"><circle r="4.4" fill="#f0dcac"/></g>
<g class="planet" data-r="86" data-rate="1" data-cx="${cx}" data-cy="${cy}"><circle r="4.6" fill="#9ec0ea"/><circle r="8" fill="none" stroke="#9ec0ea" stroke-width=".6" opacity=".5"/></g>
</g>`;
  };

  L.hands = (u, v) => `<g class="l-hands">
<g class="hand-h" transform="rotate(0 ${C} ${C})"><polygon points="${C},296 ${C + 16},${C} ${C},${C + 34} ${C - 16},${C}" fill="url(#${u}-hand)"/><polygon points="${C},296 ${C},${C + 34} ${C - 16},${C}" fill="${v.hands[1]}" opacity=".55"/></g>
<g class="hand-m" transform="rotate(0 ${C} ${C})"><polygon points="${C},176 ${C + 13},${C} ${C},${C + 40} ${C - 13},${C}" fill="url(#${u}-hand)"/><polygon points="${C},176 ${C},${C + 40} ${C - 13},${C}" fill="${v.hands[1]}" opacity=".55"/></g>
<g class="hand-s" transform="rotate(0 ${C} ${C})"><line x1="${C}" y1="${C + 70}" x2="${C}" y2="150" stroke="${v.seconds}" stroke-width="2.4"/><circle cx="${C}" cy="${C + 58}" r="9" fill="${v.seconds}"/></g>
<circle class="cap" cx="${C}" cy="${C}" r="15" fill="url(#${u}-metal3)"/>
<circle class="cap" cx="${C}" cy="${C}" r="5" fill="#0a0a0c"/>
</g>`;

  L.crystal = (u, v) => `<g class="l-crystal">
<circle cx="${C}" cy="${C}" r="398" fill="url(#${u}-glass)"/>
<ellipse class="glare" cx="380" cy="300" rx="170" ry="92" fill="#fff" opacity=".06" transform="rotate(-32 380 300)"/>
<circle cx="${C}" cy="${C}" r="397" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.6"/>
<path d="M${C - 300},${C - 262} a398,398 0 0,1 300,-136" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
</g>`;

  L.movement = (u, v) => `<g class="l-movement">
<circle cx="${C}" cy="${C}" r="392" fill="#1c1c21"/>
<circle cx="${C}" cy="${C}" r="378" fill="url(#${u}-cotes)"/>
<circle cx="${C}" cy="${C}" r="378" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
<path d="M300,250 h250 a40,40 0 0,1 40,40 v70 a40,40 0 0,1 -40,40 h-250 a40,40 0 0,1 -40,-40 v-70 a40,40 0 0,1 40,-40 z" fill="#2b2b31" stroke="${v.metal[1]}" stroke-opacity=".5" stroke-width="2"/>
<path d="M170,560 h200 a40,40 0 0,1 40,40 v120 a40,40 0 0,1 -40,40 h-200 a40,40 0 0,1 -40,-40 v-120 a40,40 0 0,1 40,-40 z" fill="#2b2b31" stroke="${v.metal[1]}" stroke-opacity=".5" stroke-width="2"/>
<path data-cx="500" data-cy="500" d="${gearPath(500, 500, 120, 30, 14, 5)}" fill-rule="evenodd" fill="url(#${u}-metal3)" class="gear" data-rate="1"/>
<path data-cx="330" data-cy="420" d="${gearPath(330, 420, 86, 22, 12, 4)}" fill-rule="evenodd" fill="url(#${u}-metal3)" class="gear" data-rate="-1.36"/>
<path data-cx="668" data-cy="408" d="${gearPath(668, 408, 64, 16, 11, 3)}" fill-rule="evenodd" fill="url(#${u}-metal3)" class="gear" data-rate="-1.9"/>
<path data-cx="392" data-cy="660" d="${gearPath(392, 660, 58, 14, 10, 3)}" fill-rule="evenodd" fill="url(#${u}-metal3)" class="gear" data-rate="2.1"/>
<path data-cx="300" data-cy="720" d="${gearPath(300, 720, 40, 12, 8, 0)}" fill-rule="evenodd" fill="url(#${u}-metal3)" class="gear" data-rate="-3.05"/>
<g class="balance" transform="rotate(0 668 660)">
  <circle cx="668" cy="660" r="78" fill="none" stroke="url(#${u}-metal3)" stroke-width="12"/>
  <g stroke="url(#${u}-metal3)" stroke-width="6"><line x1="668" y1="660" x2="668" y2="584"/><line x1="668" y1="660" x2="${f1(668 + 76 * Math.cos(2.094))}" y2="${f1(660 + 76 * Math.sin(2.094))}"/><line x1="668" y1="660" x2="${f1(668 + 76 * Math.cos(4.189))}" y2="${f1(660 + 76 * Math.sin(4.189))}"/></g>
  <path d="${spiralPath(668, 660, 6, 60, 4.5)}" fill="none" stroke="#9fb6d6" stroke-width="1.1" opacity=".9"/>
  <circle cx="668" cy="660" r="9" fill="url(#${u}-ruby)"/>
</g>
${[[500, 500], [330, 420], [668, 408], [392, 660], [300, 720], [560, 300], [240, 580]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="url(#${u}-ruby)"/>`).join('')}
${[[300, 250, 20], [550, 250, 70], [170, 560, 110], [370, 760, 40], [780, 540, 95], [620, 180, 0]].map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})"><circle r="12" fill="url(#${u}-metal3)"/><line x1="-8" y1="0" x2="8" y2="0" stroke="rgba(0,0,0,.7)" stroke-width="2.5"/></g>`).join('')}
<g class="rotor" transform="rotate(0 ${C} ${C})">
  <path d="M${C},${C} L${C + 300},${C} A300,300 0 0,1 ${C - 300},${C} Z" fill="url(#${u}-cotes)" opacity=".92"/>
  <path d="M${C},${C} L${C + 300},${C} A300,300 0 0,1 ${C - 300},${C} Z" fill="none" stroke="${v.metal[1]}" stroke-opacity=".7" stroke-width="3"/>
  <path d="M${C - 300},${C} A300,300 0 0,0 ${C + 300},${C}" fill="none" stroke="${v.metal[0]}" stroke-opacity=".35" stroke-width="1.5"/>
  <text class="back-text" fill="${v.metal[1]}" opacity=".85"><textPath href="#${u}-arcin" startOffset="27%">Orrery · Genève</textPath></text>
  <circle cx="${C}" cy="${C}" r="34" fill="url(#${u}-metal3)"/><circle cx="${C}" cy="${C}" r="12" fill="url(#${u}-ruby)"/>
</g>
</g>`;

  const ORDER_ASSEMBLED = ['case', 'module', 'dial', 'hands', 'bezel', 'crystal'];
  ORR.WATCH_LAYERS = ['crystal', 'bezel', 'hands', 'dial', 'module', 'movement', 'caseback'];

  function svgEl(markup, cls) {
    const t = document.createElement('template'); t.innerHTML = markup.trim();
    const svg = t.content.firstElementChild; svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true'); return svg;
  }

  /* Assembled watch: returns a <div class="watch"> holding a static base svg and a
     transparent live overlay (hands, planets, glare) so per-frame updates never
     re-rasterise the dial, guilloche and metal. */
  ORR.makeWatch = (variantKey, cls) => {
    const v = VARIANTS[variantKey] || VARIANTS.perihelion; const u = 'w' + (uid++);
    const body = ORDER_ASSEMBLED.map(n => L[n](u, v)).join('');
    const base = svgEl(`<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" data-variant="${variantKey}">${defs(u, v)}<defs><clipPath id="${u}-win"><circle cx="${C}" cy="655" r="112"/></clipPath></defs>${body}</svg>`, 'watch__base');
    const live = svgEl(`<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"><g class="live-planets" clip-path="url(#${u}-win)"></g><g class="live-hands"></g></svg>`, 'watch__live');
    const pg = live.querySelector('.live-planets'), hg = live.querySelector('.live-hands');
    base.querySelectorAll('.gear').forEach(el => el.remove()); // fully occluded by the dial
    base.querySelectorAll('.planet').forEach(el => pg.appendChild(el));
    base.querySelectorAll('.hand-h, .hand-m, .hand-s, .cap').forEach(el => hg.appendChild(el));
    const glare = base.querySelector('.glare'); if (glare) live.appendChild(glare);
    const wrap = document.createElement('div');
    wrap.className = 'watch ' + (cls || ''); wrap.setAttribute('aria-hidden', 'true'); wrap.dataset.variant = variantKey;
    wrap.appendChild(base); wrap.appendChild(live);
    return wrap;
  };
  /* Single layer: returns an <svg>, or for the layers with moving parts a
     <div> holding a static plate svg and a live overlay svg (everything from
     the first moving part onward keeps its paint order in the overlay). */
  ORR.makeLayer = (variantKey, layer, cls) => {
    const v = VARIANTS[variantKey] || VARIANTS.perihelion; const u = 'l' + (uid++);
    const svg = svgEl(`<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" data-layer="${layer}">${defs(u, v)}${L[layer](u, v)}</svg>`, 'watch layer ' + (cls || ''));
    if (layer !== 'module' && layer !== 'movement') return svg;
    const group = svg.querySelector('g'); const kids = Array.from(group.children);
    const first = kids.findIndex(el => el.matches('.gear, .planet, .balance, .rotor'));
    if (first < 0) return svg;
    const live = svgEl(`<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"><g class="live"></g></svg>`, 'watch__live');
    const lg = live.querySelector('.live');
    for (const el of kids.slice(first)) lg.appendChild(el);
    svg.setAttribute('class', 'watch__base');
    const wrap = document.createElement('div');
    wrap.className = 'watch layer ' + (cls || ''); wrap.setAttribute('aria-hidden', 'true'); wrap.dataset.layer = layer;
    wrap.appendChild(svg); wrap.appendChild(live);
    return wrap;
  };

  /* ---- animation: hands, planets, gears, balance, rotor ---- */
  const live = new Set();
  const vis = new WeakMap();
  const vio = new IntersectionObserver(entries => { for (const e of entries) vis.set(e.target, e.isIntersecting); }, { rootMargin: '10% 0px' });

  ORR.animateWatch = svg => {
    const parts = {
      h: svg.querySelector('.hand-h'), m: svg.querySelector('.hand-m'), s: svg.querySelector('.hand-s'),
      planets: Array.from(svg.querySelectorAll('.planet')),
      gears: Array.from(svg.querySelectorAll('.gear')).map(g => ({ el: g, cx: +g.dataset.cx || 500, cy: +g.dataset.cy || 500, rate: parseFloat(g.dataset.rate) || 1 })),
      balance: svg.querySelector('.balance'), rotor: svg.querySelector('.rotor'), rotorA: 0, rotorV: 0,
    };
    svg.__parts = parts; live.add(svg); vio.observe(svg);
    return parts;
  };
  ORR.unanimateWatch = svg => { live.delete(svg); vio.unobserve(svg); };

  let gearAngle = 0, planetT = 0;
  ORR.onFrame((dt, t) => {
    const now = new Date();
    const ms = now.getMilliseconds() / 1000;
    const s = now.getSeconds() + ms, m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
    const sa = s * 6, ma = m * 6, ha = h * 30;
    const sv = ORR.scroll ? ORR.scroll.svel : 0;
    gearAngle += dt * (18 + Math.abs(sv) * 0.12) * (sv < 0 ? -1 : 1);
    planetT += dt * (0.25 + Math.abs(sv) * 0.002);
    const bal = Math.sin(t * Math.PI * 2 * 3) * 30; // 3 Hz balance
    for (const svg of live) {
      if (vis.has(svg) && !vis.get(svg)) continue;
      const P = svg.__parts;
      if (P.h) P.h.setAttribute('transform', `rotate(${ha.toFixed(2)} 500 500)`);
      if (P.m) P.m.setAttribute('transform', `rotate(${ma.toFixed(2)} 500 500)`);
      if (P.s) P.s.setAttribute('transform', `rotate(${sa.toFixed(2)} 500 500)`);
      for (const pl of P.planets) { const r = +pl.dataset.r, rate = +pl.dataset.rate, cx = +pl.dataset.cx, cy = +pl.dataset.cy; const a = planetT * rate + r; pl.setAttribute('transform', `translate(${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)})`); }
      for (const g of P.gears) g.el.setAttribute('transform', `rotate(${(gearAngle * g.rate).toFixed(2)} ${g.cx.toFixed(1)} ${g.cy.toFixed(1)})`);
      if (P.balance) P.balance.setAttribute('transform', `rotate(${bal.toFixed(2)} 668 660)`);
      if (P.rotor) {
        // free-swinging rotor: scroll velocity spins it, gravity settles the heavy side back down
        P.rotorA += sv * 0.07 * dt;
        P.rotorA = ORR.u.damp(P.rotorA, Math.round(P.rotorA / 360) * 360, 0.5, dt);
        P.rotor.setAttribute('transform', `rotate(${P.rotorA.toFixed(2)} 500 500)`);
      }
    }
  });
})();
