# 08 — Rendering, Preview, Player, Embed, Export

**Status:** Design only. No code.  
**Date:** 2026-09-02

This document specifies how Lumina draws frames in the browser, how authors preview, how educational sites embed, and how a custom HTML/CSS/JS player is built on top of the engine.

---

## 1. Two consumption modes (from the user request)

1. **Embed in educational websites** — a teacher drops a scene into a lesson page.
2. **JS/HTML/CSS coding into a custom web player/renderer** — an author builds their own chrome around the engine.

Both modes share one function:

```
engine.render(timeSeconds) → pixels on canvas(es)
```

If that function is pure enough to seek, everything else (preview, player, export, step UI) is UI on top.

---

## 2. Frame composition

### 2.1 Layers (bottom → top)

```
[0] Background fill (color or image)
[1] WebGL 3D world          (only if 3D mobjects exist)
[2] Canvas2D VMobjects      (the Manim 2D world)
[3] KaTeX overlay (HTML)    (static formulas in overlay mode)
[4] Interaction highlights
[5] Player chrome (DOM)     (controls, sliders, captions)
```

v1 recommended **hybrid**: two stacked canvases (`position: absolute`) inside a shadow-DOM host, cameras share `frame` / `phi,theta`. Export composites 1+2 into one 2D canvas via `drawImage(webglCanvas, 0, 0)` before `captureStream`.

### 2.2 World → pixel

```
pixel.x = (world.x / (frameWidth  / 2) + 1) / 2 * canvasWidth
pixel.y = (1 - world.y / (frameHeight / 2)) / 2 * canvasHeight
```

Y is flipped (math up vs canvas down). 3D:

```
view = lookAt(cameraEye(phi,theta,gamma,focal), cameraCenter, up)
clip = perspective(fov, aspect, near, far) * view * worldPoint
```

ManimCE `ThreeDCamera` uses φ (polar from z), θ (azimuth), γ (roll), focal distance. Match those names so GL scenes port.

### 2.3 Canvas2D path build

For each VMobject:

1. Iterate cubics `(p0, h1, h2, p3)` in `points`.
2. `ctx.beginPath(); moveTo(p0); bezierCurveTo(h1,h2,p3);` … close if closed.
3. If `backgroundStrokeWidth > 0`, stroke with fat dark line first.
4. Fill with `fillOpacity * opacity`.
5. Stroke with `strokeWidth` (world units → pixels via `pixelsPerUnit`).

`Create` uses `pointwiseBecomePartial(0, alpha)` so the path is physically shorter, not a `lineDash` trick (dash tricks cannot Uncreate correctly).

### 2.4 Crispness

- `canvas.width = cssWidth * devicePixelRatio`
- `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`
- Round stroke widths to device pixels when they are 1px-ish, but **do not** round world coordinates (morphing would jitter).
- Optional MSAA: only on WebGL.

### 2.5 WebGL (owned, not Three.js)

Minimum shader set v1:

- **Mesh:** Lambert + directional light + ambient, vertex colors or checker UV.
- **Line/mesh overlay:** SurfaceMesh as `LINE` or thin triangles.
- **Point:** Dot3D as small spheres (instanced later).

Buffers rebuilt when mobject `points`/`indices` change. Transform animation of a Surface = CPU lerp of vertex positions (Manim way) unless the surface is a shader (`ShaderSurface`, phase 3).

### 2.6 Why not SVG as the primary 2D backend

SVG is great for a11y and CSS. It is bad for:

- 60 fps Transform of 2k-point NumberPlanes
- Export (foreignObject / Safari)
- Z-order with WebGL

Keep SVG as a **possible later backend**, not v1 default.

---

## 3. Live preview (authoring)

Authors need a tight loop: edit JS → see the scene.

### 3.1 Playground (after confirmation, hosted in this Hono app)

```
┌──────────────────────────────────────────────┐
│  editor (JS)     │  player canvas            │
│                  │  [play][pause][scrub]     │
│                  │  fps / object count       │
│                  │  console / onLog          │
└──────────────────────────────────────────────┘
```

- Debounced re-construct on edit (300 ms).
- Errors overlay, not a white screen (`onLog` analogue).
- Button: “copy embed snippet”.
- Button: “export WebM / GIF / last frame PNG”.

This is Motion Canvas’s editor UX, with Manim language in the editor instead of JSX.

### 3.2 Local HTML

```html
<!doctype html>
<meta charset="utf-8">
<canvas id="stage" width="1280" height="720"></canvas>
<script type="module">
  import { Scene, Circle, Create } from './lumina.js';
  const scene = new Scene('#stage', { width: 1280, height: 720, background: '#111' });
  await scene.play(Create(new Circle({ radius: 2, color: '#58C4DD' })));
</script>
```

Hot reload: Vite during playground development. The *library* itself has no bundler requirement for consumers (ESM).

### 3.3 REPL (ManimGL `self.embed()` analogue)

```js
scene.embed(); // pauses timeline, exposes `scene`, `play`, `add` on window
```

In the playground, a console tab: type `await play(square.animate.shift(RIGHT))` and it appends a clip. This is how Grant authors videos. Worth phase 2.

---

## 4. Custom web player (first-party)

### 4.1 Responsibilities

| Control | Behavior |
|---|---|
| Play / Pause | space |
| Seek bar | maps 0…duration; preview frame on drag |
| Skip ±5s | arrows |
| Prev / next **section** | `[` `]` or buttons (Manim Slides analogue) |
| Speed | 0.25 / 0.5 / 1 / 1.5 / 2, keys `1–5` |
| Loop | toggle |
| Fullscreen | `f` |
| Mute | if audio (phase 3) |
| Quality | 480p/720p/1080p (resizes canvas, re-renders) |
| Sliders | exposed ValueTrackers |
| Step | `s` pause and step one frame |

### 4.2 DOM structure (semantic)

```html
<div class="lumina-player" id="player-root">
  <div class="lumina-viewport" id="viewport">
    <canvas class="lumina-layer-3d" id="canvas-3d"></canvas>
    <canvas class="lumina-layer-2d" id="canvas-2d"></canvas>
    <div class="lumina-katex-overlay" id="katex-overlay"></div>
  </div>
  <div class="lumina-chrome" id="chrome">
    <button id="btn-play" aria-label="Play">…</button>
    <input id="seek" type="range" min="0" max="1000" aria-label="Seek">
    <time id="time-display">0:00 / 0:00</time>
    <button id="btn-speed">1×</button>
    <button id="btn-fs" aria-label="Fullscreen">…</button>
  </div>
  <aside class="lumina-sliders" id="sliders"></aside>
</div>
```

Chrome is **HTML/CSS**, not painted on canvas, so educational sites can restyle it.

### 4.3 CSS theming hooks

```css
lumina-player {
  --lumina-accent: #58C4DD;
  --lumina-chrome-bg: rgba(0,0,0,.72);
  --lumina-chrome-fg: #fff;
  --lumina-radius: 8px;
}
```

Authors can hide chrome: `<lumina-player controls="false">` and build their own using the JS `Player` API.

### 4.4 Player JS API (for custom chrome)

```js
const player = new Player({ mount, scene: construct, controls: false });

player.play();
player.pause();
player.toggle();
player.seek(t);
player.seekSection(i);
player.setSpeed(1.5);
player.setLoop(true);
player.enterFullscreen();
player.on('time', ({ t, duration }) => { /* update custom slider */ });
player.on('section', ({ index, name }) => {});
player.on('ended', () => {});
player.engine; // advanced
```

This is consumption mode 2: **your HTML/CSS, our renderer**.

### 4.5 Accessibility

- Buttons have `aria-label`.
- Seek is `<input type="range">`.
- Keyboard as above.
- Optional: `aria-live` for section titles.
- Reduced motion: `Player({ respectPrefersReducedMotion: true })` jumps to last frame of each clip (still pedagogically sequential via next-section).

---

## 5. Website embed

### 5.1 Web component (primary)

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/lumina/dist/player.js"></script>
<lumina-player
  src="./scenes/fourier.js"
  width="960"
  height="540"
  controls
  loop="false"
  autoplay="false"
></lumina-player>
```

`src` is an ES module URL exporting `construct`. Cross-origin: CORS must allow the scene module.

### 5.2 Inline construct (no extra file)

```html
<lumina-player width="640" height="360">
  <script type="module">
    import { Circle, Create } from 'lumina';
    export async function construct(scene) {
      await scene.play(Create(new Circle({ radius: 1 })));
    }
  </script>
</lumina-player>
```

Custom elements cannot natively take a child module export easily; implementation options:

- `scene` attribute with JSON (declarative, limited).
- `window.Lumina.register('fourier', construct)` then `scene="fourier"`.
- Property: `el.construct = construct`.

**Proposal:** support `element.construct = fn` and `register(name, fn)` + `scene="name"`. Inline `<script>` inside the element is parsed by the component if `type="application/lumina"`.

### 5.3 iframe

For LMS sites that strip custom elements:

```html
<iframe src="https://play.example/embed?scene=https://…/fourier.js"
        width="960" height="540" allow="fullscreen"></iframe>
```

The playground host (this Hono app, later) can serve `/embed`.

### 5.4 React / Vue (phase 2)

```jsx
<LuminaPlayer construct={construct} width={800} height={450} controls />
```

Thin wrapper around the custom element. manim-web already proved demand.

### 5.5 Resize

Default: canvas has a fixed **world** aspect, CSS scales the host (`object-fit: contain`). `resize="cover"` fills. Always re-render on resize (pixel ratio / size).

---

## 6. Export

### 6.1 WebM (v1)

```js
const blob = await scene.export({ format: 'webm', fps: 60, quality: 0.9 });
```

Implementation:

1. Composite layers to an export canvas.
2. `stream = canvas.captureStream(fps)`.
3. `MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })` with fallback vp8.
4. Drive the clock **offline**: do not rely on rAF. For each frame `t = i/fps`, `render(t)`, wait for `requestAnimationFrame` *or* `await scene.gl.finish()` so the recorder actually sees the frame.

**Caveat:** `captureStream` + rAF can drop frames. More reliable: `MediaRecorder` on a stream while we `render(i/fps)` and `await waitForPaint()`. Document that duration may slightly differ.

Safari: may prefer `video/mp4`. Try mp4 then webm.

### 6.2 GIF (phase 2)

Worker + gifenc. Palette 256. Cap resolution 480p default (GIF is huge). Progress callback.

### 6.3 PNG sequence

```js
const files = await scene.export({ format: 'pngs', fps: 30 });
// [{ name: 'frame-000123.png', blob }]
```

Optional zip. Teachers drag into Premiere / Resolve.

### 6.4 Last frame

`scene.screenshot({ type: 'png' | 'svg?' })` — GL `-s` analogue.

### 6.5 Not in v1

MP4 via FFmpeg.wasm is possible but heavy (multi-MB). Offer a doc: “download PNG sequence / WebM, transcode locally”. Cloudflare Workers cannot FFmpeg anyway.

---

## 7. Performance budget (explainer scenes)

| Scene class | Target |
|---|---|
| Typical 2D (≤ 200 VMobjects, 5k points) | 60 fps on a school Chromebook |
| NumberPlane nonlinear morph (20k points) | 30 fps, or downsample |
| 3D surface 64×64 | 60 fps
| 3D surface 200×200 | 30 fps, GPU buffer |
| Export 1080p60 | not real-time required; can render slower than play |

Optimizations (plan, not code):

- Skip invisible mobjects (camera frustum / opacity 0).
- Cache Path2D if points unchanged.
- Dirty flags on mobjects.
- For NumberPlane ApplyMatrix: transform on GPU (phase 3) or subsample.
- KaTeX overlay not rebuilt every frame if tex string unchanged.

---

## 8. Color / style defaults (3b1b-ish, not a clone)

- Background `#000000` or `#111111` (configurable).
- Default stroke width 4 (world-independent pixels-ish; Manim uses ~4).
- Default color `BLUE` (`#58C4DD` CE).
- Text default white.
- Background stroke on text/formulas when over grids (black, width 4–8, opacity 1) — this is the 3b1b readability trick.

Ship a theme:

```js
Lumina.theme('threeb1b'); // dark, CE colors, background stroke on Tex
Lumina.theme('light');    // white bg, dark strokes, for print/slides
```

Do **not** copy 3b1b intro music, logo, or pi creatures.

---

## 9. Error handling for embeds

Classroom Wi-Fi is hostile.

- If WebGL fails, fall back to Canvas2D and skip 3D with a visible notice.
- If KaTeX fails a formula, show raw TeX in a red `Text` mobject (`throwOnError: false`).
- If `construct` throws, player shows the stack in the overlay (`onLog`).
- If `src` 404s, player shows a placeholder, not a dead custom element.

---

## 10. Security for `src=` embeds

Loading arbitrary JS into a lesson page is XSS. Rules:

- Document that `src` must be trusted (same origin or reviewed CDN).
- Playground `/embed` can run scenes in a sandboxed iframe (`sandbox="allow-scripts"` without `allow-same-origin` if we can; modules make this tricky).
- No `eval` of author strings in the engine core. `MathTex` does not `eval`. Plot functions are real JS functions supplied by the author module, not strings, unless the playground explicitly compiles them.

---

## 11. Implementation order (rendering/player only)

1. Canvas2D + `render(t)` + `Create`/`FadeIn`/`Transform` on Circle/Square.
2. Player chrome (play/pause/seek) on that clock.
3. Web component wrapper.
4. KaTeX overlay + path mode.
5. Export WebM composite.
6. WebGL 3D layer under 2D.
7. GIF/PNG, sliders, sections.

No code in this phase. This is the spec the implementer (later) must follow.
