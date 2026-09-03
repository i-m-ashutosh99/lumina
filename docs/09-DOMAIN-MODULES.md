# 09 — Domain Modules (Math, Physics, CS, AI/ML)

**Status:** Design only. No code.  
**Date:** 2026-09-02  
**Purpose:** Catalogue every domain pack the complete library must ship so that 3Blue1Brown-style explainers, classroom embeds, and interactive simulations can be authored without reinventing mobjects each time.

These packs sit **above** the engine (doc 06) and **use** the public API (doc 07). They never talk to Canvas/WebGL directly. A pack is a tree-shakable import:

```js
import { LinearTransformationScene, Vector, Matrix } from 'lumina/math-linalg';
import { NeuralNet } from 'lumina/ml';
```

Core (`lumina`) stays geometry + animation + player. Packs are optional, but they are **in-repo first-party**, not afterthought plugins — that is the “complete packed features” requirement.

---

## 1. Pack map and phasing

| Pack | Import | Phase | Depends on |
|---|---|---|---|
| **math-linalg** | `lumina/math-linalg` | 1–2 | Axes, NumberPlane, Vector, Matrix, ApplyMatrix |
| **math-calculus** | `lumina/math-calculus` | 2 | Axes, FunctionGraph, ValueTracker, Riemann |
| **math-complex** | `lumina/math-complex` | 2 | ComplexPlane, ApplyComplexFunction, Homotopy |
| **math-probability** | `lumina/math-probability` | 2 | BarChart, SampleSpace, NumberLine |
| **math-discrete** | `lumina/math-discrete` | 3 | Graph, NumberLine, Integer |
| **math-euclidean** | `lumina/math-euclidean` | 3–4 | geometry kernel, optional JSXGraph-class constructions |
| **physics** | `lumina/physics` | 3 | VectorField, ValueTracker, 2D integrator |
| **cs** | `lumina/cs` | 3 | Graph, Code, VGroup layouts (learn from Manim.js) |
| **ml** | `lumina/ml` | 3–4 | Graph, Surface, VectorField, math-linalg |
| **shared pedagogy** | `lumina` core | 1–3 | FormulaToGraph, `decompose()`, step UI, expose() |

Deliberate non-packs (see [02 §I](02-MANIM-PYTHON-COMPLETE-API.md) omissions):

- Real game-engine physics (Box2D/cannon.js full fidelity)
- Training production ML models in the browser
- NetworkX as a hard dependency
- Pi creatures / copyrighted 3b1b character art
- Local TeX / Typst CLI

---

## 2. Shared pedagogical primitives (core, not a pack)

These are the innovations that make *every* domain pack teach rather than just draw. Spec also in [07](07-API-DESIGN.md) and [11](11-GAPS-AND-INNOVATIONS.md).

### 2.1 FormulaToGraph

Linked morph: a `MathTex` expression becomes (or stays tied to) a plot.

```js
const link = new FormulaToGraph({
  tex: 'f(x) = a\\sin(bx)',
  axes,
  fn: (x, p) => p.a * Math.sin(p.b * x),
  params: { a: new ValueTracker(1), b: new ValueTracker(1) },
});
await scene.play(link.morph({ runTime: 2 }));   // glyphs → curve
scene.expose('a', link.params.a, { min: 0, max: 3 });
scene.expose('b', link.params.b, { min: 0.5, max: 6 });
```

Rules:

- Identical symbols (`x`, `a`, `sin`) keep identity through the morph (TransformMatchingTex internally).
- Changing a tracker **redraws the graph and recolors the corresponding glyph**.
- This is the Desmos gold standard (doc 04) expressed in Manim language.

### 2.2 `decompose()` / step UI

A visual proof is a list of beats the player can step:

```js
scene.section('setup');
await scene.play(Create(triangle));
scene.section('drop-altitude');
await scene.play(Create(altitude));
scene.section('two-right-triangles');
await scene.play(TransformMatchingShapes(triangle, pair));
```

Player chrome: prev/next beat, optional numbered list. `decompose(mobject)` is a helper that splits a VGroup / MathTex into highlighted pieces with LaggedStart.

### 2.3 Parameter recording

`scene.expose(name, tracker, { bind: 'live' | 'timeline' })`.

- `live` — slider moves the simulation without changing playhead (interactive classroom).
- `timeline` — slider motion is recorded as a clip (interactive → film). Seeded RNG still applies.

### 2.4 Intuition labels

`Narration(tex | text)` is a `fixInFrame` HUD label that Succession-fades with sections. Not a voiceover (phase 3 audio). Used for conceptual flow: idea A becomes idea B with a caption.

---

## 3. `lumina/math-linalg` — linear algebra

**Why it is first:** 3Blue1Brown’s *Essence of Linear Algebra* is the reference explainer. ManimCE ships `VectorScene` and `LinearTransformationScene` for this reason.

### 3.1 Must-have classes / helpers

| Name | Role | Manim source |
|---|---|---|
| `Vector` | Arrow from origin (or from a point) | `geometry.line.Vector` |
| `Arrow` / `DoubleArrow` | General directed segment | geometry |
| `Matrix` / `IntegerMatrix` / `DecimalMatrix` / `MobjectMatrix` | Bracketed array | `mobject.matrix` |
| `getDetText()` | “det” annotation | CE |
| `NumberPlane` + ghost copy | Background grid that stays while a transformed copy moves | LinearTransformationScene |
| `LinearTransformationScene` | applyMatrix, applyInverse, applyTransposedMatrix, applyNonlinearTransformation, addVector, addUnitSquare, getGhostPlane | **CE scene class** |
| `VectorScene` | addAxes, addVector, coordsToVector | CE |
| `ApplyMatrix` / `ApplyComplexFunction` / `ApplyPointwiseFunction` | Animations | CE transform |
| `prepareForNonlinearTransform(n)` | Subdivide curves before a nonlinear map | GL |
| `basisI`, `basisJ`, `basisK` | Colored unit vectors (i-hat, j-hat, k-hat) | 3b1b convention |

### 3.2 Must-have scenes (acceptance demos)

1. **i-hat / j-hat shear.** Unit square + basis vectors; apply `[[1,1],[0,1]]`; ghost original grid.
2. **Determinant as area.** Unit square morphs; `getDetText` updates via ValueTracker.
3. **Eigenvectors.** A vector that does not rotate; others spin; 3D optional later.
4. **3D linear map.** Cube or unit box under a 3×3 matrix (needs `lumina/3d`).
5. **Change of basis.** Two grids, matrix sandwich.
6. **Matrix as machine.** Formula `A\\vec{v}` FormulaToGraph-style morph onto the transformed vector.

### 3.3 API sketch

```js
const s = new LinearTransformationScene('#c', {
  includeBackgroundPlane: true,
  includeForegroundPlane: true,
  showBasisVectors: true,
  leaveGhostVector: true,
});
await s.construct(async (s) => {
  const v = s.addVector([1, 2], { color: YELLOW });
  await s.applyMatrix([[1, 1], [0, 1]], { runTime: 3 });
  await s.applyInverse();
  await s.applyTransposedMatrix();
  await s.applyNonlinearTransformation(([x, y]) => [x + 0.1 * y * y, y]);
});
```

### 3.4 Out of pack (lives in core)

`ApplyMatrix` as a generic Animation can live in core. The **scene class + ghost plane + basis helpers** are the pack.

---

## 4. `lumina/math-calculus`

Manim has the primitives (`get_graph`, `get_riemann_rectangles`, `get_tangent_line`, `get_area`, ValueTracker). It does **not** ship a calculus pack. Lumina should.

### 4.1 Classes / helpers

| Name | Role |
|---|---|
| `Plot` | Sugar over `axes.plot(fn, { xRange, color })` |
| `ParametricPlot` | `axes.plotParametricCurve` |
| `ImplicitPlot` | `F(x,y)=0` contour (phase 2; marching squares) |
| `TangentLine` | Line through `(x0, f(x0))` with slope `f'(x0)` — live via tracker |
| `SecantLine` | Two-point slope; morphs into tangent as `h → 0` |
| `RiemannRectangles` | left/right/mid/trapezoid; `dx` as ValueTracker |
| `Area` | Filled region between curves or curve and axis |
| `DerivativeGraph` | Second axes whose plot is `f'` (numerical or provided) |
| `IntegralTracker` | Running accumulation animation (area paints left→right) |
| `RelatedRatesScene` | Two quantities tied by one tracker (ladder, balloon) |
| `TaylorPolynomial` | Partial sums overlay, `n` tracker |
| `SlopeField` | ArrowVectorField of `y' = f(x,y)` |
| `EulerMethod` | Stepped polyline along a slope field |
| `PhaseLine` | 1D autonomous ODE on a NumberLine |
| `PolarGraph` | On PolarPlane |

### 4.2 Formula↔graph (required demos)

- `f(x)=x^2` Write → FormulaToGraph → parabola.
- Slider `a` on `a x^2 + bx + c` updates both TeX coefficients and the curve.
- Riemann `n` slider: bars subdivide; sum DecimalNumber updates.
- Definition of derivative: secant → tangent as `h` tracker → 0, with the difference quotient still on screen.

### 4.3 Numerical policy

- Default sampler: adaptive (more points where curvature is high) with a max-point budget.
- Derivatives: central difference unless the author passes `fPrime`.
- Never call a CAS. Optional later: expression parser (mathjs) so a TeX string *is* the function. v1: author supplies JS `fn`.

---

## 5. `lumina/math-complex`

### 5.1 Classes

| Name | Role |
|---|---|
| `ComplexPlane` | NumberPlane with `n2p` / `p2n` | 
| `ComplexValueTracker` | `z` as `{re, im}` or `Complex` |
| `ComplexNumber` | Dot + Arrow + optional label `a+bi` |
| `ApplyComplexFunction(fn, mob)` | Animation `z → f(z)` on every point |
| `ComplexHomotopy` | `H(z, t)` |
| `ComplexMapScene` | Input plane / output plane split, or in-place morph |
| `GridUnderMap` | Cartesian or polar grid `prepareForNonlinearTransform` then `z²`, `e^z`, Möbius |
| `ComplexVectorField` | `f: ℂ → ℂ` as arrows |

### 5.2 Demos

- `z → z²` of a grid (the 3b1b complex-number signature).
- Multiplication as rotate+scale (tracker for modulus and argument).
- e^{iθ} on the unit circle, with the formula and the point linked.
- Möbius transform of the Riemann sphere (needs 3D).

---

## 6. `lumina/math-probability`

| Name | Role | Manim source |
|---|---|---|
| `BarChart` | Categorical | CE |
| `SampleSpace` | Unit square partitions | CE |
| `Histogram` | Binned numeric | new |
| `DensityCurve` | Overlay on histogram / axes | new |
| `RandomDotCloud` | Monte Carlo dots (seeded `scene.rng`) | new |
| `BernoulliTrial` / `BinomialProcess` | Animated coin/urn | new |
| `BayesScene` | SampleSpace morph between prior and posterior | new |
| `ExpectedValueMarker` | Brace + DecimalNumber | Brace helpers |
| `BoxPlot` / `DotPlot` | EDA | new, phase 3 |

Seekable Monte Carlo: all randomness from `scene.rng`. Re-seek replays the same sequence.

---

## 7. `lumina/math-discrete`

| Name | Role |
|---|---|
| `IntegerDots` | n dots that regroup (square numbers, primes) |
| `ModularClock` | Circle of n ticks; multiplication/addition mod n |
| `PascalTriangle` | Cells as Integer mobjects; highlight identities |
| `RecurrenceTree` | Same as CS recursion tree; shared primitive |
| `PermutationScene` | Dots + arrows for σ; composition |
| `BinaryExpansion` | NumberLine + grouped powers of two |

Graph theory lives in **`lumina/cs`** (and core `Graph`) so discrete-math lectures import both.

---

## 8. `lumina/math-euclidean` (later)

JSXGraph-class constructions (doc 04): point-line-circle incidence, drag a point, dependent objects update.

| Name | Role |
|---|---|
| `EuclidPoint` / `EuclidLine` / `EuclidCircle` | Constraint objects |
| `Midpoint`, `Perp, Parallel, AngleBisector` | Constructions |
| `Thales` / `PythagorasScene` | Curriculum scenes |

v1 does **not** need a constraint solver. Phase 3–4. Until then, authors use updaters.

---

## 9. `lumina/physics`

**Scope:** pedagogical 2D (and light 3D) simulations for explainers. **Not** a game engine. Python `manim-physics` is a plugin; Lumina treats a *small* pack as first-party.

### 9.1 Integrator

```js
class Particle {
  mass, position: Vec3, velocity: Vec3, charge?, fixed?
}
class World {
  add(body)
  addForce(fn)            // (p, t) => force
  step(dt)                // symplectic Euler or RK4, fixed dt
  snapshot() / restore()  // required for seek
}
```

Seek rule: physics clips store `{ t0, t1, snapshot0, dt }`. `render(t)` restores snapshot0 and steps `(t-t0)/dt` times (or caches keyframes every N ms). Wall-clock `dt` is forbidden.

### 9.2 Modules

| Module | Objects | Typical demo |
|---|---|---|
| **particles** | Particle, ParticleSystem, Trails (`TracedPath`) | Newton gravity 2-body, charges |
| **forces** | Gravity, Spring, Drag, Coulomb, UniformField | Feynman diagrams are *not* in scope; Coulomb field arrows are |
| **oscillators** | SpringMass, Pendulum, CoupledOscillators, SHMPhasor | SHM + phase space side by side |
| **waves** | TransverseWave, StandingWave, Interference2D, DoubleSlit | path difference → bright/dark |
| **fields** | ElectricField, MagneticField (ArrowVectorField + StreamLines) | point charge, dipole, solenoid schematic |
| **optics** | Ray, Mirror, ThinLens, Refraction (Snell) | principal rays through a lens |
| **kinematics** | MotionDiagram, VelocityArrow, AccelerationArrow | projectile with component arrows |
| **energy** | EnergyBar (kinetic/potential stacked) | pendulum energy swap |
| **thermo** | IdealGasBox (many particles, seeded) | P-V schematic, not real thermo engine |
| **circuits** | schematic Resistor/Capacitor/Wire (phase 4) | Kirchhoff as graph |

### 9.3 3b1b physics bar

- Fields are **visible** (arrows, streamlines), not just numbers.
- Equations (`F = q(E + v × B)`) stay on screen via FormulaToGraph / HUD.
- Time can slow (`ChangeSpeed`, player speed) without breaking the integrator.

### 9.4 Out of scope

Rigid-body collision with friction stacks, cloth, fluid Navier–Stokes, n-body with Barnes–Hut (unless a later demo needs it). Point-mass + spring + field is enough for Essence-of-physics style videos.

---

## 10. `lumina/cs`

**Learn from Manim.js (JazonJiao)** for graph lecture patterns; **do not** copy pixel coordinates or p5 `show()`. Core `Graph` / `DiGraph` (doc 02) is the substrate — this pack adds *algorithm animation* and *data-structure mobjects*.

### 10.1 Data-structure mobjects

| Name | Visual | Operations to animate |
|---|---|---|
| `ArrayMobject` | cells in a row, indices as DecimalNumber | swap, shift, highlight, insert, delete |
| `LinkedList` | nodes + arrows | pointer move, splice |
| `Stack` / `Queue` | vertical / horizontal cells | push/pop, enqueue/dequeue |
| `Tree` / `BinaryTree` / `Heap` | nodes + edges, layout | rotate, heapify, insert |
| `HashTable` | array of buckets | hash highlight, collision chain |
| `MatrixGrid` | 2D cells (CS matrices, DP tables) | fill cell, highlight recurrence |
| `MemoryTape` | Turing / RAM cells | head move, write |
| `Pointer` | labeled arrow at a cell | *p, &x |
| `CallStack` | frames | recurse / return |
| `CodeBlock` | `Code` mobject + current-line highlight | step through |

### 10.2 Graph algorithms (the Manim.js gap-filler)

Core `Graph` already has vertices/edges as mobjects. The pack adds:

```js
const g = new Graph(vertices, edges, { layout: 'spring' | 'circular' | 'tree' | 'layered' });
await scene.play(g.bfs(start, {
  visit: (v) => Indicate(v),
  traverse: (e) => ShowPassingFlash(e),
}));
await scene.play(g.dfs(start, opts));
await scene.play(g.dijkstra(start, { distLabels: true }));
await scene.play(g.mstKruskal());
```

Layouts **we implement** (no NetworkX): `circular`, `grid`, `tree`, `layered` (Sugiyama-lite), `random` (seeded), `static` (author-supplied positions). `spring` = force-directed, snapshot-able.

Manim.js lesson: vertices/edges must support **timed color state** (undiscovered / frontier / visited) without the author writing updaters by hand.

### 10.3 Algorithm scenes

| Scene | What morphs |
|---|---|
| `SortScene` | ArrayMobject bars; swap = Transform; compare = Indicate |
| `SearchScene` | linear / binary search highlights |
| `RecursionTree` | unfold call tree as the code steps |
| `DPTableScene` | grid fill order |
| `AutomataScene` | DFA/NFA states; input tape; current state |
| `TuringScene` | tape + head + state HUD |

Sorting: bubble, insertion, merge (split/merge morph), quick (pivot partition). Bars are Rectangles whose *height* is the key — 3b1b-adjacent and CS-lecture standard.

### 10.4 Code highlighting

`Code` in core uses highlight.js/Prism tokens → per-token VMobjects (so `Write` and `Indicate` work). The CS pack adds:

```js
const code = new CodeBlock(src, { language: 'python' });
await scene.play(code.stepTo(line));      // highlight + optional pointer
await scene.play(code.morphTo(src2));     // TransformMatchingShapes on tokens
```

---

## 11. `lumina/ml`

**Scope:** schematic explainers, not training real models. Optional tiny numeric demos (a few perceptron steps) as simulations with seeded data.

### 11.1 Classes

| Name | Role |
|---|---|
| `Neuron` / `Layer` / `NeuralNet` | Graph of nodes + weighted edges |
| `ForwardPass` | Activation animation left → right; values as DecimalNumber |
| `BackwardPass` | Gradient highlights right → left (thickness ~ \|grad\|) |
| `LossSurface` | 3D Surface z = L(θ); ball + arrow = gradient descent |
| `GradientDescent` | Particle on a 2D contour or 3D surface; lr tracker |
| `LinearClassifier` | 2D points + line/plane; `w` tracker |
| `DecisionBoundary` | Contour of `f(x)=0` for a tiny net |
| `EmbeddingScatter` | 2D/3D dots; schematic PCA (we compute 2-component SVD of a toy matrix, not sklearn) |
| `AttentionMatrix` | Grid of weights; row/column highlight; softmax as morph |
| `TransformerBlock` | Box diagram: LN → Attn → residual → MLP (conceptual flow, not real weights) |
| `TrainingCurve` | Axes + running plot bound to a tracker |
| `ConfusionMatrix` | IntegerTable with heat color |
| `SoftmaxBars` | BarChart that always sums to 1 (tracker vector) |

### 11.2 Demos (acceptance)

1. **Perceptron.** Dots on a plane; line updates; FormulaToGraph for `σ(w·x+b)`.
2. **Tiny 2-2-1 net.** Forward numbers on edges; loss HUD; one backward pass.
3. **Loss bowl.** 3D paraboloid; ball walks downhill (lr slider).
4. **Attention.** Query/key dots; matrix cells light up; output is a weighted sum morph.
5. **Overfitting schematic.** Polynomial fit with `n` tracker (reuses Taylor/calculus pack).

### 11.3 Out of scope

ONNX runtime, training MNIST for real, t-SNE of ImageNet, importing PyTorch graphs. If an author wants real weights, they pass a JS `forward(x)` — we do not ship a framework.

---

## 12. Cross-cutting visual language (all packs)

Every pack must use the same 3b1b grammar so a lecture can mix them:

| Grammar | How packs use it |
|---|---|
| Background stroke on VMobjects | Default theme `threeb1b` |
| Named palette (`BLUE`, `YELLOW`, `RED` for i-hat/j-hat/k-hat) | linalg; reused in CS (frontier/visited) and ML (pos/neg) |
| HUD `fixInFrame` formulas | physics equations, ML loss, CS code |
| ValueTracker + expose() | every “dynamic parameter scaling” demo |
| Transform / TransformMatchingTex | conceptual flow, not crossfades |
| LaggedStart for “many of the same idea” | Riemann bars, array cells, neurons |
| Sections | step-by-step decomposition UI |

---

## 13. Pack file layout (when implementation is approved — not now)

```
src/lumina/packs/
  math-linalg/
    index.ts
    linear-transformation-scene.ts
    vector-scene.ts
    basis.ts
  math-calculus/
    plot.ts
    riemann.ts
    tangent.ts
    ode.ts
  math-complex/
    complex-plane-helpers.ts
    complex-map-scene.ts
  math-probability/
    histogram.ts
    sample-space.ts
  math-discrete/
    modular-clock.ts
    integer-dots.ts
  math-euclidean/          # phase 4
  physics/
    world.ts
    particle.ts
    spring.ts
    fields.ts
    waves.ts
    optics.ts
  cs/
    array.ts
    list.ts
    tree.ts
    graph-algorithms.ts
    sort-scene.ts
    code-block.ts
    automata.ts
  ml/
    net.ts
    loss-surface.ts
    attention.ts
    classifier.ts
```

Public barrel:

```js
// lumina/math  re-exports linalg + calculus + complex + probability
// lumina/physics, lumina/cs, lumina/ml
```

---

## 14. Curriculum coverage checklist (eventual)

Not a v1 gate — a *completeness* list so “without missing anything” is testable.

**Math.** Vectors, matrices, determinants, eigen, change of basis; limits, derivatives, integrals, Taylor, ODEs, polar; complex arithmetic and maps; probability spaces, Bayes, distributions; modular arithmetic, graphs as math.

**Physics.** Kinematics, Newton, energy, SHM, waves/interference, E&M fields, geometric optics.

**CS.** Arrays, lists, stacks/queues, trees/heaps, hash, sorting, search, BFS/DFS/Dijkstra/MST, recursion, DP, automata, Turing tape, code stepping.

**AI/ML.** Linear models, gradient descent, tiny nets, backprop schematic, loss surfaces, decision boundaries, attention/transformers schematic, softmax, training curves.

If a topic is only “DIY with Circle and Text,” the pack is not done.

---

## 15. Dependencies per pack (planned, not installed)

| Pack | Extra JS libs (proposed) |
|---|---|
| core | KaTeX, opentype.js |
| calculus implicit plots | none (own marching squares) |
| boolean ops (core phase 2) | path-boolean JS or WASM pathops |
| cs Code | highlight.js (token only) |
| physics | **none** (own integrator) |
| ml SVD toy | own 2×n numeric, no tensorflow.js |
| euclidean | none (own constraints) |
| 3D | **none** (owned WebGL; not Three.js) |

No pack may add Three.js, p5, NetworkX-in-WASM, or FFmpeg.

---

## 16. What authors import (examples)

```js
// linear algebra lecture
import { LinearTransformationScene } from 'lumina/math-linalg';

// calculus + live slider
import { RiemannRectangles, TangentLine } from 'lumina/math-calculus';

// CS lecture
import { ArrayMobject, SortScene } from 'lumina/cs';

// ML explainer
import { NeuralNet, LossSurface } from 'lumina/ml';

// physics
import { SpringMass, World } from 'lumina/physics';
```

CDN IIFE can attach `Lumina.packs.cs` etc. so a no-bundler lesson page still works.

---

## 17. v1 vs later (domain)

| In v1 (with core) | Not v1 |
|---|---|
| FormulaToGraph primitive (even if calculus pack is thin) | Full physics integrator |
| LinearTransformationScene (or a reduced version using NumberPlane.applyMatrix) | Euclidean constraint solver |
| Axes plots + ValueTracker sliders | Attention/transformer pack |
| sections / step UI | Automata / Turing |
| | SortScene, NeuralNet, LossSurface |

v1 still needs *one* domain-quality demo (square→circle + formula, plus a NumberPlane matrix) so the 3b1b bar is visible. Full packs are phase 3.

---

**Do not implement these packs until the user confirms the documentation set and the v1 engine exists.**
