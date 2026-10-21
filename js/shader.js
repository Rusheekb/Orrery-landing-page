/* ORRERY — hero WebGL: domain-warped liquid obsidian with gold veins.
   The cursor is a light source and a lens; clicks send ripples through the field. */
(function () {
  'use strict';
  const ORR = (window.ORR = window.ORR || {});

  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_scroll;
uniform float u_intro;
uniform vec4 u_ripple[4];

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3. - 2. * f);
  float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= .5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = uv * 2. - 1.; p.x *= asp;
  vec2 m = u_mouse;
  vec2 dm = p - m; float md = length(dm);

  // cursor lens: the field bulges away from the pointer
  p += dm * 0.16 * exp(-md * md * 2.6);

  // click ripples
  for (int i = 0; i < 4; i++) {
    vec4 r = u_ripple[i];
    float age = u_time - r.z;
    if (r.w > 0. && age > 0. && age < 5.) {
      vec2 dr = p - r.xy; float d = length(dr);
      float w = sin(d * 26. - age * 6.5) * exp(-age * 1.2) * exp(-d * 2.2) * r.w;
      p += (dr / max(d, 1e-3)) * w * 0.06;
    }
  }

  float t = u_time * 0.065;
  vec2 q = vec2(fbm(p * 1.25 + t), fbm(p * 1.25 + vec2(5.2, 1.3) - t * 0.8));
  vec2 r2 = vec2(fbm(p * 1.25 + 3.0 * q + vec2(1.7, 9.2) + t * 0.45), fbm(p * 1.25 + 3.0 * q + vec2(8.3, 2.8) - t * 0.3));
  float f = fbm(p * 1.25 + 3.0 * r2);

  vec3 base = mix(vec3(0.024, 0.024, 0.032), vec3(0.075, 0.06, 0.1), smoothstep(0.15, 0.85, f));
  float vein = smoothstep(0.40, 0.49, f) * smoothstep(0.62, 0.53, f);
  float fine = smoothstep(0.465, 0.5, f) * smoothstep(0.535, 0.5, f);
  vec3 gold = vec3(0.84, 0.63, 0.30);
  vec3 goldHi = vec3(1.0, 0.87, 0.58);

  float light = exp(-md * 1.5);
  float amb = 0.25 + 0.75 * u_intro;
  vec3 col = base;
  col += gold * vein * (0.10 + 0.95 * light) * amb;
  col += goldHi * fine * (0.08 + 1.6 * light) * amb;
  col += gold * 0.045 * light * amb;

  // soft nebula tint drifting slowly
  col += vec3(0.05, 0.03, 0.09) * smoothstep(0.55, 0.9, q.y) * 0.6;

  float vig = smoothstep(1.75, 0.35, length(uv * 2. - 1.) * 0.95);
  col *= mix(0.55, 1.0, vig);
  col *= 1.0 - 0.9 * u_scroll;
  col += (hash(gl_FragCoord.xy + fract(u_time) * 7.1) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.);
}`;

  ORR.initHeroGL = function (canvas) {
    let gl;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return null;

    let prog = null, buf = null; const U = {};
    function init() {
      const compile = (type, src) => {
        const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn('shader', gl.getShaderInfoLog(sh)); return null; }
        return sh;
      };
      const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return false;
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('program', gl.getProgramInfoLog(prog)); return false; }
      gl.useProgram(prog);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['u_res', 'u_time', 'u_mouse', 'u_scroll', 'u_intro', 'u_ripple']) U[n] = gl.getUniformLocation(prog, n);
      return true;
    }
    if (!init()) return null;

    const state = { w: 1, h: 1, cw: 1, ch: 1, mx: 0, my: 0, tmx: 0, tmy: 0, scroll: 0, intro: 0, tintro: 0, visible: true, lost: false };
    const ripples = new Float32Array(16); let rippleIdx = 0;

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); state.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { if (init()) { resize(); state.lost = false; } else { canvas.style.display = 'none'; } });

    function resize() {
      const r = canvas.getBoundingClientRect();
      state.cw = Math.max(1, r.width); state.ch = Math.max(1, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // resolution follows a fragment budget: the field is low-frequency and film grain hides any softness
      const budget = ORR.touch ? 3.5e5 : 9e5;
      const scale = Math.min(ORR.touch ? 0.5 : 0.8, Math.max(0.4, 0.5 * dpr), Math.sqrt(budget / (state.cw * state.ch)));
      state.w = Math.max(2, Math.round(state.cw * scale)); state.h = Math.max(2, Math.round(state.ch * scale));
      canvas.width = state.w; canvas.height = state.h;
      gl.viewport(0, 0, state.w, state.h);
    }
    resize();

    const api = {
      resize,
      setScroll: v => { state.scroll = v; },
      setIntro: v => { state.tintro = v; },
      setVisible: v => { state.visible = v; },
      ripple: (clientX, clientY, strength) => {
        const r = canvas.getBoundingClientRect();
        const asp = state.cw / state.ch;
        const x = ((clientX - r.left) / state.cw * 2 - 1) * asp;
        const y = -((clientY - r.top) / state.ch * 2 - 1);
        const i = (rippleIdx++ % 4) * 4;
        ripples[i] = x; ripples[i + 1] = y; ripples[i + 2] = ORR.time; ripples[i + 3] = strength || 1;
      },
      render: (dt) => {
        if (!state.visible || state.lost || document.hidden || state.scroll >= 0.92) return; // past 92% the field is dark and the copy has gone
        const r = canvas.getBoundingClientRect();
        const asp = state.cw / state.ch;
        const P = ORR.pointer;
        state.tmx = ((P.x - r.left) / state.cw * 2 - 1) * asp;
        state.tmy = -((P.y - r.top) / state.ch * 2 - 1);
        state.mx = ORR.u.damp(state.mx, state.tmx, 5, dt);
        state.my = ORR.u.damp(state.my, state.tmy, 5, dt);
        state.intro = ORR.u.damp(state.intro, state.tintro, 1.2, dt);
        gl.uniform2f(U.u_res, state.w, state.h);
        gl.uniform1f(U.u_time, ORR.time);
        gl.uniform2f(U.u_mouse, state.mx, state.my);
        gl.uniform1f(U.u_scroll, state.scroll);
        gl.uniform1f(U.u_intro, state.intro);
        gl.uniform4fv(U.u_ripple, ripples);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
    return api;
  };
})();
