import type { FC } from 'hono/jsx';

export const GalleryPage: FC = () => (
  <>
    <h1>Demo Gallery</h1>
    <p class="lead">Live, runnable demos — each one mounts a real <code>Scene</code>/<code>ThreeDScene</code> and
    plays a recorded timeline in your browser right now. View source links point at the exact demo script.</p>

    <div class="callout">
      These run the actual engine bundle client-side (no server rendering of animation frames) — the same
      <code>Scene.construct()</code> record-then-seek architecture described in the
      <a href="/guides/timeline-seek">Timeline guide</a>.
    </div>

    <h2>2D shapes: Create, Transform, .animate</h2>
    <p>Square → Create, morph to Circle, morph to Star, rotate + shift via <code>.animate</code>, then fade out/in.</p>
    <div class="demo-frame" id="demo-shapes"></div>
    <p class="demo-source"><a href="https://github.com/i-m-ashutosh99/lumina/blob/main/src/site/demos/shapes.ts" target="_blank" rel="noreferrer">View source: demos/shapes.ts</a></p>

    <h2>Text: Write animation</h2>
    <p>Glyph-outline text rendering via the <code>Write</code> animation, then a subtitle fades in below it.</p>
    <div class="demo-frame" id="demo-text"></div>
    <p class="demo-source"><a href="https://github.com/i-m-ashutosh99/lumina/blob/main/src/site/demos/text.ts" target="_blank" rel="noreferrer">View source: demos/text.ts</a></p>

    <h2>3D: solid + lighting + camera</h2>
    <p>A lit <code>Dodecahedron</code> rendered by the owned WebGL2 renderer inside a <code>ThreeDScene</code>, scaled and rotated.</p>
    <div class="demo-frame" id="demo-3d"></div>
    <p class="demo-source"><a href="https://github.com/i-m-ashutosh99/lumina/blob/main/src/site/demos/three-d.ts" target="_blank" rel="noreferrer">View source: demos/three-d.ts</a></p>

    <script type="module" dangerouslySetInnerHTML={{ __html: `
      import { runShapesDemo } from '/src/site/demos/shapes.ts';
      import { runTextDemo } from '/src/site/demos/text.ts';
      import { runThreeDDemo } from '/src/site/demos/three-d.ts';
      runShapesDemo('demo-shapes').catch(e => console.error('shapes demo', e));
      runTextDemo('demo-text').catch(e => console.error('text demo', e));
      runThreeDDemo('demo-3d').catch(e => console.error('3d demo', e));
    ` }}></script>
  </>
);
