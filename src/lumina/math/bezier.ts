/**
 * Lumina — bezier.ts
 * Cubic Bézier kernel: evaluation, arc-length, partial extraction
 * (de Casteljau), resampling, smoothing. This is the geometric heart of
 * VMobject (doc 02 §A.2).
 */
import { Vec3, v, lerp } from './vec';

export type Points = Vec3[]; // flat list; cubics consume 4 at a time

/** Point on a single cubic at parameter t. */
export function cubicPoint(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

/** Sub-cubic of [0..t] and [t..1] via de Casteljau; returns two cubics (8 pts). */
export function splitCubic(
  p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3,
  t: number
): { left: [Vec3, Vec3, Vec3, Vec3]; right: [Vec3, Vec3, Vec3, Vec3] } {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const f = lerp(d, e, t);
  return { left: [p0, a, d, f], right: [f, e, c, p3] };
}

/** Cubic for parameter range [a, b] of the unit interval. */
export function partialCubic(
  p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3,
  a: number, b: number
): [Vec3, Vec3, Vec3, Vec3] {
  const start = a <= 0 ? [p0, p1, p2, p3] as [Vec3, Vec3, Vec3, Vec3] : splitCubic(p0, p1, p2, p3, a).right;
  return b >= 1 ? start : splitCubic(start[0], start[1], start[2], start[3], (b - a) / (1 - a)).left;
}

export function cubicTangent(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const mt = 1 - t;
  const dx =
    3 * mt * mt * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy =
    3 * mt * mt * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  const dz =
    3 * mt * mt * (p1[2] - p0[2]) + 6 * mt * t * (p2[2] - p1[2]) + 3 * t * t * (p3[2] - p2[2]);
  return [dx, dy, dz];
}

/** Approximate arc length of one cubic (Gauss–Legendre 5-point). */
export function cubicLength(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, samples = 16): number {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const pt = cubicPoint(p0, p1, p2, p3, i / samples);
    len += Math.hypot(pt[0] - prev[0], pt[1] - prev[1], pt[2] - prev[2]);
    prev = pt;
  }
  return len;
}

/** Evenly resample a point list (polyline) into n points. */
export function resamplePolyline(points: Vec3[], n: number): Vec3[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array(n).fill(points[0]);
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
      points[i][2] - points[i - 1][2]
    );
    segLens.push(l);
    total += l;
  }
  const out: Vec3[] = [];
  let seg = 0;
  let segAcc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (seg < segLens.length - 1 && segAcc + segLens[seg] < target) {
      segAcc += segLens[seg];
      seg++;
    }
    const t = segLens[seg] > 0 ? (target - segAcc) / segLens[seg] : 0;
    const a = points[seg];
    const b = points[seg + 1] ?? points[seg];
    out.push(lerp(a, b, t));
  }
  return out;
}

/** Convert a polyline into cubics with straight handles. */
export function cornersToCubics(points: Vec3[], closed = false): Vec3[] {
  const out: Vec3[] = [];
  const pts = closed && points.length > 1 ? [...points, points[0]] : points;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    out.push(a, [(a[0] + b[0]) / 3, (a[1] + b[1]) / 3, 0], [(2 * a[0] + b[0]) / 3, (2 * a[1] + b[1]) / 3, 0], b);
  }
  return out;
}

/** Catmull-Rom → cubic Bézier conversion for smooth curves through points. */
export function smoothToCubics(points: Vec3[], closed = false): Vec3[] {
  const n = points.length;
  if (n < 3) return cornersToCubics(points, closed);
  const out: Vec3[] = [];
  const at = (i: number): Vec3 => {
    if (closed) return points[(i + n) % n];
    return points[Math.min(n - 1, Math.max(0, i))];
  };
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const h1: Vec3 = [
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p1[2] + (p2[2] - p0[2]) / 6,
    ];
    const h2: Vec3 = [
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[2] - (p3[2] - p1[2]) / 6,
    ];
    out.push(p1, h1, h2, p2);
  }
  return out;
}

/** Circle-arc approximation as n cubics. */
export function arcToCubics(
  radius = 1,
  startAngle = 0,
  angle = Math.PI * 2,
  center: Vec3 = [0, 0, 0],
  nCurves?: number
): Vec3[] {
  const twoPi = Math.PI * 2;
  if (Math.abs(angle - twoPi) < 1e-9) {
    // full circle: 8 cubics, avoid zero-length seam
    const n = 8;
    const out: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * twoPi;
      const a1 = ((i + 1) / n) * twoPi;
      out.push(...arcSegment(center, radius, a0, a1));
    }
    return out;
  }
  const n = Math.max(1, nCurves ?? Math.ceil(Math.abs(angle) / (Math.PI / 4)));
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = startAngle + (angle * i) / n;
    const a1 = startAngle + (angle * (i + 1)) / n;
    out.push(...arcSegment(center, radius, a0, a1));
  }
  return out;
}

function arcSegment(center: Vec3, radius: number, a0: number, a1: number): [Vec3, Vec3, Vec3, Vec3] {
  const k = (4 / 3) * Math.tan((a1 - a0) / 4);
  const p = (a: number): Vec3 => [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a), center[2]];
  const t0 = [-Math.sin(a0), Math.cos(a0), 0] as Vec3;
  const t1 = [-Math.sin(a1), Math.cos(a1), 0] as Vec3;
  const A = p(a0);
  const B = p(a1);
  const h1: Vec3 = [A[0] + k * radius * t0[0], A[1] + k * radius * t0[1], A[2]];
  const h2: Vec3 = [B[0] - k * radius * t1[0], B[1] - k * radius * t1[1], B[2]];
  return [A, h1, h2, B];
}

/** Sample an implicit function F(x, y) = 0 contour with marching squares. */
export function marchingSquares(
  F: (x: number, y: number) => number,
  xMin: number, xMax: number, yMin: number, yMax: number,
  step: number
): Vec3[][] {
  const contours: Vec3[][] = [];
  let prevRow: { y: number; vals: number[] } | null = null;
  const rows: { y: number; vals: number[] }[] = [];
  for (let y = yMin; y <= yMax + step / 2; y += step) {
    const vals: number[] = [];
    for (let x = xMin; x <= xMax + step / 2; x += step) vals.push(F(x, y));
    rows.push({ y, vals });
  }
  // build small line segments per cell, then chain them greedily
  const segs: [Vec3, Vec3][] = [];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < rows[r].vals.length - 1; c++) {
      const x0 = xMin + c * step;
      const y0 = rows[r].y;
      const f00 = rows[r].vals[c], f10 = rows[r].vals[c + 1];
      const f01 = rows[r + 1].vals[c], f11 = rows[r + 1].vals[c + 1];
      const pts: Vec3[] = [];
      const lerpPt = (fx0: number, fx1: number, X: number, Y: number, horizontal: boolean): Vec3 => {
        const t = fx0 / (fx0 - fx1 || 1e-12);
        return horizontal ? [X + t * step, Y, 0] : [X, Y + t * step, 0];
      };
      // bottom edge
      if ((f00 < 0) !== (f10 < 0)) pts.push(lerpPt(f00, f10, x0, y0, true));
      // right edge
      if ((f10 < 0) !== (f11 < 0)) pts.push(lerpPt(f10, f11, x0 + step, y0, false));
      // top edge
      if ((f01 < 0) !== (f11 < 0)) pts.push(lerpPt(f01, f11, x0, rows[r + 1].y, true));
      // left edge
      if ((f00 < 0) !== (f01 < 0)) pts.push(lerpPt(f00, f01, x0, y0, false));
      if (pts.length === 2) segs.push([pts[0], pts[1]]);
      else if (pts.length === 4) {
        segs.push([pts[0], pts[1]]);
        segs.push([pts[2], pts[3]]);
      }
    }
  }
  // chain segments into polylines
  const used = new Array(segs.length).fill(false);
  const key = (p: Vec3) => `${p[0].toFixed(4)}_${p[1].toFixed(4)}`;
  const map = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
  });
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const line: Vec3[] = [segs[i][0], segs[i][1]];
    // extend forward
    for (let guard = 0; guard < segs.length; guard++) {
      const k = key(line[line.length - 1]);
      const cands = (map.get(k) ?? []).filter((j) => !used[j]);
      if (!cands.length) break;
      const j = cands[0];
      used[j] = true;
      const [a, b] = segs[j];
      line.push(key(a) === k ? b : a);
    }
    // extend backward
    for (let guard = 0; guard < segs.length; guard++) {
      const k = key(line[0]);
      const cands = (map.get(k) ?? []).filter((j) => !used[j]);
      if (!cands.length) break;
      const j = cands[0];
      used[j] = true;
      const [a, b] = segs[j];
      line.unshift(key(a) === k ? b : a);
    }
    if (line.length >= 2) contours.push(line);
  }
  return contours;
}
