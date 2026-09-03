# Lumina — a from-scratch, browser-native Manim-style animation engine

**Status: partially implemented engine, pre-alpha.** This is **not** documentation-only anymore — there is real, compiling TypeScript under `src/lumina/` (**8,360+ lines**) implementing a Manim-Community/ManimGL-familiar `Mobject → Animation → Scene` model with a seekable timeline, a Canvas2D 2D renderer, and now an **owned WebGL2 3D renderer** composited underneath it. A full documentation website (19 routes: overview, quickstart, 6 guides, 6 API reference pages, a demo gallery with 3 live runnable demos, 2 deployment guides) lives under `src/site/` (**10,460+ lines total across `src/`**). It is **far from feature-complete** relative to the goal (pack the capabilities of ManimCE + ManimGL + Three.js-class 3D + a custom player, for any math/physics/CS/AI-ML explainer). See **Implementation status** below for exactly what works today and what is still missing.

The original planning docs are kept in `docs/00-INDEX.md` … `docs/11-GAPS-AND-INNOVATIONS.md` — they remain the design source of truth (API shape, architecture, domain-pack catalogue, build plan) for everything not yet built.

---

## What works today (`src/lumina/`)

- **Math kernel** (`math/`): `Vec3` ops, 3×3/4×4 matrices, full ManimCE color palette + color math, cubic-Bézier kernel (eval / split / partial / smoothing / arc-to-cubics / marching-squares implicit contouring), seeded RNG, constants, and the **full ManimCE + easing.net rate-function catalogue**.
- **Core** (`core/`): `Mobject` (hierarchy, placement: `shift/moveTo/nextTo/alignTo/toEdge/toCorner/scale/stretch/rotate/flip/arrange/arrangeInGrid`), `VMobject` (cubic-Bézier geometry, `pointwiseBecomePartial`, point-count alignment for scribble-free `Transform`), `Group`/`VGroup`/`VDict`, `.animate` proxy, `saveState/restore`, updaters, `ValueTracker`/`ComplexValueTracker`/`alwaysRedraw`, `Scene` (record-then-seek `play()`/`wait()` matching real ManimCE's `Scene.play` lifecycle), `Timeline` (pure `render(t)` seeking), `Clock`.
- **Geometry** (`mobjects/geometry/basic.ts`): Circle/Arc/Dot/Ellipse/Line/Arrow/Vector/DoubleArrow/CurvedArrow/Polygon/RegularPolygon/Star/Square/Rectangle/RoundedRectangle/ConvexHull/Cutout/Angle/RightAngle/TangentLine and more — all built from cubic Béziers so everything is `Transform`-able.
- **Text** (`mobjects/text/`): real vector glyphs via `opentype.js` (Roboto CDN fonts), `Text`/`Paragraph`/`Title`/`BulletedList`/`DecimalNumber`/`Integer`/`Variable`.
- **Graphing:** `NumberLine`/`UnitInterval` only.
- **Animations**: `Create`/`Uncreate`/`Write`/`Unwrite`/`DrawBorderThenFill`, `FadeIn`/`FadeOut`, `Grow*`, `Transform` family (`ReplacementTransform`, `TransformFromCopy`, `ClockwiseTransform`, `FadeTransform*`, `TransformMatchingShapes`/`TransformMatchingTex`), `ApplyMatrix`/`ApplyFunction`/`ApplyComplexFunction`, `Rotate`/`Rotating`/`MoveAlongPath`/`Homotopy`/`PhaseFlow`, `Indicate`/`Circumscribe`/`Flash`/`FocusOn`/`Wiggle`/`Broadcast`/`ApplyWave`, `ChangingDecimal`, `TracedPath`/`AnimatedBoundary`/`ChangeSpeed`, `AnimationGroup`/`LaggedStart`/`LaggedStartMap`/`Succession`.
- **Camera**: 2D `Camera` + `MovingCamera`/`FrameMobject`/`ZoomedCamera` (animatable frame), plus a real **3D `ThreeDCamera`** (ManimCE-style `phi`/`theta`/`gamma`/`focalDistance`/`zoom`/`frameCenter`/`fovDegrees`, `lightSource`, ambient rotation, `viewMatrix()`/`projectionMatrix()`).
- **3D pipeline** (`math/mesh.ts`, `core/mesh-mobject.ts`, `mobjects/three-d/`): mesh kernel (sphere/cube/prism/cylinder/cone/torus/tetrahedron/octahedron/icosahedron/dodecahedron/parametric surface), `MeshMobject` (shares the same placement API as 2D `Mobject` via a `positions`↔`points` mirror), `Sphere`/`Cube`/`Prism`/`Cylinder`/`Cone`/`Torus`/platonic solids/`Dot3D`/`Line3D`/`Arrow3D`/`Surface`/`functionSurface`, and a `Light` mobject (point/directional/ambient, itself animatable via `.animate`/`shift`).
- **Renderer**: Canvas2D (`renderers/canvas2d.ts`) — Bézier path building, background-stroke (3b1b readability trick), frustum culling, dpr-aware — **plus a new owned WebGL2 renderer** (`renderers/webgl.ts`): Lambert + ambient shading, per-mesh GPU buffer caching, wireframe mode, back-to-front transparency sort. The two are composited as stacked canvases (WebGL 3D behind, transparent Canvas2D 2D on top) by the new `ThreeDScene`/`ZoomedScene`/`VectorScene` classes in `core/scene.ts`.
- **Shape-matcher & annotation mobjects** (`mobjects/geometry/brace.ts`, `mobjects/geometry/shape-matchers.ts`): `Brace`/`BraceBetweenPoints`/`BraceLabel`/`ArcBrace`, `SurroundingRectangle`, `BackgroundRectangle`, `Cross`, `Underline`, `Checkmark` — all `Transform`-able VMobjects/VGroups fitted to an arbitrary target mobject's bounding box.
- **Documentation website** (`src/site/`): a full Manim/Three.js-style docs site wired into Hono routes — Overview/Home, Quickstart, 6 narrative guides (installation, core-concepts, animations, timeline-seek, text, camera-3d, updaters), 6 API reference pages (core, geometry, three-d, animations, text, cameras-renderers), a **Demo Gallery** with 3 live in-browser runnable demos (shapes, text, 3D), and 2 deployment guides (publishing to npm, hosting on Cloudflare). 19 routes total, all typechecked, built, and live-verified (Playwright console capture: zero JS errors on `/` and `/gallery`).
- **Build**: `package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc` now exist. `npm run typecheck` and `npm run build` both pass. `src/index.tsx` serves the full documentation site above at `/`, plus a separate minimal Canvas2D engine smoke-test page at `/dev-preview` (`src/demo.ts`) — the docs site is a real reference/demo site, but there is still no editor+preview **playground** (paste-code-and-render) or a packaged `Player`/`<lumina-player>` component; see the gap table below.

Run it:

```bash
npm install
npm run dev       # http://localhost:5173 — documentation site (/) + engine smoke test (/dev-preview)
npm run typecheck
npm run build
```

---

## Implementation status vs. the "pack everything" goal — what is still missing

This is the honest gap list. Nothing below should be assumed to exist:

| Area | Status |
|---|---|
| **MathTex / Tex (LaTeX → vector glyphs)** | ✅ **Implemented** (`mobjects/text/mathtex.ts`, `math/svg-path.ts`): `MathTex`/`Tex`/`SingleStringMathTex` render real LaTeX via `mathjax-full@3.2.1`'s `liteAdaptor` + `TeX` input jax (`AllPackages`) + `SVG` output jax (`fontCache:'none'`), producing a synchronous SVG tree of `<path>`/`<rect>` elements which is walked and converted to cubic-Bézier `VMobject` glyphs by a new generic SVG path parser (`math/svg-path.ts`: handles absolute/relative `M/L/H/V/C/S/Q/T/Z`, degree-raises quadratics to cubics, composes nested `translate/scale/rotate/matrix` transforms per the SVG/CSS affine convention). `\cssId{p<i>}{...}` tagging (from the `isolate`/multi-arg constructor API) is preserved on **both** the `MathTexPart` container *and* every individual glyph leaf, so `TransformMatchingTex` (leaf-only matching, since VGroup containers have empty `.points`) works correctly end-to-end. Supports `color`, `fontSize`, `isolate`, `texToColorMap`, `argSeparator`, and `Tex extends MathTex` for text-mode (non-display) rendering. Async `ready: Promise<this>` pattern matches `Text`/`NumberLine`/`Axes`. **Bug fixed along the way**: `mobjects/text/font.ts`'s `glyphToCubics` was double-flipping (or rather, *not* re-flipping) the y-axis — opentype.js's `Glyph.getPath()` already negates y internally when converting TrueType font space to SVG/canvas space, so every `Text` glyph in Lumina was rendering vertically mirrored before this pass; fixed by re-negating y once more to match Lumina's y-up world (matches real Manim/ManimGL). Verified via Node smoke tests (esbuild-bundled TS run in Node, no browser needed) plus visual SVG→PNG (`rsvg-convert`) inspection. **Still missing**: `\begin{matrix}`/`bmatrix` layout is handled by MathJax itself (no extra work needed), but dedicated color-per-character convenience helpers beyond `texToColorMap` and matrix-aware `getPartByTex` disambiguation for repeated substrings are not yet polished. |
| **Axes / NumberPlane / ComplexPlane / PolarPlane, `plot()`/`c2p`/`p2c`** | ✅ **Implemented** (`mobjects/graphing/coordinate-system.ts`): `CoordinateSystem` base (`coordsToPoint`/`c2p`, `pointToCoords`/`p2c`, `plot()`, `plotParametric()`, `getRiemannRectangles()`, `getArea()`, `pointToDot()`, `getVerticalLine()`); `Axes` composes two `NumberLine`s; `NumberPlane` adds background/faded grid lines behind the axes; `ComplexPlane extends NumberPlane` with `complexToPoint`/`pointToComplex`; `PolarPlane` is an independent r/θ system with rings+spokes+`plotPolarGraph()`. **Bug fixed along the way**: the initial `Axes` construction rotated/positioned the y-axis about its bounding-box center, which only coincides with world-value `0` for symmetric ranges — for an asymmetric range like `xRange:[0,10]` the axes would cross at the wrong point. Fixed by rotating the y-axis about `numberToPoint(0)` (not the bbox center) and then shifting both axes so each one's own zero-value point lands exactly at world `(0,0,0)`, which is the correct definition of where a coordinate system's origin must sit regardless of range symmetry. Verified via Node smoke tests (zero-point alignment checked for both symmetric and asymmetric ranges, plus roundtrip `coordsToPoint`→`pointToCoords` checks). **Still missing**: `getGraphLabel()` convenience positioning, `input_to_graph_point`/`secant_slope_group`-style calculus helpers, and log-scale axes. |
| **3D anything** (`MeshMobject`, Sphere/Cube/Cylinder/Cone/Torus/platonic solids, Surface/ParametricSurface, Line3D/Arrow3D/Dot3D, `ThreeDCamera`/`ThreeDScene`, `fixInFrame` HUD compositing) | ✅ **Implemented**: mesh kernel + `MeshMobject` + 10 solid primitives + `Surface`/`functionSurface` + `Line3D`/`Arrow3D`/`Dot3D` + `Light` + `ThreeDCamera` + an owned WebGL2 renderer (Lambert+ambient shader, GPU buffer caching, wireframe, transparency sort) + `ThreeDScene`/`ZoomedScene`/`VectorScene`, all wired through `Transform`/`.animate`. Typecheck+build pass and the data pipeline is verified via scripted smoke tests. **Still missing**: texture/image mapping, shader-based deformation, animated `moveCamera({runTime})` tweening, `fixInFrame` HUD compositing helper, and a live in-browser visual confirmation of the WebGL output (only CPU-side data was verified this pass, not actual rendered pixels). |
| **Player** (`Player` class, `<lumina-player>` web component: play/pause/seek/speed/loop/fullscreen/section nav) | ❌ Not implemented. `Scene` has `startPlayback/pausePlayback/seek` primitives but no chrome/UI/web-component wraps them. |
| **Export** (WebM via MediaRecorder, GIF, PNG sequence) | ❌ Not implemented. |
| **Boolean ops** (`Union`/`Intersection`/`Difference`/`Exclusion`) | ❌ Not implemented. |
| **Graph / DiGraph mobject** + layouts (circular/tree/layered/spring) + algorithm animation (BFS/DFS/Dijkstra/MST) | ❌ Not implemented. |
| **Matrix / Table / Code (syntax-highlighted) mobjects** | ❌ Not implemented. |
| **Brace, SurroundingRectangle, BackgroundRectangle, Cross, Underline, Checkmark** | ✅ **Implemented** (`mobjects/geometry/brace.ts`, `mobjects/geometry/shape-matchers.ts`): `Brace`/`BraceBetweenPoints`/`BraceLabel`/`ArcBrace`, `SurroundingRectangle`, `BackgroundRectangle`, `Cross`, `Underline`, `Checkmark`, all fitted to an arbitrary target's bounding box and `Transform`-able. **Note**: `DashedVMobject` does not exist as a separate class — dashing is exposed as the `VMobject.asDashed()` method (used by e.g. `DashedLine`), not a standalone mobject wrapper; that's a minor naming gap, not a missing feature. |
| **VectorField / StreamLines** | ❌ Not implemented. |
| **Domain packs** — `math-linalg` (`LinearTransformationScene`), `math-calculus` (Riemann/tangent/area), `math-complex`, `math-probability`, `math-discrete`, `physics` (World/Particle/Spring/Fields/Waves/Optics), `cs` (ArrayMobject/Stack/Tree/SortScene/CodeBlock/Automata), `ml` (NeuralNet/LossSurface/AttentionMatrix) | ❌ None implemented. This is the entire "for any subject: maths, physics, CS, AI/ML" promise from `docs/09-DOMAIN-MODULES.md` — currently zero domain packs exist. |
| **JSON scene serialization**, **React wrapper**, **audio (`addSound`)**, **a11y** | ❌ Not implemented (`addSound` is an explicit documented no-op stub in `core/scene.ts`). |
| **Docs site** | ✅ **Implemented**: full documentation website under `src/site/` (19 routes — overview, quickstart, 6 guides, 6 API reference pages, demo gallery with 3 live demos, 2 deployment guides), wired into `src/index.tsx`'s Hono routes, typechecked, built, and live-verified with zero JS console errors. |
| **Playground** (paste-code-and-render editor, distinct from the docs site above) | ❌ Not implemented. There is no in-browser code editor that takes arbitrary user `Scene` code and renders it live — the Demo Gallery only runs 3 pre-written, hard-coded demos. |

### Bugs fixed in this pass

- `AnimatedBoundary.target` shadowed `Mobject`'s `target` accessor (TS2610) — renamed to `boundaryTarget`.
- `Circle.scaleTo` was called through an optional-chain typed as absent on `Broadcast`'s ring array (typed as `Mobject[]`, missing the `Circle` subclass method) — retyped `rings: Circle[]`.
- `Mobject.applyMatrixToPoints` used the `mat3` **value** (namespace object) as a **type** (TS2749) — introduced and used the `Mat3` type alias correctly.
- `thereAndBackWithPause` / `there_and_back_with_pause` were typed as single-argument `RateFunc` but called with two arguments (TS2554) — retyped as a plain two-argument function.
- `Arrow.getStart()/getEnd()` called `.getStart()/.getEnd()` on `children[i]` typed as base `Mobject` (which has neither) — cast to `Line`/`ArrowTip` respectively.
- Repo had **no build tooling at all** (no `package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`) despite ~6,400 lines of TypeScript already existing — the code could not even be type-checked, let alone run in a browser. Added all of the above; `npm run typecheck` and `npm run build` now both pass, and the smoke-test scene runs live in a browser (Canvas2D `Create`/`Transform`/`.animate`/seek).
- Moved all engine sources from the repo root into `src/lumina/` (the layout `docs/10-BUILD-PLAN.md §7` specifies) and added the public barrel `src/lumina/index.ts`.
- **`AnimationGroup`/`LaggedStart`/`Succession`/`LaggedStartMap` were broken for their primary real-world use case.** `splitAnimsOpts()` in `animations/composition.ts` only unwrapped a leading-array call form (`new AnimationGroup([a, b], opts)`) when the constructor received *exactly one* argument; but `LaggedStart`/`Succession`/`LaggedStartMap` all internally call `super(anims, opts)` — an already-built array **plus** an options object, i.e. two arguments — so the unwrap never fired, the whole array got treated as a single "animation-like" item, and `prepareAnimation()` (meant to run per-element) ran on the array itself, throwing `"play() expects Animation or .animate builder"` immediately. **Every call to `LaggedStart(...)`/`Succession(...)` with real `Animation` instances was broken** before this fix. Rewrote `splitAnimsOpts()` to detect the array-leading form unconditionally (regardless of total argument count) before falling back to the variadic form. Verified via targeted reproduction scripts and a full smoke-test re-run — `AnimationGroup`, `LaggedStart`, and `Succession` now all report correct `runTime`/timing.
- **`Torus`'s documented API signature didn't match its real constructor.** `src/site/pages/api/three-d.tsx` claimed `new Torus({ majorRadius?, minorRadius?, resolution? })`; the real constructor (`mobjects/three-d/solids.ts`) is `{ radius?, tubeRadius?, color? }` with resolution hardcoded at 32×16 segments (not configurable). Corrected the docs page.
- Ran a broader functional-correctness audit this pass beyond typecheck/build (which only prove the code compiles, not that it behaves correctly): constructed and exercised every 3D solid primitive, the full Brace/shape-matcher family, `NumberLine`/`UnitInterval`, most `Animation` subclasses individually (including the ones with unusual argument orders — `Homotopy(fn, mobject)`, and the ones taking a raw `Vec3` point rather than a `Mobject` — `Flash`/`FocusOn`/`Broadcast`), the remaining 2D geometry mobjects (`Ellipse`, `ArcBetweenPoints`, `Elbow`, `CurvedArrow`/`CurvedDoubleArrow`, `DoubleArrow`, `LabeledDot`, `AnnotationDot`, `RegularPolygram`, `Star`), and all four `Scene` subclasses (`MovingCameraScene` frame animation, `ThreeDScene` camera orientation + ambient rotation, `ZoomedScene.activateZooming`, `VectorScene`). All confirmed working as implemented.
- Added a real `LICENSE` file (MIT) and a `"license": "MIT"` field in `package.json` — previously the README asserted MIT as settled while `docs/00-INDEX.md` only ever phrased it as "recommended... Confirm", and no LICENSE file existed anywhere in the repo (a real gap, especially since the npm-publishing deployment guide assumes a license is set).

---

## Priority order for finishing "pack everything, missing nothing"

1. ~~**MathTex** (LaTeX via `mathjax-full` → SVG path → VMobject)~~ — **done**: `MathTex`/`Tex`/`SingleStringMathTex`, `TransformMatchingTex` now functional end-to-end (see `mobjects/text/mathtex.ts`, `math/svg-path.ts`).
2. ~~**Axes / NumberPlane / plot()**~~ — **done**: `CoordinateSystem`/`Axes`/`NumberPlane`/`ComplexPlane`/`PolarPlane` with `plot()`/`c2p`/`p2c`/Riemann rectangles/area (see `mobjects/graphing/coordinate-system.ts`).
3. **Player + `<lumina-player>` + WebM export** — required to call this a usable product, not just a library. **Next up.**
4. ~~**3D** (own WebGL renderer, `MeshMobject`, primitives, `ThreeDScene`)~~ — **done**: mesh kernel, `MeshMobject`, 10 solids, `Surface`, `Light`, `ThreeDCamera`, WebGL2 renderer, `ThreeDScene`/`ZoomedScene`/`VectorScene`. Remaining 3D follow-ups: textures, `fixInFrame` HUD, live browser-visual QA.
5. **Domain packs** (`math-linalg` → `math-calculus` → `cs`/`physics`/`ml`) — required for "any subject" coverage. Now unblocked by MathTex + Axes/NumberPlane.
6. Boolean ops, Graph/DiGraph, Matrix/Table/Code mobjects, VectorField/StreamLines, JSON serialization, paste-code-and-render playground.

~~**Brace / shape-matcher mobjects** (`Brace`, `SurroundingRectangle`, `BackgroundRectangle`, `Cross`, `Underline`, `Checkmark`)~~ — **done**.
~~**Documentation website** (guides + API reference + demo gallery + deployment docs)~~ — **done**; the remaining "playground" item above is a distinct, still-unbuilt feature (arbitrary user code → live render), not the docs site itself.

See `docs/10-BUILD-PLAN.md` for the full phased plan this follows (Phase 1 is now further along with MathTex + Axes/NumberPlane done; Phases 2–4 are not started).

---

## Repository layout

```
src/
  index.tsx          # Hono routes: full docs site (see site/ below) at "/", engine smoke test at "/dev-preview"
  renderer.tsx        # Hono JSX shell (used only by the /dev-preview route)
  demo.ts             # /dev-preview smoke-test scene
  lumina/             # THE ENGINE
    math/            # vec, mat, color, bezier, rng, constants, rate-functions, mesh (3D mesh kernel), svg-path (generic SVG d-string parser + affine transforms, used by mathtex.ts)
    core/             # mobject, vmobject, group, mesh-mobject, animation, scene, clock, timeline, style, updater
    mobjects/
      geometry/       # basic.ts — Circle/Line/Arrow/Polygon/... family; brace.ts, shape-matchers.ts
      graphing/       # number-line.ts, coordinate-system.ts (Axes/NumberPlane/ComplexPlane/PolarPlane)
      text/           # text.ts, font.ts, mathtex.ts (MathTex/Tex via mathjax-full)
      three-d/        # solids.ts, light.ts — Sphere/Cube/.../Torus/Surface, Light
    animations/       # creation, composition, transform, indication, movement, changing
    cameras/          # camera.ts — 2D Camera + MovingCamera/ZoomedCamera/FrameMobject, 3D ThreeDCamera
    renderers/        # canvas2d.ts (2D) + webgl.ts (owned WebGL2 3D renderer)
    index.ts          # public barrel
  site/               # documentation website (19 Hono routes wired from src/index.tsx)
    layout.tsx         # shared <html> shell + nav
    pages/
      home.tsx, quickstart.tsx
      guides/          # installation, core-concepts, animations, timeline-seek, text, camera-3d, updaters
      api/             # core, geometry, three-d, animations, text, cameras-renderers
      gallery.tsx       # Demo Gallery — 3 live runnable demos
      deployment/       # npm.tsx, cloudflare.tsx
    demos/              # shapes.ts, text.ts, three-d.ts — the Scene code the gallery runs live
docs/                  # design docs (00–11) — still the source of truth for unbuilt features
public/static/         # style.css
LICENSE                 # MIT
```

## License

MIT — see `LICENSE`. No Pi-creature assets are included or planned (copyrighted).
