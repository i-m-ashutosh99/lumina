import type { FC } from 'hono/jsx';

export const CoreConceptsPage: FC = () => (
  <>
    <h1>Core Concepts</h1>
    <p class="lead">The Mobject → Animation → Scene triad, and the record-then-seek timeline that makes Lumina scenes instantly seekable.</p>

    <h2>Mobject</h2>
    <p>
      A <code>Mobject</code> ("mathematical object") is anything that can be placed and
      displayed. Every mobject has <code>points</code>, a parent/children hierarchy, a
      <code>style</code> (fill/stroke/opacity), <code>updaters</code>, and the full
      placement API:
    </p>
    <table>
      <tr><th>Method</th><th>Meaning</th></tr>
      <tr><td><code>shift(vec)</code></td><td>Translate by a vector</td></tr>
      <tr><td><code>moveTo(point | mobject)</code></td><td>Center onto a point or another mobject's center</td></tr>
      <tr><td><code>nextTo(mobject, direction, {'{ buff }'})</code></td><td>Park beside another mobject with a gap</td></tr>
      <tr><td><code>alignTo(mobject, direction)</code></td><td>Align one edge to another mobject's edge</td></tr>
      <tr><td><code>toEdge(direction, buff)</code> / <code>toCorner(corner, buff)</code></td><td>Stick to the frame edge/corner</td></tr>
      <tr><td><code>scale(factor, {'{ aboutPoint }'})</code></td><td>Uniform scale</td></tr>
      <tr><td><code>rotate(angle, {'{ axis, aboutPoint }'})</code></td><td>Rotate (2D: implicit Z axis; 3D: any axis)</td></tr>
      <tr><td><code>arrange(direction, buff)</code> / <code>arrangeInGrid(rows, cols)</code></td><td>Layout children</td></tr>
      <tr><td><code>getCenter()</code> / <code>getBoundingBox()</code> / <code>getWidth()</code> / <code>getHeight()</code></td><td>Query geometry</td></tr>
      <tr><td><code>saveState()</code> / <code>restore()</code></td><td>Checkpoint and revert (used by <code>Restore</code>)</td></tr>
      <tr><td><code>copy()</code></td><td>Deep-clone a mobject</td></tr>
    </table>

    <h3>VMobject — the 2D workhorse</h3>
    <p>
      A <code>VMobject</code> ("vectorized mobject") stores its geometry as a flat array of
      cubic-Bézier control points — 4 points per curve. This is <strong>the</strong> reason
      shapes can morph into each other: <code>Transform(square, circle)</code> aligns the two
      point counts (padding/resampling as needed) and linearly interpolates every control
      point. A Canvas <code>arc()</code> call has no points to interpolate — it can never
      morph. Every 2D shape in Lumina (circles, lines, polygons, text glyphs, braces) is
      built from cubic Béziers so that everything is <code>Transform</code>-able.
    </p>

    <h3>MeshMobject — the 3D counterpart</h3>
    <p>
      A <code>MeshMobject</code> stores <code>positions</code>/<code>normals</code>/
      <code>uvs</code>/<code>indices</code> flat vertex buffers instead of Bézier points.
      Crucially, <code>this.points</code> is <em>mirrored by reference</em> to
      <code>this.positions</code>, so the exact same base <code>Mobject</code> placement API
      (<code>shift</code>, <code>moveTo</code>, <code>scale</code>, <code>rotate</code>,
      <code>getCenter</code>, <code>getBoundingBox</code>) works unmodified on 3D geometry —
      you never need a separate 3D placement API. <code>Transform</code> between two
      <code>MeshMobject</code>s dispatches to <code>interpolatePoints()</code>, which CPU-lerps
      vertex positions and normals directly, instead of the VMobject cubic-curve-alignment
      path.
    </p>

    <h2>Animation</h2>
    <p>
      An <code>Animation</code> interpolates a mobject over α ∈ [0, 1] via a rate function
      (easing curve). Every animation subclass inherits the same constructor options:
    </p>
    <pre>{`{
  runTime: 1,          // seconds
  rateFunc: smooth,    // (t: number) => number
  lagRatio: 0,         // stagger submobjects
  remover: false,      // remove the mobject from the scene when finished
  introducer: false,   // add the mobject to the scene when it begins
}`}</pre>
    <p>Its lifecycle, run once by <code>Scene.play()</code>:</p>
    <ol>
      <li><code>begin()</code> — snapshot the mobject's start state, set up anything the animation needs (e.g. point alignment for Transform).</li>
      <li><code>apply(alpha)</code> (internally <code>interpolateMobject(alpha)</code>) — called at every sampled alpha, always preceded by <code>restoreStart()</code> so animations are pure functions of α (this is what makes seeking glitch-free).</li>
      <li><code>finish()</code> — final cleanup / snap to the α=1 state.</li>
    </ol>

    <h3>The <code>.animate</code> proxy</h3>
    <p>
      <code>.animate</code> is a JS <code>Proxy</code> installed on <code>Mobject.prototype</code>.
      Any mutating method call recorded through it becomes a single <code>Transform</code>-like
      animation from the mobject's current state to the state after all chained calls:
    </p>
    <pre>{`await scene.play((square.animate as any).shift([2, 0, 0]).scale(0.5).rotate(Math.PI / 4));`}</pre>

    <h2>Scene</h2>
    <p>
      A <code>Scene</code> owns the mobject list, the camera, and the clock. It exposes the
      same verbs as Python Manim:
    </p>
    <table>
      <tr><th>Method</th><th>Meaning</th></tr>
      <tr><td><code>scene.add(...mobjects)</code></td><td>Add mobjects to the scene (drawn from now on)</td></tr>
      <tr><td><code>scene.remove(...mobjects)</code></td><td>Remove mobjects</td></tr>
      <tr><td><code>await scene.play(...animations, opts?)</code></td><td>Run one or more animations together</td></tr>
      <tr><td><code>await scene.wait(seconds)</code></td><td>Hold — updaters still tick during a wait</td></tr>
      <tr><td><code>scene.seek(t)</code></td><td>Jump the whole scene to time <code>t</code>, instantly and purely</td></tr>
      <tr><td><code>scene.startPlayback()</code> / <code>scene.pausePlayback()</code></td><td>Live rAF-driven playback of the recorded timeline</td></tr>
    </table>

    <h3>Record-then-seek: how the timeline works</h3>
    <p>
      This is the single most important architectural difference from a naive "call
      <code>requestAnimationFrame</code> and mutate mobjects" animation library, and the
      reason Lumina scenes are seekable at all:
    </p>
    <div class="callout">
      <strong>Your <code>construct()</code> method runs exactly once, synchronously</strong> (from
      JS's point of view — each <code>await scene.play(...)</code> resolves immediately
      internally). Each call to <code>play()</code>/<code>wait()</code> is recorded as a
      <code>ClipEntry</code> onto <code>scene.timeline</code>, capturing an <em>immutable
      snapshot</em> of every animated mobject's start state. <code>Timeline.render(t)</code>
      is a pure function: given any time <code>t</code>, it replays every clip active at that
      time from its start snapshot, producing the exact same frame every time it's called —
      no matter what order you call <code>render(t)</code> in, no matter how many times.
    </div>
    <p>
      This is why <code>scene.seek(scene.timeline.duration * 0.5)</code> works instantly and
      correctly even for a 30-second scene with a hundred animations: nothing is
      "fast-forwarded" frame-by-frame. It is why a custom player's scrubber can drag freely
      in either direction without ever producing a glitched or stale frame. Python Manim, by
      contrast, renders every frame once to a video file in order — it has no equivalent
      random-access seek.
    </p>

    <h2>Groups: <code>Group</code> vs <code>VGroup</code></h2>
    <p>
      <code>Group</code> is a pure hierarchy container (extends <code>Mobject</code> directly)
      — use it to compose mobjects of <em>any</em> kind, including 3D <code>MeshMobject</code>s
      (e.g. <code>Arrow3D</code> is a <code>Group</code> of a <code>Line3D</code> shaft and a
      <code>Cone3D</code> head). <code>VGroup</code> extends <code>VMobject</code> and is
      specifically a group of 2D Bézier-point mobjects — use it when you want the group
      itself to behave like a single VMobject (e.g. for styling all children's stroke/fill at
      once). Never put a <code>MeshMobject</code> inside a <code>VGroup</code>.
    </p>

    <div class="callout">
      Next: <a href="/guides/animations">Animation Catalogue</a> — every animation class Lumina
      ships, organized by category.
    </div>
  </>
);
