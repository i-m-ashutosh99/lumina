/**
 * Lumina — mobjects/fields/vector-field.ts
 * VectorField / ArrowVectorField / StreamLines / ComplexVectorField
 * (doc 02 §C "VectorField/ArrowVectorField/StreamLines", doc 07 §8,
 * doc 09 §5 ComplexVectorField, doc 13 audit gap G7).
 *
 * Real ManimCE's `VectorField` is the base class (color-by-magnitude,
 * opacity, `func: R^2/R^3 -> R^2/R^3`); `ArrowVectorField` draws a grid of
 * `Vector`s; `StreamLines` seeds particles and integrates their paths
 * through the field, optionally animating them flowing along the field
 * (`AnimatedStreamLines` in real Manim). Lumina reimplements all three
 * from scratch on the existing `Vector`/`VMobject`/`VGroup` primitives —
 * no new renderer support needed, everything here is plain 2D cubic-Bézier
 * geometry (doc 09 §15: "fields: none — own math", i.e. no vector-field
 * specific dependency, just the color/interpolation kernel already in
 * math/color.ts).
 *
 * SEEK-SAFETY (doc 06 §12 / timeline.ts's documented limitation): Lumina's
 * Scene is record-then-seek, so any animation that "integrates dt" must be
 * re-derivable from an arbitrary absolute time t, not from "how many frames
 * have played so far". `StreamLines.flowAnimation()` below follows the same
 * pattern the audit doc already established for physics (see doc 09 §9):
 * each streamline's *shape* is fully precomputed once (integrated ahead of
 * time via RK4, ignorant of wall-clock/frame timing), and the "flowing"
 * animation is a pure function of alpha — `pointwiseBecomePartial` sliding
 * a fixed-length highlighted window along the PRECOMPUTED path. No live
 * integration happens inside `interpolateMobject`, so `render(t)` is exactly
 * as pure as every other animation in this codebase.
 */
import { Vec3 } from '../../math/vec';
import { VGroup } from '../../core/group';
import { VMobject } from '../../core/vmobject';
import { Vector } from '../geometry/basic';
import { normalizeOptions } from '../../core/style';
import {
  ManimColor, resolveColor, interpolateColors, BLUE, GREEN, YELLOW, RED,
} from '../../math/color';
import { Animation } from '../../core/animation';
import { Random } from '../../math/rng';

export type Field2DFunc = (x: number, y: number) => [number, number] | Vec3;

/** Default 4-stop magnitude color scheme (real ManimCE's
 *  `VectorField`'s default `color_scheme`/`colors` — blue (slow) through
 *  yellow to red (fast)). */
export const DEFAULT_FIELD_COLORS: ManimColor[] = [
  resolveColor(BLUE), resolveColor(GREEN), resolveColor(YELLOW), resolveColor(RED),
];

export interface VectorFieldOptions {
  colors?: ManimColor[];
  /** Magnitude that maps to the *last* color stop; magnitudes are clamped
   *  to `[0, lengthFunc(maxNorm)]` before indexing into `colors` — mirrors
   *  real Manim's `min_color_scheme_value`/`max_color_scheme_value`. */
  minColorSchemeValue?: number;
  maxColorSchemeValue?: number;
  /** Reshape magnitude -> arrow length (real Manim `length_func`, default
   *  `lambda norm: 0.45 * sigmoid(norm)` so dense/fast fields don't overlap). */
  lengthFunc?: (norm: number) => number;
  opacity?: number;
}

/** Monotone, bounded-length default matching real Manim's `length_func`
 *  intent (arrow length grows with magnitude but saturates so a dense grid
 *  never overlaps): `0.9 * norm / (norm + 1)`. */
function saturatingLengthFunc(norm: number): number {
  return 0.9 * norm / (norm + 1);
}

/**
 * `VectorField` — abstract base holding the sampling function + color/
 * length-mapping config shared by `ArrowVectorField` and `StreamLines`
 * (real ManimCE `mobject.vector_field.VectorField`).
 */
export abstract class VectorField extends VGroup {
  func: Field2DFunc;
  colors: ManimColor[];
  minColorSchemeValue: number;
  maxColorSchemeValue: number;
  lengthFunc: (norm: number) => number;
  opacity: number;

  constructor(func: Field2DFunc, opts: VectorFieldOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    this.func = func;
    this.colors = o.colors ?? DEFAULT_FIELD_COLORS;
    this.minColorSchemeValue = o.minColorSchemeValue ?? 0;
    this.maxColorSchemeValue = o.maxColorSchemeValue ?? 2;
    this.lengthFunc = o.lengthFunc ?? saturatingLengthFunc;
    this.opacity = o.opacity ?? 1;
  }

  /** Sample the field at `(x, y)`, returning `[dx, dy]`. */
  sample(x: number, y: number): [number, number] {
    const r = this.func(x, y);
    return [r[0], r[1]];
  }

  /** Magnitude-to-color per the configured scheme (real Manim
   *  `VectorField.get_color_from_magnitude`). */
  colorForMagnitude(norm: number): ManimColor {
    const lo = this.minColorSchemeValue;
    const hi = this.maxColorSchemeValue;
    const t = hi > lo ? Math.max(0, Math.min(1, (norm - lo) / (hi - lo))) : 0;
    const n = this.colors.length;
    if (n === 1) return this.colors[0];
    const idx = Math.min(n - 2, Math.floor(t * (n - 1)));
    const local = t * (n - 1) - idx;
    return interpolateColors(this.colors[idx], this.colors[idx + 1], local);
  }
}

export interface ArrowVectorFieldOptions extends VectorFieldOptions {
  xRange?: [number, number, number?];
  yRange?: [number, number, number?];
  deltaX?: number;
  deltaY?: number;
  /** Extra uniform scale applied after `lengthFunc` (real Manim
   *  `vector_config`-level fudge factor for very sparse/dense grids). */
  vectorScale?: number;
}

/**
 * `ArrowVectorField` — a static grid of `Vector`s sampling `func` at every
 * `(x, y)` on `xRange x yRange` (step `deltaX`/`deltaY`), colored by
 * magnitude (real ManimCE `ArrowVectorField`).
 *
 * ```js
 * const field = new ArrowVectorField((x, y) => [-y, x], {
 *   xRange: [-4, 4, 1], yRange: [-3, 3, 1],
 * });
 * scene.add(field);
 * ```
 */
export class ArrowVectorField extends VectorField {
  vectors: Vector[] = [];

  constructor(func: Field2DFunc, opts: ArrowVectorFieldOptions = {}) {
    super(func, opts);
    const o = normalizeOptions(opts as any);
    const [x0, x1, xStep] = o.xRange ?? [-4, 4, 1];
    const [y0, y1, yStep] = o.yRange ?? [-4, 4, 1];
    const dx = o.deltaX ?? xStep ?? 1;
    const dy = o.deltaY ?? yStep ?? 1;
    const scale = o.vectorScale ?? 1;

    for (let x = x0; x <= x1 + 1e-9; x += dx) {
      for (let y = y0; y <= y1 + 1e-9; y += dy) {
        const [fx, fy] = this.sample(x, y);
        const norm = Math.hypot(fx, fy);
        const len = this.lengthFunc(norm) * scale;
        const dir: [number, number] = norm > 1e-9 ? [fx / norm, fy / norm] : [0, 0];
        const vec = new Vector({
          coords: [dir[0] * len, dir[1] * len, 0],
          origin: [x, y, 0],
          color: this.colorForMagnitude(norm),
        });
        vec.setOpacity(this.opacity);
        this.vectors.push(vec);
        this.add(vec);
      }
    }
  }

  /** Re-sample every arrow from a (possibly time-varying) field function —
   *  e.g. call from an updater bound to a `ValueTracker` for a field that
   *  changes over time. Rebuilds each Vector's direction/length/color in
   *  place, so it Transforms/interpolates cleanly across a seek. */
  updateField(func: Field2DFunc = this.func): void {
    this.func = func;
    let i = 0;
    for (let vi = 0; vi < this.vectors.length; vi++) {
      const vec = this.vectors[vi];
      const origin = vec.getStart();
      const [fx, fy] = this.sample(origin[0], origin[1]);
      const norm = Math.hypot(fx, fy);
      const len = this.lengthFunc(norm);
      const dir: [number, number] = norm > 1e-9 ? [fx / norm, fy / norm] : [0, 0];
      const fresh = new Vector({
        coords: [dir[0] * len, dir[1] * len, 0],
        origin,
        color: this.colorForMagnitude(norm),
      });
      vec.points = fresh.points;
      vec.style.stroke = fresh.style.stroke;
      i++;
    }
  }
}

/**
 * `ComplexVectorField` — `ArrowVectorField` for `f: C -> C`, sampled on the
 * real/imaginary plane (doc 09 §5 `ComplexVectorField`). `func` takes
 * `{re, im}` and returns `{re, im}`.
 *
 * ```js
 * const field = new ComplexVectorField((z) => ({ re: z.re*z.re - z.im*z.im, im: 2*z.re*z.im }));
 * ```
 */
export class ComplexVectorField extends ArrowVectorField {
  constructor(
    func: (z: { re: number; im: number }) => { re: number; im: number },
    opts: ArrowVectorFieldOptions = {}
  ) {
    super((x, y) => { const r = func({ re: x, im: y }); return [r.re, r.im]; }, opts);
  }
}

/* ====================================================================== */
/* Runge-Kutta 4 field-line integration (shared by StreamLines + future    */
/* physics-pack force-field visualizations)                                */
/* ====================================================================== */

function rk4Step(func: Field2DFunc, x: number, y: number, h: number): [number, number] {
  const f = (px: number, py: number) => { const r = func(px, py); return [r[0], r[1]] as [number, number]; };
  const [k1x, k1y] = f(x, y);
  const [k2x, k2y] = f(x + h / 2 * k1x, y + h / 2 * k1y);
  const [k3x, k3y] = f(x + h / 2 * k2x, y + h / 2 * k2y);
  const [k4x, k4y] = f(x + h * k3x, y + h * k3y);
  return [
    x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
    y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y),
  ];
}

/** Integrate one streamline forward (and, if `twoSided`, backward too) from
 *  a seed point until it leaves `[xRange]x[yRange]`, stalls (near-zero
 *  field), or hits `maxSteps` — real Manim `StreamLines.get_colored_stroke_
 *  points`-equivalent path construction, done once at construction time
 *  (not per-frame) so it is fully seek-safe. */
function integrateStreamline(
  field: VectorField,
  seed: [number, number],
  opts: { dt: number; maxSteps: number; xRange: [number, number]; yRange: [number, number]; twoSided: boolean }
): Vec3[] {
  const { dt, maxSteps, xRange, yRange, twoSided } = opts;
  const inBounds = (x: number, y: number) =>
    x >= xRange[0] - 1e-6 && x <= xRange[1] + 1e-6 && y >= yRange[0] - 1e-6 && y <= yRange[1] + 1e-6;

  const forward: Vec3[] = [[seed[0], seed[1], 0]];
  let [x, y] = seed;
  for (let i = 0; i < maxSteps; i++) {
    const [fx, fy] = field.sample(x, y);
    if (Math.hypot(fx, fy) < 1e-6) break;
    [x, y] = rk4Step(field.func, x, y, dt);
    if (!inBounds(x, y)) break;
    forward.push([x, y, 0]);
  }

  if (!twoSided) return forward;

  const backward: Vec3[] = [];
  [x, y] = seed;
  for (let i = 0; i < maxSteps; i++) {
    const [fx, fy] = field.sample(x, y);
    if (Math.hypot(fx, fy) < 1e-6) break;
    [x, y] = rk4Step(field.func, x, y, -dt);
    if (!inBounds(x, y)) break;
    backward.push([x, y, 0]);
  }
  backward.reverse();
  return [...backward, ...forward];
}

export interface StreamLinesOptions extends VectorFieldOptions {
  xRange?: [number, number];
  yRange?: [number, number];
  /** How many seed points to scatter (real Manim `StreamLines`'s
   *  `noise_factor`-jittered grid; Lumina uses a seeded RNG for
   *  reproducibility — same seed -> same streamlines every run). */
  strokeWidth?: number;
  virtualTime?: number;
  /** Integration step. Smaller = smoother/slower to build. */
  dt?: number;
  /** Max steps per direction per streamline. */
  maxAnchors?: number;
  /** Number of streamlines. */
  nLines?: number;
  /** Integrate both forward AND backward from each seed (default true,
   *  matches real Manim so lines don't all start at grid corners). */
  twoSided?: boolean;
  seed?: number;
}

/**
 * `StreamLines` — a set of curves following the field's flow, built once by
 * RK4-integrating from scattered seed points (real ManimCE `StreamLines`).
 * Colored per-point by local magnitude (a gradient along each curve, not
 * just a single flat color) via `VMobject`'s per-point style is not
 * supported by this engine (styles are per-mobject, not per-vertex) — so
 * each streamline instead gets ONE color, sampled at its seed point,
 * matching the simpler (but still useful) "color by starting speed" mode.
 *
 * `flowAnimation(opts)` (below) returns a seekable `Animation` — a fixed-
 * length highlighted "traveling window" that slides along each streamline's
 * PRECOMPUTED path as alpha goes 0 -> 1, looping `virtualTime` times, using
 * `pointwiseBecomePartial` so it stays a pure function of alpha (see file
 * header "SEEK-SAFETY").
 *
 * ```js
 * const lines = new StreamLines((x, y) => [-y, x], { xRange: [-4, 4], yRange: [-4, 4], nLines: 40 });
 * scene.add(lines);
 * scene.play(lines.flowAnimation({ runTime: 4 }));
 * ```
 */
export class StreamLines extends VectorField {
  lines: VMobject[] = [];
  virtualTime: number;
  protected _dt: number;
  protected _maxAnchors: number;

  constructor(func: Field2DFunc, opts: StreamLinesOptions = {}) {
    super(func, opts);
    const o = normalizeOptions(opts as any);
    const xRange: [number, number] = o.xRange ?? [-4, 4];
    const yRange: [number, number] = o.yRange ?? [-4, 4];
    const dt = o.dt ?? 0.05;
    const maxAnchors = o.maxAnchors ?? 60;
    const nLines = o.nLines ?? 30;
    const twoSided = o.twoSided ?? true;
    const strokeWidth = o.strokeWidth ?? 2;
    this.virtualTime = o.virtualTime ?? 1;
    this._dt = dt;
    this._maxAnchors = maxAnchors;

    const rng = new Random(o.seed ?? 7);
    for (let i = 0; i < nLines; i++) {
      const sx = rng.range(xRange[0], xRange[1]);
      const sy = rng.range(yRange[0], yRange[1]);
      const pts = integrateStreamline(this, [sx, sy], { dt, maxSteps: maxAnchors, xRange, yRange, twoSided });
      if (pts.length < 2) continue;
      const line = new VMobject();
      line.setPointsSmoothly(pts, false);
      const [fx, fy] = this.sample(sx, sy);
      line.style.stroke = this.colorForMagnitude(Math.hypot(fx, fy));
      line.style.strokeWidth = strokeWidth;
      line.style.fillOpacity = 0;
      line.setOpacity(this.opacity);
      this.lines.push(line);
      this.add(line);
    }
  }

  /**
   * Returns a seekable `Animation` that reveals each streamline as a
   * traveling "comet" window (real Manim's `AnimatedStreamLines` flowing
   * effect), looping `virtualTime` times over `runTime`. Pure function of
   * alpha — see file header "SEEK-SAFETY": every streamline's full point
   * path was already integrated in the constructor, this only slides a
   * `pointwiseBecomePartial(start,end)` window per line, per frame.
   */
  flowAnimation(opts: { runTime?: number; windowSize?: number } = {}): Animation {
    const self = this;
    const windowSize = opts.windowSize ?? 0.25;
    const fullLines = this.lines.map((l) => l.copy() as VMobject);
    class StreamFlow extends Animation {
      constructor() {
        super(null, { runTime: opts.runTime ?? 4 });
      }
      interpolateMobject(alpha: number): void {
        const cyclePos = (alpha * self.virtualTime) % 1;
        for (let i = 0; i < self.lines.length; i++) {
          const line = self.lines[i];
          const full = fullLines[i];
          // Stagger each line's phase slightly by index so they don't all
          // pulse in lockstep (purely a function of i and alpha -> seek-safe).
          const phase = (cyclePos + (i / Math.max(1, self.lines.length)) * 0.37) % 1;
          const lo = Math.max(0, phase - windowSize);
          const hi = Math.min(1, phase);
          if (hi <= lo) { line.points = []; continue; }
          line.pointwiseBecomePartial(full, lo, hi);
        }
      }
      finish(): void { this.apply(1); }
    }
    return new StreamFlow();
  }
}
