/**
 * Lumina — mobjects/graphing/coordinate-system.ts
 * Axes / NumberPlane / ComplexPlane / PolarPlane, `plot()`, Riemann
 * rectangles, area-under-curve, `c2p`/`p2c` coordinate conversion (doc 07
 * §8, doc 09 calculus/complex modules; Phase 2 "graphing" remainder — the
 * single highest-priority gap identified in the 2026 audit after MathTex).
 *
 * Design mirrors real ManimCE's `Axes`/`CoordinateSystem` mixin closely:
 * an `Axes` owns an x- and y- `NumberLine`, and `coordsToPoint`/`c2p` /
 * `pointToCoords`/`p2c` convert between "axes space" (the numbers a caller
 * thinks in) and "world space" (where the NumberLines actually are,
 * post-shift/scale/rotate) by delegating to each NumberLine's own
 * `numberToPoint`/`pointToNumber` — which is itself defined relative to
 * the line's CURRENT endpoints (see `number-line.ts`), so an `Axes` that
 * has been moved/scaled after construction still converts correctly.
 */
import { Vec3, v, add, sub, mul, lerp } from '../../math/vec';
import { VGroup } from '../../core/group';
import { VMobject } from '../../core/vmobject';
import { Mobject } from '../../core/mobject';
import { normalizeOptions } from '../../core/style';
import { resolveColor, WHITE, BLUE, GREY, GRAY_C } from '../../math/color';
import { NumberLine, NumberLineOptions } from './number-line';
import { cornersToCubics } from '../../math/bezier';
import { Line, Dot, Circle } from '../geometry/basic';
import { Text } from '../text/text';

export interface AxesOptions {
  xRange?: [number, number, number?];
  yRange?: [number, number, number?];
  xLength?: number;
  yLength?: number;
  axisConfig?: NumberLineOptions;
  xAxisConfig?: NumberLineOptions;
  yAxisConfig?: NumberLineOptions;
  tips?: boolean;
  color?: any;
}

/**
 * `CoordinateSystem` — a mixin-by-inheritance base providing `c2p`/`p2c`
 * and `plot()` on top of ANY subclass that fills `this.xAxis`/`this.yAxis`
 * (both `NumberLine`s) before use. `Axes`, `NumberPlane`, and
 * `ComplexPlane` all extend this directly; `PolarPlane` extends `Axes`.
 */
export class CoordinateSystem extends VGroup {
  xAxis!: NumberLine;
  yAxis!: NumberLine;

  /**
   * Axes-space (x, y) -> world-space point. Real Manim's `coords_to_point`.
   *
   * Relies on the invariant `Axes`'s constructor establishes (and any
   * other `CoordinateSystem` subclass must preserve): `xAxis.numberToPoint(0)`
   * and `yAxis.numberToPoint(0)` are the SAME world point, and the two
   * axes are perpendicular. Under that invariant, moving along the x-axis
   * by "x" and along the y-axis by "y" and adding the two displacements
   * (relative to their shared zero) gives the exact world point — correct
   * even after the whole `Axes` group is later shifted/scaled/rotated as
   * one rigid unit, since both axes move together and stay perpendicular.
   */
  coordsToPoint(x: number, y = 0): Vec3 {
    const zero = this.xAxis.numberToPoint(0);
    const px = this.xAxis.numberToPoint(x);
    const py = this.yAxis.numberToPoint(y);
    return [
      zero[0] + (px[0] - zero[0]) + (py[0] - zero[0]),
      zero[1] + (px[1] - zero[1]) + (py[1] - zero[1]),
      zero[2] + (px[2] - zero[2]) + (py[2] - zero[2]),
    ];
  }
  c2p(x: number, y = 0): Vec3 { return this.coordsToPoint(x, y); }

  /** World-space point -> axes-space (x, y). Real Manim's `point_to_coords`. */
  pointToCoords(p: Vec3): [number, number] {
    return [this.xAxis.pointToNumber(p), this.yAxis.pointToNumber(p)];
  }
  p2c(p: Vec3): [number, number] { return this.pointToCoords(p); }

  /**
   * Plot y = f(x) over `[xMin, xMax]` (defaults to the x-axis's own range)
   * as a single smooth VMobject curve in world space. Real Manim's
   * `Axes.plot`. `useSmoothing: false` gives corner-to-corner cubics
   * (matches real Manim's default use_smoothing=True vs. False choice).
   */
  plot(
    fn: (x: number) => number,
    opts: { xRange?: [number, number, number?]; color?: any; strokeWidth?: number; useSmoothing?: boolean } = {}
  ): VMobject {
    const o = normalizeOptions(opts as any);
    const [xMin, xMax, step] = o.xRange ?? [this.xAxis.xMin, this.xAxis.xMax, undefined];
    const n = Math.max(50, Math.ceil((xMax - xMin) / (step ?? (xMax - xMin) / 200)));
    const pts: Vec3[] = [];
    for (let i = 0; i <= n; i++) {
      const x = xMin + ((xMax - xMin) * i) / n;
      const y = fn(x);
      if (Number.isFinite(y)) pts.push(this.coordsToPoint(x, y));
    }
    const curve = new VMobject();
    if (o.useSmoothing === false) curve.setPointsAsCorners(pts);
    else curve.setPointsSmoothly(pts);
    curve.style.stroke = resolveColor(o.color ?? BLUE);
    if (o.strokeWidth !== undefined) curve.style.strokeWidth = o.strokeWidth;
    (curve as any).underlyingFunction = fn;
    return curve;
  }

  /** Parametric plot t -> (x(t), y(t)) over [tMin, tMax] (real Manim's
   *  `plot_parametric_curve`), in AXES coordinates (auto-converted via c2p). */
  plotParametric(
    fn: (t: number) => [number, number],
    tRange: [number, number, number?] = [0, 1],
    opts: { color?: any; strokeWidth?: number } = {}
  ): VMobject {
    const o = normalizeOptions(opts as any);
    const [tMin, tMax, step] = tRange;
    const n = Math.max(50, Math.ceil((tMax - tMin) / (step ?? (tMax - tMin) / 200)));
    const pts: Vec3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = tMin + ((tMax - tMin) * i) / n;
      const [x, y] = fn(t);
      pts.push(this.coordsToPoint(x, y));
    }
    const curve = new VMobject();
    curve.setPointsSmoothly(pts);
    curve.style.stroke = resolveColor(o.color ?? BLUE);
    if (o.strokeWidth !== undefined) curve.style.strokeWidth = o.strokeWidth;
    return curve;
  }

  /** Riemann sum rectangles under `fn` over `[xMin,xMax]` split into `n`
   *  strips (real Manim's `get_riemann_rectangles`). `mode` picks the
   *  sample point within each strip: `'left'|'right'|'center'`. */
  getRiemannRectangles(
    fn: (x: number) => number,
    opts: { xRange?: [number, number]; dx?: number; mode?: 'left' | 'right' | 'center'; color?: any; fillOpacity?: number; strokeWidth?: number } = {}
  ): VGroup {
    const o = normalizeOptions(opts as any);
    const [xMin, xMax] = o.xRange ?? [this.xAxis.xMin, this.xAxis.xMax];
    const dx = o.dx ?? (xMax - xMin) / 20;
    const mode = o.mode ?? 'left';
    const group = new VGroup();
    const colorList = Array.isArray(o.color) ? o.color : [o.color ?? BLUE];
    let i = 0;
    for (let x0 = xMin; x0 < xMax - 1e-9; x0 += dx) {
      const x1 = Math.min(xMax, x0 + dx);
      const sampleX = mode === 'left' ? x0 : mode === 'right' ? x1 : (x0 + x1) / 2;
      const y = fn(sampleX);
      const p00 = this.coordsToPoint(x0, 0);
      const p10 = this.coordsToPoint(x1, 0);
      const p11 = this.coordsToPoint(x1, y);
      const p01 = this.coordsToPoint(x0, y);
      const rect = new VMobject();
      rect.points = cornersToCubics([p00, p10, p11, p01], true);
      rect.closed = true;
      const col = colorList[i % colorList.length];
      rect.style.fill = resolveColor(col);
      rect.style.fillOpacity = o.fillOpacity ?? 0.8;
      rect.style.stroke = resolveColor(col);
      rect.style.strokeWidth = o.strokeWidth ?? 1;
      group.add(rect);
      i++;
    }
    return group;
  }

  /** Filled area between `fn` and the x-axis (or between two functions if
   *  `boundY` is given) over `[xMin,xMax]` — real Manim's `get_area`. */
  getArea(
    fn: (x: number) => number,
    opts: { xRange?: [number, number]; color?: any; opacity?: number; boundY?: (x: number) => number } = {}
  ): VMobject {
    const o = normalizeOptions(opts as any);
    const [xMin, xMax] = o.xRange ?? [this.xAxis.xMin, this.xAxis.xMax];
    const n = 100;
    const top: Vec3[] = [];
    const bottom: Vec3[] = [];
    for (let i = 0; i <= n; i++) {
      const x = xMin + ((xMax - xMin) * i) / n;
      top.push(this.coordsToPoint(x, fn(x)));
      bottom.push(this.coordsToPoint(x, o.boundY ? o.boundY(x) : 0));
    }
    const area = new VMobject();
    const pts = [...top, ...bottom.reverse()];
    area.setPointsAsCorners(pts, true);
    area.closed = true;
    area.style.fill = resolveColor(o.color ?? BLUE);
    area.style.fillOpacity = o.opacity ?? 0.5;
    area.style.strokeWidth = 0;
    return area;
  }

  /** A dot at axes-space `(x, y)` (real Manim's `get_graph_point`/manual
   *  `Dot(axes.c2p(x,y))` idiom, provided as a convenience). */
  pointToDot(x: number, y = 0, opts: { color?: any; radius?: number } = {}): Mobject {
    return new Dot({ point: this.coordsToPoint(x, y), ...opts });
  }

  /** Vertical line from the x-axis up to the curve at coordinate `x`
   *  (real Manim's `get_vertical_line`/`get_lines_to_point`). */
  getVerticalLine(x: number, fn: (x: number) => number, opts: { color?: any; strokeWidth?: number } = {}): Line {
    const o = normalizeOptions(opts as any);
    return new Line({
      start: this.coordsToPoint(x, 0),
      end: this.coordsToPoint(x, fn(x)),
      color: o.color ?? GRAY_C,
      strokeWidth: o.strokeWidth ?? 2,
    });
  }
}

/** Axes: x/y `NumberLine`s crossing at world origin (real ManimCE `Axes`). */
export class Axes extends CoordinateSystem {
  ready: Promise<this>;

  constructor(opts: AxesOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    const xRange = o.xRange ?? [-8, 8, 1];
    const yRange = o.yRange ?? [-5, 5, 1];
    const xLength = o.xLength ?? Math.min(14, xRange[1] - xRange[0]);
    const yLength = o.yLength ?? Math.min(8, yRange[1] - yRange[0]);
    const color = o.color ? resolveColor(o.color) : WHITE;

    this.xAxis = new NumberLine({
      xRange, length: xLength, includeTip: o.tips ?? true, color,
      ...o.axisConfig, ...o.xAxisConfig,
    });
    this.yAxis = new NumberLine({
      xRange: yRange, length: yLength, includeTip: o.tips ?? true, color,
      ...o.axisConfig, ...o.yAxisConfig,
    });
    // CRITICAL correctness step (bug found + fixed during this audit): a
    // NumberLine's "value 0" only sits at ITS OWN local origin when its
    // range is symmetric about 0 (see number-line.ts's `localPointForValue`
    // — it centers the RANGE's midpoint, not the value 0, at local
    // origin). For an asymmetric range like `xRange: [0, 10]`, "0" sits at
    // the line's LEFT edge, not its center. `coordsToPoint()` below is
    // written to work correctly regardless of WHERE each axis's zero point
    // ends up, but only if `xAxis.numberToPoint(0)` and
    // `yAxis.numberToPoint(0)` are made to COINCIDE at one shared point —
    // otherwise the two axes wouldn't visually cross at the coordinate
    // system's actual (0,0), producing a correct-but-visually-wrong grid.
    // Fix: rotate the y-axis about ITS OWN zero point (not its bounding-box
    // center — those only coincide for a symmetric yRange), then shift both
    // axes so each one's zero point lands at world (0,0,0).
    this.yAxis.rotate(Math.PI / 2, { aboutPoint: this.yAxis.numberToPoint(0) });
    this.xAxis.shift([-this.xAxis.numberToPoint(0)[0], -this.xAxis.numberToPoint(0)[1], -this.xAxis.numberToPoint(0)[2]]);
    this.yAxis.shift([-this.yAxis.numberToPoint(0)[0], -this.yAxis.numberToPoint(0)[1], -this.yAxis.numberToPoint(0)[2]]);
    this.add(this.xAxis, this.yAxis);

    this.ready = Promise.all([this.xAxis.ready, this.yAxis.ready]).then(() => this);
  }

  /** Axis-label mobjects (`x`/`y` by default) placed near each tip — real
   *  Manim's `get_axis_labels()`. */
  getAxisLabels(xLabel = 'x', yLabel = 'y'): VGroup {
    const xl = new Text(xLabel, { fontSize: 36 });
    const yl = new Text(yLabel, { fontSize: 36 });
    const group = new VGroup();
    const ready = Promise.all([xl.ready, yl.ready]).then(() => {
      xl.nextTo(this.xAxis.getEnd(), [1, 0, 0], { buff: 0.15 });
      yl.nextTo(this.yAxis.getEnd(), [0, 1, 0], { buff: 0.15 });
      group.add(xl, yl);
    });
    (group as any).ready = ready;
    return group;
  }
}

export interface NumberPlaneOptions extends AxesOptions {
  backgroundLineStyle?: { strokeColor?: any; strokeWidth?: number; strokeOpacity?: number };
  faded?: boolean;
  fadedLineRatio?: number;
}

/** NumberPlane: Axes plus a full background grid of lines at every tick —
 *  real ManimCE `NumberPlane`. Grid lines are drawn UNDER the axes
 *  (added first) and are NOT `Transform`-matched individually (real Manim
 *  treats the whole grid as one visual unit too). */
export class NumberPlane extends Axes {
  backgroundLines: VGroup = new VGroup();
  fadedLines: VGroup = new VGroup();

  constructor(opts: NumberPlaneOptions = {}) {
    super(opts);
    const o = normalizeOptions(opts as any);
    const lineColor = o.backgroundLineStyle?.strokeColor ? resolveColor(o.backgroundLineStyle.strokeColor) : GREY;
    const lineWidth = o.backgroundLineStyle?.strokeWidth ?? 1;
    const lineOpacity = o.backgroundLineStyle?.strokeOpacity ?? 1;

    const xStep = this.xAxis.step;
    const yStep = this.yAxis.step;
    for (let x = this.xAxis.xMin; x <= this.xAxis.xMax + 1e-9; x += xStep) {
      const line = new Line({
        start: this.coordsToPoint(x, this.yAxis.xMin),
        end: this.coordsToPoint(x, this.yAxis.xMax),
        color: lineColor, strokeWidth: lineWidth,
      });
      line.style.strokeOpacity = lineOpacity;
      this.backgroundLines.add(line);
    }
    for (let y = this.yAxis.xMin; y <= this.yAxis.xMax + 1e-9; y += yStep) {
      const line = new Line({
        start: this.coordsToPoint(this.xAxis.xMin, y),
        end: this.coordsToPoint(this.xAxis.xMax, y),
        color: lineColor, strokeWidth: lineWidth,
      });
      line.style.strokeOpacity = lineOpacity;
      this.backgroundLines.add(line);
    }
    // Grid goes BEHIND the axes: insert at the front of the children array.
    this.children.unshift(this.backgroundLines);
    this.backgroundLines.parent = this;
  }
}

/** ComplexPlane: a NumberPlane whose `n2p`/`p2n`-style conversion works on
 *  a `{re, im}` complex pair instead of separate (x, y) — real ManimCE
 *  `ComplexPlane`. Grid + axes look identical to `NumberPlane`; the only
 *  behavioral difference is the complex-number convenience methods. */
export class ComplexPlane extends NumberPlane {
  /** Complex number -> world point (real Manim's `number_to_point` for
   *  ComplexPlane, aliased `n2p` there too — kept distinct here from
   *  NumberLine's own `n2p` by taking a complex pair instead of a scalar). */
  complexToPoint(z: { re: number; im: number } | number): Vec3 {
    const re = typeof z === 'number' ? z : z.re;
    const im = typeof z === 'number' ? 0 : z.im;
    return this.coordsToPoint(re, im);
  }
  c2pComplex(z: { re: number; im: number } | number): Vec3 { return this.complexToPoint(z); }

  /** World point -> complex number. */
  pointToComplex(p: Vec3): { re: number; im: number } {
    const [x, y] = this.pointToCoords(p);
    return { re: x, im: y };
  }
  p2cComplex(p: Vec3): { re: number; im: number } { return this.pointToComplex(p); }
}

export interface PolarPlaneOptions {
  radiusRange?: [number, number, number?];
  azimuthUnit?: 'degrees' | 'radians';
  azimuthStep?: number;
  size?: number;
  color?: any;
}

/** PolarPlane: concentric radius rings + angle spokes, `coordsToPoint`
 *  taking `(r, theta)` — real ManimCE `PolarPlane`. Built independently of
 *  `Axes` (polar has no meaningful x/y `NumberLine` pair), but still
 *  exposes `c2p(r, theta)`/`p2c(point)` so `plot()`-style helpers written
 *  against `CoordinateSystem` work by calling `coordsToPoint` directly
 *  (PolarPlane overrides it to interpret its two numbers as r/theta). */
export class PolarPlane extends VGroup {
  radiusMax: number;
  size: number;
  rings: VGroup = new VGroup();
  spokes: VGroup = new VGroup();

  constructor(opts: PolarPlaneOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    const [rMin, rMax, rStep] = o.radiusRange ?? [0, 4, 1];
    this.radiusMax = rMax;
    this.size = o.size ?? 3;
    const color = o.color ? resolveColor(o.color) : GREY;
    const step = rStep ?? 1;
    const azStep = o.azimuthStep ?? 12;

    for (let r = step; r <= rMax + 1e-9; r += step) {
      const ring = new Circle({ radius: (r / rMax) * this.size, color, strokeWidth: 1 });
      this.rings.add(ring);
    }
    for (let i = 0; i < azStep; i++) {
      const theta = (i / azStep) * Math.PI * 2;
      const spoke = new Line({
        start: [0, 0, 0],
        end: [this.size * Math.cos(theta), this.size * Math.sin(theta), 0],
        color, strokeWidth: 1,
      });
      this.spokes.add(spoke);
    }
    this.add(this.rings, this.spokes);
  }

  /** Polar (r, theta[radians]) -> world point. */
  coordsToPoint(r: number, theta: number): Vec3 {
    const scaled = (r / this.radiusMax) * this.size;
    return [scaled * Math.cos(theta), scaled * Math.sin(theta), 0];
  }
  c2p(r: number, theta: number): Vec3 { return this.coordsToPoint(r, theta); }

  pointToCoords(p: Vec3): [number, number] {
    const rWorld = Math.hypot(p[0], p[1]);
    const theta = Math.atan2(p[1], p[0]);
    return [(rWorld / this.size) * this.radiusMax, theta];
  }
  p2c(p: Vec3): [number, number] { return this.pointToCoords(p); }

  /** Polar plot r = f(theta) over [thetaMin, thetaMax] (real Manim's
   *  `PolarPlane.plot_polar_graph`). */
  plotPolarGraph(
    fn: (theta: number) => number,
    thetaRange: [number, number] = [0, Math.PI * 2],
    opts: { color?: any; strokeWidth?: number } = {}
  ): VMobject {
    const o = normalizeOptions(opts as any);
    const [t0, t1] = thetaRange;
    const n = 200;
    const pts: Vec3[] = [];
    for (let i = 0; i <= n; i++) {
      const theta = t0 + ((t1 - t0) * i) / n;
      pts.push(this.coordsToPoint(fn(theta), theta));
    }
    const curve = new VMobject();
    curve.setPointsSmoothly(pts);
    curve.style.stroke = resolveColor(o.color ?? BLUE);
    if (o.strokeWidth !== undefined) curve.style.strokeWidth = o.strokeWidth;
    return curve;
  }
}
