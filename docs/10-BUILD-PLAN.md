# 10 — Build Plan

**Working name:** Lumina

This document turns the research (01–05) and design (06–09, 11) into a sequenced implementation. It is a checklist for *after* confirmation, not a license to start now.

---

## 0. Gate: confirmation required

Implementation starts only when the user has confirmed (or overridden) the [00 decision log](00-INDEX.md):

1. Product name (working: **Lumina**)
2. TypeScript + ESM + IIFE + `.d.ts`
3. Manim-familiar API with JS idioms (`await scene.play`)
4. No Three.js in core
5. KaTeX for math
6. First-party Player + `<lumina-player>`
7. v1 vs later scope (this file)
8. MIT license

Until then: documentation only. No `src/lumina/`, no playground, no npm extra deps, no deploy.

---

## 1. Phase overview

| Phase | Name | Outcome | Depends on |
|---|---|---|---|
| **0** | Research & docs | This folder. Complete. | — |
| **1** | 2D core + player | Acceptance scene plays, seeks, embeds, exports WebM | User confirm |
| **2** | Completeness | Full animation catalogue, cameras, graphing, 3D, graphs, boolean | Phase 1 |
| **3** | Domain + pedagogy | Packs, FormulaToGraph, step UI, GIF/PNG, JSON, React | Phase 2 |
| **4** | Polish & extras | Physics/ML depth, WebGPU research, audio, optional py-to-js | Phase 3 |

Nothing in the [05 matrix](05-FEATURE-MATRIX.md) is out of product vision. Only **phased**. Deliberate omissions stay those in [02](02-MANIM-PYTHON-COMPLETE-API.md) (local TeX, FFmpeg, Pi creatures, NetworkX hard dep, IPython embed).

---

## 2. Phase 0 — Documentation (current)

**Done when:**

- [x] Online research of ManimCE v0.21.0, ManimGL, Manim.js, manim-web, Three.js, Motion Canvas, related libs
- [x] Complete API inventory (02)
- [x] Feature matrix (05)
- [x] Architecture, API, renderer/player, domain packs, gaps (06–11)
- [x] README points here and does **not** claim a working library
- [ ] User confirmation

**Not done in phase 0:** any engine code, playground, deploy.

---

## 3. Phase 1 — 2D core + player (the v1 product)

**Done when the [07 §17 acceptance scene](07-API-DESIGN.md) plays in the browser, seeks, embeds via `<lumina-player>`, and exports WebM.**

### 3.1 Work packages (order)

Implement in this order. Each package has a demo that must run before the next starts.

| # | Package | Deliverable | Demo |
|---|---|---|---|
| 1.1 | **Math kernel** | `Vec3`, `Mat3/4`, color, seeded RNG, constants (`ORIGIN`, `UP`, palette) | unit tests only |
| 1.2 | **Mobject / VMobject** | points as cubics, style (fill/stroke/backgroundStroke/opacity), hierarchy, `shift/moveTo/nextTo/alignTo/scale/rotate/copy/saveState/restore` | static Square + Circle on canvas |
| 1.3 | **Canvas2D renderer** | world→pixel, Path2D, dpr, background | same, crisp |
| 1.4 | **Scene + Clock** | `add/remove`, `play/wait` live mode (forward rAF) | Create a Square |
| 1.5 | **Animation base** | `begin/interpolate/finish`, rate functions (`linear`, `smooth`, `thereAndBack`) | Create + FadeIn/Out |
| 1.6 | **Create / Uncreate / Write** | `pointwiseBecomePartial` | square draws on, writes a Text |
| 1.7 | **Transform** | `alignPoints`, `insertNCurves`, lerp | Square → Circle |
| 1.8 | **`.animate` proxy** | method recording → Transform into copy | `square.animate.shift(RIGHT).scale(0.5)` |
| 1.9 | **Timeline record + seek** | dry-run snapshots, `render(t)`, rebuild-from-0 fallback | scrub a completed scene |
| 1.10 | **Geometry set (v1)** | Square, Circle, Rectangle, Line, Arrow, Dot, Polygon, RegularPolygon, Triangle, Star, Arc, Ellipse, VGroup | gallery page |
| 1.11 | **Text** | Canvas Text + opentype outlines (morphable) | Write(Text) |
| 1.12 | **MathTex** | KaTeX → SVG paths → VMobject tree | Write(MathTex) |
| 1.13 | **Graphing v1** | NumberLine, Axes, NumberPlane, `plot`, `c2p/p2c` | sine on Axes |
| 1.14 | **ValueTracker + updaters** | `addUpdater`, `alwaysRedraw`, `always` / `fAlways` aliases | tracker moves a Dot |
| 1.15 | **Player** | play/pause/seek/speed/loop/fullscreen, keyboard, sections list | chrome around acceptance scene |
| 1.16 | **Web component + embed** | `<lumina-player src>` , script-tag IIFE | iframe-able lesson snippet |
| 1.17 | **Export WebM** | composite canvas + MediaRecorder | download button |
| 1.18 | **Playground host** | Hono page: editor + live canvas (Monaco or textarea) | author the acceptance scene in-page |

### 3.2 Phase 1 animation subset (must)

`Create` ≡ `ShowCreation`, `Uncreate`, `DrawBorderThenFill`, `Write`, `Unwrite`, `FadeIn`, `FadeOut`, `GrowFromCenter`, `GrowFromPoint`, `Transform`, `ReplacementTransform`, `FadeTransform`, `Rotate`, `Wait`, `AnimationGroup`, `LaggedStart`, `Succession`, `.animate`.

Everything else in [02 §B](02-MANIM-PYTHON-COMPLETE-API.md) waits for phase 2.

### 3.3 Phase 1 out

- 3D / WebGL
- TransformMatchingTex / Shapes
- MovingCamera, ZoomedScene, MultiCamera
- Boolean ops
- Graph / DiGraph
- Domain packs (except a thin NumberPlane `applyMatrix` demo if time)
- GIF/PNG, React, JSON serialization
- Audio

### 3.4 v1 quality bar

- 60 fps with ≤ 200 VMobjects, ≤ 4k cubics total, 1280×720, mid-laptop.
- Background stroke default in theme `threeb1b`.
- Snake_case option aliases (`run_time` → `runTime`).
- Seeded `scene.rng`.
- No Three.js, no p5, no FFmpeg.

---

## 4. Phase 2 — Completeness (Manim catalogue + 3D)

**Done when:** a reviewer can tick every row of [02](02-MANIM-PYTHON-COMPLETE-API.md) as shipped or deliberately omitted, and a ThreeDScene with Sphere + Surface + euler camera + `fixInFrame` HUD plays.

### 4.1 Animation remainder

Indication (`Indicate`, `Circumscribe`, `Flash`, `FocusOn`, `ApplyWave`, `Blink`, `ShowPassingFlash`, `Wiggle`, `Broadcast`), growing remainder (`GrowFromEdge`, `GrowArrow`, `SpinInFromNothing`), movement (`MoveAlongPath`, `Homotopy`, `ComplexHomotopy`, `PhaseFlow`), numbers (`ChangingDecimal`, `ChangeDecimalToValue`), transform remainder (`ApplyMatrix`, `ApplyComplexFunction`, `ApplyFunction`, `ApplyPointwiseFunction`, `ClockwiseTransform`, `CounterclockwiseTransform`, `CyclicReplace`, `Swap`, `MoveToTarget`, `FadeToColor`, `ScaleInPlace`, `ShrinkToCenter`, `Restore`, `TransformFromCopy`, `FadeTransformPieces`), matching (`TransformMatchingShapes`, `TransformMatchingTex`), composition (`LaggedStartMap`), changing (`TracedPath`, `AnimatedBoundary`), `ChangeSpeed`, `UpdateFromFunc`, `UpdateFromAlphaFunc`, `MaintainPositionRelativeTo`, text extras (`SpiralIn`, `TypeWithCursor`, `AddTextLetterByLetter`, …).

### 4.2 Geometry remainder

Arc family (Annulus, Sector, ArcBetweenPoints, CurvedArrow, CubicBezier, TipableVMobject), line family (DashedLine, Elbow, Angle, RightAngle, TangentLine, DoubleArrow), polygram remainder (RoundedRectangle, RegularPolygram, ConvexHull, Cutout), shape matchers (SurroundingRectangle, BackgroundRectangle, Cross, Underline), tips (ArrowTip variants, StealthTip), boolean (`Union`, `Intersection`, `Difference`, `Exclusion`) via JS/WASM pathops, SVG import, braces, Matrix/Table, DecimalNumber/Integer/Variable, Code tokens, DashedVMobject, CurvesAsSubmobjects.

### 4.3 Graphing remainder

`ThreeDAxes`, `PolarPlane`, `ComplexPlane`, `ParametricFunction`, `ImplicitFunction`, `UnitInterval`, `BarChart`, `SampleSpace`, log scale, `getRiemannRectangles`, `getArea`, `getTangentLine`, `i2gp`, vector fields + streamlines.

### 4.4 Cameras / scenes

`MovingCamera` / `MovingCameraScene`, `ZoomedScene`, `ThreeDCamera` / `ThreeDScene`, `VectorScene`, `LinearTransformationScene`, `MultiCamera` / `SplitScreenCamera` / `MappingCamera` (in that priority), `section()`.

### 4.5 3D (owned WebGL, hybrid compositor from [08](08-RENDERING-AND-PLAYER.md))

MeshMobject, Sphere, Cube, Prism, Cone, Cylinder, Torus, Surface, platonic solids, Arrow3D/Line3D/Dot3D, SurfaceMesh, TexturedSurface, light as mobject, euler camera, ambient rotation, orbit interaction, `fixInFrame`.

Package: `lumina/3d` optional import so 2D embeds stay Canvas-only.

### 4.6 Graphs

`Graph`, `DiGraph`, own layouts (circular, tree, layered, spring, static). No NetworkX.

### 4.7 Rate functions

Full [02 §E](02-MANIM-PYTHON-COMPLETE-API.md) catalogue including easing.net family.

---

## 5. Phase 3 — Domain packs, pedagogy, delivery

**Done when:** FormulaToGraph + step UI work; at least one demo per pack in [09](09-DOMAIN-MODULES.md); GIF/PNG export; JSON round-trip for tracker-recorded scenes; React wrapper optional.

| # | Work |
|---|---|
| 3.1 | `FormulaToGraph`, `decompose()`, player beats UI |
| 3.2 | `scene.expose` sliders + parameter recording |
| 3.3 | `lumina/math-linalg` (LinearTransformationScene complete) |
| 3.4 | `lumina/math-calculus` (Riemann, tangent, area) |
| 3.5 | `lumina/math-complex` |
| 3.6 | `lumina/math-probability` |
| 3.7 | `lumina/cs` (ArrayMobject, SortScene, graph algorithms) |
| 3.8 | `lumina/ml` schematic (NeuralNet, LossSurface, AttentionMatrix) |
| 3.9 | `lumina/physics` v0 (World + SpringMass + field arrows) |
| 3.10 | Export GIF (gifenc worker), PNG sequence |
| 3.11 | `scene.toJSON` / `fromJSON` (no function round-trip) |
| 3.12 | `lumina/react` thin wrapper |
| 3.13 | Docs site (this MD rendered) + playground examples gallery |

---

## 6. Phase 4 — Polish

| Item | Note |
|---|---|
| Physics depth | waves, optics, SHM phase space |
| ML polish | transformer block diagram, tiny perceptron numeric |
| `math-euclidean` | JSXGraph-class constraints |
| `math-discrete` | modular clock, integer dots |
| WebGPU backend research | not a rewrite unless Canvas/WebGL hits a wall |
| Audio / captions | `addSound`, cue points |
| Optional py-to-js mapper | syntactic sugar, **not** a Python runtime |
| Optional `lumina/three` interop | import a Three.js Object3D as MeshMobject |
| a11y | reduced motion, captions, canvas fallback text |
| Performance | instancing, spatial hash, WebGL unified compositor |

---

## 7. File layout (after confirmation — not now)

Single package under the existing Hono app (simpler for this sandbox than a monorepo):

```
/home/user/webapp/
  docs/                          # this set (already exists)
  src/
    index.tsx                    # Hono: docs site + playground routes (later)
    renderer.tsx
    lumina/                      # THE LIBRARY
      index.ts                   # public barrel
      math/
        vec.ts
        mat.ts
        color.ts
        bezier.ts
        rng.ts
        constants.ts
      core/
        mobject.ts
        vmobject.ts
        group.ts
        animation.ts
        scene.ts
        clock.ts
        timeline.ts
        updater.ts
        tracker.ts
      mobjects/
        geometry/
        graphing/
        text/
        svg/
        matrix.ts
        table.ts
        graph.ts
      animations/
        creation.ts
        fading.ts
        growing.ts
        indication.ts
        movement.ts
        transform.ts
        composition.ts
        changing.ts
      cameras/
        camera.ts
        moving.ts
        three-d.ts
        zoomed.ts
      renderers/
        canvas2d.ts
        webgl/                   # phase 2
      player/
        player.ts
        element.ts               # <lumina-player>
        chrome.css
      export/
        webm.ts
        gif.ts
        png.ts
      packs/                     # phase 3
        math-linalg/
        math-calculus/
        math-complex/
        math-probability/
        math-discrete/
        physics/
        cs/
        ml/
      three/                     # phase 4 optional interop
  playground/                    # later: editor HTML/JS
  public/
    static/
    examples/                    # later: scene modules
  tests/                         # later: math + timeline unit tests
  package.json                   # add lumina build exports AFTER confirm
  wrangler.jsonc                 # unchanged until playground host needs it
```

CDN build targets (phase 1 end):

```
dist/lumina.js            # ESM
dist/lumina.global.js     # IIFE → window.Lumina
dist/lumina.d.ts
dist/player.js            # player + element (or bundled in lumina)
```

Playground and docs **run in the browser**. The Worker only serves HTML. No FFmpeg on the edge. Hosted deploy: D1/R2 only if user scenes are persisted later. **Never add `kv_namespaces` or `triggers` if using Genspark hosted deploy.**

---

## 8. Tooling (after confirmation)

| Tool | Role |
|---|---|
| TypeScript | source |
| Vite | already in the template — library mode + playground |
| Vitest or node:test | math kernel, alignPoints, timeline snapshots |
| KaTeX | math (CDN in playground; bundled or peer in lib) |
| opentype.js | glyph outlines |
| gifenc | phase 3 GIF worker |
| highlight.js | phase 2/3 Code tokens |
| **not** Three.js, p5, manim-web, FFmpeg.wasm, NetworkX |

Keep the Cloudflare Pages 10 MB compressed worker budget in mind: the **library is a static asset**, not Worker CPU. Bundle size target for `lumina` core (no 3D, no packs): **< 150 kB gz**.

---

## 9. Testing strategy (after confirmation)

| Layer | How |
|---|---|
| Math / bezier / alignPoints | unit tests, golden point arrays |
| Animations | snapshot `mobject.points` at α = 0, 0.5, 1 |
| Timeline seek | construct → seek(0) == start, seek(end) == finish, seek(mid) twice == same |
| Renderer | Playwright screenshot of gallery (sandbox) |
| Player | keyboard + click contracts |
| Export | WebM blob non-empty, duration ≈ scene duration |
| Packs | one golden demo per pack |

RNG: every test sets `seed: 1`.

---

## 10. Playground (phase 1.18) — UX only after confirm

Inspired by Motion Canvas preview and manim-web CDN, **not** a fork:

- Left: code (textarea v1, Monaco later)
- Right: `<lumina-player>`
- Bottom: errors, fps, mobject count
- Examples dropdown: acceptance scene, axes plot, tracker slider
- Share: URL hash or (later) D1 scene id — **not** in v1 unless requested

The existing `src/index.tsx` Hello World is replaced **only after confirmation**.

---

## 11. Documentation site (phase 1+)

This `docs/*.md` set becomes the human spec. After confirm:

- Serve as `/docs/*` from Hono (markdown → HTML) **or** keep GitHub-flavored MD in-repo and a short tutorial in the playground.
- README becomes the product README (install, CDN snippet, acceptance scene) **in addition to** linking here.

Do not rewrite README as if the library exists until phase 1.17 is actually done.

---

## 12. Milestones and stop-the-line bugs

Stop and fix before continuing if:

- Transform of Square→Circle scribbles (alignment bug)
- Seek(t) ≠ replay-from-0 to t (timeline impurity)
- Create uses lineDash instead of `pointwiseBecomePartial`
- MathTex cannot isolate a substring
- Player chrome eats scene pointer events
- Any Three.js or p5 import lands in core
- Pi-creature assets appear
- Bundle > 150 kB gz for core without a recorded reason

---

## 13. Estimated sequence after confirmation (indicative, not a promise)

| Week-equivalent | Focus |
|---|---|
| 1 | 1.1–1.8 math, mobject, canvas, Create, Transform, .animate |
| 2 | 1.9–1.14 timeline seek, geometry set, text, KaTeX, axes, trackers |
| 3 | 1.15–1.18 player, embed, WebM, playground, README productization |
| 4–6 | Phase 2 catalogue + 3D hybrid |
| 7–10 | Phase 3 packs + pedagogy |
| 11+ | Phase 4 |

These are sequencing hints for the implementer, not a calendar commitment.

---

## 14. Deploy (only after a working playground exists)

When (and only when) the user asks to deploy:

- **Two deploy paths exist** in this environment: the user’s own Cloudflare account (BYOK / wrangler) and Genspark hosted deploy.
- The implementer **must ask which path** before any deploy action.
- Hosted deploy supports **D1 and R2 only** — no KV, no cron `triggers`.
- The engine itself does not need a database for v1.

**Do not deploy as part of writing these docs.**

---

## 15. Implementation kickoff checklist (print this when confirmed)

After the user says to build:

1. Freeze name, license, v1 scope from the decision log.
2. Add `src/lumina/` per §7. Do not fork manim-web.
3. Implement 1.1 → 1.8 until Square→Circle Transform is beautiful.
4. Implement seek (1.9) **before** more animations — everything else depends on `render(t)`.
5. Geometry + text + KaTeX + Axes.
6. Player + web component + WebM.
7. Acceptance scene is the gate. Then playground.
8. Only then phase 2.

---

**End of build plan. No code until confirmation.**
