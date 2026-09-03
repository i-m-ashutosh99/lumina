# 12 — Online Research & Feature/Functionality Comparison (2026-09-03)

**Status:** Research. Live web search + library README/documentation crawl, dated 2026-09-03.
**Purpose:** Refresh and extend the original landscape research (doc 01) with *current* (2026) facts about every comparable library — JavaScript *and* other languages — so Lumina's gap list and plan are grounded in what these tools actually ship today, not what they shipped when docs 01–05 were written.

Related: [01-RESEARCH-LANDSCAPE.md](01-RESEARCH-LANDSCAPE.md), [05-FEATURE-MATRIX.md](05-FEATURE-MATRIX.md), [11-GAPS-AND-INNOVATIONS.md](11-GAPS-AND-INNOVATIONS.md), [13-AUDIT-PLAN-ISSUES.md](13-AUDIT-PLAN-ISSUES.md), [14-INNOVATIONS-GAPS.md](14-INNOVATIONS-GAPS.md).

---

## 1. Method

- Web searches (2026-09-03) for: manim-web, Motion Canvas, Remotion, Manim.js, KaTeX→Bézier, boolean path ops, MediaRecorder/WebCodecs export, Three.js/MathBox/JSXGraph, Manim CE v0.21, gifenc.
- Crawled the live `maloyan/manim-web` GitHub README for its current feature list.
- Re-verified the MathJax SVG pipeline locally (see §7) — the single biggest technical risk for `MathTex`.

---

## 2. manim-web (maloyan) — current feature list (crawled 2026-09-03)

From the live README:

| Area | What manim-web ships today |
|---|---|
| **Geometry** | Circle, Rectangle, Polygon, Arrow, Arc, Star, Brace, "and more" |
| **Text & LaTeX** | Text, MathTex, Tex, Paragraph **via KaTeX** |
| **Graphing** | Axes, NumberPlane, FunctionGraph, ParametricFunction, VectorField, BarChart |
| **3D** | Sphere, Cube, Cylinder, Torus, Surface3D, ThreeDAxes with **orbit controls** |
| **Animations** | FadeIn/Out, Create, Transform, Write, GrowFromCenter, AnimationGroup, LaggedStart |
| **Interaction** | **Draggable, Hoverable, Clickable** mobjects |
| **Export** | **GIF and video export** |
| **Graphs & Tables** | **Network graphs, Matrix, Table** |
| **Frameworks** | **React + Vue** components (`ManimScene`) |
| **Tooling** | `py2ts.cjs` Python→TypeScript converter; structured `onLog` logger; CDN ESM (`manim-web.browser.js`) |

**Key observations for Lumina:**

1. **manim-web's animation catalogue is small** (7 listed) vs Lumina's already-implemented ~40+ (Create/Uncreate/Write/Transform family/FadeIn/Indicate/Homotopy/AnimationGroup/LaggedStart/Succession/TransformMatchingShapes/Tex/…). Lumina is *ahead* on animation breadth.
2. **manim-web's 3D is Three.js** — Lumina deliberately owns its WebGL2 renderer (no `Object3D` leak). manim-web's 3D list is short (7 primitives) vs Lumina's 10 solids + Surface + Light + ThreeDCamera.
3. **manim-web ships things Lumina does NOT yet have:** interaction (Draggable/Hoverable/Clickable), GIF/video export, Matrix/Table, Network graphs, React/Vue wrappers, py2ts, structured logging. These are confirmed gaps → Lumina plan §6.
4. **manim-web has NO first-party player chrome, NO `<lumina-player>`-style web component, NO seekable timeline, NO domain packs, NO FormulaToGraph, NO CE↔GL alias policy.** These remain Lumina's differentiators (doc 11 §5).
5. manim-web renders math via **KaTeX**; Lumina's de-risked path uses **mathjax-full** (SVG output → Bézier). Both are legitimate; MathJax gives true TeX box-layout + `cssId` subexpression tagging for `TransformMatchingTex` (verified working, §7).

---

## 3. Motion Canvas (motion-canvas/motion-canvas)

- **TypeScript library** using **generator functions** to program animations (`yield* tween(...)`), plus a **web-based editor** with real-time preview, powered by Vite.
- Editor syncs animations **with audio**; exports video.
- **Missing for Lumina's mission:** no Manim triad (`Mobject → Animation → Scene`), no math mobjects (MathTex/NumberPlane), no 3D explainer camera, no KaTeX-as-VMobject, no domain packs. Different "religion" (generators vs `play()`).
- **Steal:** playground/editor UX, seek-as-a-product-requirement, time as a first-class cursor, audio-synced preview.

---

## 4. Remotion (remotion-dev/remotion)

- **React** framework for programmatic video; frames are pure functions of time (`useCurrentFrame`); real **video export** (server-side rendering); a **Remotion Player** for embedding; batch/agentic rendering pipelines.
- **Missing:** geometry kernel, Bézier morph (`Transform`), math typesetting, Manim DSL. Wrong unit of authoring for 3b1b (JSX trees vs mobjects).
- **Steal:** nothing architectural — but proof that **web-export-to-video matters** and that a **player embed** is table-stakes for a product.

---

## 5. Manim.js (JazonJiao)

- p5.js-based 2D toolkit replicating 3b1b-style **CS graph** lectures (vertex/edge color states, visit/frontier/visited pedagogy).
- **Missing almost everything else:** no VMobject, no math frame, no LaTeX, no 3D, no `play()`, no player; pixel coordinates; p5 `setup/draw`.
- **Steal:** CS-graph *pedagogy* only (see Lumina `cs` pack, doc 09).

---

## 6. Other JS / cross-language libraries (2026 facts)

### 6.1 KaTeX (katex/katex)
- "Fastest math typesetting for the web"; **synchronous**, no reflow; print quality; simple API. Used by manim-web for Tex/MathTex.
- **Lumina relevance:** KaTeX is a *peer* option for MathTex. We chose mathjax-full because its SVG output exposes per-glyph `<path d>` + `cssId` tags that map directly to `TransformMatchingTex` submobjects (verified). KaTeX also emits SVG paths; either backend is fine — the SVG-path→Bézier parser we build (§7) is backend-agnostic.

### 6.2 polygon-clipping (mfogel) / Clipper2 / jsclipper
- **polygon-clipping:** Martinez–Rueda–Feito algorithm, O((n+k)·log n), union/intersection/difference/xor on polygons & multipolygons; pure JS.
- **Clipper2 (angusj):** the industry-standard C++ polygon clipping/offsetting (portable to JS/WASM); handles open *and* closed paths, offsets.
- **Lumina relevance:** boolean ops (`Union`/`Intersection`/`Difference`/`Exclusion`) are a confirmed missing feature (README gap table). Plan: prototype pure-JS `polygon-clipping` on sampled polylines first (no new heavy dep), evaluate WASM Clipper2 only if Bézier-fidelity is needed. See [14-INNOVATIONS-GAPS.md](14-INNOVATIONS-GAPS.md) §4.

### 6.3 MediaRecorder / captureStream / WebCodecs / gifenc (export)
- **MediaRecorder + `canvas.captureStream()`** → WebM in-browser, real-time; the standard v1 export path. Caveat: WebM codec varies by browser (VP8/VP9/AV1); Safari support uneven.
- **WebCodecs `VideoEncoder`** → hardware-accelerated, **10× faster-than-realtime** MP4 (with `mp4-muxer`); the modern export path, better than MediaRecorder for MP4.
- **gifenc (mattdesl)** → fast, lightweight pure-JS GIF encoder, browser + Node; the v1 GIF path (doc 10 §3.10).
- **Lumina relevance:** Export (WebM/GIF/PNG) is a confirmed missing feature. Plan: `export/webm.ts` (MediaRecorder) + `export/gif.ts` (gifenc) + `export/png.ts` (frame dump); WebCodecs/MP4 as a later enhancement. See [13-AUDIT-PLAN-ISSUES.md](13-AUDIT-PLAN-ISSUES.md) §6.3.

### 6.4 Three.js / MathBox / JSXGraph
- **Three.js:** every 3D primitive/camera/light/material/orbit/glTF; no pedagogical DSL, no VMobject/MathTex/NumberPlane/player.
- **MathBox:** presentation-quality math diagrams on WebGL (built on Three.js + ShaderGraph); dense fields/GLSL; not a Manim DSL.
- **JSXGraph:** interactive *Euclidean* geometry + function plotting + charting; drag-constructions; a `math-euclidean` pack inspiration (doc 10 §6), not a core.
- **Lumina relevance:** confirms the "own WebGL, don't wrap Three.js" decision (doc 00 decision log #4). Three.js remains an *optional later interop* (`lumina/three`), never core.

### 6.5 Manim Community Edition v0.21 (Python)
- v0.21 (Aug 2026) shipped **60 changes**, incl. a **new text-rendering option** and substantial performance improvements across Cairo and OpenGL backends.
- **Lumina relevance:** the Python catalogue (doc 02) is the source of truth for API completeness; v0.21's text-rendering work mirrors Lumina's own text/MathTex effort. No new class families that change Lumina's plan.

---

## 7. Re-verified technical risk: MathJax SVG → Bézier pipeline (2026-09-03)

Ran `mathjax-full@3.2.1` in Node (TeX input + SVG output, `fontCache:'none'`, `liteAdaptor`). Confirmed:

1. `html.convert('...', { display:false })` is **synchronous** → `MathTex` can build its VMobject tree synchronously in the constructor (no `await` needed for layout; only font *fetch* for the opentype fallback path stays async).
2. Output is a plain `<svg>` with `viewBox="0 -864.9 3024.6 1209.9"` (ex, ey, width, height), root `<g transform="scale(1,-1)">`, then nested `<g data-mml-node="...">` with `transform="translate(x,y) scale(s)"`.
3. Glyphs are `<path data-c="..." d="M...Q...C...Z">` — **only `M L Q C Z H V T` commands** (no arcs, no `<use>`/glyph-cache refs when `fontCache:'none'`).
4. Fraction bars / sqrt bars come through as `<rect x w h y>` → translate to filled VMobject rectangles.
5. `\cssId{name}{...}` survives as an `id` attribute on the wrapping `<g>` → ready-made per-subexpression tagging for `TransformMatchingTex` (which already expects a `.tex`/`.texString` field per submobject — see `animations/transform.ts`).

**Conclusion:** the MathTex implementation path is fully de-risked. Write `mobjects/text/mathtex.ts` with an SVG-path-`d`-string → cubic-Bézier parser (upgrade `Q`→cubic like `font.ts` already does for opentype glyphs; flatten `H`/`V`/`T`; skip `Z` closure), apply the nested `translate/scale` transforms, convert `<rect>` to filled rectangles, and tag each `<g>` (by `data-mml-node` + `cssId`) with a `tex` string for `TransformMatchingTex`.

---

## 8. Comparison summary table (2026)

| Capability | manim-web | Motion Canvas | Remotion | Manim.js | Manim CE (Py) | **Lumina (today)** | **Lumina (plan)** |
|---|---|---|---|---|---|---|---|
| Manim triad API | Partial | N | N | N | Y | **Y** | Y |
| Animation catalogue | 7 | own DSL | own DSL | few | full | **~40** | full |
| MathTex (vector, morphable) | KaTeX | N | N | N | TeX+dvisvgm | **planned (this pass)** | Y |
| Axes/NumberPlane/plot | Y | N | N | N | Y | **planned (this pass)** | Y |
| 3D (owned, not Three.js) | Three.js | N | N | N | OpenGL | **Y (own WebGL2)** | Y |
| Seekable player + web component | N | editor only | Player (React) | N | N | primitives only | **planned** |
| WebM/GIF/PNG export | GIF+video | video | Y | N | FFmpeg | N | **planned** |
| Interaction (drag/hover/click) | **Y** | N | N | N | N | N | planned |
| Matrix/Table/Network graphs | **Y** | N | N | N | Y | N | planned |
| React/Vue wrappers | **Y** | N | React | N | N | N | planned |
| py2ts / logging | **Y** | N | N | N | N | N | planned |
| Domain packs (math/physics/CS/ML) | N | N | N | CS only | plugins | N | planned |
| FormulaToGraph / step UI / CE↔GL aliases | N | N | N | N | N | aliases **Y** | rest planned |

---

## 9. What this means for Lumina (actionable)

1. **MathTex + Axes/NumberPlane/plot() are the #1–2 priority** (README priority order) — they are the biggest gap vs manim-web *and* the unblocker for every math demo.
2. **Player + `<lumina-player>` + WebM export (#3)** is what turns "a library" into "a product" — manim-web has export but no player chrome; Remotion has a player but no Manim DSL. Lumina should own both.
3. **Interaction (drag/hover/click), Matrix/Table, Network graphs, React/Vue wrappers, py2ts, logging** are confirmed manim-web features Lumina lacks → add to the plan as a "parity +" work package (doc 13 §6.5).
4. **Boolean ops** via `polygon-clipping` (pure JS, no heavy dep) is the pragmatic first cut.
5. **Export** via MediaRecorder (WebM) + gifenc (GIF) + frame dump (PNG); WebCodecs/MP4 as a fast-path enhancement.
6. **Owned WebGL stays** — no Three.js in core (confirmed again by MathBox/Three.js analysis).

---

**End of research doc. Next: [13-AUDIT-PLAN-ISSUES.md](13-AUDIT-PLAN-ISSUES.md).**
