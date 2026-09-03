import type { FC } from 'hono/jsx';

export const TimelineSeekPage: FC = () => (
  <>
    <h1>Timeline, Seeking &amp; Playback</h1>
    <p class="lead">
      Why Lumina scenes can be scrubbed like a video, even though nothing is
      actually pre-rendered to a video file.
    </p>

    <h2>The problem with naive JS animation</h2>
    <p>
      Most browser animation code drives itself with a <code>requestAnimationFrame</code>
      loop that mutates object state incrementally, frame by frame, forward in time only.
      That works for playback, but it is fundamentally <em>not seekable</em>: to know what
      the scene looked like at t=7.3s, you would have to replay from t=0 and integrate every
      incremental mutation up to that point. Scrubbing a slider backward is either impossible
      or requires re-running the whole scene from scratch every time.
    </p>
    <p>
      Python Manim doesn't have this problem in the way you'd think — it renders every frame
      once, in order, straight to a video file via FFmpeg. There's no live "seek" concept at
      all; you get a finished MP4 you then seek in a video player.
    </p>

    <h2>Lumina's approach: record once, replay purely</h2>
    <p>Lumina's <code>Scene.construct()</code>-style script:</p>
    <pre>{`class MyScene extends Scene {
  async construct() {
    const sq = new Square();
    await this.play(new Create(sq));
    await this.wait(0.5);
    await this.play((sq.animate as any).shift([2, 0, 0]));
  }
}`}</pre>
    <p>
      runs <strong>exactly once</strong>, synchronously (each <code>await</code> resolves
      immediately internally — there's no real asynchronous delay). What actually happens on
      each <code>play()</code> call:
    </p>
    <ol>
      <li>Every argument (an <code>Animation</code> instance, or an <code>.animate</code> proxy call) is coerced into a real <code>Animation</code> via <code>prepareAnimation()</code>.</li>
      <li>Each animation's target, if not already in the scene, is added (unless it's an introducer, which decides membership itself — matching real ManimCE's <code>compile_animation_data</code>/<code>_setup_scene</code> split).</li>
      <li><code>anim.begin()</code> runs immediately — this is where the animation takes an <strong>immutable snapshot</strong> of the mobject's start state.</li>
      <li>The animation is pushed into a <code>ClipEntry</code> on <code>scene.timeline</code>, spanning <code>[cursor, cursor + runTime]</code>, and the recording cursor advances.</li>
      <li><code>anim.finish()</code> + membership cleanup run immediately, so subsequent script code sees the mobject's <em>final</em> state (exactly like real Manim mutates <code>self.mobject</code> as it renders) — <code>getCenter()</code> called right after <code>play()</code> returns the post-animation position.</li>
    </ol>
    <p>
      By the time <code>construct()</code> finishes, <code>scene.timeline</code> holds a
      complete, ordered list of <code>ClipEntry</code> objects, each with its own frozen
      start snapshot, plus a list of add/remove <strong>markers</strong> recording exactly
      when each top-level mobject entered or left the scene.
    </p>

    <h2><code>Timeline.render(t)</code> is a pure function</h2>
    <pre>{`render(t: number): Mobject[] {
  for (const clip of this.clips) {
    if (clip.t0 > t) break;
    for (const anim of clip.animations) {
      anim.restoreStart();                 // reset to the frozen snapshot
      const alpha = /* clamp (t - clip.t0) / runTime to [0,1] */;
      anim.apply(anim.computeAlpha(alpha)); // pure function of alpha
    }
  }
  return [...this.membershipAt(t)];         // which mobjects are visible now
}`}</pre>
    <p>
      Two concerns are deliberately kept separate, mirroring real ManimCE's own split
      between <code>interpolate()</code> (visuals) and <code>add</code>/<code>remove</code>/
      <code>clean_up_from_scene</code> (scene membership):
    </p>
    <table>
      <tr><th>Concern</th><th>Driven by</th><th>Behavior</th></tr>
      <tr><td>Visuals (points/style)</td><td><code>clips</code></td><td>Every clip active at time <code>t</code> is replayed from its frozen start snapshot — always <code>restoreStart()</code> then <code>apply(alpha)</code>, never incremental.</td></tr>
      <tr><td>Membership (what's drawn)</td><td><code>markers</code></td><td>Explicit add/remove events recorded once, at record time — <code>render(t)</code> never infers visibility from animation flags.</td></tr>
    </table>
    <p>
      Because every clip's start snapshot is frozen forever, calling <code>render(t1)</code>
      then <code>render(t0)</code> (backward!) then <code>render(t1)</code> again always
      produces bit-identical results. That's the whole trick: <strong>nothing is ever
      integrated incrementally</strong> — every frame is computed fresh, directly, from
      time zero.
    </p>

    <h2>Seeking and live playback</h2>
    <pre>{`scene.seek(3.2);            // jump straight to t=3.2s — instant, pure, glitch-free
scene.seek(0);               // jump back to the start
scene.startPlayback();       // resume rAF-driven live playback from the current time
scene.pausePlayback();       // pause`}</pre>
    <p>
      <code>startPlayback()</code> just calls <code>scene.seek(clock.time)</code> every
      animation frame while advancing <code>clock.time</code> — it is layered <em>on top
      of</em> the same pure <code>render(t)</code>, not a separate code path. This is exactly
      what a scrubber-based player UI needs: dragging the scrubber just calls
      <code>scene.seek(draggedT)</code>, and "resume playing" just calls
      <code>scene.startPlayback()</code> from wherever the scrubber landed.
    </p>

    <h2>Known limitation: non-idempotent updaters</h2>
    <div class="callout warn">
      <strong>Updaters that integrate <code>dt</code> over time</strong> (hand-rolled physics
      that accumulates velocity, for example) are not re-derivable from an arbitrary
      <code>t</code> — they depend on having "played through" every prior frame. Updaters
      that are <strong>pure functions of absolute scene time</strong> or of a
      <code>ValueTracker</code>'s current value (the vast majority of real Manim usage —
      <code>always_redraw</code>, a <code>DecimalNumber</code> tracking a tracker, a dot
      following a graph) work correctly under seeking, because they are recomputed fresh on
      every <code>render(t)</code> call. If you need seek-correct physics, drive it from a
      closed-form function of <code>t</code> rather than integrating <code>dt</code>.
    </div>

    <div class="callout">
      Next: <a href="/guides/camera-3d">3D, Camera &amp; Lighting</a>.
    </div>
  </>
);
