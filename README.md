# Orrery — Instruments of Time

A single-page, zero-dependency luxury landing page for **Orrery**, a fictional Geneva maison that makes nine planetarium wristwatches a year. Built to show what scroll-, cursor- and time-driven motion design can do with nothing but HTML, CSS, raw WebGL, SVG and canvas.

**Live preview:** open `index.html` from any static server (e.g. `npx serve .`) or enable GitHub Pages on this repository (Settings → Pages → Deploy from branch → `main` / root).

## What's in it

| Section | Motion |
| --- | --- |
| Preloader | Orbit draw, 000→100 counter, scrambled status lines, split-panel curtain |
| Hero | Raw-WebGL domain-warped "liquid obsidian" shader. The cursor is a light source and a lens; clicks send ripples. A procedurally generated SVG watch keeps real Geneva time, tilts toward the pointer, and iris-reveals on load. Title letters flee the cursor. |
| Manifesto | Word-by-word scroll-scrubbed reveal, driven by a single CSS custom property |
| Anatomy | Pinned 520vh section: the watch explodes into seven 3D layers (sapphire, bezel, hands, dial, planetarium module, calibre, caseback) as you scroll; gears spin with scroll velocity, the rotor swings, the balance beats at 3 Hz |
| Collection | Pinned horizontal glide across four variants on a bone-coloured ground (the page background lerps between sections). Cards skew with scroll velocity; the watches tilt on hover |
| Planetarium | Canvas orrery with six planets on true relative orbits. The cursor bends space (gravitational lensing); the Earth–Venus pentagram accumulates on a persistent trail; scroll speeds up time |
| Atelier | Live rose-engine guilloché on canvas that the cursor disturbs; animated counters; a marquee whose variable-font weight follows scroll velocity |
| Reserve | Cursor-following glow, magnetic buttons, scrambled confirmation state |
| Footer | Four world clocks, outline wordmark that fills on hover |

Global: Lenis-style lerped smooth scrolling on native scroll, blend-mode custom cursor with labels and velocity stretch, film grain, scroll progress bar, hide-on-scroll nav with scramble hovers, opt-in synthesised escapement tick, `prefers-reduced-motion` support, mobile layout with a full-screen menu.

## Files

```
index.html          markup and copy
css/styles.css      design tokens, layout, responsive rules
js/engine.js        scroll lerp engine, scrub registry, pointer, cursor, text utilities
js/shader.js        hero WebGL shader
js/watch.js         procedural SVG watch (assembled and per-layer) + hand/gear animation
js/planetarium.js   canvas orrery
js/main.js          page wiring
```

No build step, no dependencies. Fonts are loaded from Google Fonts (Bodoni Moda, Instrument Sans, Geist Mono).

## Performance notes

Every watch is two stacked SVGs: a static base (case, dial, guilloché, metal) and a transparent live overlay (hands, planets, glare). Per-frame updates only touch the overlay, so the expensive dial never re-rasterises. The exploded module and calibre layers are split the same way. Moving watches use static gradient shadows instead of `filter: drop-shadow`, canvases are capped at 1.5× density, and scrub-driven styles are written only when their values change. Off-screen watches and canvases pause through IntersectionObserver.

Orrery is a fictional maison; all names, prices and specifications are invented.
