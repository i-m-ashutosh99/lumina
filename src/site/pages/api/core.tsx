import type { FC } from 'hono/jsx';

const M: FC<{ sig: string; desc: string }> = ({ sig, desc }) => (
  <li><code>{sig}</code><span class="desc">— {desc}</span></li>
);

export const ApiCorePage: FC = () => (
  <>
    <h1>API Reference — Core</h1>
    <p class="lead"><code>Mobject</code>, <code>VMobject</code>, <code>Group</code>/<code>VGroup</code>, <code>Animation</code>, <code>Scene</code>, <code>Timeline</code>, <code>Clock</code>.</p>

    <h2>Mobject <span class="badge badge-done">implemented</span></h2>
    <p class="api-sig">class Mobject {'{'} points: Vec3[]; children: Mobject[]; style: Style; ... {'}'}</p>
    <p>Base class for everything displayable. Source: <code>core/mobject.ts</code>.</p>

    <h3>Hierarchy</h3>
    <ul class="member-list">
      <M sig="add(...mobjects: Mobject[]): this" desc="Add children" />
      <M sig="remove(...mobjects: Mobject[]): this" desc="Remove children" />
      <M sig="clear(): this" desc="Remove all children" />
      <M sig="family(): Mobject[]" desc="This mobject + all descendants, flattened" />
      <M sig="setSubmobjects(mobs: Mobject[]): this" desc="Replace all children" />
    </ul>

    <h3>Geometry queries</h3>
    <ul class="member-list">
      <M sig="getCenter(): Vec3" desc="Bounding-box center" />
      <M sig="getBoundingBox(): { min: Vec3; max: Vec3 }" desc="Axis-aligned bounding box (own + descendants)" />
      <M sig="getTop() / getBottom() / getLeft() / getRight(): Vec3" desc="Edge anchor points" />
      <M sig="getCorner(dir: Vec3): Vec3" desc="Corner point along a diagonal direction" />
      <M sig="edgePoint(dir: Vec3): Vec3" desc="Point on the boundary in direction dir from center" />
      <M sig="getWidth() / getHeight() / getDepth(): number" desc="Bounding-box extents" />
    </ul>

    <h3>Placement</h3>
    <ul class="member-list">
      <M sig="shift(vec: Vec3 | number): this" desc="Translate by a vector" />
      <M sig="moveTo(target: Vec3 | Mobject): this" desc="Center onto a point or another mobject" />
      <M sig="nextTo(target, direction?, { buff?, alignedEdge? }): this" desc="Park beside another mobject with a gap" />
      <M sig="alignTo(target, direction?): this" desc="Align one edge to a target's edge" />
      <M sig="toEdge(direction, buff?): this" desc="Stick to the camera frame's edge" />
      <M sig="toCorner(corner, buff?): this" desc="Stick to the frame's corner" />
      <M sig="center(): this" desc="Move to the origin" />
      <M sig="scale(factor, { aboutPoint?, aboutEdge? }): this" desc="Uniform scale" />
      <M sig="stretch(factor, dim): this" desc="Scale along one axis (0=x,1=y,2=z)" />
      <M sig="stretchToFitWidth/Height/Depth(v): this" desc="Stretch to an exact size" />
      <M sig="setWidth/setHeight/setDepth(v, stretch?): this" desc="Resize (uniform scale unless stretch=true)" />
      <M sig="rotate(angle, { axis?, aboutPoint? }): this" desc="Rotate (2D: implicit Z axis)" />
      <M sig="flip(axis?, aboutPoint?): this" desc="Mirror across an axis" />
      <M sig="setX/setY/setZ(v): this" desc="Set one coordinate of the center" />
      <M sig="arrange(direction?, { buff? }): this" desc="Lay out children in a row/column" />
      <M sig="arrangeInGrid(rows?, cols?, { buff? }): this" desc="Lay out children in a grid" />
    </ul>

    <h3>Style</h3>
    <ul class="member-list">
      <M sig="setColor(c): this" desc="Set fill + stroke color together" />
      <M sig="setFill(c, opacity?): this" desc="Fill color/opacity" />
      <M sig="setStroke(c, width?, opacity?): this" desc="Stroke color/width/opacity" />
      <M sig="setBackgroundStroke(c, width?, opacity?): this" desc="3b1b-style contrast stroke behind the main stroke" />
      <M sig="setOpacity(o): this" desc="Fill + stroke opacity together" />
      <M sig="setColorByGradient(...colors): this" desc="Gradient fill/stroke across the mobject" />
      <M sig="highlight(color?): this" desc="Quick attention color flash (non-animated)" />
    </ul>

    <h3>Copy, snapshot &amp; targets</h3>
    <ul class="member-list">
      <M sig="copy(): this" desc="Deep clone" />
      <M sig="become(other: Mobject): this" desc="Snap this mobject's points/style to match another" />
      <M sig="saveState() / restore(): this" desc="Checkpoint / revert (used by the Restore animation)" />
      <M sig="generateTarget(): this" desc="Create a .target clone to mutate, animated via MoveToTarget" />
    </ul>

    <h3>Updaters</h3>
    <ul class="member-list">
      <M sig="addUpdater(fn: (m, dt?) => void): this" desc="Run fn every frame while active" />
      <M sig="removeUpdater(fn): this" desc="Remove a specific updater" />
      <M sig="clearUpdaters(): this" desc="Remove all updaters" />
      <M sig="alwaysRedraw(factory): this" desc="Instance-level: rebuild from factory() every frame" />
    </ul>

    <h3>Z-order</h3>
    <ul class="member-list">
      <M sig="setZIndex(z): this" desc="Explicit draw-order override" />
      <M sig="bringToFront() / sendToBack(): void" desc="Reorder relative to siblings" />
    </ul>

    <h2>VMobject <span class="badge badge-done">implemented</span></h2>
    <p>Extends <code>Mobject</code>. Source: <code>core/vmobject.ts</code>. Stores geometry as a flat cubic-Bézier point array (4 points per curve). This is the base class for every 2D shape.</p>
    <ul class="member-list">
      <M sig="get nCurves: number" desc="Number of cubic segments" />
      <M sig="getAnchors(): Vec3[]" desc="Curve start points + final end" />
      <M sig="getStart() / getEnd(): Vec3" desc="Path endpoints" />
      <M sig="pointAt(t: number): Vec3" desc="Point at normalized arc-parameter t" />
      <M sig="tangentAt(t: number): Vec3" desc="Tangent direction at t" />
      <M sig="pointwiseBecomePartial(mob, a, b): this" desc="Trim to the sub-path [a,b] — used by Create/Uncreate" />
    </ul>
    <p>Also exported: <code>VectorizedPoint</code> (a degenerate zero-size VMobject) and <code>CurvesAsSubmobjects</code> (splits each cubic segment into its own submobject).</p>

    <h2>MeshMobject <span class="badge badge-done">implemented</span></h2>
    <p>Extends <code>Mobject</code>. Source: <code>core/mesh-mobject.ts</code>. The 3D analogue of VMobject.</p>
    <ul class="member-list">
      <M sig="positions / normals / uvs: Vec3[] | number[]" desc="Flat vertex buffers (positions mirrors this.points by reference)" />
      <M sig="indices: number[]" desc="Triangle index buffer" />
      <M sig="interpolatePoints(other: MeshMobject, alpha): void" desc="CPU vertex lerp (position + normal + color/opacity crossfade) — used by Transform for 3D" />
      <M sig="style: MeshStyle" desc="Color/opacity/wireframe/shading flags" />
    </ul>
    <div class="callout">
      Because <code>points</code> mirrors <code>positions</code> by reference, every base
      <code>Mobject</code> placement method works unmodified on 3D geometry.
    </div>

    <h2>Group &amp; VGroup <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>core/group.ts</code>.</p>
    <ul class="member-list">
      <M sig="class Group extends Mobject" desc="Pure hierarchy container — use for mixed 2D/3D composition (e.g. Arrow3D)" />
      <M sig="class VGroup extends VMobject" desc="Group specifically of 2D VMobjects — group-level styling applies uniformly" />
      <M sig="class VDict extends VGroup" desc="VGroup with named key access, like Python's VDict" />
    </ul>

    <h2>Animation <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>core/animation.ts</code>. Base class for every animation — see the full <a href="/guides/animations">Animation Catalogue</a> for subclasses.</p>
    <ul class="member-list">
      <M sig="constructor(mobject, opts?: AnimOptions)" desc="opts: { runTime?, rateFunc?, lagRatio?, remover?, introducer? }" />
      <M sig="begin(): void" desc="Snapshot start state" />
      <M sig="apply(alpha: number): void" desc="Always preceded by restoreStart() when replayed" />
      <M sig="finish(): void" desc="Final state / cleanup" />
      <M sig="computeAlpha(rawT: number): number" desc="Applies the rate function to a raw progress fraction" />
    </ul>
    <p><code>prepareAnimation(x)</code> coerces an <code>.animate</code> proxy or a plain object into a real <code>Animation</code> instance — called internally by <code>Scene.play()</code>.</p>

    <h2>Scene, MovingCameraScene, ThreeDScene, ZoomedScene, VectorScene <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>core/scene.ts</code>. See the <a href="/guides/timeline-seek">Timeline guide</a> for the record-then-seek architecture and the <a href="/guides/camera-3d">3D guide</a> for the 3D subclasses.</p>
    <ul class="member-list">
      <M sig="constructor(mount?, options?: SceneOptions)" desc="options: { width?, height?, background?, frameHeight?, frameWidth?, fps?, seed? }" />
      <M sig="add(...mobs) / remove(...mobs): this" desc="Scene membership" />
      <M sig="play(...animations, opts?: PlayOptions): Promise<void>" desc="Record and immediately apply a clip" />
      <M sig="wait(seconds, opts?): Promise<void>" desc="Hold — updaters still tick" />
      <M sig="seek(t: number): void" desc="Jump to any time, instantly and purely" />
      <M sig="startPlayback(fromT?) / pausePlayback(): void" desc="Live rAF-driven playback" />
      <M sig="timeline: Timeline" desc="The recorded clip/marker log — see Timeline below" />
    </ul>

    <h2>Timeline <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>core/timeline.ts</code>.</p>
    <ul class="member-list">
      <M sig="clips: ClipEntry[]" desc="{ t0, t1, animations } — recorded play() calls" />
      <M sig="duration: number" desc="Total recorded length" />
      <M sig="render(t: number): Mobject[]" desc="Pure: mutate mobjects to time t, return visible top-level mobjects" />
      <M sig="membershipAt(t): Set<Mobject>" desc="Which mobjects are on screen at t, per markers" />
    </ul>

    <h2>Clock <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>core/clock.ts</code>. Simple time-tracking utility used by live playback.</p>

    <h2>Updaters &amp; trackers <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>core/updater.ts</code>. See the <a href="/guides/updaters">Updaters guide</a>.</p>
    <ul class="member-list">
      <M sig="class ValueTracker(value?, opts?)" desc="getValue() / setValue() / .value / increment(d)" />
      <M sig="class ComplexValueTracker(re?, im?, opts?)" desc="getComplexValue() / setComplexValue({re, im})" />
      <M sig="always(method, ...args): Updater" desc="Call mob[method](...args) every frame" />
      <M sig="fAlways(method, ...argFns): Updater" desc="Like always, but args are re-evaluated thunks" />
      <M sig="alwaysRedraw(factory): Mobject" desc="Free function: returns a mobject that rebuilds itself every frame" />
    </ul>

    <h2>Style &amp; option normalization</h2>
    <p>Source: <code>core/style.ts</code>.</p>
    <ul class="member-list">
      <M sig="normalizeOptions(opts): T" desc="snake_case → camelCase key normalization, applied to every constructor's options object" />
      <M sig="defaultStyle(): Style" desc="fill: null, stroke: '#FFFFFF', strokeWidth: 4, ..." />
      <M sig="lerpStyle(a, b, t): Style" desc="Interpolate two styles" />
    </ul>
  </>
);
