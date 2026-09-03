# 05 — Feature Matrix

**Date:** 2026-09-02  
**Purpose:** Every capability the complete library must cover, scored against existing tools. This is the product checklist.

Legend: **Y** = first-class, **P** = partial / DIY, **N** = no, **—** = not applicable.

Columns: **CE** Manim Community, **GL** ManimGL, **M.js** Manim.js, **MW** manim-web, **T3** Three.js, **MC** Motion Canvas, **L** Lumina target.

**Note:** this is the original *design-target* checklist (every "Lumina" column entry is a goal, not a claim of what's built). For the actual, currently-implemented status, see the README's "Implementation status" gap table and [13-AUDIT-PLAN-ISSUES.md](13-AUDIT-PLAN-ISSUES.md) §2 (gaps G1–G16). As of this pass: **MathTex/Tex** and **Axes/NumberPlane/ComplexPlane/PolarPlane** (rows in §5 and §1 below) are now ✅ implemented — see §5's note on the MathTex backend choice.

---

## 1. Core engine

| Feature | CE | GL | M.js | MW | T3 | MC | Lumina |
|---|---|---|---|---|---|---|---|
| Mobject / Animation / Scene triad | Y | Y | N | Y | N | N | **Y** |
| VMobject cubic Bézier points | Y | Y | N | P | N | N | **Y** |
| `Transform` point lerp | Y | Y | N | Y | N | N | **Y** |
| `.animate` method proxy | Y | Y | N | P | N | P | **Y** |
| `play` / `wait` clock | Y | Y | N | Y | N | Y | **Y** |
| Updaters every frame | Y | Y | N | P | N | P | **Y** |
| `always` / `f_always` / `always_redraw` | P | Y | N | N | N | N | **Y** |
| ValueTracker / ComplexValueTracker | Y | Y | N | P | N | P | **Y** |
| VGroup / Group / VDict | Y | Y | N | P | P | P | **Y** |
| save_state / restore | Y | Y | N | P | N | N | **Y** |
| Rate function catalogue | Y | Y | N | P | N | P | **Y** |
| AnimationGroup / LaggedStart / Succession | Y | Y | N | P | N | Y | **Y** |
| Seekable timeline (player) | N | N | N | P | N | Y | **Y** |
| JSON scene serialization | N | N | N | N | P | P | **Y** |
| Browser runtime | N | N | Y | Y | Y | Y | **Y** |
| Zero-framework script tag | — | — | Y | Y | Y | N | **Y** |

---

## 2. 1D / 2D / 3D

| Feature | CE | GL | M.js | MW | T3 | MC | Lumina |
|---|---|---|---|---|---|---|---|
| NumberLine / UnitInterval | Y | Y | N | P | N | N | **Y** |
| 1D morph (interval, number, tracker) | Y | Y | N | P | N | P | **Y** |
| Full 2D geometry (arc/line/polygram) | Y | Y | P | P | P | P | **Y** |
| Boolean 2D (union/intersect/diff/xor) | Y | P | N | N | N | N | **Y** |
| Coordinate systems (Axes, Plane, Polar, Complex) | Y | Y | N | P | N | N | **Y** — ✅ implemented (`mobjects/graphing/coordinate-system.ts`) |
| Function / parametric / implicit plots | Y | Y | N | P | P | N | **Y** |
| Vector fields + streamlines | Y | Y | N | P | P | N | **Y** |
| 3D surfaces parametric | Y | Y | N | P | Y | N | **Y** |
| 3D solids (sphere, cube, platonic, torus, cylinder, cone) | Y | Y | N | P | Y | N | **Y** |
| 3D arrows / lines / dots | Y | Y | N | P | P | N | **Y** |
| Textured surface + mesh overlay | P | Y | N | N | Y | N | **Y** |
| Lights as animatable mobjects | P | Y | N | P | Y | N | **Y** |
| Euler camera (φ, θ, γ) + ambient rotation | Y | Y | N | P | P | N | **Y** |
| Orbit / pan / zoom interaction | P | Y | N | Y | Y | P | **Y** |
| `fix_in_frame` HUD | Y | Y | N | N | N | N | **Y** |
| Mixed 2D overlay + 3D world | P | Y | N | P | P | N | **Y** |

---

## 3. Animations (catalogue completeness)

| Family | CE | GL | MW | Lumina |
|---|---|---|---|---|
| Creation (Create/Write/Uncreate/SpiralIn/TypeWithCursor/…) | Y | Y (ShowCreation) | P | **full** |
| Fading (FadeIn/Out + shift/scale) | Y | Y | Y | **full** |
| Growing (GrowFrom*) | Y | Y | P | **full** |
| Indication (Indicate, Circumscribe, Flash, Wave, Blink, PassingFlash, Wiggle) | Y | Y | N | **full** |
| Movement (Homotopy, MoveAlongPath, PhaseFlow, ComplexHomotopy) | Y | Y | N | **full** |
| Numbers (ChangingDecimal) | Y | Y | N | **full** |
| Rotation | Y | Y | P | **full** |
| Transform family (ApplyMatrix, ApplyComplex, FadeTransform, Replacement, MatchingTex/Shapes) | Y | Y | P (basic Transform) | **full** |
| Composition (Group, Lagged, Succession, LaggedStartMap) | Y | Y | P | **full** |
| Changing (TracedPath, AnimatedBoundary) | Y | Y | N | **full** |
| Speed (ChangeSpeed) | Y | P | N | **full** |

---

## 4. Cameras and scene types

| Feature | CE | GL | MW | Lumina |
|---|---|---|---|---|
| Camera (static 2D) | Y | Y | Y | **Y** |
| MovingCamera (pan/zoom frame) | Y | Y | N | **Y** |
| ZoomedScene (inset magnifier) | Y | P | N | **Y** |
| Multi / Split / Mapping camera | Y | P | N | **Y** |
| ThreeDScene | Y | Y | P | **Y** |
| VectorScene | Y | Y | N | **Y** |
| LinearTransformationScene | Y | via NumberPlane.apply_matrix | N | **Y** |
| Sections / beats | Y | P | N | **Y** |
| Interactive embed / REPL | P | Y (`self.embed`) | N | **playground REPL** |

---

## 5. Text and math

| Feature | CE | GL | MW | Lumina |
|---|---|---|---|---|
| Text (system fonts) | Pango | Pango | KaTeX/canvas | **Canvas + OpenType outlines — ✅ implemented** |
| MathTex / Tex | local LaTeX | local LaTeX | KaTeX | **mathjax-full (browser TeX engine) — ✅ implemented**, not KaTeX (see decision note below) |
| Substring isolate / color map | Y | Y | P | **Y — ✅ implemented** (`isolate`/`texToColorMap` options) |
| TransformMatchingTex | Y | Y | N | **Y — ✅ implemented**, verified via gallery demo |
| DecimalNumber / Integer / Variable | Y | Y | N | **Y** |
| Code (syntax highlight) | Pygments | P | N | **highlight.js tokens → VMobjects** |
| Brace / BraceLabel | Y | Y | P | **Y** |
| Title, BulletedList, Paragraph | Y | Y | P | **Y** |
| SVG import | Y | Y | P | **Y** |
| Typst | Y | N | N | later optional |

**Decision note (MathTex backend):** this doc originally targeted KaTeX, but the actual implementation uses
**`mathjax-full`** instead — confirmed via research (doc 12 §7) that `mathjax-full`'s `liteAdaptor` + `SVG`
output jax produces path-only SVG (no DOM needed, `M/L/Q/C/Z/H/V/T` commands only with `fontCache:'none'`) with
`\cssId` tagging surviving into the output, which was the missing piece for per-subexpression
`TransformMatchingTex` matching. `katex` remains an installed dependency but is currently unused; the
SVG-path→Bézier parser (`math/svg-path.ts`) is generic enough that KaTeX's SVG output (if ever preferred for
bundle-size reasons) could be routed through the same pipeline later.

---

## 6. Domain: mathematics

| Feature | CE/GL | Others | Lumina |
|---|---|---|---|
| Linear algebra (vectors, matrices, ApplyMatrix, ghost grid) | Y (LinearTransformationScene) | T3 matrices only | **pack `lumina/math-linalg`** |
| Calculus (graphs, tangent, Riemann, area, related rates via tracker) | Y (DIY scenes) | Desmos P | **pack** |
| Complex analysis (ComplexPlane, z→f(z), homotopy) | Y | MathBox P | **pack** |
| Probability (BarChart, SampleSpace) | Y | D3 P | **pack** |
| Graph theory (Graph, DiGraph, layouts) | Y (NetworkX) | Manim.js strong | **own layouts** |
| Number theory / discrete (dots, modular clock, trees) | DIY | Manim.js P | **pack** |
| Formula ↔ graph linked morph | DIY updaters | Desmos Y | **first-class** |
| Step-by-step algebraic decomposition | TransformMatchingTex DIY | N | **first-class UI** |

---

## 7. Domain: physics

| Feature | manim-physics / CE | T3 | Lumina |
|---|---|---|---|
| Particles + forces | plugin | DIY | **pack `lumina/physics`** |
| Springs / pendulums | plugin | DIY | **pack** |
| Electric / magnetic fields (ArrowVectorField) | CE + plugin | DIY | **pack** |
| Waves / double slit / interference | DIY | DIY | **pack** |
| Optics (rays, lenses) | DIY | DIY | **pack** |
| Rigid body (box2d-ish) | plugin | cannon.js etc. | **simple 2D integrator v1, later** |
| SHM / phase space | DIY | N | **pack** |

Python `manim-physics` is a plugin, not core. Lumina treats a **small, pedagogical physics pack** as in-scope (not a general game engine).

---

## 8. Domain: computer science

| Feature | CE | Manim.js | MW | Lumina |
|---|---|---|---|---|
| Arrays / lists as mobjects | DIY | P | N | **pack `lumina/cs`** |
| Linked lists, trees, heaps | DIY | P | N | **pack** |
| Graphs + BFS/DFS/Dijkstra highlight | Graph mobject | **strong** | P | **pack (learn from Manim.js)** |
| Sorting (bar array morph) | DIY | P | N | **pack** |
| Stack / queue | DIY | N | N | **pack** |
| Automata / Turing tape | DIY | N | N | **pack** |
| Memory / pointer diagrams | DIY | N | N | **pack** |
| Code + running highlight | Code mobject | N | N | **pack** |
| Recursion trees | DIY | N | N | **pack** |

---

## 9. Domain: AI / ML

| Feature | Existing Manim | Lumina |
|---|---|---|
| Neural net graph (layers as nodes) | DIY | **pack `lumina/ml`** |
| Forward / backward pass animation | DIY | **pack** |
| Loss surface + gradient descent | DIY 3D Surface | **pack** |
| Linear classifier / perceptron | DIY | **pack** |
| Embeddings / PCA / t-SNE schematic | DIY | **pack (schematic, not full sklearn)** |
| Attention / transformer diagram | DIY | **pack** |
| Decision boundary 2D | DIY | **pack** |
| Training curve live tracker | ValueTracker DIY | **pack** |

Not in scope: training real models in the browser as a core feature. Optional later: tiny numeric demos (a few perceptron steps) as simulations.

---

## 10. Morphing, flow, intuition (the 3b1b bar)

| Feature | CE/GL | MW | Lumina |
|---|---|---|---|
| Object morph (square→circle) | Transform | Transform | **Y** |
| Shape-matching morph | TransformMatchingShapes | N | **Y** |
| Formula morph keeping identical symbols | TransformMatchingTex | N | **Y** |
| Formula → graph (equation becomes a plot) | DIY FadeTransform | N | **first-class `FormulaToGraph`** |
| Geometric linear transform of the plane | ApplyMatrix + LinearTransformationScene | N | **Y** |
| Nonlinear / complex map of the plane | apply_complex_function | N | **Y** |
| Homotopy / continuous deformation | Homotopy | N | **Y** |
| Conceptual flow (idea A becomes idea B with labels) | FadeTransform + Succession | P | **Y + step UI** |
| Step-by-step visual decomposition | sections + matching tex | N | **player beats + `decompose()`** |
| Dynamic parameter scaling | ValueTracker + updaters | P | **tracker + sliders** |
| Interactive math simulation | GL mouse/embed | drag/hover | **sliders, drag, orbit, step** |

---

## 11. Player, embed, export

| Feature | CE/GL | MW | MC | Lumina |
|---|---|---|---|---|
| Browser live preview | N (window in GL) | Y | Y (editor) | **Y** |
| Play / pause / seek / speed / loop | N | DIY | Y | **first-party Player** |
| Fullscreen | N | DIY | Y | **Y** |
| Keyboard (space, arrows, 0–9 speeds) | N | N | Y | **Y** |
| Captions / voiceover cue | add_sound | N | audio | **phase 3** |
| Section / beat next-prev | Manim Slides | N | P | **Y** |
| `<lumina-player>` web component | N | N | N | **Y** |
| iframe / script embed snippet | N | mount DOM | N | **Y** |
| React / Vue wrapper | N | Y | N | **phase 2** |
| Export WebM | FFmpeg | Y | Y | **MediaRecorder** |
| Export GIF | FFmpeg | Y | Y | **gifenc worker** |
| Export PNG sequence | Y | P | Y | **Y** |
| Export MP4 | FFmpeg | N (browser) | Y (ffmpeg) | **not in-browser; optional later server** |

---

## 12. Innovations no existing lib productizes (see also [11](11-GAPS-AND-INNOVATIONS.md))

| Innovation | Why it matters |
|---|---|
| Formula↔graph **linked** morph with shared ValueTracker | Desmos × Manim |
| Step-decomposition UI (click a beat, see the visual proof step) | Teaching |
| Web component embed with player chrome | Educational websites |
| JSON / declarative scene file + JS construct() | Share scenes without a build step |
| Dual 2D Canvas + owned WebGL with one mobject tree | No Three.js lock-in |
| Parameter recording (slider motion becomes an animation) | Interactive → film |
| Alias layer CE ↔ GL names | Authors from either world |
| Domain packs (math/physics/CS/ML) in core repo | “Complete packed features” |

---

## 13. Coverage target by phase

| Phase | Must reach “Y” on |
|---|---|
| **0** (this docs set) | Research complete. No code. |
| **1** | Core engine 2D + creation/fade/grow/transform(basic) + Axes/NumberPlane + Text/MathTex(KaTeX) + Player + embed — **mostly done**: core engine 2D, animations, Text, MathTex (mathjax-full, not KaTeX), Axes/NumberPlane are all ✅ implemented; Player + embed are the remaining item. |
| **2** | Full animation catalogue, TransformMatching*, ComplexPlane, LinearTransformationScene, MovingCamera, Zoomed, boolean ops, graphs, 3D solids/surfaces/camera — **mostly done**: animation catalogue, `TransformMatchingShapes`/`TransformMatchingTex`, ComplexPlane, MovingCamera/Zoomed, 3D solids/surfaces/camera are ✅ implemented; boolean ops and Graph/DiGraph remain open. `LinearTransformationScene` equivalent not yet built. |
| **3** | Domain packs, formula↔graph, step UI, export GIF/PNG, React wrapper, JSON serialization |
| **4** | Physics/ML polish, WebGPU research, audio, py-to-js mapping tool |

Nothing in this matrix is “out of product vision.” Only **phased**. Deliberate omissions remain those in [02 §I](02-MANIM-PYTHON-COMPLETE-API.md) (local TeX, FFmpeg, Pi creatures, NetworkX, IPython).
