/**
 * Lumina — mobjects/boolean/boolean-ops.ts
 * Union / Intersection / Difference / Exclusion (doc 05 §5, doc 09 §15
 * "boolean ops (core phase 2) — path-boolean JS or WASM pathops").
 *
 * Real ManimCE implements these via the `pathops` Python binding (Skia's
 * exact curve-aware boolean ops). No browser-native equivalent exists, so
 * Lumina follows the same pragmatic path most JS vector tools take:
 * sample each closed VMobject subpath to a fine polygon, run exact
 * polygon-polygon boolean ops (`polygon-clipping`, a JS/WASM-free port of
 * the Martinez-Rueda algorithm), then rebuild a VMobject whose points are
 * straight-line ("corner") cubics through the result rings. This is
 * visually indistinguishable from curve-exact ops once the sampling
 * resolution (`segmentsPerCurve`) is reasonably high, and — critically —
 * the *result* is a normal VMobject, so it can still be `Transform`ed,
 * `Create`d, colored, etc. like any other shape.
 */
import * as pc from 'polygon-clipping';
import { Vec3 } from '../../math/vec';
import { cornersToCubics } from '../../math/bezier';
import { VMobject } from '../../core/vmobject';
import { normalizeOptions } from '../../core/style';

export interface BooleanOpOptions {
  /** Bézier→polygon sampling density per cubic curve. Higher = smoother
   *  but slower boolean-op input. Default 16. */
  segmentsPerCurve?: number;
  color?: any;
  [key: string]: any;
}

/** Sample every closed subpath of a VMobject into polygon-clipping's
 *  `Polygon` shape: an array of rings, each ring an array of [x, y] pairs
 *  (outer ring only — Lumina's VMobjects don't track hole winding, so each
 *  subpath becomes its own single-ring polygon; polygon-clipping's union
 *  step correctly derives holes from overlapping opposite-wound rings only
 *  if wound oppositely, so authors relying on a shape-with-a-hole as INPUT
 *  should pre-combine via `Difference` first — same authoring pattern as
 *  real ManimCE's pathops booleans). */
function vmobjectToPolygon(vm: VMobject, segmentsPerCurve: number): pc.Polygon {
  const rings: pc.Ring[] = [];
  const n = vm.nCurves;
  if (n === 0) return [];
  // Group cubics into contiguous subpaths (a new subpath starts whenever
  // the current cubic's p0 doesn't match the previous cubic's p3 — same
  // "degenerate marker" convention documented in vmobject.ts's header).
  let current: Vec3[] = [];
  const flushRing = () => {
    if (current.length >= 3) {
      const ring: pc.Ring = current.map((p) => [p[0], p[1]] as pc.Pair);
      ring.push(ring[0]); // polygon-clipping rings must be explicitly closed
      rings.push(ring);
    }
    current = [];
  };
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const p0 = vm.points[o], p1 = vm.points[o + 1], p2 = vm.points[o + 2], p3 = vm.points[o + 3];
    if (current.length > 0) {
      const last = current[current.length - 1];
      const gap = Math.hypot(p0[0] - last[0], p0[1] - last[1]);
      if (gap > 1e-6) flushRing();
    }
    if (current.length === 0) current.push(p0);
    for (let k = 1; k <= segmentsPerCurve; k++) {
      const t = k / segmentsPerCurve;
      const mt = 1 - t;
      const x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0];
      const y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1];
      current.push([x, y, 0]);
    }
  }
  flushRing();
  return rings;
}

/** Rebuild a VMobject from a polygon-clipping `MultiPolygon` result. Each
 *  ring becomes a closed straight-line ("corner") subpath — see file
 *  header for the curve-fidelity tradeoff. */
function multiPolygonToVMobject(mp: pc.MultiPolygon, opts: BooleanOpOptions = {}): VMobject {
  const out = new VMobject(opts);
  out.closed = true;
  const allPoints: Vec3[] = [];
  for (const polygon of mp) {
    for (const ring of polygon) {
      if (ring.length < 4) continue; // needs >=3 distinct + closing point
      const pts: Vec3[] = ring.slice(0, -1).map(([x, y]) => [x, y, 0] as Vec3);
      const cubics = cornersToCubics(pts, true);
      allPoints.push(...cubics);
    }
  }
  out.points = allPoints;
  return out;
}

function toPolygons(mobs: VMobject[], segmentsPerCurve: number): pc.Polygon[] {
  const polys: pc.Polygon[] = [];
  for (const m of mobs) {
    for (const leaf of m.family()) {
      if (leaf instanceof VMobject && leaf.nCurves > 0) {
        const p = vmobjectToPolygon(leaf, segmentsPerCurve);
        if (p.length) polys.push(p);
      }
    }
  }
  return polys;
}

/**
 * `Union(...mobjects)` — real ManimCE `Union(*vmobjects, **kwargs)`.
 * Merges all input shapes' filled regions into one VMobject.
 */
export class Union extends VMobject {
  constructor(mobs: VMobject[], opts: BooleanOpOptions = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const segs = o.segmentsPerCurve ?? 16;
    const polys = toPolygons(mobs, segs);
    if (polys.length === 0) return;
    const result = polys.length === 1 ? [polys[0]] as pc.MultiPolygon : pc.union(polys[0], ...polys.slice(1));
    this.become(multiPolygonToVMobject(result, opts));
  }
}

/**
 * `Intersection(...mobjects)` — real ManimCE `Intersection(*vmobjects)`.
 * The region common to ALL input shapes.
 */
export class Intersection extends VMobject {
  constructor(mobs: VMobject[], opts: BooleanOpOptions = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const segs = o.segmentsPerCurve ?? 16;
    const polys = toPolygons(mobs, segs);
    if (polys.length < 2) {
      if (polys.length === 1) this.become(multiPolygonToVMobject([polys[0]], opts));
      return;
    }
    const result = pc.intersection(polys[0], ...polys.slice(1));
    this.become(multiPolygonToVMobject(result, opts));
  }
}

/**
 * `Difference(a, b)` — real ManimCE `Difference(subject, clip)`. Region of
 * `a` with `b`'s region removed. Unlike Union/Intersection this is NOT
 * commutative and (unlike real Manim's variadic form) Lumina keeps it
 * strictly binary for clarity — chain calls for `a - b - c`.
 */
export class Difference extends VMobject {
  constructor(a: VMobject, b: VMobject, opts: BooleanOpOptions = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const segs = o.segmentsPerCurve ?? 16;
    const [pa] = toPolygons([a], segs);
    const [pb] = toPolygons([b], segs);
    if (!pa) return;
    const result = pb ? pc.difference(pa, pb) : [pa] as pc.MultiPolygon;
    this.become(multiPolygonToVMobject(result, opts));
  }
}

/**
 * `Exclusion(a, b)` — real ManimCE `Exclusion(*vmobjects)` (symmetric
 * difference / XOR): everything covered by exactly one of the two shapes.
 */
export class Exclusion extends VMobject {
  constructor(mobs: VMobject[], opts: BooleanOpOptions = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const segs = o.segmentsPerCurve ?? 16;
    const polys = toPolygons(mobs, segs);
    if (polys.length === 0) return;
    if (polys.length === 1) { this.become(multiPolygonToVMobject([polys[0]], opts)); return; }
    const result = pc.xor(polys[0], ...polys.slice(1));
    this.become(multiPolygonToVMobject(result, opts));
  }
}
