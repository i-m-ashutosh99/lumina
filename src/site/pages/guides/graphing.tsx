import type { FC } from 'hono/jsx';

export const GraphingPage: FC = () => (
  <>
    <h1>Graphing &amp; Coordinate Systems</h1>
    <p class="lead">
      <code>Axes</code>, <code>NumberPlane</code>, <code>ComplexPlane</code>, and <code>PolarPlane</code> — 2D
      coordinate systems for plotting functions, calculus visualizations, and complex-number/polar diagrams,
      mirroring real ManimCE's <code>CoordinateSystem</code> family.
    </p>

    <h2>Why not just draw lines yourself?</h2>
    <p>
      Any scene involving a graph needs to repeatedly convert between "the numbers you're thinking in" (e.g.
      plot <code>y = sin(x)</code> for <code>x</code> in <code>[-5, 5]</code>) and "where that actually is on
      screen" — and that conversion has to keep working correctly even after you <code>shift()</code>,
      <code>scale()</code>, or animate the whole coordinate system. <code>Axes</code> owns this conversion for
      you via <code>coordsToPoint</code>/<code>c2p</code> and <code>pointToCoords</code>/<code>p2c</code>, and
      every plotting helper (<code>plot()</code>, <code>getRiemannRectangles()</code>, <code>getArea()</code>)
      is built on top of those two primitives.
    </p>

    <h2>Basic Axes</h2>
    <pre>{`import { Axes, Create } from 'lumina';

const axes = new Axes({
  xRange: [-5, 5, 1],   // [min, max, step]
  yRange: [-3, 3, 1],
  xLength: 10,          // world-unit width of the x-axis
  yLength: 6,
  tips: true,           // arrow tips at each axis end (default true)
});
await axes.ready;        // NumberLines (and tip glyphs) are built asynchronously
await scene.play(new Create(axes));`}</pre>

    <div class="callout warn">
      <strong>Async construction, same pattern as <code>Text</code>/<code>MathTex</code>.</strong>
      <code>Axes</code> constructs synchronously as an empty shell — safe to build on/animate right away — but
      <code>await axes.ready</code> before reading geometry or calling <code>coordsToPoint</code> if you need
      the tip glyphs to already be positioned correctly.
    </div>

    <h2>Plotting a function</h2>
    <pre>{`const sine = axes.plot((x) => Math.sin(x), {
  xRange: [-5, 5],     // defaults to the x-axis's own range if omitted
  color: YELLOW,
  strokeWidth: 3,
});
await scene.play(new Create(sine));`}</pre>
    <p>
      <code>plot()</code> samples the function at up to 200 points, converts every sample through
      <code>coordsToPoint</code>, and builds one smooth cubic-Bézier curve. Pass <code>useSmoothing: false</code>
      for corner-to-corner straight segments instead (matches real Manim's <code>use_smoothing</code> flag).
    </p>

    <h2>Labeling axes and points</h2>
    <pre>{`const labels = axes.getAxisLabels('x', 'f(x)');
await labels.ready;
await scene.play(new FadeIn(labels));

// Label a specific point using MathTex, positioned via c2p:
const label = new MathTex('(\\\\pi, 0)');
await label.ready;
label.nextTo(axes.c2p(Math.PI, 0), [0, 1, 0], { buff: 0.2 });
await scene.play(new Write(label));`}</pre>

    <h2>Riemann rectangles and area under a curve</h2>
    <pre>{`const rects = axes.getRiemannRectangles(
  (x) => x * x,
  { xRange: [0, 2], dx: 0.2, mode: 'left', color: [BLUE, GREEN], fillOpacity: 0.7 }
);
await scene.play(new Create(rects));

const area = axes.getArea((x) => x * x, { xRange: [0, 2], color: BLUE, opacity: 0.4 });
await scene.play(new FadeIn(area));`}</pre>

    <h2>NumberPlane: a full background grid</h2>
    <pre>{`import { NumberPlane } from 'lumina';

const plane = new NumberPlane({
  xRange: [-6, 6, 1],
  yRange: [-4, 4, 1],
  backgroundLineStyle: { strokeColor: GREY, strokeWidth: 1, strokeOpacity: 0.5 },
});
await plane.ready;
await scene.play(new Create(plane));`}</pre>
    <p>
      <code>NumberPlane extends Axes</code> and draws a grid line at every tick, inserted behind the axes so
      the axes themselves remain visually on top.
    </p>

    <h2>ComplexPlane</h2>
    <pre>{`import { ComplexPlane } from 'lumina';

const cplane = new ComplexPlane({ xRange: [-4, 4, 1], yRange: [-3, 3, 1] });
const z = cplane.complexToPoint({ re: 2, im: 1 });   // -> world Vec3
const dot = new Dot({ point: z, color: RED });
await scene.play(new Create(cplane), new Create(dot));`}</pre>

    <h2>PolarPlane</h2>
    <p>
      Built independently of <code>Axes</code> (there's no meaningful x/y <code>NumberLine</code> pair in polar
      coordinates) — concentric radius rings plus angle spokes, with <code>coordsToPoint(r, theta)</code>
      instead of <code>coordsToPoint(x, y)</code>.
    </p>
    <pre>{`import { PolarPlane } from 'lumina';

const polar = new PolarPlane({ radiusRange: [0, 3, 1] });
const rose = polar.plotPolarGraph(
  (theta) => 2 * Math.sin(3 * theta),
  [0, Math.PI],
  { color: PINK }
);
await scene.play(new Create(polar));
await scene.play(new Create(rose));`}</pre>

    <h2>Parametric curves</h2>
    <pre>{`const spiral = axes.plotParametric(
  (t) => [t * Math.cos(t), t * Math.sin(t)],
  [0, 4 * Math.PI, 0.05],
  { color: TEAL }
);
await scene.play(new Create(spiral));`}</pre>

    <div class="callout warn">
      <strong>Still missing</strong> versus real ManimCE's coordinate systems: <code>getGraphLabel()</code>
      convenience positioning (use <code>nextTo()</code> manually for now), <code>input_to_graph_point</code>/
      <code>secant_slope_group</code>-style calculus tangent-line helpers, and log-scale axes. See
      <a href="/api/graphing">API: Graphing</a> for the full method list.
    </div>

    <div class="callout">
      Next: <a href="/guides/updaters">Updaters &amp; ValueTrackers</a> — pair a <code>DecimalNumber</code>
      or moving <code>Dot</code> on an <code>Axes</code> plot with a live-updating value.
    </div>
  </>
);
