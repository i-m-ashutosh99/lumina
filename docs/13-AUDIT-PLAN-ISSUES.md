# 13 — Deep Audit, Implementation Plan, and Issues (2026-09-03)

**Status:** Audit + plan. Grounded in a full read of every engine source file (`src/lumina/`, ~8,360 lines), every design doc (00–12), the docs site (`src/site/`), and a live `npm run typecheck` (passes, 0 errors).
**Purpose:** (1) state exactly what exists today, (2) list every confirmed gap/issue with severity, (3) give the prioritized implementation plan the implementer follows from now on.

**Update (2026-09-03, later pass): Phase A is done.** `mobjects/text/mathtex.ts` (`MathTex`/`Tex`/`SingleStringMathTex`), `math/svg-path.ts` (generic SVG path + affine transform parser), and `mobjects/graphing/coordinate-system.ts` (`CoordinateSystem`/`Axes`/`NumberPlane`/`ComplexPlane`/`PolarPlane`) are implemented, exported from `index.ts`, verified via Node smoke tests, and wired into the docs site (`/api/text`, `/api/graphing`, `/guides/text`, `/guides/graphing`, gallery demos). Two real bugs were found and fixed along the way: (1) `font.ts`'s `glyphToCubics` was not re-negating y after opentype.js's own internal y-flip, so every `Text` glyph rendered vertically mirrored; (2) `Axes`'s y-axis was rotated about its bounding-box center instead of its own zero-value point, which only coincides for symmetric ranges — broken for e.g. `xRange:[0,10]`. G1 and G2 below are now ✅; see the README gap table for full detail. Phase B (Player + export) is next.

Related: [12-RESEARCH-COMPARISON-2026.md](12-RESEARCH-COMPARISON-2026.md), [14-INNOVATIONS-GAPS.md](14-INNOVATIONS-GAPS.md), [10-BUILD-PLAN.md](10-BUILD-PLAN.md), [11-GAPS-AND-INNOVATIONS.md](11-GAPS-AND-INNOVATIONS.md).

---

## 1. What exists today (verified by reading source, not just README)

### 1.1 Math kernel (`src/lumina/math/`)
- `vec.ts` — Vec3 ops, `v()` coercion, rotatePoint.
- `mat.ts` — Mat3/Mat4.
- `color.ts` — full ManimCE palette + GL aliases, `interpolateColors`, `resolveColor`, `gradientAt`.
- `bezier.ts` — cubicPoint, splitCubic, partialCubic, cornersToCubics, smoothToCubics, arcToCubics, marchingSquares (implicit contouring).
- `rate-functions.ts` — full ManimCE + easing.net catalogue, `resolveRateFunc`.
- `mesh.ts` — 3D mesh generators (sphere/cube/prism/cylinder/cone/torus/parametric/platonic).
- `rng.ts` — mulberry32 seeded RNG.
- `constants.ts` — Manim constants, frame, quality presets.

### 1.2 Core (`src/lumina/core/`)
- `mobject.ts` — Mobject base: hierarchy, placement API (`shift/moveTo/nextTo/alignTo/toEdge/toCorner/scale/stretch/rotate/flip/arrange/arrangeInGrid`), style setters, snapshots, updaters, `.animate` proxy (AnimationBuilder + buildAnimateProxy).
- `vmobject.ts` — VMobject: cubic-Bézier points, `setPointsAsCorners/Smoothly`, `insertNCurves`, `alignPoints(Bidirectional)`, `pointwiseBecomePartial` (de Casteljau), `asDashed`, `prepareForNonlinearTransform`, `samplePath`.
- `group.ts` — Group/VGroup/VDict.
- `mesh-mobject.ts` — MeshMobject (positions/normals/uvs/indices mirrored to points).
- `animation.ts` — Animation base: `computeSubAlpha` (exact `(n-1)*lag_ratio+1`), `computeAlpha`, `begin/apply/finish`, `setupScene/cleanUpFromScene`, `prepareAnimation`, `registerTransformFactory`.
- `scene.ts` — Scene + MovingCameraScene/ThreeDScene/ZoomedScene/VectorScene; `play()/wait()/section()/construct()`, Timeline recording, `startPlayback/pausePlayback/seek`, `addSound` (no-op stub), `expose()`. `VectorScene.addVector` throws (intentionally unimplemented).
- `timeline.ts` — ClipEntry {t0,t1,animations}, markers, sections, pure `render(t)`, `membershipAt(t)`.
- `updater.ts` — ValueTracker/ComplexValueTracker/always/fAlways/alwaysRedraw.
- `style.ts` — Style, defaultStyle, `normalizeOptions` (snake→camel), `lerpStyle`, `applyStyleOverrides`.
- `clock.ts` — Clock.

### 1.3 Mobjects
- **Geometry** (`mobjects/geometry/basic.ts`): Circle/Arc/Dot/Ellipse/Line/Arrow/Vector/DoubleArrow/CurvedArrow/Polygon/RegularPolygon/Star/Square/Rectangle/RoundedRectangle/ConvexHull/Cutout/Angle/RightAngle/TangentLine/Elbow/LabeledDot/AnnotationDot.
- **Brace** (`brace.ts`): Brace/BraceBetweenPoints/BraceLabel/BraceText/ArcBrace.
- **Shape matchers** (`shape-matchers.ts`): SurroundingRectangle/BackgroundRectangle/Cross/Underline/Checkmark.
- **Graphing** (`graphing/number-line.ts`): NumberLine/UnitInterval with `numberToPoint/pointToNumber` (n2p/p2n).
- **Text** (`text/text.ts`, `font.ts`): Text/Paragraph/Title/BulletedList/DecimalNumber/Integer/Variable via opentype.js; `glyphToCubics` upgrades Q→C, flattens arcs.
- **3D** (`three-d/solids.ts`, `light.ts`): Sphere/Cube/Prism/Cylinder/Cone/Torus/platonic solids/Dot3D/Line3D/Arrow3D/Surface/functionSurface/SurfaceMesh/TexturedSurface; Light mobject.

### 1.4 Animations (`src/lumina/animations/`)
- creation.ts (Create/Uncreate/Write/Unwrite/DrawBorderThenFill), composition.ts (AnimationGroup/LaggedStart/LaggedStartMap/Succession), transform.ts (Transform/ReplacementTransform/TransformFromCopy/Clockwise/Counterclockwise/FadeTransform*/TransformMatchingShapes/Tex/ApplyMatrix/ApplyFunction/ApplyComplexFunction/CyclicReplace/Swap/MoveToTarget/Restore/ScaleInPlace/ShrinkToCenter/FadeToColor/ApplyMethod), indication.ts (Indicate/Circumscribe/Flash/FocusOn/Wiggle/Broadcast/ApplyWave), movement.ts (MoveAlongPath/Homotopy/PhaseFlow/Rotate/Rotating), changing.ts (ChangingDecimal/TracedPath/AnimatedBoundary/ChangeSpeed).

### 1.5 Cameras + renderers
- `cameras/camera.ts` — Camera/MovingCamera/FrameMobject/ZoomedCamera/ThreeDCamera (phi/theta/gamma/focalDistance/zoom/lightSource).
- `renderers/canvas2d.ts` — Canvas2D (background stroke, dpr, culling).
- `renderers/webgl.ts` — owned WebGL2 (Lambert+ambient, buffer caching, wireframe, transparency sort).

### 1.6 Public barrel + docs site
- `index.ts` — exports everything implemented; MathTex/Axes/Player explicitly NOT exported.
- `src/site/` — 19-route docs site; `src/demo.ts` — /dev-preview smoke test.

**Build state:** `npm run typecheck` passes (0 errors). Git: branch `main`, clean tree, last commit `d8304b8` (merge PR #6).

---

## 2. Confirmed gaps (authoritative, from README gap table + source read)

| # | Area | Status | Severity |
|---|---|---|---|
| G1 | **MathTex / Tex** (LaTeX → vector glyphs) | ✅ **done** — `mobjects/text/mathtex.ts` via mathjax-full | — |
| G2 | **Axes / NumberPlane / ComplexPlane / PolarPlane, `plot()`/`c2p`/`p2c`** | ✅ **done** — `mobjects/graphing/coordinate-system.ts` | — |
| G3 | **Player + `<lumina-player>` + WebM export** | ❌ Scene has playback primitives only | **P0 — next up** |
| G4 | **Boolean ops** (Union/Intersection/Difference/Exclusion) | ❌ | P1 |
| G5 | **Graph/DiGraph** + layouts + algorithm animation | ❌ | P1 |
| G6 | **Matrix/Table/Code** mobjects | ❌ | P1 |
| G7 | **VectorField/StreamLines** | ❌ | P1 |
| G8 | **Domain packs** (math-linalg/calculus/complex/probability/discrete, physics, cs, ml) | ❌ zero exist | P1 |
| G9 | **JSON scene serialization** | ❌ (Mobject.toJSON exists, no Scene round-trip) | P2 |
| G10 | **React wrapper** | ❌ | P2 |
| G11 | **Audio (`addSound`)** | ❌ explicit no-op stub | P2 |
| G12 | **a11y** | ❌ | P2 |
| G13 | **Playground** (paste-code-and-render) | ❌ | P1 |
| G14 | **Interaction** (Draggable/Hoverable/Clickable) | ❌ (manim-web has it) | P2 |
| G15 | **py2ts / structured logging** | ❌ (manim-web has it) | P2 |
| G16 | **3D follow-ups**: textures, `fixInFrame` HUD, animated `moveCamera`, live browser-visual QA | partial | P1 |

---

## 3. Issues found during the audit (bugs / risks / debt)

### 3.1 Bugs / correctness risks
- **I1 — `VectorScene.addVector` throws** (`core/scene.ts:631`): intentional stub, but any `VectorScene` demo that calls `addVector` crashes. Needs implementation or a clear error message. (Low effort.)
- **I2 — `addSound` is a silent no-op** (`core/scene.ts:410`): documented, but a caller gets no warning. Consider a console.warn until implemented.
- **I3 — `Mobject.copy()` on `Text`/`MathTex`** (async-ready VGroup): `copy()` calls `new Ctor()` with no args and `copyOnto` copies points; for async-built mobjects the copy may be empty until `ready` resolves. **Verified for `MathTex`**: `MathTexPart.copy()` is overridden to preserve `.tex`; `TransformMatchingTex` was exercised end-to-end via the gallery demo (`site/demos/mathtex.ts`) and works.
- **I4 — `nextTo` alignedEdge logic** (`mobject.ts:230-239`): the `alignDir` computation has a `dir[1] !== 0 || true` tautology; behavior is fragile for diagonal directions. Unit-test before relying on it.
- **I5 — `TransformMatchingTex` expects `.tex`/`.texString` per submobject — RESOLVED.** `mathtex.ts` now tags every glyph LEAF (not just the `MathTexPart` container, whose own `.points` is always empty) with `.tex`, matching what `TransformMatchingTex`'s leaf-only matcher (`animations/transform.ts`) expects. Verified working via the gallery demo.
- **I6 — `NumberLine` log-scale** (`applyScale`): uses `Math.log10` with `max(x, 1e-9)`; negative-range log axes will silently clamp. Document or guard.
- **I7 — `CurvesAsSubmobjects`/`asDashed`** produce many tiny VMobjects — performance risk at scale (doc 10 §3.4 quality bar). Monitor.

### 3.2 Architecture / API debt
- **I8 — MathTex backend choice — RESOLVED.** Implemented with **mathjax-full** (true TeX layout + `\cssId` tagging); the SVG-path→Bézier parser (`math/svg-path.ts`) is generic/backend-agnostic, so KaTeX (or any other SVG-emitting TeX engine) could be swapped in later without touching the parser.
- **I9 — Async construction pattern — RESOLVED.** `MathTex` follows `Text`'s exact pattern: constructor is synchronous, `ready: Promise<this>` resolves once MathJax has typeset and glyphs are built.
- **I10 — Bundle size**: mathjax-full's dynamic `import()` in `getMathJaxEngine()` is only triggered on first `MathTex`/`Tex` construction, keeping it out of the main bundle path (still ~600 kB gz when it does load — confirmed a real concern, not yet split into its own explicit Vite chunk with a `<link rel="modulepreload">` hint; that polish is still open).
- **I11 — No test runner wired** (doc 10 §9): typecheck only. Add `node:test` or Vitest for math/bezier/timeline golden tests as features land.
- **I12 — `docs/00-INDEX.md` header** still says "No library code has been written" — stale (README corrects it). Update index to reflect reality.

---

## 4. Implementation plan (priority order — follows README)

### Phase A — Math typesetting + graphing (P0) — ✅ DONE
1. ~~**A1 — `mobjects/text/mathtex.ts`**~~ — **done**: `MathTex`/`Tex`/`SingleStringMathTex` via mathjax-full SVG → cubic-Bézier parser (`math/svg-path.ts`). Follows `Text`'s async-ready pattern. Every glyph leaf tagged `.tex` for `TransformMatchingTex`. `index.ts` exports added. mathjax-full loaded via lazy dynamic `import()`.
2. ~~**A2 — `mobjects/graphing/axes.ts`**~~ — **done** (as `mobjects/graphing/coordinate-system.ts`): `Axes` (`xRange`/`yRange`, `c2p`/`p2c`, `plot()`), `NumberPlane` (background grid lines), `ComplexPlane` (`complexToPoint`/`pointToComplex`), `PolarPlane` (rings/spokes/`plotPolarGraph`). Follows NumberLine's n2p/p2n pattern. **Not yet done**: `ThreeDAxes` (3D) — still open, low priority until 3D follow-ups (G16) are picked up.
3. **A3 — graphing helpers** — **partially done**: `plotParametric` (parametric curves), `getRiemannRectangles`, `getArea`, `getVerticalLine` are implemented on `CoordinateSystem`. **Still open**: `ImplicitFunction` (via `marchingSquares`, which already exists in `math/bezier.ts`), `getTangentLine`/`secant_slope_group`-style calculus helpers, `getGraphLabel()`.
4. ~~**A4 — smoke tests + docs**~~ — **done**: Node esbuild-bundled smoke tests for both MathTex and Axes/NumberPlane (zero-point alignment, roundtrips, bounding boxes) all passed; gallery demos added (`site/demos/mathtex.ts`, `site/demos/graphing.ts`); new docs site pages (`/api/text` MathTex section, `/api/graphing`, `/guides/graphing`, `/guides/text` MathTex section); `npm run typecheck` + `npm run build` pass.

### Phase B — Player + export (P0)
5. **B1 — `player/player.ts`**: JS `Player` class wrapping Scene playback primitives (play/pause/seek/speed/loop/fullscreen/keyboard/sections).
6. **B2 — `player/element.ts`**: `<lumina-player>` custom element + `chrome.css`.
7. **B3 — `export/webm.ts`** (MediaRecorder + captureStream), **`export/gif.ts`** (gifenc), **`export/png.ts`** (frame dump). WebCodecs/MP4 later (doc 12 §6.3).

### Phase C — Completeness (P1)
8. **C1 — Boolean ops** via `polygon-clipping` (pure JS first cut, doc 12 §6.2).
9. **C2 — Graph/DiGraph** + layouts (circular/tree/layered/spring) + algorithm animation (BFS/DFS/Dijkstra/MST).
10. **C3 — Matrix/Table/Code** mobjects.
11. **C4 — VectorField/StreamLines**.
12. **C5 — 3D follow-ups**: textures, `fixInFrame` HUD, animated `moveCamera`, browser-visual QA.

### Phase D — Domain packs (P1) + parity (P2)
13. **D1 — packs**: `math-linalg` (LinearTransformationScene), `math-calculus` (Riemann/tangent/area), `math-complex`, `math-probability`, `math-discrete`, `cs` (ArrayMobject/SortScene/graph algorithms), `physics` (World/Spring/fields/waves), `ml` (NeuralNet/LossSurface/AttentionMatrix).
14. **D2 — parity +**: Interaction (Draggable/Hoverable/Clickable), JSON scene round-trip, React wrapper, py2ts, structured logging, audio, a11y, playground.

---

## 5. Acceptance criteria per phase

- **A**: ✅ met — `Write(MathTex("x^2 + \\frac{1}{2}"))` renders as morphable VMobjects; `TransformMatchingTex` morphs formulas (verified with `a^2+b^2` ↔ `b^2+a^2` in the gallery demo); `Axes` plots functions with `c2p` correct for both symmetric and asymmetric ranges; typecheck+build pass.
- **B**: acceptance scene plays/seeks/embeds via `<lumina-player>`; WebM/GIF/PNG export produces non-empty files of ≈ scene duration.
- **C**: every README gap row flips to ✅.
- **D**: one golden demo per domain pack (doc 10 §9).

---

## 6. Immediate next actions

1. ~~Write `docs/14-INNOVATIONS-GAPS.md`~~ — done.
2. ~~Update `docs/00-INDEX.md`~~ — done.
3. ~~Implement **A1 MathTex**, then **A2 Axes/NumberPlane/plot()**~~ — done (this doc, section 4 Phase A).
4. ~~`npm run typecheck` + `npm run build`; smoke-test~~ — done, both pass; docs site pages verified serving 200 with expected content.
5. Commit + squash + PR from `genspark_ai_developer` → main; provide PR link — **in progress, do this next**.
6. **Start Phase B — Player + export** (`player/player.ts`, `<lumina-player>` custom element, WebM/GIF/PNG export) — the next P0 priority per the README.

---

**End of audit/plan doc. Next: [14-INNOVATIONS-GAPS.md](14-INNOVATIONS-GAPS.md).**
