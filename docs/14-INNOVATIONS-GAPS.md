# 14 — Gaps, New Discoveries, and Innovations for Lumina (2026-09-03)

**Status:** Research + design. Extends doc 11 with (a) gaps discovered during the 2026 comparative research (doc 12), (b) new discoveries/techniques useful for a browser-native Manim, and (c) the innovation roadmap Lumina should own.

Related: [11-GAPS-AND-INNOVATIONS.md](11-GAPS-AND-INNOVATIONS.md), [12-RESEARCH-COMPARISON-2026.md](12-RESEARCH-COMPARISON-2026.md), [13-AUDIT-PLAN-ISSUES.md](13-AUDIT-PLAN-ISSUES.md).

**Update (2026-09-03, later pass):** §1's MathTex and Axes/NumberPlane/plot()/c2p/p2c rows (marked "A1 — this pass" / "A2 — this pass") are now **done**. The backend-agnostic SVG-path→Bézier parser mentioned in §4 was built as `math/svg-path.ts` and is already reused as-is by `MathTex` (§4's stated design intent — one parser for MathJax now, KaTeX/SVGMobject later — held up in practice). **FormulaToGraph** (§3) is now unblocked (both of its prerequisites, A1 and A2, are done) but not yet built itself.

---

## 1. Gaps newly confirmed by the 2026 research (vs manim-web etc.)

Doc 12 §8/§9 lists these in full. Summary of gaps Lumina must close to reach "pack everything, missing nothing":

| Gap | Where the competition has it | Lumina plan |
|---|---|---|
| MathTex (morphable vector math) | manim-web (KaTeX) | **A1 — this pass** |
| Axes/NumberPlane/plot()/c2p/p2c | manim-web | **A2 — this pass** |
| Player + `<lumina-player>` + WebM export | Remotion player / manim-web export | **Phase B** |
| Interaction (Draggable/Hoverable/Clickable) | manim-web | Phase D2 |
| Matrix/Table/Network graphs | manim-web | Phase C3/C2 |
| React/Vue wrappers | manim-web | Phase D2 |
| py2ts + structured logging | manim-web | Phase D2 |
| Boolean ops | polygon-clipping/Clipper2 (JS) | Phase C1 |
| GIF/PNG/MP4 export | manim-web/gifenc/WebCodecs | Phase B3 |

---

## 2. New discoveries / techniques (2026) useful for this JS library

### 2.1 MathJax SVG → Bézier is the de-risked MathTex path (verified)
- `mathjax-full` TeX→SVG output is **synchronous**, emits plain `M/L/Q/C/Z` path data, `rect` fraction bars, `translate/scale` nesting, and preserves `\cssId{...}` as `id` attributes → per-subexpression tagging for `TransformMatchingTex`. Full proof in doc 12 §7.
- **Discovery:** this gives Lumina *true TeX box-layout* (fractions, sqrt, matrices, sub/superscripts) without reimplementing any layout — the same win real Manim gets from LaTeX+dvisvgm, in the browser, morphable.

### 2.2 Export stack (2026)
- **MediaRecorder + `canvas.captureStream()`** → WebM, real-time, v1.
- **WebCodecs `VideoEncoder` + `mp4-muxer`** → hardware-accelerated MP4, **10× faster than realtime** (doc 12 §6.3). This is the modern upgrade path; MediaRecorder is the fallback.
- **gifenc (mattdesl)** → fast pure-JS GIF encoder, browser+Node; v1 GIF path.
- **Discovery:** because Lumina's `render(t)` is a *pure function of time*, export can render frames **offline at any rate** (faster than realtime) into any encoder — a structural advantage Python Manim's forward-only `construct()` doesn't have. `render(t)` + WebCodecs is the flagship export story.

### 2.3 Boolean ops
- **polygon-clipping (mfogel)** — Martinez–Rueda–Feito, pure JS, O((n+k)·log n), union/intersection/difference/xor.
- **Clipper2 (angusj)** — industry-standard, open+closed paths, offsets; JS/WASM ports exist.
- **Discovery:** for a first cut, sample VMobject Béziers to polylines → `polygon-clipping` → rebuild cubics (`setPointsAsCorners`). Keeps the core dependency-light; upgrade to WASM Clipper2 only if Bézier-fidelity matters.

### 2.4 Interaction model
- manim-web ships Draggable/Hoverable/Clickable. Lumina's `Scene` has no pointer pipeline yet.
- **Discovery:** Lumina's seekable `render(t)` + `ValueTracker` gives a clean interaction architecture: pointer events → set tracker values → re-render. Draggable = pointer→tracker binding; no separate animation clock needed. This is a *natural fit* worth designing deliberately (Phase D2).

### 2.5 Determinism / seeding
- `mulberry32` seeded RNG already gives deterministic seeking (doc 06). **Discovery:** extend the same principle to any stochastic animation (jitter, Brownian, noise fields) so `render(t)` stays pure — a documented contract for authors, and a test hook (doc 10 §9: every test sets `seed: 1`).

### 2.6 Text-rendering parity
- Manim CE v0.21 shipped a new text-rendering option (doc 12 §6.5). Lumina's opentype glyph→cubics path (font.ts) is the browser analogue; MathTex via MathJax closes the LaTeX gap. Both feed the same VMobject tree → `Write`/`Transform`/morph work on text and math alike.

---

## 3. Innovations Lumina should own (roadmap, from doc 11 + new)

| Innovation | Status | Notes |
|---|---|---|
| **FormulaToGraph** (formula↔graph linked morph) | planned | Requires A1 (MathTex) + A2 (Axes/plot). The flagship pedagogy feature. |
| **Step-decomposition UI** (`section` + `decompose()` + player beats) | planned | `Scene.section()` exists; `decompose()` + beats UI in Phase B. |
| **First-party `<lumina-player>` + JS `Player`** | planned | Phase B. |
| **Seekable timeline `render(t)`** | **done** | Pure-function seeking is the structural advantage (doc 12 §2.2). |
| **Dual renderer (Canvas2D + owned WebGL)** | **done** | No Three.js in core (confirmed again by 2026 research). |
| **CE ↔ GL alias layer** | **done** | `Create`≡`ShowCreation`, `always`/`fAlways`/`alwaysRedraw`, snake_case options. |
| **Domain packs in core repo** | planned | Phase D1. |
| **Parameter recording** (`scene.expose` + timeline bind) | planned | `expose()` exists; recording UI in Phase B/D. |
| **JSON / declarative scenes** | planned | `Mobject.toJSON` exists; Scene round-trip in Phase D2. |
| **Zero-framework script tag + web component** | planned | Phase B (IIFE + `<lumina-player src>`). |

### New innovation candidates (2026)
- **Offline faster-than-realtime export** built on `render(t)` + WebCodecs (doc 12 §2.2) — a differentiator vs every Python Manim and vs manim-web's real-time MediaRecorder.
- **Pointer→tracker interaction contract** (doc 12 §2.4) — Draggable/Hoverable/Clickable as first-class, seekable, recordable interactions.
- **Stochastic determinism contract** (doc 12 §2.5) — seeded noise/jitter so seeking stays pure.
- **Backend-agnostic SVG-path→Bézier parser** — one parser serves MathJax (now), KaTeX (later), and SVGMobject (Phase C). Shared utility, not MathTex-specific.

---

## 4. Anti-wrapper rules (reaffirmed, doc 11 §6)

1. Own vec/mat/bezier/mobject/animation/timeline/camera/renderer.
2. No `import { Scene } from 'manim-web'`; no source-tree copy.
3. No `import * as THREE from 'three'` in core (optional `lumina/three` interop later only).
4. No p5 `setup/draw` as the public clock.
5. Not named Manim/Manim.js/3Blue1Brown.
6. No Pi creatures / ManimBanner art.
7. Read CE/GL behavior from docs + public source; reimplement.

---

## 5. Risks if we skip an innovation (doc 11 §7, updated)

| If we skip… | Product collapses to… |
|---|---|
| Seekable `render(t)` | manim-web with nicer docs |
| FormulaToGraph | Manim in a tab (still DIY) |
| Player / web component | A canvas demo, not educational-site ready |
| Owned 3D | A Three.js wrapper with extra steps |
| Domain packs | "Complete" only on a slide, not in the repo |
| CE↔GL aliases | Half of Manim authors lost |
| Parameter recording | Interactive XOR cinematic, not both |
| Offline export (`render(t)`+WebCodecs) | Real-time-only recording (manim-web parity, no advantage) |

---

## 6. Success criteria (product, from doc 11 §8 — unchanged)

1. ManimCE author writes Square→Circle→MathTex in JS; plays in a tab.
2. ManimGL author uses `ShowCreation`, `always`, `fixInFrame`, euler camera.
3. Teacher pastes `<lumina-player src="lesson.js">`.
4. Engineer builds a custom HTML/CSS player on `engine.render(t)`.
5. Linear algebra / calculus / CS sort / tiny NN / spring-field demos exist as first-party packs.
6. Formula morphs into its graph; beats step a proof; sliders record or live-bind.
7. 3D surfaces + HUD formulas composite with 2D VMobjects.
8. Export WebM/GIF/PNG (and MP4 via WebCodecs) without Python.
9. No Three.js / p5 / manim-web in the core dependency tree.
10. Legal: MIT, no Pi creatures, not named Manim.

---

**End of innovations/gaps doc. Next: implement Phase A (MathTex → Axes/NumberPlane) per doc 13 §4.**
