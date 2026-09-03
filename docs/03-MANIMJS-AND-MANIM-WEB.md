# 03 — Manim.js and manim-web (existing JS libraries)

**Date:** 2026-09-02  
**Purpose:** Document the two existing JavaScript projects that already try to bring Manim to the browser, so Lumina does not accidentally become a thin wrapper or a fork.

---

## 1. Why these two matter

Python Manim cannot run in a web page. Two independent JS projects tried to fill that gap:

| | **Manim.js** | **manim-web** |
|---|---|---|
| Author | Jazon Jiao | maloyan |
| Year | 2018 | ~2025–2026 |
| Repo | https://github.com/JazonJiao/Manim.js | https://github.com/maloyan/manim-web |
| Stack | p5.js (instance mode) | TypeScript, Canvas 2D, Three.js (3D), KaTeX |
| Relationship to Manim | Inspired by 3b1b *look*; not an API port | Explicit TypeScript port of Manim API |
| 3D | No | Yes (Three.js) |
| Math formulas | No LaTeX | KaTeX (`Text`, `MathTex`, `Tex`) |
| Animations | Custom `show()` in `draw()` | `Create`, `Transform`, `FadeIn/Out`, `Write`, … |
| Status | Historical / teaching graphs | Actively the closest JS Manim |
| License | (see repo; treat as reference only) | MIT |

Lumina’s rule: **read both, fork neither.**

---

## 2. Manim.js (JazonJiao) — deep notes

### 2.1 Origin

Jazon Jiao could not get Python Manim working in 2018, chose **p5.js** after The Coding Train, and built utilities for math/CS visualizations. In 2019 Grant Sanderson recommended the videos and approved the name “Manim.js”. The original YouTube channel is gone; a new channel exists (`@JazonJiao`).

This is important historically: the *name* “Manim.js” is already taken in public mind. Lumina should **not** be named Manim.js.

### 2.2 Runtime model

p5 instance mode:

```js
const GraphExample = function(s) {
    let tnr;
    s.preload = function() {
        tnr = s.loadFont('../lib/font/times.ttf');
    };
    s.setup = function () {
        setup2D(s);           // 30 fps, 1200×675 (globals.js)
        s.g = new Graph_U(s, {
            V: G.V,
            E: G.E,
            font: tnr,
            start: 40,        // animation start in FRAMES
            color_e: [7, 97, 7],
            color_v: Yellow,
        });
    };
    s.draw = function () {
        s.background(0);
        s.g.show();           // classes expose show(), called every draw
    };
};
let p = new p5(GraphExample);
```

Graph data is a literal:

```js
let G = {
    V: [[100, 200], [260, 100], [260, 300], [420, 200]],
    E: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3]]
};
```

### 2.3 What it actually is

- A **collection of visualization classes** (especially undirected/directed graphs) with timed `show()` methods.
- Time is **frame indices** (`start: 40`), not Manim `play()` / `wait()`.
- Coordinates are **canvas pixels**, not a centered mathematical frame.
- No VMobject, no Bézier Transform, no Axes/NumberPlane/ComplexPlane, no cameras, no rate functions, no LaTeX, no 3D, no player, no embed component.

### 2.4 What Lumina should steal from it

1. **CS graph viz as a first-class domain pack** (vertices, edges, BFS/DFS coloring, timed highlights) — ManimCE’s `Graph` is NetworkX-heavy and not as “CS lecture” oriented as Manim.js examples.
2. **Keep the API mathematical, not pixel-first** — do *not* copy pixel coordinates as the public unit system.
3. Proof that 3b1b-ish teaching content *can* live in the browser without Python.

### 2.5 What Lumina must not copy

- p5 `setup`/`draw` as the public API.
- Frame-number timing as the only clock.
- “Manim” in the product name.

---

## 3. manim-web (maloyan) — deep notes

### 3.1 Positioning (author’s own words)

> Manim — in the browser, no Python required.

HN / Reddit (2025–2026): TypeScript port, entirely client-side, Canvas API / WebGL via Three.js for 3D. Familiar API: `Scene`, `Circle`, `Square`, `Create`, `Transform`.

Docs: https://maloyan.github.io/manim-web/

### 3.2 Browser usage (official README)

```html
<div id="container"></div>
<script type="module">
    import {
        Scene, Circle, Create,
    } from "https://cdn.jsdelivr.net/npm/manim-web@latest/dist/manim-web.browser.js";

    const options = { width: 500, height: 300 };
    const scene = new Scene(
        document.getElementById("container"),
        options,
    );
    const circle = new Circle({ radius: 1.5 });
    await scene.play(new Create(circle));
</script>
```

Local:

```ts
import { Scene, Circle, Square, Create, Transform, FadeOut } from 'manim-web';

async function squareToCircle(scene: Scene) {
  const square = new Square({ sideLength: 3 });
  const circle = new Circle({ radius: 1.5 });
  await scene.play(new Create(square));
  await scene.play(new Transform(square, circle));
  await scene.play(new FadeOut(square));
}
```

### 3.3 Advertised feature set (README, 2026-09-02)

**Geometry:** Circle, Rectangle, Polygon, Arrow, Arc, Star, Brace, and more.

**Text & LaTeX:** Text, MathTex, Tex, Paragraph via KaTeX.

**Graphing:** Axes, NumberPlane, FunctionGraph, ParametricFunction, VectorField, BarChart.

**3D:** Sphere, Cube, Cylinder, Torus, Surface3D, ThreeDAxes with orbit controls.

**Animations:** FadeIn/Out, Create, Transform, Write, GrowFromCenter, AnimationGroup, LaggedStart.

**Interaction:** Draggable, Hoverable, Clickable mobjects.

**Export:** GIF and video.

**Graphs & Tables:** Network graphs, Matrix, Table.

**Integrations:**

```tsx
import { ManimScene } from 'manim-web/react';
<ManimScene construct={squareToCircle} width={800} height={450} />
```

```vue
<ManimScene :construct="squareToCircle" :width="800" :height="450" />
```

**Python → TypeScript:** `node tools/py2ts.cjs input.py -o output.ts`

**Logging:** `onLog(entry => …)` structured logs, sanitized, `LOG_LEVEL`.

### 3.4 What it gets right (Lumina should also do)

| Idea | Why it is right |
|---|---|
| `await scene.play(...)` | JS has no `construct()` blocking renderer thread; Promises *are* the scene script. |
| Options objects `new Circle({ radius: 1.5 })` | Pythonic kwargs → JS options. |
| Scene mounted on a **DOM container**, not a hidden file writer | Embed-native. |
| KaTeX instead of local TeX | The only viable browser math path. |
| CDN ESM build | Teachers can drop a script tag. |
| React/Vue wrappers | Education sites are often component frameworks. |
| GIF/video export in-browser | Replaces FFmpeg for the 80% case. |
| Interaction (drag/hover/click) | Python Manim is weak here; the web should be strong. |
| `onLog` | Debug scenes, including AI-written scenes. |

### 3.5 What it does **not** complete (the gap Lumina exists to fill)

Compared to ManimCE v0.21.0 + ManimGL (inventory in [02](02-MANIM-PYTHON-COMPLETE-API.md)):

**Animations missing or not advertised:** Uncreate, Unwrite, DrawBorderThenFill, ShowIncreasingSubsets, ShowSubmobjectsOneByOne, SpiralIn, TypeWithCursor, all indication (Indicate, Circumscribe, Flash, FocusOn, ApplyWave, Blink, ShowPassingFlash, Wiggle), all movement (Homotopy, ComplexHomotopy, MoveAlongPath, PhaseFlow), ChangingDecimal, Rotate/Rotating as full family, Broadcast, ChangeSpeed, the entire Transform family beyond basic Transform (ReplacementTransform, TransformFromCopy, FadeTransform, ApplyMatrix, ApplyComplexFunction, ApplyFunction, CyclicReplace, Restore, TransformMatchingTex/Shapes), Succession, LaggedStartMap.

**Mobjects missing or not advertised:** boolean ops (Union/Intersection/Difference/Exclusion), full arc family (Annulus, Sector, ArcPolygon, TangentialArc), Angle/RightAngle/Elbow/TangentLine, Cutout/ConvexHull, labeled geometry, all arrow tips, PolarPlane, ComplexPlane, ThreeDAxes parity with CE, StreamLines, DecimalNumber/Integer/Variable, Code, SVGMobject, BraceLabel family, platonic polyhedra, TexturedSurface/SurfaceMesh, ValueTracker/ComplexValueTracker as first-class.

**Scenes/cameras missing:** MovingCameraScene, ZoomedScene, MultiCamera, MappingCamera, SplitScreenCamera, VectorScene, LinearTransformationScene, `fix_in_frame`, ambient camera rotation, sections.

**GL workflow missing:** `always` / `f_always` / `always_redraw`, `.animate` chaining parity, `self.embed()`, mouse as a tracker, `prepare_for_nonlinear_transform`.

**Product missing:** first-party pedagogical **player** (beats, captions, step-through), `<lumina-player>` web component, formula↔graph linked morph, step-decomposition UI, physics/CS/AI-ML domain packs, JSON scene serialization, dual Canvas2D + *owned* WebGL (manim-web leans on Three.js for 3D).

**Architecture:** it is a **port**. User asked for **from-scratch**, complete, without missing anything.

### 3.6 py2ts

A Python-to-TypeScript converter is attractive for authors with existing Manim scripts. Reality:

- ManimCE ≠ ManimGL; a converter must pick a dialect.
- Python `lambda`, numpy, `config`, `self.play` unpacking, `*mobjects`, TeX files — lossy.
- AI agents already rewrite Python scenes to JS more reliably than a brittle syntax converter.

**Lumina v1:** do **not** ship py2ts. Ship a *mapping table* (this docs set) and JS examples that are obviously the CE/GL equivalents. A converter is a later optional tool.

### 3.7 Three.js inside manim-web

3D in manim-web is Three.js. That is a reasonable shortcut for a port. It conflicts with the user’s “from scratch / packed features of Three.js” if Lumina *is* Three.js underneath:

- Bundle size and version lock.
- Two scene graphs (Manim mobjects vs `Object3D`).
- Transform of a VMobject into a Mesh is a mismatch.
- Hosted Cloudflare Pages 10 MB worker limit does not apply to *browser* bundles, but education pages still care about kB.

**Lumina decision (proposed):** own WebGL layer for 3D mobjects. Optional `lumina/three` interop later for people who already have Three.js scenes.

---

## 4. Side-by-side API sketch

| Task | ManimCE | Manim.js | manim-web | Lumina (proposed) |
|---|---|---|---|---|
| Create a circle | `Circle(radius=1.5)` | p5 `ellipse` / custom | `new Circle({ radius: 1.5 })` | `new Circle({ radius: 1.5 })` |
| Draw it | `self.play(Create(c))` | `show()` in `draw` | `await scene.play(new Create(c))` | `await scene.play(Create(c))` |
| Morph square→circle | `Transform(sq, c)` | not really | `new Transform(sq, c)` | `Transform(sq, c)` |
| Group time | `AnimationGroup` / `LaggedStart` | frame offsets | `AnimationGroup`, `LaggedStart` | same + `Succession` |
| Math | `MathTex(r"x^2")` | none | KaTeX `MathTex` | KaTeX `MathTex` |
| 3D sphere | `Sphere()` | none | `Sphere` via Three.js | own `Sphere` mobject |
| Graph (CS) | `Graph(vertices, edges)` | `Graph_U` (strong) | network graphs | domain pack + Manim-like Graph |
| Embed | render MP4, `<video>` | iframe p5 | mount on DOM | `<lumina-player>` + mount |
| Player | none | none | DIY | first-party |

Factory vs class: manim-web uses `new Create(circle)`. Python uses `Create(circle)`. Lumina should support **both** `Create(circle)` (function returning Animation) and `new Create(circle)` so it reads like Manim.

---

## 5. Interaction: the web-native gap both only partly fill

Python Manim interaction is:

- GL: `self.embed()`, `touch()`, `self.mouse_point`, `always(circle.move_to, self.mouse_point)`.
- CE: limited OpenGL preview, not a productized UI.

manim-web adds Draggable / Hoverable / Clickable. That is necessary but not sufficient for *educational simulation*:

- Slider bound to `ValueTracker` (the Desmos move).
- Hover a formula term → highlight the corresponding graph piece.
- Step buttons that `seek` to scene sections.
- 3D orbit that does not desync the timeline.

Lumina player + interaction layer must treat these as **core**, not extras.

---

## 6. Verdict

| Project | Use as |
|---|---|
| Manim.js | Historical proof + CS graph lecture patterns. Not a base. |
| manim-web | Closest API preview of “Manim in the browser”. Study public API and delivery (CDN, React, KaTeX, export). **Do not fork.** Incomplete vs CE/GL. Three.js-backed 3D is not the architecture we want for a from-scratch engine. |

Lumina is a **new engine** with a Manim-familiar API, browser-native player/embed, owned renderers, and domain packs those two projects do not attempt.
