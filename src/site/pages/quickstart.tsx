import type { FC } from 'hono/jsx';

export const QuickstartPage: FC = () => (
  <>
    <h1>Quickstart</h1>
    <p class="lead">Go from zero to a rendered, seekable animation in under five minutes.</p>

    <h2>1. Install</h2>
    <p>Lumina has no required runtime dependencies for 2D/3D core usage (KaTeX/opentype.js are
      only pulled in when you actually use <code>MathTex</code>/<code>Text</code>).</p>
    <pre>{`npm install lumina`}</pre>
    <p>Or, for a zero-build prototype, load it straight from a CDN in a plain HTML file:</p>
    <pre>{`<script type="module">
  import { Scene, Circle, Create } from "https://esm.sh/lumina";
  // ...
</script>`}</pre>

    <h2>2. Mount a Scene on a DOM element</h2>
    <p>
      A <code>Scene</code> is constructed against any container element. It creates its own
      canvas (or two stacked canvases if you use <code>ThreeDScene</code>) sized to the
      container.
    </p>
    <pre>{`import { Scene } from 'lumina';

const stage = document.getElementById('stage');
const scene = new Scene(stage, {
  width: 800,
  height: 450,
  background: '#0b0b10',
});`}</pre>

    <h2>3. Add and animate a mobject</h2>
    <pre>{`import { Square, Create, BLUE } from 'lumina';

const square = new Square({ color: BLUE, sideLength: 2 });
await scene.play(new Create(square));
await scene.wait(0.5);`}</pre>
    <p>
      <code>scene.play(...)</code> returns a Promise that resolves when the animation
      finishes — <code>construct()</code>-style scripts in Lumina are just <code>async</code>
      functions. Internally, nothing is drawn frame-by-frame as you write the script: every
      <code>play()</code>/<code>wait()</code> call is <em>recorded</em> as a clip with an
      immutable start snapshot, and the whole thing is replayed by the pure
      <code>Timeline.render(t)</code> function afterward. That is what makes
      <code>scene.seek(t)</code> instant and glitch-free.
    </p>

    <h2>4. Transform one shape into another</h2>
    <pre>{`import { Transform, Circle, YELLOW } from 'lumina';

const circle = new Circle({ color: YELLOW, radius: 1.3 });
await scene.play(new Transform(square, circle));`}</pre>
    <p>
      <code>Transform</code> mutates <code>square</code>'s points in place to match
      <code>circle</code> — the same "3b1b signature" morph as real Manim's
      <code>Transform</code>.
    </p>

    <h2>5. Use <code>.animate</code> for one-liners</h2>
    <pre>{`await scene.play((square.animate as any).shift([2, 0, 0]).scale(0.6));`}</pre>
    <p>
      <code>.animate</code> is a JS <code>Proxy</code> that records chained mutating-method
      calls (<code>shift</code>, <code>scale</code>, <code>rotate</code>, <code>setColor</code>,
      …) and turns them into a single animation, exactly like Python's
      <code>square.animate.shift(RIGHT).scale(0.5)</code>.
    </p>

    <h2>6. Seek anywhere, instantly</h2>
    <pre>{`scene.seek(scene.timeline.duration * 0.5);  // jump to the midpoint
scene.seek(0);                              // jump back to the start
scene.startPlayback();                      // resume normal playback from current time`}</pre>

    <h2>7. Go to 3D</h2>
    <pre>{`import { ThreeDScene, Sphere, Torus, defaultLight } from 'lumina';

class MyScene extends ThreeDScene {
  async construct() {
    this.setCameraOrientation({ phi: 65 * Math.PI / 180, theta: -45 * Math.PI / 180 });
    this.camera.lightSource = defaultLight();

    const sphere = new Sphere({ radius: 1.5, color: '#58C4DD' });
    this.add(sphere);
    await this.play(new Create(sphere));
    this.beginAmbientCameraRotation({ rate: 0.15 });
    await this.wait(3);
  }
}

const scene = new MyScene(document.getElementById('stage-3d'), { width: 800, height: 450 });
await scene.construct();`}</pre>
    <p>See the <a href="/guides/camera-3d">3D, Camera &amp; Lighting guide</a> for the full API.</p>

    <h2>Next steps</h2>
    <ul>
      <li><a href="/guides/core-concepts">Core Concepts</a> — the Mobject/Animation/Scene model in depth.</li>
      <li><a href="/guides/animations">Animation Catalogue</a> — every animation class and when to use it.</li>
      <li><a href="/gallery">Demo Gallery</a> — runnable, live examples you can copy-paste.</li>
      <li><a href="/api/core">API Reference</a> — full class-by-class documentation.</li>
    </ul>
  </>
);
