# 11 — Gaps in Existing Libraries, and Innovations Lumina Should Own

**Status:** Design / research. No code.  
**Date:** 2026-09-02  
**Purpose:** State clearly what each existing tool fails to provide for the user’s request, and which capabilities are *new* (not a port). This is the justification for a from-scratch engine rather than a wrapper or fork.

Related: landscape [01](01-RESEARCH-LANDSCAPE.md), matrix [05](05-FEATURE-MATRIX.md), architecture [06](06-ARCHITECTURE.md), domains [09](09-DOMAIN-MODULES.md).

---

## 1. The user request, restated as testable gaps

The product must:

1. Pack Manim Python (CE **and** GL) + Three.js-class 3D + related explainer tools.
2. Create 3Blue1Brown-style explainer videos **and** educational web embeds.
3. Cover 1D / 2D / 3D; maths, physics, CS, AI/ML.
4. Support visual intuition, geometric transforms, conceptual flow, morphing, step-by-step decomposition, formula-to-graph morphing, interactive simulation, dynamic parameter scaling.
5. Two consumption modes: **embed in websites**, and **JS/HTML/CSS against a custom player/renderer**.
6. Browser rendering and live preview.
7. **From scratch**, not a thin wrapper, without missing anything.

No existing library satisfies all seven at once. The rest of this document is the evidence.

---

## 2. Gap table (existing tools vs the request)

| Requirement | ManimCE | ManimGL | Manim.js | manim-web | Three.js | Motion Canvas | Desmos | JSXGraph | Remotion |
|---|---|---|---|---|---|---|---|---|---|
| Manim triad API | **Y** | **Y** | N | Partial | N | N | N | N | N |
| Complete CE+GL catalogue | CE only | GL only | N | Small subset | N | N | N | N | N |
| Bézier Transform morph | **Y** | **Y** | N | Basic | N | Path lerp ≠ VMobject | N | N | N |
| 3D explainer (surfaces, euler cam, HUD) | Y | **Y** | N | Partial (Three.js) | Capability only, no DSL | N | N | N | N |
| Browser runtime | N | N | Y | Y | Y | Y (editor) | Y | Y | Y (React) |
| Seekable HTML player | N | N | N | DIY | DIY | Editor, not embed player | sliders | N | Player, not Manim |
| Web component embed | N | N | N | mount DOM | DIY | N | iframe only | DIY | Player embed |
| Formula↔graph **linked** morph | DIY | DIY | N | N | N | N | **Y** (no morph cinema) | N | N |
| Step-decomposition UI | sections / Slides | P | N | N | N | P | N | N | N |
| Domain packs math/physics/CS/ML | DIY + plugins | DIY | CS graphs only | N | N | N | math only | euclidean | N |
| Custom JS player/renderer | N | N | p5 draw | partial | yes, wrong DSL | own editor | closed | API | React |
| From-scratch owned core | — | — | p5 | Three.js 3D | — | own, different DSL | closed | own | React |

**Conclusion:** the closest *API* is manim-web; the closest *3D substrate* is Three.js; the closest *player UX* is Motion Canvas; the closest *formula↔graph* is Desmos; the closest *CS graphs* is Manim.js; the closest *film language* is ManimGL. **None is the product.** Forking any one inherits its ceiling.

---

## 3. Gaps, library by library

### 3.1 ManimCE (Python)

**Has:** the catalogue, docs, LinearTransformationScene, community, Cairo quality.

**Missing vs the request:**

- No browser, no embed, no HTML player, no seek.
- No first-class formula↔graph widget (you write updaters).
- Domain packs are plugins or DIY scenes (`manim-physics`, not core).
- Incompatible with GL (`Create` vs `ShowCreation`).
- Local TeX + FFmpeg + Pango — impossible in Cloudflare Workers / a static lesson page.
- Forward-only `construct()`.

**Steal:** class inventory (doc 02), LinearTransformationScene semantics, rate functions, VMobject point protocol.

### 3.2 ManimGL / 3b1b

**Has:** the actual 3Blue1Brown look (OpenGL, `always`/`f_always`, `fix_in_frame`, textured surfaces, interactive `embed()`, euler camera, light as mobject).

**Missing:**

- Same browser/player/embed holes as CE.
- Docs thinner; APIs move with Grant’s videos.
- Pi creatures cannot be shipped (copyright).
- Not versioned for classroom vendors the way CE is.

**Steal:** updater style, HUD, SurfaceMesh, interactive development as a **playground REPL**, visual language (background stroke, palette).

### 3.3 Manim.js (JazonJiao, p5, 2018)

**Has:** proof that 3b1b-*looking* CS graph lectures can run in a tab; timed vertex/edge color states.

**Missing almost everything else:** no VMobject, no math frame, no LaTeX, no 3D, no `play()`, no player, pixel coordinates, p5 `setup/draw`, name already taken.

**Steal:** CS graph *pedagogy* (visit/frontier/visited), not the runtime.

### 3.4 manim-web (maloyan)

**Has:** the right *shape* of a JS Manim (`await scene.play`, KaTeX, Canvas + Three.js 3D, CDN, React/Vue, GIF/video, MIT).

**Missing vs “complete packed features”:**

- Animation catalogue is a handful (`Create`, `Transform`, `Fade*`, `Write`, `GrowFromCenter`, groups) — not Indicate/Homotopy/MatchingTex/LinearTransformationScene/…
- Geometry / graphing / 3D lists are README-complete, not CE-complete (research date 2026-09-02).
- 3D is Three.js, so the public 3D API is at risk of leaking `Object3D`.
- No first-party player chrome, no web component, no FormulaToGraph, no domain packs, no CE↔GL aliases as a policy.
- py2ts is a convenience, not a substitute for a designed JS API.
- Seeking a scene with updaters is not documented as a snapshot architecture.

**Steal:** delivery (CDN ESM, `await play`, KaTeX, mount-on-DOM). **Do not fork.** A fork would spend its life chasing CE while carrying Three.js.

### 3.5 Three.js

**Has:** every 3D primitive the web knows (cameras, lights, geometries, materials, orbit, glTF).

**Missing:** pedagogical DSL. `AnimationMixer` is glTF clips, not `Transform(square, circle)`. No VMobject, no MathTex, no NumberPlane, no player for explainers.

**Steal:** capability ceiling (what 3D *must be able to do*), math types as a checklist, OrbitControls interaction. **Do not** make Object3D the authoring API. Core 3D = owned WebGL (doc 06). Optional later `lumina/three`.

### 3.6 Motion Canvas

**Has:** generator-based time, editor, seek, preview UX that authors love.

**Missing:** Manim language, math mobjects, 3D explainer camera, KaTeX-as-VMobject, domain packs. Different religion (generators vs `play()`).

**Steal:** playground layout, seek-as-a-product-requirement, time as a first-class cursor.

### 3.7 Remotion

**Has:** React frames, real video export, player.

**Missing:** geometry kernel, morph, math. Wrong unit of authoring for 3b1b (JSX trees vs mobjects).

**Steal:** nothing architectural. Proof that web-export-to-video matters.

### 3.8 Desmos

**Has:** the gold standard of **formula ↔ graph ↔ slider**.

**Missing:** cinema (Create/Transform/Write), 3D explainer, CS/ML/physics packs, morphing objects, embed as *your* player (closed product).

**Steal:** linked representations as a first-class object (`FormulaToGraph`).

### 3.9 JSXGraph, MathBox, p5, DefinedMotion, Manim Slides

- **JSXGraph:** Euclidean drag constructions — later pack, not core.
- **MathBox:** dense fields / GLSL — later, not v1.
- **p5:** creative coding; Manim.js already showed this is the wrong public API.
- **DefinedMotion:** another code-to-video experiment; not a Manim pack.
- **Manim Slides:** presenter beats on *Python* output — Lumina’s section/beat UI is the browser analogue.

---

## 4. Browser-platform gaps (not library gaps)

These are constraints every web Manim must accept. Lumina documents them instead of pretending to be Python.

| Python Manim | Browser Lumina |
|---|---|
| Cairo / OpenGL + FFmpeg | Canvas2D + owned WebGL + MediaRecorder |
| Local TeX / Pango / Typst CLI | KaTeX (+ opentype.js outlines) |
| MP4 everywhere | WebM (codec varies), GIF, PNG; MP4 only with a later server |
| Forward-only construct | `render(t)` + snapshots / rebuild-from-0 |
| IPython `embed()` | Playground REPL |
| NetworkX | Own layouts |
| skia-pathops boolean | JS/WASM pathops (phase 2) |
| Pi creatures | Do not ship |
| Worker CPU 10–30 ms | Engine runs **in the browser**, Worker only serves files |

Innovations below are designed *inside* these constraints, not against them.

---

## 5. Innovations Lumina should own

These are **not** in ManimCE/GL, manim-web, or Three.js as productized features. They are why a new library is justified.

### 5.1 Formula↔graph linked morph (`FormulaToGraph`)

**Gap:** Manim can `Write` a formula and `Create` a graph; tying them is DIY updaters. Desmos ties them but cannot *cinematically morph* glyphs into a curve.

**Innovation:** one object owns TeX, function, and parameter trackers. Morph keeps symbol identity; sliders recolor glyphs and resample the curve.

**Why it matters:** “formula-to-graph morphing” and “dynamic parameter scaling” are explicit user requirements.

### 5.2 Step-decomposition UI (`section` + `decompose()` + player beats)

**Gap:** Manim Slides is a presenter on rendered video. Motion Canvas has an editor, not an embeddable lesson stepper. Classroom sites need **next/prev visual proof step** without a video file.

**Innovation:** `scene.section(name)` becomes player chapters; `decompose(mob)` LaggedStarts pieces; embed shows a beat list.

**Why it matters:** “step-by-step visual decomposition” and “conceptual flow.”

### 5.3 First-party `<lumina-player>` + JS `Player`

**Gap:** manim-web mounts a canvas. Three.js has no explainer chrome. CE/GL emit mp4.

**Innovation:** play/pause/seek/speed/loop/fullscreen/keyboard/sections/sliders as **library**, plus a custom element for educational websites, plus a documented DOM/CSS contract so authors build *their own* chrome (user consumption mode 2).

**Why it matters:** both consumption modes in the original request.

### 5.4 Seekable timeline (`render(t)` with snapshots)

**Gap:** Python Manim cannot seek. manim-web live `await play` is forward. Motion Canvas solved seek for a different DSL.

**Innovation:** record clips during construct; each clip stores start snapshots; updaters are deterministic (`scene.rng`); fallback rebuild-from-0; keyframe cache for scrubbing.

**Why it matters:** a web player that cannot scrub is a gif.

### 5.5 Dual renderer, one mobject tree (Canvas2D + owned WebGL)

**Gap:** manim-web’s 3D *is* Three.js. CE Cairo cannot mix interactive 3D HUD the way GL can. Three.js cannot draw CE-quality 2D Bézier text without giving up the DSL.

**Innovation:** hybrid compositor (doc 08): WebGL world under Canvas2D VMobjects + KaTeX overlay + DOM chrome. 3D lights are mobjects. No Object3D in the public API.

**Why it matters:** “pack Three.js capabilities” without becoming a wrapper.

### 5.6 CE ↔ GL alias layer

**Gap:** the two Manims are incompatible. Ports pick a side (manim-web ≈ CE names).

**Innovation:** `Create` ≡ `ShowCreation`, `always`/`fAlways`/`alwaysRedraw` all exist, `FadeIn(mob, UP)` and `{ shift: UP }` both work, snake_case options accepted.

**Why it matters:** “complete packed features of Manim Python” means **both forks**.

### 5.7 Domain packs in the core repo

**Gap:** CE: DIY scenes + `manim-physics` plugin. GL: Grant’s private `3b1b/videos`. Manim.js: graphs only. manim-web: none. Three.js: none.

**Innovation:** first-party `lumina/math-*`, `physics`, `cs`, `ml` (doc 09) with a curriculum checklist.

**Why it matters:** “maths, physics, CS, AI/ML” and “without missing anything.”

### 5.8 Parameter recording (interactive → film)

**Gap:** GL `embed()` is live; recording that session into a video is manual. Desmos sliders do not export cinema.

**Innovation:** `scene.expose(name, tracker, { bind: 'live' | 'timeline' })`. Timeline bind writes a clip from slider motion.

**Why it matters:** “interactive math simulation” *and* explainer videos from the same scene.

### 5.9 JSON / declarative scenes

**Gap:** Manim scenes are Python source. Sharing requires a runtime.

**Innovation:** `toJSON/fromJSON` for mobjects + clips + tracker keyframes (functions still need `construct()`). Lets a CMS store a lesson without executing arbitrary JS (still sandbox `src=` — XSS rules in doc 08).

### 5.10 Zero-framework script tag + web component

**Gap:** Motion Canvas and Remotion assume a build. Classroom sites often cannot.

**Innovation:** IIFE + ESM CDN, `<lumina-player src="./scene.js">`, no React required (React wrapper later).

---

## 6. What “from scratch” means in practice (anti-wrapper rules)

To remain a new engine, implementation (when allowed) must obey:

1. **Own** vec/mat/bezier/mobject/animation/timeline/camera/renderer.
2. **Do not** `import { Scene } from 'manim-web'` or copy its source tree.
3. **Do not** `import * as THREE from 'three'` in core (phase 4 interop only).
4. **Do not** use p5 `setup/draw` as the public clock.
5. **Do not** name the product Manim, Manim.js, or 3Blue1Brown.
6. **Do not** ship Pi creatures or ManimBanner trademark art.
7. Read CE/GL **behavior** from docs and public source; reimplement.

Study is allowed. Copy-paste of another engine is not.

---

## 7. Risks if we skip an innovation

| If we skip… | Product collapses to… |
|---|---|
| Seekable `render(t)` | manim-web with nicer docs |
| FormulaToGraph | Manim in a tab (still DIY) |
| Player / web component | A canvas demo, not educational-site ready |
| Owned 3D | A Three.js wrapper with extra steps |
| Domain packs | “Complete” only on a slide, not in the repo |
| CE↔GL aliases | Half of Manim authors lost |
| Parameter recording | Interactive XOR cinematic, not both |

---

## 8. Success criteria (product, not phase 1)

The library is “complete” relative to the original request when all of the following are true:

1. A ManimCE author can write a Square→Circle→MathTex scene in JS with familiar names and it plays in a tab.
2. A ManimGL author can use `ShowCreation`, `always`, `fixInFrame`, euler camera without learning a second language.
3. A teacher can paste `<lumina-player src="lesson.js">` into a lesson page.
4. An engineer can build a custom HTML/CSS player on `engine.render(t)`.
5. Linear algebra (ghost plane + applyMatrix), calculus (Riemann + tangent + slider), a CS sort or BFS, a tiny neural-net schematic, and a spring/field physics demo all exist as first-party packs.
6. Formula morphs into its graph; beats step a proof; sliders record or live-bind.
7. 3D surfaces with HUD formulas composite with 2D VMobjects.
8. Export WebM/GIF/PNG without Python.
9. No Three.js / p5 / manim-web in the core dependency tree.
10. Legal: MIT, no Pi creatures, not named Manim.

Phase 1 only requires (1), (3), (4), (8 WebM), (9), (10). The rest is the north star.

---

## 9. Open research leftovers (known unknowns)

Honest gaps in *this documentation*, not in the libraries:

- Some ManimCE Sphinx pages were stubs; class lists were recovered from GitHub `__all__` / `_modules` (boolean ops, shape_matchers, three_d). Re-verify against CE git tag `v0.21.0` at implementation time.
- manim-web’s exact class list may grow after 2026-09-02; re-check README before coding so we do not duplicate a sudden complete port (we still would not fork).
- Boolean ops WASM size vs pure-JS path boolean — decide in phase 2 with a prototype, not now.
- KaTeX SVG atomization quality vs true TeX (TransformMatchingTex fidelity). Expect to iterate.
- Safari MediaRecorder mime types — document per-browser at export implementation.

None of these block finishing the docs. They block naive implementation, which is why implementation waits.

---

## 10. One-paragraph pitch (for the confirmation round)

Existing tools split the problem: Manim speaks the right language off the web; manim-web puts a subset in the browser on Three.js; Three.js is 3D without pedagogy; Motion Canvas seeks without math; Desmos links formula and graph without cinema; Manim.js draws CS graphs in p5 pixels. **Lumina** is a new, browser-native engine with Manim’s triad, both CE and GL names, owned Canvas2D+WebGL, a first-party seekable player and web component, and domain packs plus FormulaToGraph / step UI / parameter recording — the pieces nobody productized together. This folder is the spec. Code starts when you say so.

---

**Do not start writing library code until the user explicitly confirms.**
