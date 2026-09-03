import type { FC } from 'hono/jsx';

export const HomePage: FC = () => (
  <>
    <h1>Lumina</h1>
    <p class="lead">
      A from-scratch, browser-native animation engine with a
      Manim-Community / ManimGL-familiar <code>Mobject → Animation → Scene</code> model,
      a seekable timeline, a Canvas2D 2D renderer, and an owned WebGL2 3D renderer —
      for building 3Blue1Brown-style math/physics/CS/AI-ML explainer videos and
      interactive lessons that run directly in a web page. No Python, no local LaTeX,
      no server render step required.
    </p>

    <div class="callout warn">
      <strong>Pre-alpha status.</strong> This is a real, compiling, typechecked TypeScript
      engine (~8,000 lines) — not vaporware — but it does not yet cover 100% of ManimCE +
      ManimGL. See the <a href="/guides/core-concepts">Core Concepts guide</a> and the
      per-module API reference pages for an honest "implemented / partial / missing" status
      on every feature.
    </div>

    <h2>Why Lumina exists</h2>
    <p>
      Python Manim (both ManimCE and ManimGL) is unmatched for programmatic, geometric,
      pedagogical animation — but it cannot run in a browser, cannot be embedded in a
      lesson page, and has no seekable HTML player. Existing JS attempts either aren't a
      real Manim port (Manim.js) or are a port built on Three.js for 3D (manim-web).
      Lumina is a <strong>new engine</strong>, built from scratch, that:
    </p>
    <ul>
      <li>Copies Manim's <code>Mobject</code> / <code>Animation</code> / <code>Scene</code> triad and placement API (<code>shift</code>, <code>moveTo</code>, <code>nextTo</code>, <code>.animate</code>, …) so existing Manim knowledge transfers directly.</li>
      <li>Owns its own Canvas2D renderer for crisp vector 2D and its own WebGL2 renderer for 3D — no Three.js dependency.</li>
      <li>Records a scene once (like Python's <code>construct()</code>) into an immutable, pure, seekable <code>Timeline</code> — <code>timeline.render(t)</code> can jump to any point instantly, which is what makes a real scrubber-based player possible.</li>
      <li>Ships as a single npm package / ESM module you drop into any web page with a <code>&lt;script type="module"&gt;</code> tag.</li>
    </ul>

    <h2>The triad</h2>
    <pre>{`Mobject  →  Animation  →  Scene
  (what)      (how)         (when)`}</pre>
    <p>
      A <strong>Mobject</strong> is anything you can put on screen. A <strong>VMobject</strong>
      is a vectorized mobject — a cubic-Bézier point buffer — so every 2D shape can morph into
      any other shape via <code>Transform</code>. A <strong>MeshMobject</strong> is the 3D
      analogue: a flat vertex/normal/index buffer that shares the exact same placement API
      (<code>shift</code>/<code>moveTo</code>/<code>scale</code>/<code>rotate</code>) as 2D
      mobjects. An <strong>Animation</strong> interpolates a mobject over α ∈ [0, 1] through a
      rate function. A <strong>Scene</strong> owns the mobject list, the camera, and records
      every <code>play()</code>/<code>wait()</code> call into a seekable timeline.
    </p>

    <h3>A 30-second taste</h3>
    <pre>{`import { Scene, Square, Circle, Create, Transform, BLUE, YELLOW } from 'lumina';

const scene = new Scene(document.getElementById('stage'), { width: 800, height: 450 });

const square = new Square({ color: BLUE, sideLength: 2 });
await scene.play(new Create(square));
await scene.wait(0.3);

const circle = new Circle({ color: YELLOW, radius: 1.3 });
await scene.play(new Transform(square, circle));   // square morphs into circle
await scene.play((square.animate as any).shift([2, 0, 0]).scale(0.6));

scene.seek(scene.timeline.duration * 0.5);          // jump to the midpoint, instantly`}</pre>

    <h2>What's implemented today</h2>
    <div class="grid-cards">
      <div class="card">
        <h4>Math kernel <span class="badge badge-done">done</span></h4>
        <p>Vec3, 3×3/4×4 matrices, full ManimCE color palette, cubic-Bézier kernel, full rate-function catalogue.</p>
      </div>
      <div class="card">
        <h4>Core engine <span class="badge badge-done">done</span></h4>
        <p>Mobject/VMobject/Group/VGroup, .animate proxy, updaters, ValueTracker, Scene, Timeline (seekable).</p>
      </div>
      <div class="card">
        <h4>2D Geometry <span class="badge badge-done">done</span></h4>
        <p>Circle/Arc/Line/Arrow/Polygon family + Brace + shape-matchers (SurroundingRectangle, Cross, …).</p>
      </div>
      <div class="card">
        <h4>Animations <span class="badge badge-done">done</span></h4>
        <p>Create/Write/Transform family/Indication/Movement/Composition — the full ManimCE catalogue.</p>
      </div>
      <div class="card">
        <h4>Text <span class="badge badge-done">done</span></h4>
        <p>Real vector glyph outlines via opentype.js — Text/Paragraph/Title/DecimalNumber/Variable.</p>
      </div>
      <div class="card">
        <h4>3D pipeline <span class="badge badge-partial">partial</span></h4>
        <p>Mesh kernel, MeshMobject, 10 solids, Surface, Light, ThreeDCamera, owned WebGL2 renderer, ThreeDScene. No textures/deformation yet.</p>
      </div>
      <div class="card">
        <h4>MathTex / Axes <span class="badge badge-missing">missing</span></h4>
        <p>LaTeX rendering and coordinate-system plotting (Axes/NumberPlane) are researched but not yet implemented.</p>
      </div>
      <div class="card">
        <h4>Player / export <span class="badge badge-missing">missing</span></h4>
        <p>No <code>&lt;lumina-player&gt;</code> web component or WebM/GIF export yet — <code>Scene</code> has the seek primitives it needs.</p>
      </div>
    </div>

    <p>
      Start with the <a href="/quickstart">Quickstart</a>, browse the
      <a href="/gallery"> Demo Gallery</a> for runnable examples, or jump straight into the
      <a href="/api/core"> API Reference</a>.
    </p>

    <footer class="site-footer">
      Inspired by 3Blue1Brown / Manim. Not affiliated. Lumina is an independent,
      from-scratch engine — see the <a href="https://github.com/i-m-ashutosh99/lumina">source
      on GitHub</a>.
    </footer>
  </>
);
