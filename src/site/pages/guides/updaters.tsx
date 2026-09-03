import type { FC } from 'hono/jsx';

export const UpdatersPage: FC = () => (
  <>
    <h1>Updaters &amp; ValueTrackers</h1>
    <p class="lead">The mechanism that keeps mobjects "live" — recomputed every frame from some source of truth, the same way real Manim's <code>always_redraw</code> and <code>ValueTracker</code> work.</p>

    <h2>ValueTracker: a hidden mobject holding a number</h2>
    <p>
      A <code>ValueTracker</code> is a <code>Mobject</code> that draws nothing but stores a
      single number — packed directly into <code>points[0][0]</code> (the same trick real
      Manim uses), so the generic <code>.animate</code>/<code>Transform</code> pipeline can
      animate <code>setValue()</code> for free, with zero special-casing:
    </p>
    <pre>{`import { ValueTracker } from 'lumina';

const t = new ValueTracker(0);
await scene.play((t.animate as any).setValue(5), { runTime: 2 });  // smoothly interpolates 0→5
console.log(t.getValue());  // 5

t.increment(1);  // 6`}</pre>
    <p>
      <code>ComplexValueTracker</code> is the same idea for a complex number (re, im), packed
      into <code>points[0][0..1]</code>.
    </p>

    <h2>Updaters: recompute every frame</h2>
    <pre>{`mobject.addUpdater((m, dt) => {
  m.rotate(dt * 0.5);   // spin continuously
});
mobject.removeUpdater(fn);
mobject.clearUpdaters();`}</pre>
    <p>
      Updaters registered on a mobject run every frame during both <code>play()</code> and
      <code>wait()</code> — exactly like real Manim. Combined with the timeline's
      pure-function-of-t seeking (see the <a href="/guides/timeline-seek">Timeline guide</a>),
      updaters that are pure functions of absolute time or of a tracker's value replay
      correctly under seeking; updaters that integrate <code>dt</code> (hand-rolled physics)
      do not.
    </p>

    <h2><code>always</code> / <code>fAlways</code> — ManimGL's live-binding helpers</h2>
    <p>
      ManimGL scenes stay "live" via <code>always(method, *args)</code> — calling a method
      with fixed arguments every frame — and <code>f_always</code>, where the arguments
      themselves are re-evaluated thunks. Lumina ships both:
    </p>
    <pre>{`import { always, fAlways } from 'lumina';

dot.addUpdater(always('moveTo', mouseTracker.getValue()));      // fixed args (rarely useful)
dot.addUpdater(fAlways('moveTo', () => mouseTracker.getValue())); // re-evaluated every frame — the useful form`}</pre>

    <h2><code>alwaysRedraw</code> — the Desmos-style pattern</h2>
    <p>
      The single most useful updater pattern for "formula linked to graph linked to slider"
      pedagogy: rebuild a mobject from scratch every frame from some tracker's current value.
    </p>
    <pre>{`import { alwaysRedraw, ValueTracker, Dot } from 'lumina';

const a = new ValueTracker(1);
const dot = alwaysRedraw(() => new Dot({ point: [a.getValue(), a.getValue() ** 2, 0] }));
scene.add(dot);

await scene.play((a.animate as any).setValue(3), { runTime: 2 });
// dot glides along y = x^2 as the tracker value 'a' animates`}</pre>
    <p>
      Every frame, <code>dot.become(factory())</code> replaces the mobject's points/style
      with a freshly-constructed instance — so it stays correct under seeking exactly like
      any other pure-function-of-tracker-value updater.
    </p>

    <h2>Instance-level <code>alwaysRedraw</code></h2>
    <p>
      There is also a <code>Mobject.prototype.alwaysRedraw</code>-style instance method (see
      <code>core/mobject.ts</code>) that installs the rebuild-updater onto an
      <em>existing</em> mobject in place, as opposed to the free function above which
      constructs and returns a brand-new mobject. Use the free function
      (<code>alwaysRedraw(factory)</code>) for new bindings; use the instance method when you
      already have a mobject reference you want to keep and just want to start
      auto-refreshing it.
    </p>

    <div class="callout">
      That's the full guide set. Head to the <a href="/api/core">API Reference</a> for
      exhaustive per-class documentation, or the <a href="/gallery">Demo Gallery</a> for
      runnable examples.
    </div>
  </>
);
