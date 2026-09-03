# Lumina — Research & Planning (Documentation Only)

**Status:** Documentation only. **No library code has been written.**  
**Date of research:** 2026-09-02  
**Working name:** **Lumina** (not locked — alternatives: VisuaJS, Animath, ManimLite)

This repository currently holds a **complete research and design package** for a from-scratch, browser-native JavaScript animation library. It is **not** an implemented engine, playground, or npm package yet.

**Do not start implementation until the user explicitly confirms this documentation.**

---

## What was requested

A universal JS library packing the capabilities of:

- Manim Community Edition (ManimCE, Python, Cairo/FFmpeg)
- ManimGL / 3b1b (Grant Sanderson’s OpenGL engine)
- Manim.js (JazonJiao, p5, 2018)
- manim-web (maloyan, TypeScript / Three.js)
- Three.js and related explainer / math-viz tools (Motion Canvas, Remotion, MathBox, JSXGraph, Desmos, KaTeX, p5, DefinedMotion, Manim Slides)

Target: 3Blue1Brown-style explainer videos **and** educational website embeds. 1D / 2D / 3D. Maths, physics, CS, AI/ML. Morphing, geometric transforms, conceptual flow, formula-to-graph morphing, step-by-step decomposition, interactive simulation, dynamic parameter scaling.

Two consumption modes:

1. Embed in educational websites
2. JS / HTML / CSS against a custom web player / renderer

Browser-based rendering and live preview. **From scratch** — not a thin wrapper or fork.

---

## How to read the documentation

Start here: **[docs/00-INDEX.md](docs/00-INDEX.md)** (map, constraints, decision log, sources).

| File | Contents |
|---|---|
| [docs/00-INDEX.md](docs/00-INDEX.md) | Doc map, product intent, hard constraints, open decisions |
| [docs/01-RESEARCH-LANDSCAPE.md](docs/01-RESEARCH-LANDSCAPE.md) | Every relevant existing library — what it does and does not do |
| [docs/02-MANIM-PYTHON-COMPLETE-API.md](docs/02-MANIM-PYTHON-COMPLETE-API.md) | Full ManimCE v0.21.0 + ManimGL inventory (source-of-truth checklist) |
| [docs/03-MANIMJS-AND-MANIM-WEB.md](docs/03-MANIMJS-AND-MANIM-WEB.md) | Deep dive on the two existing JS Manim-like projects; study, do not fork |
| [docs/04-THREEJS-AND-RELATED-LIBS.md](docs/04-THREEJS-AND-RELATED-LIBS.md) | Three.js, Motion Canvas, Desmos, KaTeX, and related tools |
| [docs/05-FEATURE-MATRIX.md](docs/05-FEATURE-MATRIX.md) | Capability matrix vs CE / GL / M.js / MW / Three.js / Motion Canvas |
| [docs/06-ARCHITECTURE.md](docs/06-ARCHITECTURE.md) | Proposed engine: scene graph, seekable timeline, dual renderer, player |
| [docs/07-API-DESIGN.md](docs/07-API-DESIGN.md) | Proposed JavaScript public API (Manim-familiar, JS idioms) |
| [docs/08-RENDERING-AND-PLAYER.md](docs/08-RENDERING-AND-PLAYER.md) | Canvas2D + owned WebGL, preview, `<lumina-player>`, embed, export |
| [docs/09-DOMAIN-MODULES.md](docs/09-DOMAIN-MODULES.md) | Math / physics / CS / AI-ML packs and pedagogical primitives |
| [docs/10-BUILD-PLAN.md](docs/10-BUILD-PLAN.md) | Phases 0–4, file layout, v1 gate. **Build only after confirmation.** |
| [docs/11-GAPS-AND-INNOVATIONS.md](docs/11-GAPS-AND-INNOVATIONS.md) | What existing libs miss, and the innovations Lumina should own |

---

## Working design (summary — details in the docs)

- **Name:** Lumina (confirm before code). Do not call the product “Manim”.
- **Model:** Mobject → Animation → Scene. `await scene.play(...)`. CE and GL aliases (`Create` ≡ `ShowCreation`).
- **Render:** Canvas2D for 2D VMobjects; owned WebGL for 3D (Three.js is **not** a core dependency). KaTeX for math.
- **Time:** Seekable `render(t)` via recorded clips / snapshots (Python Manim is forward-only).
- **Player:** First-party JS `Player` + `<lumina-player>` web component. Custom HTML/CSS chrome is a supported mode.
- **Export (v1):** WebM via MediaRecorder. GIF / PNG later. No in-browser FFmpeg.
- **Packs:** `lumina/math-*`, `physics`, `cs`, `ml` after the 2D core.
- **License (proposed):** MIT. No Pi creatures (copyrighted).
- **v1 gate:** the acceptance scene in [docs/07-API-DESIGN.md](docs/07-API-DESIGN.md) §17 plays, seeks, embeds, and exports WebM.

This sandbox’s Hono + Cloudflare Pages template is unchanged Hello World. It can later host docs + playground — **not until confirmation**.

---

## What exists in this repo right now

- `docs/` — the twelve markdown files above (00–11)
- Stock Hono / Vite / Wrangler template (`src/index.tsx` Hello World)
- **No** `src/lumina/` engine
- **No** playground
- **No** extra npm dependencies for the library
- **No** deployment of a library

---

## Open decisions (please confirm or override)

From [docs/00-INDEX.md](docs/00-INDEX.md):

1. **Name** — Lumina, or VisuaJS / Animath / ManimLite / other
2. **Language** — TypeScript, ESM + IIFE + `.d.ts` (recommended)
3. **API fidelity** — Manim-familiar names + JS idioms (recommended), not a line-by-line Python port
4. **Three.js** — not a core dependency (recommended)
5. **Math** — KaTeX (recommended)
6. **Player** — first-party `<lumina-player>` (recommended)
7. **v1 scope** — 2D core + player + embed + math text; 3D and domain packs later ([docs/10-BUILD-PLAN.md](docs/10-BUILD-PLAN.md))
8. **License** — MIT (recommended)

When you confirm (with any overrides), implementation follows the kickoff checklist in [docs/10-BUILD-PLAN.md](docs/10-BUILD-PLAN.md) §15.

---

## Features not yet implemented

Everything. This is a spec. The library, player, playground, demos, and deploy are **out of scope until you say to start building**.
