import type { FC } from 'hono/jsx';

const M: FC<{ sig: string; desc: string }> = ({ sig, desc }) => (
  <li><code>{sig}</code><span class="desc">— {desc}</span></li>
);

export const ApiAnimationsPage: FC = () => (
  <>
    <h1>API Reference — Animations</h1>
    <p class="lead">All ~60 built-in <code>Animation</code> subclasses. Source: <code>animations/*.ts</code>. See the <a href="/guides/animations">Animation Catalogue guide</a> for a narrative introduction and the <a href="/api/core">Animation base class</a> for the shared lifecycle.</p>

    <h2>Creation <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>animations/creation.ts</code>.</p>
    <ul class="member-list">
      <M sig="new ShowPartial(mobject, opts?)" desc="Base for animations that reveal a sub-range [a,b] of a VMobject's path" />
      <M sig="new Create(mobject, opts?)" desc="Draw the path from start to end" />
      <M sig="ShowCreation" desc="Alias of Create (ManimGL name)" />
      <M sig="new Uncreate(mobject, opts?)" desc="Reverse of Create, then removes the mobject" />
      <M sig="new DrawBorderThenFill(mobject, opts?)" desc="Stroke the outline, then fill it in" />
      <M sig="new Write(mobject, opts?)" desc="DrawBorderThenFill tuned for text/glyphs" />
      <M sig="new Unwrite(mobject, opts?)" desc="Reverse of Write" />
      <M sig="new ShowIncreasingSubsets(mobject, opts?)" desc="Reveal submobjects one at a time, cumulatively" />
      <M sig="new ShowSubmobjectsOneByOne(mobject, opts?)" desc="Show exactly one submobject at a time (non-cumulative)" />
      <M sig="new SpiralIn(mobject, opts?)" desc="Submobjects spiral inward into place" />
      <M sig="new AddTextLetterByLetter(text, opts?)" desc="Typewriter reveal, one glyph at a time" />
      <M sig="AddTextWordByWord" desc="Word-granularity variant" />
      <M sig="new RemoveTextLetterByLetter(text, opts?)" desc="Reverse typewriter" />
      <M sig="new TypeWithCursor(text, opts?)" desc="AddTextLetterByLetter + a blinking cursor glyph" />
      <M sig="new UntypeWithCursor(text, opts?)" desc="Reverse, with cursor" />
      <M sig="new Add(...mobjects)" desc="Instantaneous add (0 duration) for use inside AnimationGroup/Succession" />
      <M sig="new Wait(seconds)" desc="No-op hold animation" />
    </ul>

    <h2>Transform family <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>animations/transform.ts</code>.</p>
    <ul class="member-list">
      <M sig="new Transform(mobject, target, opts?)" desc="Morphs one mobject's points/style into another's over time" />
      <M sig="ReplacementTransform" desc="Transform that also replaces the source with the target on the scene" />
      <M sig="TransformFromCopy" desc="Transform, but leaves the original mobject untouched" />
      <M sig="ClockwiseTransform / CounterclockwiseTransform" desc="Transform with a rotational path arc" />
      <M sig="new FadeTransform(mobject, target, opts?)" desc="Crossfades two independent mobjects in place" />
      <M sig="FadeTransformPieces" desc="Per-submobject FadeTransform" />
      <M sig="new CyclicReplace(...mobjects)" desc="Rotates N mobjects into each other's positions" />
      <M sig="Swap" desc="CyclicReplace specialized for exactly 2 mobjects" />
      <M sig="new MoveToTarget(mobject)" desc="Animates toward mobject.target, set up via generateTarget()" />
      <M sig="new ApplyFunction(mobject, fn, opts?)" desc="Interpolates toward fn(mobject.copy())" />
      <M sig="ApplyPointwiseFunction" desc="Applies fn to every point directly (not full mobject transform)" />
      <M sig="ApplyPointwiseFunctionToCenter" desc="Applies fn only to the center, then shifts" />
      <M sig="new ApplyMatrix(matrix, mobject, opts?)" desc="Linear-transforms all points by a matrix" />
      <M sig="ApplyComplexFunction" desc="ApplyMatrix specialized for complex-plane functions" />
      <M sig="new ApplyMethod(mobject, methodName, ...args)" desc="Animates the effect of calling a Mobject method" />
      <M sig="new FadeToColor(mobject, color, opts?)" desc="Interpolates fill/stroke color only" />
      <M sig="new ScaleInPlace(mobject, factor, opts?)" desc="Scales about the mobject's own center" />
      <M sig="ShrinkToCenter" desc="ScaleInPlace(0)" />
      <M sig="new Restore(mobject)" desc="Animates back to the last saveState() checkpoint" />
      <M sig="new TransformMatchingShapes(source, target, opts?)" desc="Matches submobjects by shape identity, transforms matched pairs and fades the rest" />
      <M sig="new TransformMatchingTex(source, target, opts?)" desc="TransformMatchingShapes variant keyed by Tex substring identity" />
    </ul>

    <h2>Indication &amp; emphasis <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>animations/indication.ts</code>.</p>
    <ul class="member-list">
      <M sig="new Fade(mobject, opts?)" desc="Base opacity fade" />
      <M sig="FadeIn / FadeOut" desc="Fade with optional shift/scale entrance-exit direction" />
      <M sig="new GrowFromPoint(mobject, point, opts?)" desc="Scales up from a point to full size" />
      <M sig="GrowFromCenter / GrowFromEdge / GrowArrow" desc="GrowFromPoint variants" />
      <M sig="SpinInFromNothing" desc="GrowFromCenter combined with a rotation" />
      <M sig="new Indicate(mobject, opts?)" desc="Brief scale-and-color pulse to draw attention" />
      <M sig="new Wiggle(mobject, opts?)" desc="Small oscillating rotate+scale shake" />
      <M sig="new Circumscribe(mobject, opts?)" desc="Draws a temporary rectangle/circle around a mobject" />
      <M sig="new Flash(point, opts?)" desc="Radiating line-burst flash effect at a point" />
      <M sig="new FocusOn(point, opts?)" desc="Shrinking spotlight ring drawing focus to a point" />
      <M sig="new ApplyWave(mobject, opts?)" desc="Traveling sine-wave vertical displacement" />
      <M sig="new Blink(mobject, opts?)" desc="Opacity blink" />
      <M sig="new ShowPassingFlash(mobject, opts?)" desc="A bright segment sweeps once along the mobject's path" />
      <M sig="new Broadcast(mobject, opts?)" desc="Concentric expanding-and-fading copies emitted from a mobject" />
    </ul>

    <h2>Movement &amp; motion <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>animations/movement.ts</code>.</p>
    <ul class="member-list">
      <M sig="new MoveAlongPath(mobject, path: VMobject, opts?)" desc="Moves mobject's center along another VMobject's curve" />
      <M sig="new Homotopy(mobject, fn: (x,y,z,t) => Vec3, opts?)" desc="Continuously deforms every point via a time-parametrized function" />
      <M sig="ComplexHomotopy" desc="Homotopy specialized for complex-plane functions" />
      <M sig="new PhaseFlow(mobject, vectorField, opts?)" desc="Advects points along a vector field's flow" />
      <M sig="new Rotate(mobject, angle, opts?)" desc="Rotates about an axis/point over time" />
      <M sig="Rotating" desc="Rotate variant intended for indefinite/looping use" />
      <M sig="new ChangingDecimal(decimalMobject, updateFn, opts?)" desc="Animates a DecimalNumber's displayed value via a custom function of alpha" />
      <M sig="ChangeDecimalToValue" desc="ChangingDecimal convenience: linear interpolate to a target number" />
    </ul>

    <h2>Composition <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>animations/composition.ts</code>.</p>
    <ul class="member-list">
      <M sig="new AnimationGroup(...animations, opts?)" desc="Plays multiple animations concurrently as one unit; { lagRatio } staggers starts" />
      <M sig="new LaggedStart(...animations, opts?)" desc="AnimationGroup with a default non-zero lagRatio" />
      <M sig="new LaggedStartMap(mobjects, animClass, opts?)" desc="LaggedStart built by mapping an animation class over a list of mobjects" />
      <M sig="new Succession(...animations, opts?)" desc="Plays animations one after another within a single play() call" />
    </ul>

    <h2>Changing (live-updating helpers) <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>animations/changing.ts</code>.</p>
    <ul class="member-list">
      <M sig="new TracedPath(traceFn: () => Vec3, opts?)" desc="A VMobject that accumulates a trail from a moving point every frame" />
      <M sig="new AnimatedBoundary(vmobject, opts?)" desc="Animated shimmering outline effect around a VMobject" />
      <M sig="new ChangeSpeed(animation, opts?)" desc="Wraps another animation, remapping its internal time (speed ramps)" />
      <M sig="new UpdateFromFunc(mobject, fn: (mob) => void, opts?)" desc="Calls fn(mobject) every frame during the animation" />
      <M sig="new UpdateFromAlphaFunc(mobject, fn: (mob, alpha) => void, opts?)" desc="Like UpdateFromFunc, with alpha passed" />
      <M sig="new MaintainPositionRelativeTo(mobject, target, opts?)" desc="Keeps mobject glued to target's frame as target moves" />
    </ul>

    <h2>Rate functions <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>animations/rate-functions.ts</code> (imported by <code>Animation.computeAlpha</code>). Includes <code>linear</code>, <code>smooth</code>, <code>rushInto</code>/<code>rushFrom</code>, <code>slowInto</code>, <code>doubleSmooth</code>, <code>thereAndBack</code>, <code>thereAndBackWithPause</code>, <code>wiggle</code>, <code>exponentialDecay</code>, and easing families (<code>easeIn/Out/InOutSine|Cubic|Quad</code> etc.) matching ManimCE's <code>rate_functions.py</code>.</p>
  </>
);
