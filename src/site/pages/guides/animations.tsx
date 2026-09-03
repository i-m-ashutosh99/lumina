import type { FC } from 'hono/jsx';

const Row: FC<{ name: string; desc: string }> = ({ name, desc }) => (
  <tr><td><code>{name}</code></td><td>{desc}</td></tr>
);

export const AnimationsPage: FC = () => (
  <>
    <h1>Animation Catalogue</h1>
    <p class="lead">Every animation class Lumina ships, grouped the same way ManimCE's source tree groups them.</p>

    <div class="callout">
      All classes below can be used either as <code>new Create(mob)</code> or, where the
      constructor allows it, as a plain call — Lumina supports both the manim-web
      <code>new X(...)</code> convention and Python's constructor-call convention.
    </div>

    <h2>Creation (<code>animations/creation.ts</code>)</h2>
    <table>
      <Row name="Create" desc="Draw the stroke progressively via pointwise_become_partial (GL alias: ShowCreation)." />
      <Row name="Uncreate" desc="Reverse of Create — erase the stroke, then remove the mobject." />
      <Row name="DrawBorderThenFill" desc="Stroke completes, then the fill fades in." />
      <Row name="Write" desc="DrawBorderThenFill specialized for text, with per-submobject lag." />
      <Row name="Unwrite" desc="Reverse of Write." />
      <Row name="ShowIncreasingSubsets" desc="Reveal submobjects one after another (growing subset)." />
      <Row name="ShowSubmobjectsOneByOne" desc="Show exactly one child at a time." />
      <Row name="SpiralIn" desc="Spiral a mobject into place." />
      <Row name="AddTextLetterByLetter / AddTextWordByWord" desc="Typewriter reveal, per glyph or per word." />
      <Row name="RemoveTextLetterByLetter" desc="Reverse typewriter." />
      <Row name="TypeWithCursor / UntypeWithCursor" desc="Typewriter with an accompanying cursor mobject." />
      <Row name="Add" desc="Instantly add a mobject (zero-duration introducer)." />
      <Row name="Wait" desc="Hold for a duration; updaters keep ticking." />
    </table>

    <h2>Fading &amp; Growing (<code>animations/indication.ts</code>)</h2>
    <table>
      <Row name="FadeIn / FadeOut" desc="Opacity 0↔1, with optional shift/scale of arrival/departure." />
      <Row name="GrowFromCenter / GrowFromPoint / GrowFromEdge" desc="Scale 0→1 about a center, arbitrary point, or edge." />
      <Row name="GrowArrow" desc="An Arrow grows from its tail." />
      <Row name="SpinInFromNothing" desc="GrowFromCenter combined with a rotation." />
    </table>

    <h2>Indication / attention (<code>animations/indication.ts</code>)</h2>
    <table>
      <Row name="Indicate" desc="Scale up + color flash, there-and-back." />
      <Row name="Wiggle" desc="Rotational wiggle." />
      <Row name="Circumscribe" desc="Draw a rectangle/circle around the target, there-and-back." />
      <Row name="Flash" desc="Radial burst of short lines from a point." />
      <Row name="FocusOn" desc="A dot shrinks onto a point — draws viewer attention." />
      <Row name="ApplyWave" desc="Spatial wave distortion travels across the mobject." />
      <Row name="Blink" desc="Opacity flicker." />
      <Row name="ShowPassingFlash" desc="A moving window of stroke races along the path." />
      <Row name="Broadcast" desc="Expanding concentric rings from a point." />
    </table>

    <h2>Movement (<code>animations/movement.ts</code>)</h2>
    <table>
      <Row name="MoveAlongPath" desc="Follow a VMobject path as a motion guide." />
      <Row name="Homotopy / ComplexHomotopy" desc="Time-varying (x,y,z,t)→(x',y',z') deformation; complex-plane variant." />
      <Row name="PhaseFlow" desc="Flow a mobject's points along a vector field function." />
      <Row name="Rotate / Rotating" desc="Finite rotation vs. continuous rotation over run_time." />
      <Row name="ChangingDecimal / ChangeDecimalToValue" desc="Drive a DecimalNumber mobject from a function of time, or animate it to a target value." />
    </table>

    <h2>Transform family — the 3b1b signature (<code>animations/transform.ts</code>)</h2>
    <table>
      <Row name="Transform" desc="Lerp points + style of mobject A into mobject B. A becomes B in-place." />
      <Row name="ReplacementTransform" desc="Transform, then remove A and add B to the scene." />
      <Row name="TransformFromCopy" desc="Transform a copy of A into B; the original A is untouched." />
      <Row name="ClockwiseTransform / CounterclockwiseTransform" desc="Transform while sweeping along an arc path." />
      <Row name="FadeTransform / FadeTransformPieces" desc="Fade A out / B in while moving — for badly-mismatched point counts." />
      <Row name="CyclicReplace / Swap" desc="Cycle the positions of several mobjects; Swap is the 2-mobject case." />
      <Row name="MoveToTarget" desc="Animate a mobject toward its .target (set via generateTarget())." />
      <Row name="ApplyFunction / ApplyPointwiseFunction(ToCenter)" desc="Apply an R³→R³ function to all points, or just the center." />
      <Row name="ApplyMatrix" desc="Apply a 2×2/3×3 matrix to points — the quintessential linear-algebra move." />
      <Row name="ApplyComplexFunction" desc="Interpret xy as ℂ, apply f: ℂ→ℂ." />
      <Row name="ApplyMethod" desc="Animate an arbitrary method call." />
      <Row name="FadeToColor" desc="Lerp color only." />
      <Row name="ScaleInPlace / ShrinkToCenter" desc="Scale animation; ShrinkToCenter scales to zero." />
      <Row name="Restore" desc="Animate back to a previous saveState() checkpoint." />
      <Row name="TransformMatchingShapes" desc="Match submobjects between A and B by shape hash." />
      <Row name="TransformMatchingTex" desc="Match TeX submobjects by tex string — formula-to-formula morphs." />
    </table>

    <h2>Composition (<code>animations/composition.ts</code>)</h2>
    <table>
      <Row name="AnimationGroup" desc="Play several animations together, optionally staggered by lagRatio." />
      <Row name="LaggedStart" desc="AnimationGroup with a non-zero default lagRatio." />
      <Row name="LaggedStartMap" desc="Map an Animation class/factory over a mobject's submobjects, staggered." />
      <Row name="Succession" desc="Play animations strictly one after another." />
    </table>

    <h2>Changing / continuous (<code>animations/changing.ts</code>)</h2>
    <table>
      <Row name="TracedPath" desc="Trail of a moving point, optionally dissipating." />
      <Row name="AnimatedBoundary" desc="Cycling stroke that travels around a mobject's outline." />
      <Row name="ChangeSpeed" desc="Remap α through a custom speed curve / piecewise time map." />
      <Row name="UpdateFromFunc / UpdateFromAlphaFunc" desc="Call fn(mob) or fn(mob, alpha) every frame during the animation." />
      <Row name="MaintainPositionRelativeTo" desc="Keep a fixed offset to another mobject for the animation's duration." />
    </table>

    <h2>Usage pattern: <code>scene.play()</code> contract</h2>
    <pre>{`await scene.play(
  new Create(square),
  new FadeIn(text, { shift: UP }),
  (square.animate as any).shift(RIGHT),
  { runTime: 2, rateFunc: smooth, lagRatio: 0 },
);
await scene.wait(1);`}</pre>
    <ul>
      <li>All animations passed to one <code>play()</code> call start together (unless wrapped in <code>Succession</code>).</li>
      <li><code>runTime</code> passed to <code>play()</code> overrides each animation's own default unless the animation set its own explicitly.</li>
      <li>Updaters run during both <code>play</code> and <code>wait</code>.</li>
      <li>After <code>play()</code> resolves, introducers are in the scene; removers are gone.</li>
      <li><code>Transform</code> mutates the first mobject's data to match the target — subsequent code sees the transformed state.</li>
    </ul>

    <div class="callout">
      Next: <a href="/guides/timeline-seek">Timeline, Seeking &amp; Playback</a> — how the
      record-then-seek architecture actually works under the hood.
    </div>
  </>
);
