# Lumina — a from-scratch, browser-native Manim-style animation engine

**Status: partially implemented engine, pre-alpha.** This is **not** documentation-only anymore — there is real, compiling TypeScript under `src/lumina/` (~6,500 lines) implementing a Manim-Community/ManimGL-familiar `Mobject → Animation → Scene` model with a seekable timeline and a Canvas2D renderer. It is **far from feature-complete** relative to the goal (pack the capabilities of ManimCE + ManimGL + Three.js-class 3D + a custom player, for any math/physics/CS/AI-ML explainer). See **Implementation status** below for exactly what works today and what is still missing.

The original planning docs are kept in `docs/00-INDEX.md` … `docs/11-GAPS-AND-INNOVATIONS.md` — they remain the design source of truth (API shape, architecture, domain-pack catalogue, build plan) for everything not yet built.

---

## What works today (`src/lumina/`)

- **Math kernel** (`math/`): `Vec3` ops, 3×3/4×4 matrices, full ManimCE color palette + color math, cubic-Bézier kernel (eval / split / partial / smoothing / arc-to-cubics / marching-squares implicit contouring), seeded RNG, constants, and the **full ManimCE + easing.net rate-function catalogue**.
- **Core** (`core/`): `Mobject` (hierarchy, placement: `shift/moveTo/nextTo/alignTo/toEdge/toCorner/scale/stretch/rotate/flip/arrange/arrangeInGrid`), `VMobject` (cubic-Bézier geometry, `pointwiseBecomePartial`, point-count alignment for scribble-free `Transform`), `Group`/`VGroup`/`VDict`, `.animate` proxy, `saveState/restore`, updaters, `ValueTracker`/`ComplexValueTracker`/`alwaysRedraw`, `Scene` (record-then-seek `play()`/`wait()` matching real ManimCE's `Scene.play` lifecycle), `Timeline` (pure `render(t)` seeking), `Clock`.
- **Geometry** (`mobjects/geometry/basic.ts`): Circle/Arc/Dot/Ellipse/Line/Arrow/Vector/DoubleArrow/CurvedArrow/Polygon/RegularPolygon/Star/Square/Rectangle/RoundedRectangle/ConvexHull/Cutout/Angle/RightAngle/TangentLine and more — all built from cubic Béziers so everything is `Transform`-able.
- **Text** (`mobjects/text/`): real vector glyphs via `opentype.js` (Roboto CDN fonts), `Text`/`Paragraph`/`Title`/`BulletedList`/`DecimalNumber`/`Integer`/`Variable`.
- **Graphing:** `NumberLine`/`UnitInterval` only.
- **Animations**: `Create`/`Uncreate`/`Write`/`Unwrite`/`DrawBorderThenFill`, `FadeIn`/`FadeOut`, `Grow*`, `Transform` family (`ReplacementTransform`, `TransformFromCopy`, `ClockwiseTransform`, `FadeTransform*`, `TransformMatchingShapes`/`TransformMatchingTex`), `ApplyMatrix`/`ApplyFunction`/`ApplyComplexFunction`, `Rotate`/`Rotating`/`MoveAlongPath`/`Homotopy`/`PhaseFlow`, `Indicate`/`Circumscribe`/`Flash`/`FocusOn`/`Wiggle`/`Broadcast`/`ApplyWave`, `ChangingDecimal`, `TracedPath`/`AnimatedBoundary`/`ChangeSpeed`, `AnimationGroup`/`LaggedStart`/`LaggedStartMap`/`Succession`.
- **Camera**: 2D `Camera` + `MovingCamera`/`FrameMobject` (animatable frame).
- **Renderer**: Canvas2D only (`renderers/canvas2d.ts`) — Bézier path building, background-stroke (3b1b readability trick), frustum culling, dpr-aware.
- **Build**: `package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc` now exist. `npm run typecheck` and `npm run build` both pass. `src/index.tsx` serves a minimal Canvas2D smoke-test scene (`src/demo.ts`) — **not** a real playground/player.

Run it:

```bash
npm install
npm run dev       # http://localhost:5173 — smoke-test scene
npm run typecheck
npm run build
```

---

## Implementation status vs. the "pack everything" goal — what is still missing

This is the honest gap list. Nothing below should be assumed to exist:

| Area | Status |
|---|---|
| **MathTex / Tex (LaTeX → vector glyphs)** | ❌ Not implemented yet, but **researched and de-risked**: `mathjax-full@3.2.1` is now installed as a dependency (see `package.json`). Verified via Node experiments that `mathjax-full`'s `SVG` output jax (`liteAdaptor` + `TeX` input + `SVG` output, `fontCache:'none'`) renders any LaTeX string to a tree of plain `<path d="...">` elements using **only `M L Q C Z H V T` SVG path commands** (no arcs, no `<use>`/glyph-cache refs when `fontCache:'none'`), each wrapped in `<g transform="translate(x,y) scale(s)">` nesting that exactly encodes subscript/superscript/fraction/sqrt/matrix layout — i.e. MathJax has already solved TeX box-layout the same way real Manim's LaTeX+dvisvgm pipeline does, so Lumina doesn't need to reimplement any of it. Fraction bars / sqrt bars / over/underlines come through as `<rect>` (need translating to filled VMobject rectangles). `\cssId{name}{...}` survives into the output tree as an `id` attribute on the wrapping `<g>`, which gives a ready-made per-subexpression tagging mechanism for `TransformMatchingTex` (already stubbed in `animations/transform.ts` expecting a `.tex`/`.texString` field per submobject). Bundle-size check: a Vite build importing `mathjax-full`'s core + `TeX`/`SVG`/`liteAdaptor` + a trimmed package set (base/ams/boldsymbol/newcommand/color/html/mhchem/cancel/physics/mathtools/upgreek/gensymb/textmacros/configmacros/noerrors — i.e. everything except `bussproofs`/`amscd`/`braket`/`enclose`/`extpfeil`/`centernot`/`colortbl`/`empheq`/`textcomp`/`unicode`/`verb` which are lower priority) comes to **~600 KB gzipped**, comparable to shipping a LaTeX engine (which is exactly what it is) — acceptable as a lazy-loaded chunk, not in the main bundle. **Next implementation step** (not yet coded): write `mobjects/text/mathtex.ts` with (1) an SVG-path-`d`-string → cubic-Bézier parser (upgrade `Q`→cubic same as `font.ts` already does for opentype glyphs, flatten `H`/`V`/`T` line/smooth-quad shorthands, honor `Z`), (2) a LiteElement-tree walker that accumulates the `translate`/`scale` transform stack per `<path>`/`<rect>` and bakes it into that glyph's points, (3) a `MathTex`/`Tex`/`SingleStringMathTex` class mirroring `Text`'s async `ready: Promise<this>` pattern, splitting on `\cssId` boundaries (auto-inject one `\cssId{p<i>}{...}` per top-level `{...}` argument the caller passes, Manim's `isolate=[...]` equivalent) so each becomes its own submobject with a `.tex` field for `TransformMatchingTex`. Coordinate convention to reuse: MathJax's SVG viewBox is y-up before the outer `transform="scale(1,-1)"` on `<g>`, and `font.ts`'s `glyphToCubics` already negates y for the same y-down→y-up flip when reading opentype paths — the same per-point `y = -y` convention should be applied when parsing MathJax's raw path `d` (i.e. do NOT keep the outer `scale(1,-1)` as a matrix operation; bake it into the same sign-flip). Font-size scale: MathJax font units are 1000 units/em (TeX convention) vs. opentype's 2048 for Roboto — pick a `MATHTEX_FONT_SIZE_TO_WORLD` constant analogous to `text.ts`'s `FONT_SIZE_TO_WORLD` calibrated against the SVG `viewBox`/`width`/`height` (in `ex` units) MathJax reports on the outer `<svg>`, not a hardcoded guess. |
| **Axes / NumberPlane / ComplexPlane / PolarPlane, `plot()`/`c2p`/`p2c`** | ❌ Not implemented. Only the 1D `NumberLine` exists. No 2D coordinate systems, no function plotting, no Riemann rectangles, no vector fields yet. |
| **3D anything** (`MeshMobject`, Sphere/Cube/Cylinder/Cone/Torus/platonic solids, Surface/ParametricSurface, Line3D/Arrow3D/Dot3D, `ThreeDCamera`/`ThreeDScene`, `fixInFrame` HUD compositing) | ❌ Not implemented. No WebGL renderer exists at all — `renderers/` has Canvas2D only. This is a major gap for "1D/2D/3D … any subject." |
| **Player** (`Player` class, `<lumina-player>` web component: play/pause/seek/speed/loop/fullscreen/section nav) | ❌ Not implemented. `Scene` has `startPlayback/pausePlayback/seek` primitives but no chrome/UI/web-component wraps them. |
| **Export** (WebM via MediaRecorder, GIF, PNG sequence) | ❌ Not implemented. |
| **Boolean ops** (`Union`/`Intersection`/`Difference`/`Exclusion`) | ❌ Not implemented. |
| **Graph / DiGraph mobject** + layouts (circular/tree/layered/spring) + algorithm animation (BFS/DFS/Dijkstra/MST) | ❌ Not implemented. |
| **Matrix / Table / Code (syntax-highlighted) mobjects** | ❌ Not implemented. |
| **Brace, SurroundingRectangle, BackgroundRectangle, Cross, Underline, Checkmark, DashedVMobject variants** | ❌ Not implemented (some overlap exists via `Circumscribe`'s ad-hoc box, but no first-class mobjects). |
| **VectorField / StreamLines** | ❌ Not implemented. |
| **Domain packs** — `math-linalg` (`LinearTransformationScene`), `math-calculus` (Riemann/tangent/area), `math-complex`, `math-probability`, `math-discrete`, `physics` (World/Particle/Spring/Fields/Waves/Optics), `cs` (ArrayMobject/Stack/Tree/SortScene/CodeBlock/Automata), `ml` (NeuralNet/LossSurface/AttentionMatrix) | ❌ None implemented. This is the entire "for any subject: maths, physics, CS, AI/ML" promise from `docs/09-DOMAIN-MODULES.md` — currently zero domain packs exist. |
| **JSON scene serialization**, **React wrapper**, **audio (`addSound`)**, **a11y** | ❌ Not implemented (`addSound` is an explicit documented no-op stub in `core/scene.ts`). |
| **Playground / docs site** | ❌ Not implemented. `src/index.tsx` is a bare smoke test, not an editor+preview playground. |

### Bugs fixed in this pass

- `AnimatedBoundary.target` shadowed `Mobject`'s `target` accessor (TS2610) — renamed to `boundaryTarget`.
- `Circle.scaleTo` was called through an optional-chain typed as absent on `Broadcast`'s ring array (typed as `Mobject[]`, missing the `Circle` subclass method) — retyped `rings: Circle[]`.
- `Mobject.applyMatrixToPoints` used the `mat3` **value** (namespace object) as a **type** (TS2749) — introduced and used the `Mat3` type alias correctly.
- `thereAndBackWithPause` / `there_and_back_with_pause` were typed as single-argument `RateFunc` but called with two arguments (TS2554) — retyped as a plain two-argument function.
- `Arrow.getStart()/getEnd()` called `.getStart()/.getEnd()` on `children[i]` typed as base `Mobject` (which has neither) — cast to `Line`/`ArrowTip` respectively.
- Repo had **no build tooling at all** (no `package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`) despite ~6,400 lines of TypeScript already existing — the code could not even be type-checked, let alone run in a browser. Added all of the above; `npm run typecheck` and `npm run build` now both pass, and the smoke-test scene runs live in a browser (Canvas2D `Create`/`Transform`/`.animate`/seek).
- Moved all engine sources from the repo root into `src/lumina/` (the layout `docs/10-BUILD-PLAN.md §7` specifies) and added the public barrel `src/lumina/index.ts`.

---

## Priority order for finishing "pack everything, missing nothing"

1. **MathTex** (KaTeX output → SVG path → VMobject) — unblocks nearly every math/physics/ML demo and `FormulaToGraph`.
2. **Axes / NumberPlane / plot()** — unblocks calculus, linear algebra, and most "formula ↔ graph" pedagogy.
3. **Player + `<lumina-player>` + WebM export** — required to call this a usable product, not just a library.
4. **3D** (own WebGL renderer, `MeshMobject`, primitives, `ThreeDScene`) — required for the "1D/2D/3D" promise and for linear-algebra/ML surface demos.
5. **Domain packs** (`math-linalg` → `math-calculus` → `cs`/`physics`/`ml`) — required for "any subject" coverage.
6. Boolean ops, Graph/DiGraph, Matrix/Table/Code mobjects, VectorField/StreamLines, JSON serialization, playground/docs site.

See `docs/10-BUILD-PLAN.md` for the full phased plan this follows (Phase 1 is now ~70% done; Phases 2–4 are not started).

---

## Repository layout

```
src/
  index.tsx          # Hono route: smoke-test page (NOT the playground)
  renderer.tsx        # Hono JSX shell
  demo.ts             # smoke-test scene
  lumina/             # THE ENGINE
    math/            # vec, mat, color, bezier, rng, constants, rate-functions
    core/             # mobject, vmobject, group, animation, scene, clock, timeline, style, updater
    mobjects/
      geometry/       # basic.ts — Circle/Line/Arrow/Polygon/... family
      graphing/       # number-line.ts (Axes/NumberPlane NOT here yet)
      text/           # text.ts, font.ts
    animations/       # creation, composition, transform, indication, movement, changing
    cameras/          # camera.ts (2D Camera + MovingCamera)
    renderers/        # canvas2d.ts (WebGL NOT here yet)
    index.ts          # public barrel
docs/                  # design docs (00–11) — still the source of truth for unbuilt features
public/static/         # style.css
```

## License

MIT (per `docs/00-INDEX.md` decision log). No Pi-creature assets are included or planned (copyrighted).
