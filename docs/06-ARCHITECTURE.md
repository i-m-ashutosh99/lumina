# 06 — Architecture (proposed, not implemented)

**Status:** Design only. No code.  
**Date:** 2026-09-02  
**Rule:** Own math, scene graph, animation, and renderers. Optional Three.js interop later. Never a fork of manim-web.

---

## 1. One-sentence architecture

Lumina is a **seekable, frame-function animation engine**: a scene graph of Bézier (and mesh) mobjects, a clock that can jump to any `t`, dual backends (Canvas2D + custom WebGL), a Manim-like `play()` façade, and a first-party HTML player/embed.

The author writes:

```js
await scene.play(Create(square));
await scene.play(Transform(square, circle));
```

The engine records those calls into a **timeline of clips**. Preview, seek, export, and embed all call the same `engine.render(time)`.

---

## 2. Layer cake

```
┌─────────────────────────────────────────────────────────────┐
│  Consumption                                                │
│  <lumina-player>  |  Player JS  |  playground  |  embed snippet │
├─────────────────────────────────────────────────────────────┤
│  Domain packs (optional imports)                            │
│  math-linalg | calculus | complex | physics | cs | ml       │
├─────────────────────────────────────────────────────────────┤
│  Public API (Manim-familiar)                                │
│  Scene, Mobject, VMobject, animations, cameras, graphing    │
├─────────────────────────────────────────────────────────────┤
│  Engine core                                                │
│  Timeline/Clock  |  Updater system  |  ValueTracker         │
│  Animation interpolators  |  Rate functions                 │
│  Scene graph  |  Camera  |  Coordinate systems              │
├─────────────────────────────────────────────────────────────┤
│  Geometry kernel                                            │
│  vec2/3, mat3/4, quat, color, bezier, path resample,        │
│  boolean ops, triangulate (3D), spatial hash                │
├─────────────────────────────────────────────────────────────┤
│  Render backends (swap, same mobject tree)                  │
│  Canvas2DRenderer  |  WebGLRenderer  |  (later WebGPU)      │
│  Overlay: KaTeX HTML/SVG  |  Player HUD                     │
├─────────────────────────────────────────────────────────────┤
│  Export                                                     │
│  MediaRecorder(WebM)  |  GIF worker  |  PNG sequence        │
└─────────────────────────────────────────────────────────────┘
```

**Invariant:** Domain packs and the player never talk to Canvas/WebGL directly. They only create mobjects and animations.

---

## 3. Scene graph

### 3.1 Node

Every displayable thing is a `Mobject`:

```
Mobject
  id, name, tags
  parent, children[]          // submobjects
  points: Float32Array        // Nx3, z=0 for 2D
  // style
  fill, stroke, strokeWidth, opacity, backgroundStroke
  shading (3D)
  // transform (local)
  position, rotation (quat or euler), scale, matrix
  // behavior
  updaters[]
  fixedInFrame: boolean
  zIndex
  visible, isFixedOrientation
  data: Map                  // user payload
```

`VMobject extends Mobject` adds:

- `closed`, `nCurves`, `anchors`, `handles`
- `pointwiseBecomePartial(a, b)` — `Create` / `ShowPartial`
- `alignPoints(other)`, `insertNCurves(n)`, `makeSmooth()`
- `subpaths[]`

`Group` / `VGroup` are mobjects whose geometry is the union of children (Manim semantics: transforming a group transforms children).

`MeshMobject` (3D) adds: `positions, normals, uvs, indices, material`.

### 3.2 Add order = draw order (2D)

Same as Manim. 3D uses depth buffer plus a **HUD pass** for `fixedInFrame` mobjects (rendered with an orthographic camera after the 3D pass).

### 3.3 Coordinate space

- **World:** mathematical units, origin at scene center, +x right, +y up, +z out of screen (Manim).
- **Frame:** default height = 8 units, width = 8 × aspect (14.22 at 16:9). Configurable.
- **Pixel:** renderer maps world → CSS pixels via camera.

Never expose pixel space in the public geometry API (this is where Manim.js went wrong).

---

## 4. Timeline and clock (the key design choice)

Python Manim is **forward-only**: `construct()` runs, `play()` blocks the renderer until the clip finishes, FFmpeg appends frames. Seeking backwards is not a product feature.

The web **must seek**. So Lumina splits authoring from playback:

### 4.1 Recorded construct

When the user function runs:

```js
export async function construct(scene) {
  const sq = new Square({ side: 2 });
  await scene.play(Create(sq));          // records clip 0
  await scene.wait(0.5);                 // records clip 1
  await scene.play(Transform(sq, circ)); // records clip 2
}
```

In **preview-once** mode this can run live (like manim-web).  
In **player** mode, `play()` does **not** wait on rAF during first run; it **records** clip descriptors `{ t0, t1, animations[], sceneDelta }` and the function completes quickly. Then the player seeks freely.

Implementation strategy (proposed):

1. **Dry run at t=virtual:** animations expose `apply(alpha)` which is a pure function of the mobject’s *start snapshot* + alpha.
2. Each clip stores start snapshots (deep copy of affected mobjects’ points/style).
3. `render(t)` finds the clip, restores snapshot, applies `alpha = rateFunc((t-t0)/duration)`, runs updaters with a reconstructed `scene.time = t`.

**Updaters** make purity hard. Rules:

- Updaters during a clip are recorded as part of that clip’s `apply`.
- `wait()` clips still run updaters (oscillating squares, etc.).
- Non-deterministic updaters (`Math.random`, wall-clock) are forbidden for seekable scenes; `scene.rng` is seeded.

If an updater cannot be inverted, the engine **rebuilds from t=0 to t** (Motion Canvas does similar). Fast enough for typical explainer object counts (< few thousand mobjects). Cache keyframes every N ms for scrubbing.

### 4.2 Clock

```
Clock
  time: seconds
  dt
  speed: 1
  paused
  duration   // known after construct records
  raf handle
```

`play()` in live mode: advance clock, interpolate, render.  
`seek(t)`: set time, rebuild, render one frame.  
`setSpeed(s)`: scale dt.

### 4.3 Composition

```
Clip
  animations: Animation[]     // parallel (AnimationGroup)
  lagRatio
  runTime
  rateFunc default
```

`Succession` = several clips chained.  
`LaggedStart` = one clip, each child anim offset by `i * lag * runTime`.

---

## 5. Animation internals

```
class Animation {
  mobject
  runTime
  rateFunc
  lagRatio
  remover
  introducer
  begin()                    // snapshot starting state, maybe add to scene
  interpolate(alpha)         // 0..1 after rateFunc
  interpolateMobject(alpha)  // override point
  finish()
  cleanUpFromScene(scene)
}
```

`Create`: `pointwiseBecomePartial(0, alpha)`.  
`Transform`: lerp `points0 → points1` after `alignPoints`.  
`FadeIn`: opacity `0 → 1`, optional `shift * (1-alpha)` and scale.  
`.animate`: an `Animation` that lerps between pre/post method application (copy mobject, apply method, Transform into the copy’s state, then become).

**Point alignment algorithm (must document, must implement carefully):**

1. If path counts differ, split the longer into subpaths / close with degenerate curves.
2. `insertNCurves` so both have the same number of cubics.
3. Optionally `path_arc` for ClockwiseTransform (rotate each point around midpoint).

Bad alignment = the “inside-out scribble” morph. MatchingTex/Shapes exist because alignment by *identity of parts* beats alignment by *index*.

---

## 6. Render backends

### 6.1 Canvas2D (default 2D)

- One `<canvas>` (scene) + optional HTML overlay (KaTeX, player chrome).
- For each VMobject: build `Path2D` from cubics, `fill`, `stroke`, `globalAlpha`.
- Background stroke: draw a fatter stroke first (3b1b look).
- Dashes: `setLineDash` or `DashedVMobject` as real sub-curves (needed if dashes must Create).
- Pixel ratio: `devicePixelRatio`.
- No WebGL required for 2D-only embeds (education sites on old hardware).

### 6.2 WebGL2 (3D and dense 2D)

Owned renderer, not Three.js:

- Shader pair: colored vertex (meshes), extra pass for 2D VMobjects as triangulated strokes (or keep 2D on Canvas overlay — **recommended v1 hybrid**).

**v1 hybrid (recommended):**

- 2D VMobjects → Canvas2D (crisp text, cheap Bézier).
- 3D MeshMobjects → WebGL canvas **under** the 2D canvas, cameras synced.
- HUD / `fixInFrame` → 2D canvas.

**v2 unified:** triangulate 2D strokes into WebGL for a single compositor (needed when 2D objects must occlude 3D correctly).

### 6.3 SVG backend (optional, later)

DOM-accessible, good for a11y and CSS. Bad for 10k-point morphs. Not v1.

---

## 7. Camera

```
Camera
  frame: { center, width, height, rotation }   // 2D MovingCamera
  // 3D
  phi, theta, gamma
  focalDistance
  perspective
  lightSource: Mobject
  zoom
```

Projection: world → NDC → pixels.  
`MovingCamera` animates `frame` as if it were a mobject (`.animate.scale(0.5).shift(LEFT)`).  
`ZoomedScene`: a second camera whose view is blitted into a `ScreenRectangle` inset.

---

## 8. Math typesetting pipeline

```
MathTex("\\int_0^1 x^2\\,dx")
   → KaTeX renderToString / renderToSVG
   → parse SVG <path> / <use>
   → VMobject tree (one submobject per atom)
   → texToMobjectMap["x"] = ...
```

HTML overlay mode (sharp, selectable) vs path mode (morphable). Default:

- Static formula: overlay (sharper).
- Formula that will `Write` / `TransformMatchingTex`: path mode.

Cache by `{tex, fontSize, color}` .

---

## 9. Interaction

Input → `scene.pointer` (world coords), `scene.keys`.

- `Draggable(mob)` installs pointer updaters.
- `Hoverable` / `Clickable` via hit-test (2D: point-in-path; 3D: raycast against mesh AABB then triangles).
- Sliders in the **player chrome** bind to named `ValueTracker`s (`scene.expose("a", tracker, { min, max, step })`).
- Orbit: pointer drag on empty space in ThreeDScene.

Hit testing must work through the player (overlay UI should not steal scene drags except on chrome).

---

## 10. Player and embed

See [08](08-RENDERING-AND-PLAYER.md). Architecturally:

```
Player
  engine: Engine
  sceneFactory: (container) => Scene
  dom: { root, canvas2d, canvas3d, overlay, chrome }
  state: { t, paused, speed, loop, fullscreen }
  events: play, pause, seek, ended, section
```

`<lumina-player src="./scene.js" width="1280" height="720">` loads the module, constructs, shows chrome.

Embed snippet for educational sites: one module script + custom element. No build step required (CDN ESM).

---

## 11. Export

```
Exporter.capture(scene, { format: 'webm'|'gif'|'pngs', fps, quality })
```

- WebM: `canvas.captureStream(fps)` + `MediaRecorder`. Hybrid 2D+3D must **composite to one canvas** before capture (draw WebGL into 2D via `drawImage`).
- GIF: render frames to `ImageData`, post to worker, gifenc.
- PNG: `toBlob` per frame, zip optional (JSZip) — zip is optional dep.

No FFmpeg in v1. Document that Safari MediaRecorder codecs differ (maybe only mp4/webm depending on browser).

---

## 12. Package shape (proposed)

```
lumina                  // core 2D + player + math text
lumina/3d               // WebGL backend + 3D mobjects
lumina/graphing         // axes, planes, plots (or keep in core)
lumina/math             // linalg, calculus, complex
lumina/physics
lumina/cs
lumina/ml
lumina/export           // gif/png helpers
lumina/react            // later
lumina/three            // later interop
```

Tree-shakable ESM. Also an IIFE `lumina.global.js` that sets `window.Lumina`.

---

## 13. File layout (when implementation is approved — not now)

```
/home/user/webapp/
  packages/lumina/          # or src/lumina/ if single package
    math/
    core/                   # mobject, animation, scene, clock
    mobjects/
    animations/
    cameras/
    renderers/
      canvas2d.ts
      webgl/
    player/
    graphing/
    packs/
    index.ts
  playground/               # later
  docs/                     # this set
  public/                   # static
  src/index.tsx             # Hono host for docs + playground (later)
```

Single-package in `/home/user/webapp` is simpler for this sandbox. Monorepo only if the user wants npm-publishable splits.

---

## 14. Hosting note (sandbox)

The existing project is Hono + Cloudflare Pages. After confirmation, the playground/docs site can live here.

- Engine runs **in the browser**, not on the Worker.
- Hosted deploy: D1/R2 only if we later persist user scenes. **No KV, no cron.**
- Do not put `kv_namespaces` or `triggers` in wrangler if using hosted deploy.

---

## 15. Non-goals of the architecture

- Being API-compatible with Three.js `Object3D`.
- Running Python inside the browser (Pyodide + manim is a different product; huge, no FFmpeg, no TeX).
- Real-time multiplayer.
- A full NLE (After Effects). The unit of authoring is **code**.
