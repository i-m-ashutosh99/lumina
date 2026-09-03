/**
 * Lumina — mobjects/graphing/number-line.ts
 * NumberLine / UnitInterval (doc 07 §8; Phase 2 §4.3 "graphing" remainder).
 */
import { Vec3, v, add, sub, mul, norm, dot } from '../../math/vec';
import { VGroup } from '../../core/group';
import { normalizeOptions } from '../../core/style';
import { resolveColor } from '../../math/color';
import { Line, Arrow } from '../geometry/basic';
import { DecimalNumber } from '../text/text';

export interface NumberLineOptions {
  xRange?: [number, number, number?]; // [min, max, step]
  x_range?: [number, number, number?];
  length?: number;
  unitSize?: number;
  includeTicks?: boolean;
  includeNumbers?: boolean;
  includeTip?: boolean;
  numbersToInclude?: number[];
  decimalNumberConfig?: { numDecimalPlaces?: number };
  rotation?: number; // radians, applied after horizontal construction
  color?: any;
  scaling?: 'linear' | 'log';
  tickSize?: number;
  labelDirection?: Vec3;
}

/**
 * A straight number line laid out along +x locally, then optionally
 * rotated (real Manim's `Axes` rotates a horizontal copy 90° for the
 * y-axis). Coordinate conversion mirrors real Manim's `NumberLine`:
 * `number_to_point` interpolates between the *current* endpoints of the
 * underlying `Line` (so it stays correct across any later shift/rotate),
 * and `point_to_number` projects onto the line's current unit vector.
 */
export class NumberLine extends VGroup {
  xMin: number;
  xMax: number;
  step: number;
  unitSize: number;
  scaling: 'linear' | 'log';
  line: Line;
  ticks: VGroup = new VGroup();
  numberLabels: VGroup = new VGroup();
  tip: Arrow | null = null;
  ready: Promise<this>;

  constructor(opts: NumberLineOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    const range = o.xRange ?? [-8, 8, 1];
    this.xMin = range[0];
    this.xMax = range[1];
    this.step = range[2] ?? 1;
    this.scaling = o.scaling ?? 'linear';
    const scaledSpan = this.applyScale(this.xMax) - this.applyScale(this.xMin) || 1;
    const length = o.length ?? (this.xMax - this.xMin);
    this.unitSize = o.unitSize ?? length / scaledSpan;
    const color = o.color ? resolveColor(o.color) : '#FFFFFF';

    const p0: Vec3 = [-((this.applyScale(this.xMax) - this.applyScale(this.xMin)) * this.unitSize) / 2, 0, 0];
    const p1: Vec3 = [((this.applyScale(this.xMax) - this.applyScale(this.xMin)) * this.unitSize) / 2, 0, 0];
    this.line = new Line({ start: p0, end: p1, color });
    this.add(this.line);

    const tickSize = o.tickSize ?? 0.1;
    const values = o.numbersToInclude ?? this.defaultTickValues();
    if (o.includeTicks ?? true) {
      for (const x of values) {
        const p = this.localPointForValue(x, p0, p1);
        const tick = new Line({ start: [p[0], p[1] - tickSize / 2, 0], end: [p[0], p[1] + tickSize / 2, 0], color });
        this.ticks.add(tick);
      }
      this.add(this.ticks);
    }

    if (o.includeTip) {
      const dir = norm(sub(p1, p0));
      this.tip = new Arrow({ start: sub(p1, mul(dir, 0.3)), end: add(p1, mul(dir, 1e-3)), color });
      this.add(this.tip);
    }

    if (o.rotation) this.rotate(o.rotation, { aboutPoint: this.getCenter() });

    let readyP: Promise<any> = Promise.resolve();
    if (o.includeNumbers) {
      const dp = o.decimalNumberConfig?.numDecimalPlaces ?? 0;
      const labelDir: Vec3 = v(o.labelDirection ?? [0, -1, 0]);
      const labels = values.map((x) => ({ x, label: new DecimalNumber(x, { numDecimalPlaces: dp, fontSize: 24, color }) }));
      readyP = Promise.all(labels.map((l) => l.label.ready)).then(() => {
        for (const { x, label } of labels) {
          const p = this.numberToPoint(x);
          label.moveTo(add(p, mul(labelDir, 0.35)));
          this.numberLabels.add(label);
        }
        this.add(this.numberLabels);
      });
    }
    this.ready = readyP.then(() => this);
  }

  private applyScale(x: number): number {
    return this.scaling === 'log' ? Math.log10(Math.max(x, 1e-9)) : x;
  }

  private defaultTickValues(): number[] {
    const out: number[] = [];
    for (let x = this.xMin; x <= this.xMax + 1e-9; x += this.step) out.push(Math.round(x * 1e6) / 1e6);
    return out;
  }

  private localPointForValue(x: number, p0: Vec3, p1: Vec3): Vec3 {
    const span = this.applyScale(this.xMax) - this.applyScale(this.xMin) || 1;
    const alpha = (this.applyScale(x) - this.applyScale(this.xMin)) / span;
    return [p0[0] + (p1[0] - p0[0]) * alpha, p0[1] + (p1[1] - p0[1]) * alpha, p0[2] + (p1[2] - p0[2]) * alpha];
  }

  /** World point for value `x` — interpolates the line's CURRENT endpoints
   *  (real Manim `number_to_point` / `n2p`), so it stays correct after any
   *  later shift/rotate/scale of this NumberLine. */
  numberToPoint(x: number): Vec3 {
    const start = this.line.getStart();
    const end = this.line.getEnd();
    const span = this.applyScale(this.xMax) - this.applyScale(this.xMin) || 1;
    const alpha = (this.applyScale(x) - this.applyScale(this.xMin)) / span;
    return [
      start[0] + (end[0] - start[0]) * alpha,
      start[1] + (end[1] - start[1]) * alpha,
      start[2] + (end[2] - start[2]) * alpha,
    ];
  }
  n2p(x: number): Vec3 { return this.numberToPoint(x); }

  /** World point -> value (`point_to_number` / `p2n`), projecting onto the
   *  line's current unit vector so it works after rotation/shift. */
  pointToNumber(p: Vec3): number {
    const start = this.line.getStart();
    const end = this.line.getEnd();
    const vec = sub(end, start);
    const denom = dot(vec, vec) || 1e-12;
    const alpha = dot(sub(p, start), vec) / denom;
    const scaled = this.applyScale(this.xMin) + alpha * (this.applyScale(this.xMax) - this.applyScale(this.xMin));
    return this.scaling === 'log' ? Math.pow(10, scaled) : scaled;
  }
  p2n(p: Vec3): number { return this.pointToNumber(p); }
}

/** NumberLine over [0, 1] with 0.1 ticks (real Manim `UnitInterval`). */
export class UnitInterval extends NumberLine {
  constructor(opts: NumberLineOptions = {}) {
    super({ xRange: [0, 1, 0.1], ...opts });
  }
}
