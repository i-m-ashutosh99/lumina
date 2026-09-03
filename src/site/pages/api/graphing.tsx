import type { FC } from 'hono/jsx';

const M: FC<{ sig: string; desc: string }> = ({ sig, desc }) => (
  <li><code>{sig}</code><span class="desc">— {desc}</span></li>
);

export const ApiGraphingPage: FC = () => (
  <>
    <h1>API Reference — Graphing</h1>
    <p class="lead">Source: <code>mobjects/graphing/coordinate-system.ts</code>, <code>mobjects/graphing/number-line.ts</code>.
    2D coordinate systems for plotting functions, calculus visualizations, and complex/polar planes — real ManimCE's
    <code>Axes</code>/<code>NumberPlane</code>/<code>ComplexPlane</code>/<code>PolarPlane</code> family.</p>

    <h2>NumberLine / UnitInterval <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new NumberLine(opts?: NumberLineOptions)" desc="1D number line: { xRange?: [min,max,step], length?, includeTip?, color?, ... }" />
      <M sig="numberLine.numberToPoint(x: number): Vec3 / n2p" desc="Value -> world point, relative to the line's CURRENT endpoints (post shift/rotate)" />
      <M sig="numberLine.pointToNumber(p: Vec3): number / p2n" desc="World point -> value, inverse of numberToPoint" />
      <M sig="new UnitInterval(opts?)" desc="NumberLine preset with xRange [0, 1, 0.1]" />
    </ul>
    <div class="callout warn">
      <code>numberToPoint</code>/<code>pointToNumber</code> are defined relative to the line's <em>current</em>
      endpoints — not a fixed local origin. This is what makes it safe to <code>shift()</code>/<code>rotate()</code>
      a <code>NumberLine</code> after construction (as <code>Axes</code> below does) and still get correct
      coordinate conversion.
    </div>

    <h2>CoordinateSystem / Axes / NumberPlane <span class="badge badge-done">implemented</span></h2>
    <p>
      <code>CoordinateSystem</code> is a base class providing coordinate conversion and plotting helpers on top of
      any subclass that fills <code>this.xAxis</code>/<code>this.yAxis</code> (both <code>NumberLine</code>s).
      <code>Axes</code>, <code>NumberPlane</code>, and <code>ComplexPlane</code> all extend it directly.
    </p>
    <ul class="member-list">
      <M sig="new Axes(opts?: AxesOptions)" desc="{ xRange?, yRange?, xLength?, yLength?, axisConfig?, xAxisConfig?, yAxisConfig?, tips?, color? }" />
      <M sig="axes.ready: Promise&lt;this&gt;" desc="Resolves once both NumberLines (and their tip glyphs) are built" />
      <M sig="axes.coordsToPoint(x: number, y?: number): Vec3 / c2p" desc="Axes-space (x,y) -> world-space point" />
      <M sig="axes.pointToCoords(p: Vec3): [number, number] / p2c" desc="World-space point -> axes-space (x,y), inverse of c2p" />
      <M sig="axes.plot(fn: (x)=&gt;number, opts?): VMobject" desc="y = f(x) as a single smooth curve. opts: { xRange?, color?, strokeWidth?, useSmoothing? }" />
      <M sig="axes.plotParametric(fn: (t)=&gt;[x,y], tRange?, opts?): VMobject" desc="Parametric curve t -> (x(t), y(t)) in axes coordinates" />
      <M sig="axes.getRiemannRectangles(fn, opts?): VGroup" desc="Riemann-sum rectangles. opts: { xRange?, dx?, mode?: 'left'|'right'|'center', color?, fillOpacity? }" />
      <M sig="axes.getArea(fn, opts?): VMobject" desc="Filled area under fn (or between two functions via opts.boundY) over xRange" />
      <M sig="axes.pointToDot(x, y?, opts?): Mobject" desc="Convenience Dot at axes-space (x, y)" />
      <M sig="axes.getVerticalLine(x, fn, opts?): Line" desc="Vertical line from the x-axis up to the curve at x" />
      <M sig="axes.getAxisLabels(xLabel?, yLabel?): VGroup" desc="Text labels ('x'/'y' by default) placed near each axis tip" />
    </ul>

    <div class="callout">
      <strong>Correctness note (bug found + fixed during implementation):</strong> a <code>NumberLine</code>'s
      value <code>0</code> only sits at its own bounding-box center when its range is symmetric about 0 — for an
      asymmetric range like <code>xRange: [0, 10]</code>, <code>0</code> sits at the line's left edge instead.
      <code>Axes</code>'s constructor rotates the y-axis about <em>its own</em> <code>numberToPoint(0)</code>
      (not the bounding-box center) and then shifts both axes so each one's zero-value point coincides at world
      <code>(0,0,0)</code> — this is what guarantees the two axes visually cross at the coordinate system's actual
      origin regardless of range symmetry.
    </div>

    <pre>{`const axes = new Axes({
  xRange: [-5, 5, 1],
  yRange: [-3, 3, 1],
  xLength: 10,
  yLength: 6,
  tips: true,
});
await axes.ready;

const sine = axes.plot((x) => Math.sin(x), { color: YELLOW, strokeWidth: 3 });
const labels = axes.getAxisLabels('x', 't');
await labels.ready;

await scene.play(new Create(axes));
await scene.play(new Create(sine));
await scene.play(new FadeIn(labels));`}</pre>

    <h3>NumberPlane <span class="badge badge-done">implemented</span></h3>
    <p><code>NumberPlane extends Axes</code>, adding a full background grid of lines at every tick, drawn behind
    the axes.</p>
    <ul class="member-list">
      <M sig="new NumberPlane(opts?: NumberPlaneOptions)" desc="Extends AxesOptions with { backgroundLineStyle?: { strokeColor?, strokeWidth?, strokeOpacity? }, faded?, fadedLineRatio? }" />
      <M sig="plane.backgroundLines: VGroup" desc="All grid Lines, inserted at the front of children so they render behind the axes" />
    </ul>
    <pre>{`const plane = new NumberPlane({ xRange: [-6, 6, 1], yRange: [-4, 4, 1] });
await plane.ready;
await scene.play(new Create(plane));`}</pre>

    <h3>ComplexPlane <span class="badge badge-done">implemented</span></h3>
    <p><code>ComplexPlane extends NumberPlane</code> — identical visuals, adds complex-number convenience methods.</p>
    <ul class="member-list">
      <M sig="complexPlane.complexToPoint(z: {re,im} | number): Vec3 / c2pComplex" desc="Complex number -> world point" />
      <M sig="complexPlane.pointToComplex(p: Vec3): {re,im} / p2cComplex" desc="World point -> complex number" />
    </ul>

    <h2>PolarPlane <span class="badge badge-done">implemented</span></h2>
    <p>
      Built independently of <code>Axes</code> (polar coordinates have no meaningful x/y <code>NumberLine</code>
      pair) — concentric radius rings plus angle spokes, with <code>coordsToPoint</code> interpreting its two
      numbers as <code>(r, theta)</code> instead of <code>(x, y)</code>.
    </p>
    <ul class="member-list">
      <M sig="new PolarPlane(opts?: PolarPlaneOptions)" desc="{ radiusRange?: [min,max,step], azimuthUnit?, azimuthStep?, size?, color? }" />
      <M sig="polarPlane.coordsToPoint(r: number, theta: number): Vec3 / c2p" desc="Polar (r, theta[radians]) -> world point" />
      <M sig="polarPlane.pointToCoords(p: Vec3): [r, theta] / p2c" desc="World point -> polar (r, theta), inverse of c2p" />
      <M sig="polarPlane.plotPolarGraph(fn: (theta)=&gt;r, thetaRange?, opts?): VMobject" desc="Polar plot r = f(theta) over [thetaMin, thetaMax]" />
      <M sig="polarPlane.rings / polarPlane.spokes: VGroup" desc="The concentric radius circles and angle-spoke lines, individually accessible" />
    </ul>
    <pre>{`const polar = new PolarPlane({ radiusRange: [0, 3, 1] });
const rose = polar.plotPolarGraph((theta) => 2 * Math.sin(3 * theta), [0, Math.PI], { color: PINK });
await scene.play(new Create(polar));
await scene.play(new Create(rose));`}</pre>

    <div class="callout warn">
      <strong>Still missing</strong> versus real ManimCE: <code>getGraphLabel()</code> convenience positioning
      (manually <code>nextTo()</code> a <code>MathTex</code>/<code>Text</code> label to the curve for now),
      <code>input_to_graph_point</code>/<code>secant_slope_group</code>-style calculus helpers, and log-scale axes.
    </div>

    <div class="callout">
      See also: <a href="/guides/graphing">Graphing &amp; Coordinate Systems guide</a> and
      <a href="/api/text">API: Text</a> for labeling plots with <code>MathTex</code>.
    </div>
  </>
);
