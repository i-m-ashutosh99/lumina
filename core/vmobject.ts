/**
 * Lumina — vmobject.ts
 * VMobject: cubic-Bézier vectorized mobject (doc 02 §A.2, doc 06 §5).
 *
 * points[] is a flat list of cubic control points, 4 per curve:
 *   [p0, h1, h2, p3, p0', h1', h2', p3', ...]
 * Subpaths are separated by degenerate markers (start == previous end + gap).
 */
import { Vec3, v, add, sub, mul, lerp, norm, dist } from '../math/vec';
import {
  cubicPoint, partialCubic, splitCubic, cornersToCubics, smoothToCubics,
} from '../math/bezier';
import { Mobject } from './mobject';
import { normalizeOptions } from './style';

export class VMobject extends Mobject {
  closed = false;

  constructor(opts?: any) {
    super(opts);
  }

  get nCurves(): number {
    return Math.floor(this.points.length / 4);
  }

  /** Anchor points (curve starts + final end). */
  getAnchors(): Vec3[] {
    const out: Vec3[] = [];
    for (let i = 0; i < this.points.length; i += 4) out.push(this.points[i]);
    if (this.closed && this.points.length) out.push(this.points[0]);
    return out;
  }

  getStart(): Vec3 {
    return this.points[0] ?? [0, 0, 0];
  }

  getEnd(): Vec3 {
    return this.points[this.points.length - 1] ?? [0, 0, 0];
  }

  getMidpoint(): Vec3 {
    return this.pointAt(0.5);
  }

  /** Point at normalized arc-parameter along the path (approx by curve index). */
  pointAt(t: number): Vec3 {
    const n = this.nCurves;
    if (n === 0) return this.points[0] ?? [0, 0, 0];
    const idx = Math.min(n - 1, Math.max(0, Math.floor(t * n)));
    const local = t * n - idx;
    const o = idx * 4;
    return cubicPoint(this.points[o], this.points[o + 1], this.points[o + 2], this.points[o + 3], local);
  }

  /** Tangent direction at normalized parameter. */
  tangentAt(t: number): Vec3 {
    const n = this.nCurves;
    if (n === 0) return [1, 0, 0];
    const idx = Math.min(n - 1, Math.max(0, Math.floor(t * n)));
    const local = t * n - idx;
    const o = idx * 4;
    const p0 = this.points[o], p1 = this.points[o + 1], p2 = this.points[o + 2], p3 = this.points[o + 3];
    const mt = 1 - local;
    return norm([
      3 * mt * mt * (p1[0] - p0[0]) + 6 * mt * local * (p2[0] - p1[0]) + 3 * local * local * (p3[0] - p2[0]),
      3 * mt * mt * (p1[1] - p0[1]) + 6 * mt * local * (p2[1] - p1[1]) + 3 * local * local * (p3[1] - p2[1]),
      3 * mt * mt * (p1[2] - p0[2]) + 6 * mt * local * (p2[2] - p1[2]) + 3 * local * local * (p3[2] - p2[2]),
    ]);
  }

  /** Sample the path as a polyline. */
  samplePath(n = 100): Vec3[] {
    return Array.from({ length: n }, (_, i) => this.pointAt(i / (n - 1)));
  }

  /* ---------------- point-set construction ---------------- */

  setPoints(points: Vec3[]): this {
    this.points = points.map((p) => v(p));
    return this;
  }

  /** From explicit cubics list. */
  setCubics(cubics: Vec3[]): this {
    this.points = cubics.map((p) => v(p));
    return this;
  }

  setPointsAsCorners(points: Vec3[], closed = this.closed): this {
    this.points = cornersToCubics(points.map((p) => v(p)), closed);
    return this;
  }

  setPointsSmoothly(points: Vec3[], closed = this.closed): this {
    this.points = smoothToCubics(points.map((p) => v(p)), closed);
    return this;
  }

  appendPoints(points: Vec3[]): this {
    this.points.push(...points.map((p) => v(p)));
    return this;
  }

  appendCubic(a: Vec3, h1: Vec3, h2: Vec3, b: Vec3): this {
    this.points.push(v(a), v(h1), v(h2), v(b));
    return this;
  }

  /* ---------------- Manim alignment protocol ---------------- */

  /** Same number of cubics as `other`, inserting straight cubics where needed. */
  insertNCurves(n: number): this {
    const current = this.nCurves;
    if (n <= current || current === 0) return this;
    // subdivide the longest curves
    const splits = n - current;
    const pts = [...this.points];
    const out: Vec3[] = [];
    for (let i = 0; i < current; i++) {
      const o = i * 4;
      out.push(pts[o], pts[o + 1], pts[o + 2], pts[o + 3]);
    }
    // rebuild with subdivisions distributed evenly over curve indices
    const cubics: Vec3[][] = [];
    for (let i = 0; i < current; i++) {
      cubics.push(pts.slice(i * 4, i * 4 + 4));
    }
    const result: Vec3[] = [];
    let inserts = splits;
    for (let i = 0; i < cubics.length; i++) {
      const extra = Math.min(inserts, Math.floor(splits * (i + 1) / cubics.length) - Math.floor(splits * i / cubics.length));
      let quad = cubics[i];
      for (let k = 0; k < extra; k++) {
        const { left, right } = splitCubic(quad[0], quad[1], quad[2], quad[3], 1 / (extra - k + 1));
        result.push(...left);
        quad = right;
        inserts--;
      }
      result.push(...quad);
    }
    this.points = result;
    return this;
  }

  /**
   * Align point structure with another VMobject so Transform lerps cleanly
   * (doc 06 §5 — the anti-scribble algorithm).
   */
  alignPoints(other: VMobject): this {
    let a = this as VMobject;
    let b = other;
    if (a.nCurves === 0 && b.nCurves > 0) {
      a.points = b.points.map(() => b.points[0].slice() as Vec3);
      return this;
    }
    if (b.nCurves === 0 && a.nCurves > 0) {
      return this;
    }
    if (a.nCurves < b.nCurves) {
      const aPts = [...a.points];
      const extra = b.nCurves - a.nCurves;
      const end = aPts.length ? aPts[aPts.length - 1] : [0, 0, 0] as Vec3;
      const start = aPts.length ? aPts[aPts.length - 4] : [0, 0, 0] as Vec3;
      for (let i = 0; i < extra; i++) {
        aPts.push(end, end, end, end);
      }
      a.points = aPts;
    }
    return this;
  }

  /** Match both counts by subdividing the smaller (preferred over padding). */
  alignPointsBidirectional(other: VMobject): [VMobject, VMobject] {
    const a = this.copy() as VMobject;
    const b = other.copy() as VMobject;
    const n = Math.max(a.nCurves, b.nCurves);
    a.insertNCurves(n);
    b.insertNCurves(n);
    return [a, b];
  }

  /* ---------------- partial path (Create / Uncreate core) ---------------- */

  /**
   * Become the portion of the path between normalized parameters a..b.
   * Implemented via de Casteljau (physical shortening, not lineDash — doc 08 §2.3).
   */
  pointwiseBecomePartial(vm: VMobject, a: number, b: number): this {
    const n = vm.nCurves;
    if (n === 0) { this.points = []; return this; }
    if (a <= 0 && b >= 1) {
      this.points = vm.points.map((p) => [...p] as Vec3);
      return this;
    }
    if (b <= a) { this.points = []; return this; }
    const startCurve = Math.floor(a * n);
    const endCurve = Math.min(n, Math.max(startCurve + 1, Math.ceil(b * n)));
    const out: Vec3[] = [];
    for (let i = startCurve; i < endCurve; i++) {
      const o = i * 4;
      const lo = Math.max(0, a * n - i);
      const hi = Math.min(1, b * n - i);
      const seg = partialCubic(vm.points[o], vm.points[o + 1], vm.points[o + 2], vm.points[o + 3], lo, hi);
      out.push(...seg);
    }
    this.points = out;
    return this;
  }

  /* ---------------- manipulation ---------------- */

  /** Interpolate all points toward another VMobject (Transform). */
  interpolatePoints(other: VMobject, alpha: number): this {
    const b = other as VMobject;
    if (this.points.length === b.points.length) {
      this.points = this.points.map((p, i) => lerp(p, b.points[i], alpha));
    } else {
      const n = Math.max(this.nCurves, b.nCurves);
      const a2 = this.copy() as VMobject;
      const b2 = b.copy() as VMobject;
      a2.insertNCurves(n);
      b2.insertNCurves(n);
      const na = a2.points, nb = b2.points;
      const len = Math.min(na.length, nb.length);
      this.points = Array.from({ length: len }, (_, i) =>
        lerp(na[i] ?? na[na.length - 1], nb[i] ?? nb[nb.length - 1], alpha)
      );
    }
    return this;
  }

  /** Apply R^3 → R^3 to every control point. */
  applyFunction(fn: (p: Vec3) => Vec3): this {
    this.applyToPoints(fn);
    return this;
  }

  /** Apply a 2D function ([x,y,z]) → [x',y',z'] (3b1b nonlinear transforms). */
  applyFunction2D(fn: (p: [number, number]) => [number, number]): this {
    this.applyToPoints((p) => {
      const [x, y] = fn([p[0], p[1]]);
      return [x, y, p[2]];
    });
    return this;
  }

  /** Subdivide curves before a nonlinear map (doc 02 GL prepare_for_nonlinear_transform). */
  prepareForNonlinearTransform(nCurves = 100): this {
    const sampled = this.samplePath(nCurves);
    const wasClosed = this.closed;
    this.setPointsSmoothly(sampled, wasClosed);
    return this;
  }

  makeSmooth(): this {
    const anchors = this.getAnchors();
    if (anchors.length > 2) this.setPointsSmoothly(anchors, this.closed);
    return this;
  }

  /** Approximate arc length. */
  getLength(): number {
    let len = 0;
    const pts = this.samplePath(this.nCurves * 8 + 8);
    for (let i = 1; i < pts.length; i++) len += dist(pts[i], pts[i - 1]);
    return len;
  }

  /** Dashed version (as real curves so Create works; doc 08 §2.3). */
  asDashed(dashLength = 0.1, dashedRatio = 0.5): VMobject {
    const total = this.getLength();
    const nDashes = Math.max(1, Math.floor(total / dashLength));
    const out = new VMobject();
    const cycle = 1 / nDashes;
    const on = cycle * dashedRatio;
    for (let i = 0; i < nDashes; i++) {
      const piece = new VMobject();
      piece.pointwiseBecomePartial(this, i * cycle, i * cycle + on);
      out.add(piece);
    }
    out.style = { ...this.style };
    return out;
  }

  copy(): this {
    return super.copy() as this;
  }
}

/** Degenerate point-as-mobject (Manim VectorizedPoint). */
export class VectorizedPoint extends VMobject {
  constructor(point: Vec3 = [0, 0, 0], opts?: any) {
    super(opts);
    this.points = [v(point), v(point), v(point), v(point)];
  }
}

/** Each cubic as its own submobject (doc 02 CurvesAsSubmobjects). */
export class CurvesAsSubmobjects extends VMobject {
  constructor(vm: VMobject) {
    super();
    this.isGroup = true;
    for (let i = 0; i < vm.nCurves; i++) {
      const c = new VMobject();
      c.setPoints(vm.points.slice(i * 4, i * 4 + 4));
      c.style = { ...vm.style };
      this.add(c);
    }
  }
}
