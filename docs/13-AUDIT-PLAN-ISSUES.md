# 13 — Deep Audit, Implementation Plan, and Issues (2026-09-03)

**Status:** Audit + plan. Grounded in a full read of every engine source file (`src/lumina/`, ~8,360 lines), every design doc (00–12), the docs site (`src/site/`), and a live `npm run typecheck` (passes, 0 errors).
**Purpose:** (1) state exactly what exists today, (2) list every confirmed gap/issue with severity, (3) give the prioritized implementation plan the implementer follows from now on.

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
| G1 | **MathTex / Tex** (LaTeX → vector glyphs) | ❌ not implemented; **de-risked** (doc 12 §7) | **P0** |
| G2 | **Axes / NumberPlane / ComplexPlane / PolarPlane, `plot()`/`c2p`/`p2c`** | ❌ only NumberLine exists | **P0** |
| G3 | **Player + `<lumina-player>` + WebM export** | ❌ Scene has playback primitives only | **P0** |
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
- **I3 — `Mobject.copy()` on `Text`/`MathTex`** (async-ready VGroup): `copy()` calls `new Ctor()` with no args and `copyOnto` copies points; for async-built mobjects the copy may be empty until `ready` resolves. `.animate` on Text/MathTex depends on this — must be verified once MathTex lands.
- **I4 — `nextTo` alignedEdge logic** (`mobject.ts:230-239`): the `alignDir` computation has a `dir[1] !== 0 || true` tautology; behavior is fragile for diagonal directions. Unit-test before relying on it.
- **I5 — `TransformMatchingTex` expects `.tex`/`.texString` per submobject** — no MathTex exists yet, so it's untested end-to-end. MathTex must tag submobjects accordingly (doc 12 §7).
- **I6 — `NumberLine` log-scale** (`applyScale`): uses `Math.log10` with `max(x, 1e-9)`; negative-range log axes will silently clamp. Document or guard.
- **I7 — `CurvesAsSubmobjects`/`asDashed`** produce many tiny VMobjects — performance risk at scale (doc 10 §3.4 quality bar). Monitor.

### 3.2 Architecture / API debt
- **I8 — MathTex backend choice**: README says KaTeX; research doc 12 §7 verifies mathjax-full. Decision: use **mathjax-full** (true TeX layout + `cssId` tagging), keep the SVG-path→Bézier parser backend-agnostic so KaTeX can be swapped later.
- **I9 — Async construction pattern**: `Text` builds empty then `ready: Promise<this>`. MathTex must follow the same pattern (constructor synchronous, `ready` for geometry) so `.animate`/`Write`/`Transform` work.
- **I10 — Bundle size**: mathjax-full ≈ 600 kB gz — must be a **lazy-loaded chunk**, not in the main bundle (doc 12 §7, README note).
- **I11 — No test runner wired** (doc 10 §9): typecheck only. Add `node:test` or Vitest for math/bezier/timeline golden tests as features land.
- **I12 — `docs/00-INDEX.md` header** still says "No library code has been written" — stale (README corrects it). Update index to reflect reality.

---

## 4. Implementation plan (priority order — follows README)

### Phase A — Math typesetting + graphing (P0, this pass)
1. **A1 — `mobjects/text/mathtex.ts`**: `MathTex`/`Tex` via mathjax-full SVG → cubic-Bézier parser (doc 12 §7). Follow `Text`'s async-ready pattern. Tag submobjects with `tex` for `TransformMatchingTex`. Add `index.ts` exports. Lazy-load mathjax chunk.
2. **A2 — `mobjects/graphing/axes.ts`**: `Axes` (x_range/y_range, `c2p`/`p2c`, `plot()`, `getXAxis`/`getYAxis`, `add_coordinates`), `NumberPlane` (grid lines + faded unit squares), `ComplexPlane`, `PolarPlane` (grid arc/line families), `ThreeDAxes` (3D). Follow NumberLine's n2p/p2n pattern.
3. **A3 — graphing helpers**: `ParametricFunction`, `ImplicitFunction` (via marchingSquares), `getRiemannRectangles`, `getArea`, `getTangentLine` — the calculus pack seeds.
4. **A4 — smoke tests + docs**: extend `src/demo.ts` / gallery with a MathTex + Axes scene; verify typecheck + build.

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

- **A**: `Write(MathTex("x^2 + \\frac{1}{2}"))` renders as morphable VMobjects; `TransformMatchingTex` morphs `x^2` → `x^3`; `Axes` plots `sin(x)` with `c2p` correct; typecheck+build pass.
- **B**: acceptance scene plays/seeks/embeds via `<lumina-player>`; WebM/GIF/PNG export produces non-empty files of ≈ scene duration.
- **C**: every README gap row flips to ✅.
- **D**: one golden demo per domain pack (doc 10 §9).

---

## 6. Immediate next actions (this pass)

1. Write `docs/14-INNOVATIONS-GAPS.md` (innovations/gaps doc).
2. Update `docs/00-INDEX.md` (add 12–14, fix stale header).
3. Implement **A1 MathTex** (the de-risked path), then **A2 Axes/NumberPlane/plot()**.
4. `npm run typecheck` + `npm run build`; smoke-test in browser.
5. Commit + squash + PR from `genspark_ai_developer` → main; provide PR link.

---

**End of audit/plan doc. Next: [14-INNOVATIONS-GAPS.md](14-INNOVATIONS-GAPS.md).**
