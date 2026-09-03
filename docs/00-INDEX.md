# Lumina — Research, Planning, and Design Documentation

**Status:** Documentation only. **No library code has been written.**  
 
**Working library name:** **Lumina** (not locked — alternatives: VisuaJS, Animath, ManimLite). Confirm the name before implementation.

---

## What this folder is

This is the complete research and planning package for a **from-scratch, browser-native JavaScript animation library** that packs the capabilities of:

- **Manim Community Edition (ManimCE)** — Python, Cairo/OpenGL, FFmpeg
- **ManimGL / 3b1b/manim** — Grant Sanderson’s original OpenGL engine used for 3Blue1Brown videos
- **Manim.js (JazonJiao)** — 2018 p5.js 2D visualization toolkit
- **manim-web (maloyan)** — TypeScript/Three.js in-browser Manim port
- **Three.js** — WebGL 3D scene graph, cameras, lights, geometries, materials
- **Related explainer / math-viz tools** — Motion Canvas, Remotion, MathBox, JSXGraph, Desmos, KaTeX, p5.js, DefinedMotion

The intended product is **not a thin wrapper** around any of the above. It is a new engine with:

1. A Manim-familiar **Mobject → Animation → Scene** programming model
2. Browser rendering (Canvas2D + custom WebGL) and a **live preview**
3. A **custom web player** (play / pause / seek / speed / loop / fullscreen)
4. An **embeddable web component** for educational websites
5. Domain packs for **math, physics, computer science, and AI/ML**
6. Capabilities Manim itself does not have well: live parameter sliders, formula↔graph linked morphing, step-by-step visual decomposition UI, JSON scene serialization, interactive 3D orbit with 2D HUD overlay

**Do not start writing library code until the user explicitly confirms this documentation.**

---

## Document map

| File | Contents |
|---|---|
| [00-INDEX.md](00-INDEX.md) | This file. How to read the set. Decision log. Sources. |
| [01-RESEARCH-LANDSCAPE.md](01-RESEARCH-LANDSCAPE.md) | Landscape of every relevant existing library, with what each actually does and does not do. |
| [02-MANIM-PYTHON-COMPLETE-API.md](02-MANIM-PYTHON-COMPLETE-API.md) | Full ManimCE + ManimGL inventory: mobjects, animations, cameras, scenes, rate functions, updaters, graphing, 3D, constants. |
| [03-MANIMJS-AND-MANIM-WEB.md](03-MANIMJS-AND-MANIM-WEB.md) | Deep dive on the two existing JS Manim-like projects. Why neither is the product. |
| [04-THREEJS-AND-RELATED-LIBS.md](04-THREEJS-AND-RELATED-LIBS.md) | Three.js, Motion Canvas, Remotion, MathBox, JSXGraph, Desmos, KaTeX, p5.js, DefinedMotion. What to learn vs. what not to wrap. |
| [05-FEATURE-MATRIX.md](05-FEATURE-MATRIX.md) | Capability matrix: 1D/2D/3D, math, physics, CS, AI/ML, morphing, transforms, player, embed — vs every existing lib. |
| [06-ARCHITECTURE.md](06-ARCHITECTURE.md) | Proposed engine architecture: scene graph, dual renderer, timeline, camera, export, player, embed. From scratch. |
| [07-API-DESIGN.md](07-API-DESIGN.md) | Proposed JavaScript public API. Constructors, parameters, Manim-familiar names, JS-native innovations. |
| [08-RENDERING-AND-PLAYER.md](08-RENDERING-AND-PLAYER.md) | Canvas2D vs WebGL, live preview, custom player, website embed, export (WebM/GIF/PNG). |
| [09-DOMAIN-MODULES.md](09-DOMAIN-MODULES.md) | Math / physics / CS / AI-ML module catalogue the library must ship. |
| [10-BUILD-PLAN.md](10-BUILD-PLAN.md) | Phased implementation plan, file layout, milestones. **Build only after confirmation.** |
| [11-GAPS-AND-INNOVATIONS.md](11-GAPS-AND-INNOVATIONS.md) | What existing libs miss, and the innovations Lumina should own. |

Root: [../README.md](../README.md) is a short project overview that points here.

---

## Product intent (locked from the user request)

> Create a JS library with complete packed features and functionalities of Manim Python, Three.js, and other related tools, to create any kind of complex animations / explainer videos like 3Blue1Brown. Also for educational website embedding. Also so that JS/HTML/CSS coding can produce a custom web player/renderer. End-to-end from scratch, without missing anything. Browser-based rendering and preview.

Two consumption modes:

1. **Embed** — drop a scene into an educational website (`<lumina-player>` web component, or a canvas + script).
2. **Code** — write JS/HTML/CSS against the library, targeting a custom player/renderer.

Target animation kinds:

- 1D, 2D, 3D
- Maths, physics, computer science, AI/ML
- Visual intuition, geometric transformations, conceptual flow
- Object morphing, step-by-step visual decomposition
- Formula-to-graph morphing
- Interactive math simulation
- Dynamic parameter scaling

---

## Hard constraints (planning, not implementation)

- **From scratch.** Not a fork of manim-web, not a p5 wrapper, not a Three.js wrapper that pretends to be Manim.
- **Own math / scene / animation core.** Canvas2D for crisp 2D vectors. Custom WebGL for 3D (Three.js may later be an *optional interop backend*, never the core).
- **Browser only for v1.** No FFmpeg, no local LaTeX, no Pango, no Cairo. Math via KaTeX. Export via MediaRecorder / frame dump.
- **Pi creatures are copyrighted.** Do not ship Grant Sanderson’s character art. Provide a generic “explainer character” slot if needed.
- **ManimCE and ManimGL are incompatible forks.** The JS API should map *both* (aliases: `Create` ≡ `ShowCreation`).
- **This sandbox later** (only after confirmation) can host a docs site + playground on the existing Hono + Cloudflare Pages template. Hosted deploy supports D1 and R2 only (no KV, no cron triggers).

---

## Decision log (open items for the user)

Please confirm or override before any code is written:

1. **Name.** Working name is **Lumina**. Alternatives: VisuaJS, Animath, ManimLite. Pick one.
2. **Language.** TypeScript source, shipped as ESM + IIFE (CDN) + `.d.ts`. Recommended.
3. **Manim API fidelity.** Recommended: Manim-familiar names (`Scene`, `Circle`, `Create`, `Transform`, `.animate`, `ValueTracker`) with JS idioms (`await scene.play(...)`, options objects). Not a line-by-line Python port.
4. **Three.js.** Recommended: **not a dependency of the core.** Optional later interop (`lumina/three`). Core 3D is our own WebGL layer.
5. **Math typesetting.** KaTeX in the browser. Optional later Typst-to-SVG if a WASM build is acceptable.
6. **Player.** First-party `<lumina-player>` custom element + JS `Player` class. Not video.js, not YouTube.
7. **Scope of v1 vs later.** See [10-BUILD-PLAN.md](10-BUILD-PLAN.md). v1 = 2D core + player + embed + math pack. 3D, physics, CS, AI/ML packs follow.
8. **License.** MIT recommended (same as ManimCE, ManimGL, manim-web, Three.js). **Confirmed** — see `/LICENSE` and `package.json`'s `license` field.

---

## Primary sources consulted (2026-09-02)

- ManimCE docs v0.21.0 — https://docs.manim.community/en/stable/
- ManimCE reference index — animations, mobjects, cameras, scenes, rate functions
- ManimCE GitHub — https://github.com/ManimCommunity/manim (three_d, types, geometry modules)
- ManimGL / 3b1b/manim — https://github.com/3b1b/manim and https://3b1b.github.io/manim/
- ManimGL example scenes — InteractiveDevelopment, AnimatingMethods, UpdatersExample, CoordinateSystemExample, GraphExample, SurfaceExample, OpeningManimExample
- Manim.js — https://github.com/JazonJiao/Manim.js
- manim-web — https://github.com/maloyan/manim-web and https://maloyan.github.io/manim-web/
- Three.js docs — https://threejs.org/docs/
- Motion Canvas — https://motioncanvas.io/docs/quickstart
- Related: Remotion, MathBox, JSXGraph, Desmos, KaTeX, p5.js, DefinedMotion, Manim Slides

---

## How to use this set

1. Read **01** to understand what already exists and why a new library is justified.
2. Read **02** as the *source of truth* for what “complete Manim” means.
3. Read **03–04** so we do not accidentally rebuild a thin wrapper.
4. Read **05** for the capability checklist the library must eventually cover.
5. Read **06–09** for the proposed design.
6. Read **10–11** for phasing and differentiators.
7. **Confirm or request changes.** Only then does implementation start.
