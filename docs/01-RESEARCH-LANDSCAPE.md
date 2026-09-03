# 01 — Research Landscape

**Date:** 2026-09-02  
**Purpose:** Map every existing library that a 3Blue1Brown-style JS explainer engine must learn from — and why none of them *is* the product.

---

## 1. The problem being solved

3Blue1Brown videos work because they are **programmatic, geometric, and pedagogical**:

- Objects are mathematical (vectors, graphs, surfaces), not generic UI sprites.
- Motion is *meaning*: a square becoming a circle is a transform of point sets, not a crossfade.
- Time is authored as a sequence of `play()` / `wait()` beats, not a NLE timeline.
- The camera, the formula, and the graph stay in one coordinate system.

Python Manim does this at film quality (Cairo or OpenGL + FFmpeg + LaTeX). It does **not** run in a browser, does **not** embed in a lesson page, and does **not** give a seekable HTML player.

The user wants a **from-scratch JavaScript library** that:

1. Packs ManimCE + ManimGL + Three.js-class 3D + related explainer features.
2. Renders and previews in the browser.
3. Embeds in educational websites.
4. Lets authors write JS/HTML/CSS against a custom player/renderer.

This document answers: *what already exists, and where the gaps are.*

---

## 2. The two Manims (this is the most important fact)

There are **two incompatible Python projects** both called “Manim”.

| | **ManimGL** (3b1b/manim) | **Manim Community Edition (ManimCE)** |
|---|---|---|
| Repo | https://github.com/3b1b/manim | https://github.com/ManimCommunity/manim |
| Package | `manimgl` / `manimlib` | `manim` (`from manim import *`) |
| Docs | https://3b1b.github.io/manim/ | https://docs.manim.community/ (v0.21.0 as of this research) |
| Maintainer | Grant Sanderson + small circle | Community (40k+ GitHub stars) |
| Renderer | OpenGL, interactive window | Cairo (default) + optional OpenGL |
| Video output | FFmpeg | FFmpeg |
| LaTeX | Optional, local TeX | Local TeX / Pango / Typst |
| Typical command | `manimgl scene.py MyScene` | `manim -pql scene.py MyScene` |
| Creation anim | `ShowCreation` | `Create` |
| Interactive | `self.embed()` IPython in a live window | Limited; community plugins |
| Used for | Actual 3Blue1Brown videos (`3b1b/videos`) | Teaching, community content, plugins |
| Stability | Video-first, APIs shift with Grant’s needs | Versioned, tested, documented |

**They cannot be mixed.** Installing one with the other’s instructions breaks. A JS library that claims “complete Manim” must **map both APIs** (aliases) rather than pick a side.

Pi creatures (the 3b1b characters) are **copyrighted**. Do not ship them.

---

## 3. Manim’s conceptual core (shared by both)

Everything in Manim is three types:

```
Mobject  →  Animation  →  Scene
  (what)      (how)         (when)
```

- A **Mobject** is a thing on screen: points, submobjects, color, fill, stroke, updaters.
- A **VMobject** is a vectorized mobject: cubic Bézier point arrays. `Transform` interpolates those points. Point winding/order matters.
- An **Animation** interpolates a mobject from α=0 to α=1 via a **rate function**.
- A **Scene** owns the mobject list, the camera, and the clock. `construct()` is the script. `add` / `remove` / `play` / `wait` are the verbs.

Placement: origin is **screen center**. Directions: `UP DOWN LEFT RIGHT IN OUT ORIGIN`. Methods: `shift`, `move_to`, `next_to`, `align_to`, `to_edge`, `to_corner`. Styling: `set_stroke`, `set_fill`, `set_color`. Z-order = add order.

`.animate` turns any mutating method into an animation (`square.animate.shift(LEFT).scale(0.5)`).

**Updaters** recompute a mobject every frame (`add_updater`, ManimGL `always` / `f_always` / `always_redraw`). **ValueTracker** is a hidden mobject whose number other objects listen to.

This triad is the API Lumina must copy. Three.js, Motion Canvas, Remotion, p5 — none of them use this triad as their public language.

---

## 4. Existing JavaScript “Manim” projects

### 4.1 Manim.js — JazonJiao (2018)

- Repo: https://github.com/JazonJiao/Manim.js
- Stack: **p5.js**, instance mode (`new p5(sketch)`).
- Goal: emulate 3b1b-style *math/CS visualizations* in the browser after the author could not get Python Manim working.
- Grant Sanderson publicly approved the name in 2019.
- Pattern: `setup2D(s)` then `s.g = new Graph_U(s, { V, E, font, start, color_e, color_v })` then `s.g.show()` inside `draw()`.
- Classes live in `/src` (graphs, etc.). Frame rate 30, canvas 1200×675 by default.
- **Not a Manim port.** No `Scene.play()`, no VMobject point transforms, no LaTeX, no 3D, no rate-function animation system, no camera classes.
- Status: historical / educational. Useful as a *reference for CS graph viz in the browser*, not as a foundation.

### 4.2 manim-web — maloyan (TypeScript, ~2025–2026)

- Repo: https://github.com/maloyan/manim-web
- Docs/examples: https://maloyan.github.io/manim-web/
- Stack: TypeScript, Canvas 2D + **Three.js for 3D**, KaTeX, React/Vue wrappers, `py2ts` converter, GIF/video export.
- API *is* Manim-like:

```js
import { Scene, Circle, Create } from "manim-web";
const scene = new Scene(container, { width: 500, height: 300 });
const circle = new Circle({ radius: 1.5 });
await scene.play(new Create(circle));
```

- Advertised features: Geometry (Circle, Rectangle, Polygon, Arrow, Arc, Star, Brace), Text/KaTeX, Graphing (Axes, NumberPlane, FunctionGraph, ParametricFunction, VectorField, BarChart), 3D (Sphere, Cube, Cylinder, Torus, Surface3D, ThreeDAxes + orbit), Animations (FadeIn/Out, Create, Transform, Write, GrowFromCenter, AnimationGroup, LaggedStart), Interaction (Draggable, Hoverable, Clickable), Graphs/Tables/Matrix, React/Vue, `onLog`.
- **Closest existing JS Manim.** Still incomplete vs ManimCE/GL: missing most indication/movement/homotopy animations, TransformMatchingTex, LinearTransformationScene, ZoomedScene, MultiCamera, boolean ops, full 3D polyhedra, StreamLines, rate-function catalogue, `.animate` chaining parity, ManimGL `always`/`embed`, domain packs (physics, CS, AI/ML), first-party pedagogical player, formula↔graph morph, step-decomposition UI.
- It is a **port**. The user asked for a **from-scratch end-to-end library**, not a fork.

**Decision:** Study manim-web’s API shape (async `scene.play`, options objects, KaTeX, browser export). Do not fork it. Re-implement the core.

---

## 5. Three.js (r-current, 2026)

Three.js is the industry WebGL/WebGPU scene graph. It is **not** an explainer DSL.

What it gives (and Lumina 3D must cover equivalently):

- Core: `Scene`, `Object3D`, `Group`, `Mesh`, `BufferGeometry`, `Material`, `Clock`
- Cameras: Perspective, Orthographic, Cube, Stereo, Array
- Lights: Ambient, Directional, Hemisphere, Point, Spot, RectArea, LightProbe + shadows
- Geometries: Box, Sphere, Cylinder, Cone, Torus, TorusKnot, Plane, Ring, Circle, Capsule, Extrude, Lathe, Tube, Polyhedron family, Parametric, Text, Teapot, …
- Materials: Basic, Lambert, Phong, Standard, Physical, Toon, Normal, Depth, Shader, Points, Sprite, Line, Node materials
- Animation: `AnimationMixer`, `AnimationClip`, keyframe tracks (not Manim `play()`)
- Controls (addons): Orbit, Trackball, Fly, FirstPerson, PointerLock, Transform, Drag, Arcball, Map
- Curves: Cubic/Quadratic Bézier, CatmullRom, Ellipse, NURBS
- Renderers: WebGLRenderer, WebGPURenderer
- Math: Vector2/3/4, Matrix3/4, Quaternion, Euler, Color, Ray, Frustum, Box2/3

What it does **not** give: VMobject point morphing, `Create`/`Write`/`TransformMatchingTex`, Axes/NumberPlane/ComplexPlane, KaTeX, pedagogical timeline, rate functions as Manim means them, embeddable explainer player.

**Decision:** Own math + scene + animation core. Custom WebGL for 3D. Optional later `lumina/three` interop. Three.js must **not** be a core dependency.

---

## 6. Motion Canvas

- Site: https://motioncanvas.io
- TypeScript, generator scenes (`function*`, `yield*`), JSX-like view tree, first-party web editor, audio sync.
- Property tweens: `myCircle().position.x(300, 1).to(-300, 1)` merged with `all(...)`.
- Excellent **web-native animation authoring**. Not Manim: no mobjects, no Bézier-point Transform, no math coordinate systems as first-class objects, no 3b1b visual language.

**Learn from:** generator/timeline mental model, editor/preview UX, `all`/`sequence` flow helpers, audio.  
**Do not become:** a Motion Canvas clone.

---

## 7. Remotion

React components → video frames, server-side render to MP4. Superb for product/marketing video in React. Wrong abstraction for geometric explainer math (no VMobject, no Axes, heavy React runtime). Optional later *export path* inspiration only.

---

## 8. Math visualization libraries (not animation engines)

| Library | What it is | Takeaway |
|---|---|---|
| **MathBox** | 3Blue1Brown-adjacent WebGL math viz (terminally / Steven Wittens). Declarative graphs, 4D-ish, GLSL. | Best-in-class *math as a field*. Weak as a scene/animation authoring DSL. |
| **JSXGraph** | Interactive 2D geometry (points, lines, constructions, dragging). | Interaction + Euclidean constructions. |
| **Desmos** | Graphing calculator product (not a lib to embed as an engine). | Gold standard of *formula linked to graph*. |
| **KaTeX** | Fast browser TeX. | **This is how Lumina renders MathTex.** No local LaTeX. |
| **MathJax** | Heavier, more complete TeX. Fallback if KaTeX misses a package. |
| **p5.js** | Creative coding. Draw loop. | What Manim.js used. Too low-level for Manim DSL. |
| **D3** | Data join / SVG. | Charts, not geometric morphs. |
| **anime.js / GSAP / theatre.js** | Generic tweening. | Rate functions / timelines inspiration. Not math objects. |
| **DefinedMotion** | Smaller programmatic motion tool. | Note as related; not a Manim replacement. |
| **Manim Slides** | Python plugin: `Slide` / `ThreeDSlide` on top of Manim scenes. | Presentation beats. Lumina player should support *sections/beats*. |

---

## 9. Browser platform capabilities (the actual runtime)

| Need | Browser primitive |
|---|---|
| Crisp 2D vectors | Canvas2D (`Path2D`, `bezierCurveTo`, `clip`, `globalAlpha`) |
| 3D meshes / lighting | WebGL2 (custom) or WebGPU later |
| Math formulas | KaTeX → SVG or HTML overlay, or rasterize to canvas |
| Fonts | `document.fonts`, OpenType, optional opentype.js for point extraction (needed for `Write` / TransformMatchingShapes on glyphs) |
| Animation clock | `requestAnimationFrame` + own timeline (seekable; rAF alone is not seekable) |
| Export video | `MediaRecorder` + `canvas.captureStream()` → WebM |
| Export GIF | Frame dump + gifenc / gif.js in a worker |
| Export PNG sequence | `canvas.toBlob` |
| Embed | Custom element + Shadow DOM, or a canvas + script |
| Audio (later) | Web Audio API, `<audio>` element sync to timeline |
| Offscreen | `OffscreenCanvas` in a worker for export |

**Not available in Cloudflare Workers / Pages at runtime:** FFmpeg, filesystem, local TeX, Cairo, Pango. The *library itself* is browser-side. A docs/playground site can be hosted on Pages; the engine does not run *inside* the Worker except as static JS.

---

## 10. Why a new library is justified

| Requirement | ManimCE/GL | Manim.js | manim-web | Three.js | Motion Canvas |
|---|---|---|---|---|---|
| Manim triad (Mobject/Animation/Scene) | Yes | No | Partial | No | No |
| VMobject point Transform | Yes | No | Partial | No | No |
| Full animation catalogue | Yes | No | Small subset | No | Different |
| 3D explainer (surfaces, axes, lights) | Yes (GL stronger) | No | Partial (Three.js) | Yes (not pedagogical) | Weak |
| Browser live preview | No | Yes | Yes | Yes | Yes |
| Educational website embed + player | No | DIY | DIY | DIY | Editor, not embed DSL |
| KaTeX / no local TeX | No (local TeX) | No | Yes | No | Partial |
| Physics / CS / AI-ML packs | Plugins / DIY | Some CS graphs | No | DIY | DIY |
| Formula↔graph morph + step UI | DIY | No | No | No | No |
| From-scratch, complete, owned | N/A | Incomplete | Port | Wrong DSL | Wrong DSL |

**Conclusion:** Build **Lumina** as a new engine. Steal *ideas and API names* from Manim. Steal *browser delivery* from manim-web. Steal *3D substrate ideas* from Three.js. Steal *player/editor UX* from Motion Canvas. Implement the core ourselves.

---

## 11. Legal / attribution notes

- ManimCE: MIT. API names are not trademarked in a way that blocks a new JS library, but **do not** call the product “Manim” without permission. Working name **Lumina**.
- ManimGL: MIT. Pi creatures / 3b1b branding are **not** MIT-free to copy as assets.
- manim-web: MIT. Do not copy source; it is a research reference.
- Manim.js: study only.
- Three.js: MIT. Optional later dependency, not a copy.
- KaTeX: MIT.

Always attribute in README: “Inspired by 3Blue1Brown / Manim. Not affiliated.”

---

## 12. Research completeness statement

Inventories in [02](02-MANIM-PYTHON-COMPLETE-API.md) are taken from ManimCE v0.21.0 reference pages, ManimCE GitHub module trees, and ManimGL official example scenes (2026-09-02). Sphinx pages for some submodules (`boolean_ops` HTML, `shape_matchers` HTML, `three_d` package HTML, `types` package HTML, `graphing.functions` HTML) returned empty stubs; those lists were recovered from `_modules` source, GitHub trees, and sibling class pages.

If implementation is approved, the first engineering task is to re-verify this inventory against the then-current ManimCE tag and ManimGL HEAD — not to invent APIs.
