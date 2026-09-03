# 04 — Three.js and Related Libraries

**Date:** 2026-09-02  
**Purpose:** Extract what Lumina must *learn* from Three.js and the surrounding JS animation / math-viz ecosystem — without becoming a wrapper of any of them.

---

## 1. Three.js — what it is and is not

Three.js is the default WebGL/WebGPU engine on the web. It gives you a **scene graph of Object3D**, cameras, lights, geometries, materials, and a renderer. It does **not** give you Manim’s pedagogical language.

Lumina needs Three.js-class **3D capability**. Lumina does **not** need Three.js as a core dependency (see architecture in [06](06-ARCHITECTURE.md)).

Official docs: https://threejs.org/docs/

### 1.1 Mental model

```
Scene
  └── Object3D (transform: position, rotation, scale, quaternion, matrix)
        ├── Mesh (Geometry + Material)
        ├── Line / LineSegments / Points / Sprite
        ├── Group / LOD / InstancedMesh / SkinnedMesh
        ├── Light
        └── Camera
Renderer.render(scene, camera)  // every frame
```

Animation in Three.js is **clip-based** (`AnimationMixer` + `AnimationClip` + keyframe tracks), designed for imported glTF characters — the opposite of Manim’s `play(Transform(a, b))`.

### 1.2 Inventory Lumina 3D must cover (capability, not class names)

**Cameras**

| Three.js | Lumina equivalent |
|---|---|
| `PerspectiveCamera(fov, aspect, near, far)` | Default 3D camera |
| `OrthographicCamera` | 2D and “blueprint” 3D |
| `CubeCamera` / `StereoCamera` / `ArrayCamera` | Later (reflections, VR). Not v1 |

Manim 3D is closer to a **perspective camera on a spherical boom** (φ, θ, γ euler, focal distance) plus `fix_in_frame` HUD. Three.js OrbitControls is the interaction analogue of ManimGL `touch()`.

**Lights**

Ambient, Directional (+ shadow), Hemisphere, Point (+ shadow), Spot (+ shadow), RectArea, LightProbe.

ManimGL exposes `camera.light_source` as a **mobject you can `play(light.animate.move_to(...))`**. Lumina must treat lights as mobjects, not as Three.js-only objects the timeline cannot see.

**Geometries (core)**

Box, Capsule, Circle, Cone, Cylinder, Dodecahedron, Icosahedron, Octahedron, Tetrahedron, Plane, Ring, Shape, Sphere, Torus, TorusKnot, Tube, Lathe, Extrude, Polyhedron, Edges, Wireframe, Parametric (addon).

Map onto ManimCE 3D mobjects (Sphere, Cube, Cone, Cylinder, Prism, Torus, Surface, platonic solids, Arrow3D, Line3D, Dot3D) plus extras Manim never shipped (TorusKnot, Capsule) as optional.

**Materials**

For *explainer* 3D, photoreal Physical/SSS is usually wrong. 3b1b 3D is:

- Flat / Lambert-ish fill
- Crisp stroke (mesh overlay = ManimGL `SurfaceMesh`)
- Checkerboard parametric surfaces
- Optional dual texture (day/night Earth in SurfaceExample)
- Background stroke / contrast

Lumina 3D materials v1: **Unlit, Lambert, Phong, Wire, Checker, Texture**. Physical/PBR later if needed.

**Math types**

`Vector2/3/4`, `Matrix3/4`, `Quaternion`, `Euler`, `Color`, `Ray`, `Box2/3`, `Frustum`, `Spherical`, `Cylindrical`, `Triangle`, interpolants.

Lumina core must own **vec2/vec3/mat3/mat4/quat/color**. Do not import Three.js just for `Vector3`. Reimplement a small `lumina/math` (or vendor a tiny MIT vec library and wrap it). This is the shared language of 2D VMobjects *and* 3D meshes.

**Curves**

Cubic/Quadratic Bézier 2D+3D, Ellipse, CatmullRom, NURBS, Path/Shape.

VMobject *is* a Bézier path. Three.js `Curve.getPoint(t)` is the same idea as Manim `point_from_proportion(α)`. Implement once in core.

**Controls (addons)**

OrbitControls, Trackball, Fly, FirstPerson, PointerLock, Transform, Drag, Arcball, Map.

v1: **Orbit** (3D) + **pan/zoom** (2D MovingCamera) + **drag mobjects**. Others later.

**Renderers**

`WebGLRenderer` (default), `WebGPURenderer` (future). Lumina: custom WebGL2 renderer v1, WebGPU research later.

**AnimationMixer**

Do **not** use this as the explainer timeline. Keep Manim `play()`. Optionally, a later interop can play a glTF clip *inside* a wait() window.

**Post / extras we do not need in v1**

CSM shadows, clustered lighting, WebXR, most loaders (Collada, AMF, …), city/forest generators, inspector, GPGPU bitonic sort. Loaders worth a later plugin: glTF, Texture, Font (for 3D extruded text).

### 1.3 What to copy as *ideas*, not code

1. Object3D transform stack (position/rotation/scale/matrixWorld) for 3D mobjects.
2. BufferGeometry as the GPU representation of a Surface.
3. OrbitControls UX.
4. Separate geometry from material.
5. Layers / render order (Manim z-order is add-order; 3D needs explicit depth + a 2D overlay pass).

### 1.4 What never to copy as public API

- `new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshPhongMaterial())` as the authoring API.
- `requestAnimationFrame` loops in user code.
- `scene.add(mesh)` as the only composition (we have Scene.add(mobject) + play()).

Authors write Manim. The WebGL layer is an internal backend.

---

## 2. Motion Canvas

Site: https://motioncanvas.io — TypeScript, generator scenes, first-party editor.

```ts
export default makeScene2D(function* (view) {
  const myCircle = createRef<Circle>();
  view.add(<Circle ref={myCircle} x={-300} width={240} height={240} fill="#e13238" />);
  yield* all(
    myCircle().position.x(300, 1).to(-300, 1),
    myCircle().fill('#e6a700', 1).to('#e13238', 1),
  );
});
```

**Steal:**

| Idea | Why |
|---|---|
| Generator / `yield*` as a timeline | Alternative to `await play()`; both are valid JS. Lumina uses `await` to stay Manim-like, but internally the clock is a generator of frames. |
| `all(...)` / flow helpers | Same as AnimationGroup |
| Property tween `.x(300, 1).to(-300, 1)` | Nice for scalar props. Lumina `.animate` is the Manim form; we can *also* offer `tracker.to(3, { runTime: 1 })`. |
| First-party **preview editor** | Playground (after confirmation) should feel this good. |
| Audio sync | Later phase |
| Scene-as-module | `export function construct(scene)` |

**Do not steal:** JSX view tree as the only way to build objects. Manim authors think in constructors, not in HTML-ish trees. Optional JSX later, not core.

---

## 3. Remotion

React → video frames, rendered to MP4 (often server-side). Composition = React tree + `useCurrentFrame()`.

**Steal:** frame-accurate render function `renderFrame(t)` (required for seek and export). `<Sequence>` as an idea for Scene sections.

**Do not steal:** React as a required runtime. Lumina must run from a `<script type="module">` with zero framework.

---

## 4. MathBox

WebGL math visualization (Steven Wittens / terminally). Declarative graphs, expressions as fields, 4D-ish, GLSL.

**Steal:**

- Treat a plot as a **sampled field**, not a polyline you throw away.
- GPU for dense fields / 3D graphs / complex maps on a grid.
- Camera that can present mathematical 4D projections (later).

**Do not steal:** MathBox’s expression DSL as the public API. Lumina public API is Mobjects.

Use-case overlap: `ApplyComplexFunction` on a NumberPlane *is* a MathBox-quality job. Implement with subdivided VMobjects first (ManimGL `prepare_for_nonlinear_transform`), GPU later for dense grids.

---

## 5. JSXGraph

Interactive Euclidean geometry: points, lines, circles, intersections, dragging, constructions that stay consistent.

**Steal:** constraint solver for “point A stays on circle C while B is dragged”. This is **interactive geometry**, a domain pack (`lumina/geometry-euclid`).

**Do not steal:** JSXGraph’s Board API as the scene API.

---

## 6. Desmos

Not an embeddable engine we can reimplement fully (proprietary). Pedagogically it is the gold standard of **formula linked to graph linked to slider**.

Lumina must have:

```js
const a = new ValueTracker(1);
const eq = new MathTex(() => `y = ${a.getValue().toFixed(2)} x^2`);
const graph = axes.plot(() => x => a.getValue() * x * x);
// slider in the player binds to `a`
```

When `a` changes (animation *or* user slider), formula text and graph both update. That is the Desmos-class feature Manim only has via updaters, and manim-web does not productize.

---

## 7. KaTeX and MathJax

| | KaTeX | MathJax |
|---|---|---|
| Speed | Fast, designed for it | Slower, more complete |
| Browser | Yes | Yes |
| Packages | Large but not full TeX | Closer to full LaTeX |
| Output | HTML/CSS or MathML; SVG possible | HTML, SVG, CHTML |

**Decision:** KaTeX default for `MathTex` / `Tex`. MathJax optional fallback for missing macros.

To **TransformMatchingTex** and `Write` formulas, glyphs must become VMobjects:

1. KaTeX renders to DOM/SVG.
2. Parse SVG paths → Bézier VMobjects (one per atom / one per path).
3. Keep a map `tex string → submobject` for matching.

opentype.js (or harfbuzz-wasm later) is needed for **non-TeX** `Text` outlines (`Write`, `TransformMatchingShapes` on words).

---

## 8. p5.js

Draw loop, immediate mode, great for sketches. Manim.js is built on it.

**Steal:** nothing for the core API. Maybe a playground “p5 interop” later (`fromP5`).

**Do not:** require p5, or use `draw()` as the clock.

---

## 9. D3, anime.js, GSAP, Theatre.js, DefinedMotion

| Lib | Role | Steal |
|---|---|---|
| D3 | Data joins, SVG charts | Scale helpers, color interpolators (`d3-interpolate` ideas, reimplemented) |
| anime.js | Generic tween | Easing catalogue cross-check vs Manim rate functions |
| GSAP | Timeline, plugins | Timeline UX; too commercial/heavy as a dependency |
| Theatre.js | Studio for three/react | Studio inspiration for playground |
| DefinedMotion | Small programmatic motion | Note as related; not a base |

Lumina’s clock is **ours**. Do not sit on GSAP.

---

## 10. Manim Slides

Python: `Slide` / `ThreeDSlide` subclasses of Scene. Presentation beats, PDF-ish skip.

Lumina player should support:

- `scene.section("Title")` (CE `next_section`)
- Player UI: next/prev beat, not only continuous play
- Optional “slides mode” that pauses at each section until the teacher advances

---

## 11. Web platform pieces (libraries we *will* depend on, proposed)

These are the only third-party runtime deps proposed for v1. Everything else is from scratch.

| Dep | Why | Optional? |
|---|---|---|
| **KaTeX** | MathTex | Required for math |
| **opentype.js** | Text outlines | Required for Write/Transform on Text |
| **gifenc or gif.js** | GIF export | Optional extra entry `lumina/export-gif` |
| *(none for WebGL)* | Own renderer | — |

Explicitly **not** v1 deps: three, p5, gsap, d3, mathbox, jsxgraph, motion-canvas, remotion, manim-web, paper.js (boolean ops: evaluate WASM pathops vs a small boolean impl in phase 2).

---

## 12. Mapping Three.js features → Lumina 3D module (checklist)

| Three.js capability | Lumina public API | Phase |
|---|---|---|
| Scene / Object3D transform | `Mobject` 3D transform | 1 (2D already has it) / 2 for 3D |
| Perspective camera | `ThreeDCamera` / `ThreeDScene` | 2 |
| OrbitControls | `scene.camera.orbit({ enabled })` | 2 |
| SphereGeometry | `Sphere` | 2 |
| BoxGeometry | `Cube`, `Prism` | 2 |
| Cylinder / Cone | `Cylinder`, `Cone`, `Arrow3D`, `Line3D` | 2 |
| Torus | `Torus` | 2 |
| ParametricGeometry | `Surface(func, uRange, vRange)` | 2 |
| Platonic | Tetrahedron…Dodecahedron | 2 |
| MeshLambert + lights | default 3D shading + `Light` mobject | 2 |
| Texture | `TexturedSurface` | 2 |
| EdgesGeometry | `SurfaceMesh` | 2 |
| Fog | `scene.fog` | 3 |
| InstancedMesh | particle fields, StreamLines GPU | 3 |
| glTF | `importModel` plugin | later |
| WebGPU | backend flag | later |
| AnimationMixer | not public | — |
| ShaderMaterial | `ShaderSurface` escape hatch | 3 |

---

## 13. Verdict

Three.js is the **capability ceiling** for 3D, not the authoring language.

Motion Canvas is the **preview UX ceiling**.

KaTeX is the **math typesetter**.

Desmos is the **interaction ceiling** for parameter-linked math.

MathBox is the **dense-field ceiling**.

JSXGraph is the **Euclidean construction ceiling**.

Lumina’s job is to sit in the Manim language and **reach those ceilings** with owned internals.
