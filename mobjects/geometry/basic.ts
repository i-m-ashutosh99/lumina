/**
 * Lumina — mobjects/geometry/basic.ts
 * Core 2D geometry: Circle, Arc family, Line/Arrow family, polygons.
 * All built from cubic Béziers so every shape can Transform/Create.
 */
import { Vec3, v, add, sub, mul, norm, lerp } from '../../math/vec';
import { arcToCubics, cornersToCubics } from '../../math/bezier';
import { VMobject } from '../../core/vmobject';
import { VGroup } from '../../core/group';
import { normalizeOptions } from '../../core/style';
import { ORIGIN, PI, TAU } from '../../math/constants';
import { resolveColor, GREEN, YELLOW } from '../../math/color';

/* ---------------- circle / arc ---------------- */

export class Arc extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    this.build(
      o.radius ?? 1,
      o.startAngle ?? 0,
      o.angle ?? TAU / 2,
      o.arcCenter ? v(o.arcCenter) : [0, 0, 0]
    );
  }
  protected build(radius: number, startAngle: number, angle: number, center: Vec3) {
    this.points = arcToCubics(radius, startAngle, angle, center);
    this.closed = false;
  }
  pointAtAngle(a: number): Vec3 {
    const c = this.arcCenter ?? [0, 0, 0];
    return [c[0] + this.radius * Math.cos(a), c[1] + this.radius * Math.sin(a), 0];
  }
  radius = 1;
  arcCenter: Vec3 | null = null;
}

export class Circle extends Arc {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super({ ...opts, startAngle: 0, angle: TAU, arcCenter: o.arcCenter ?? ORIGIN });
    this.radius = o.radius ?? 1;
    this.arcCenter = v(o.arcCenter ?? ORIGIN);
    this.closed = true;
    // default fill behavior: Manim Circle has stroke only unless fill_opacity
  }
  /** Circle that surrounds a mobject. */
  surround(m: VMobject, dim: 0 | 1 | 2 = 0, stretch = false): this {
    this.moveTo(m.getCenter());
    const r = m.extent(dim as any) + (0.25);
    this.scaleTo?.(r);
    return this;
  }
  scaleTo(r: number) {
    this.scale(r / (this.radius || 1), { aboutPoint: this.getCenter() });
    this.radius = r;
  }
  static fromThreePoints(a: Vec3, b: Vec3, c: Vec3, opts?: any): Circle {
    const D = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / D;
    const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / D;
    const center: Vec3 = [ux, uy, 0];
    const r = Math.hypot(a[0] - ux, a[1] - uy);
    return new Circle({ ...opts, radius: r, arcCenter: center });
  }
}

export class Dot extends Circle {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super({ radius: 0.08, color: '#FFFFFF', ...opts, point: o.point });
    const p = v(o.point ?? ORIGIN);
    this.moveTo(p);
    this.style.fill = resolveColor(o.color ?? '#FFFFFF');
    this.style.fillOpacity = 1;
  }
}

export class AnnotationDot extends Dot {
  constructor(opts: any = {}) {
    super({ radius: 0.08, ...opts });
  }
}

/**
 * Late-bound Text constructor (avoids a hard ESM import cycle between
 * geometry/basic.ts and mobjects/text/text.ts). text.ts calls
 * `registerTextCtor(Text)` at module load; any consumer that needs a label
 * must import from 'mobjects/text/text' (or the barrel) somewhere in the
 * app so that registration has run before LabeledDot is constructed.
 */
let TextCtor: (new (s: string, opts?: any) => VMobject) | null = null;
export function registerTextCtor(ctor: new (s: string, opts?: any) => VMobject): void {
  TextCtor = ctor;
}

export class LabeledDot extends VGroup {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super();
    const dot = new Dot({ point: o.point, radius: o.radius, color: o.color });
    this.add(dot);
    if (o.label) {
      if (!TextCtor) throw new Error('LabeledDot requires the text module to be loaded (import lumina/mobjects/text/text.ts, or the lumina barrel, before constructing a LabeledDot with a label).');
      const label = new TextCtor(String(o.label), { fontSize: 0.25 * 48 });
      label.moveTo(dot.getCenter());
      this.add(label);
    }
  }
}

export class Ellipse extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const w = o.width ?? 3;
    const h = o.height ?? 1.5;
    this.points = arcToCubics(1, 0, TAU).map((p) => [p[0] * w / 2, p[1] * h / 2, p[2]] as Vec3);
    this.closed = true;
  }
}

export class ArcBetweenPoints extends Arc {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const start = v(o.start ?? ORIGIN);
    const end = v(o.end ?? [1, 0, 0]);
    const angle = o.angle ?? TAU / 4;
    const chord = sub(end, start);
    const chordLen = Math.hypot(chord[0], chord[1]);
    const radius = chordLen / (2 * Math.sin(Math.abs(angle) / 2)) || chordLen / 2;
    const mid = mul(add(start, end), 0.5);
    const perp: Vec3 = norm([-chord[1], chord[0], 0]);
    const apothem = Math.sqrt(Math.max(0, radius * radius - (chordLen / 2) ** 2));
    const center = add(mid, mul(perp, angle > 0 ? -apothem : apothem));
    const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
    super({ ...opts, radius, startAngle, angle, arcCenter: center });
  }
}

export class Sector extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const radius = o.radius ?? 1;
    const startAngle = o.startAngle ?? 0;
    const angle = o.angle ?? TAU / 4;
    const center = v(o.arcCenter ?? ORIGIN);
    const arc = arcToCubics(radius, startAngle, angle, center);
    const arcEnd: Vec3 = [center[0] + radius * Math.cos(startAngle + angle), center[1] + radius * Math.sin(startAngle + angle), 0];
    const pts: Vec3[] = [center, center, center, arc[0]];
    pts.push(...arc);
    pts.push(arcEnd, arcEnd, arcEnd, center);
    this.points = pts;
    this.closed = true;
  }
}

export class AnnularSector extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const inner = o.innerRadius ?? 1;
    const outer = o.outerRadius ?? 2;
    const startAngle = o.startAngle ?? 0;
    const angle = o.angle ?? TAU / 4;
    const center = v(o.arcCenter ?? ORIGIN);
    const outerArc = arcToCubics(outer, startAngle, angle, center);
    const innerArc = arcToCubics(inner, startAngle + angle, -angle, center);
    const s: Vec3 = [center[0] + inner * Math.cos(startAngle), center[1] + inner * Math.sin(startAngle), 0];
    const s2: Vec3 = [center[0] + inner * Math.cos(startAngle + angle), center[1] + inner * Math.sin(startAngle + angle), 0];
    const pts: Vec3[] = [s, s, s, s];
    pts.push(...outerArc);
    pts.push(s2, s2, s2, s2);
    pts.push(...innerArc);
    pts.push(s, s, s, s);
    this.points = pts;
    this.closed = true;
  }
}

export class Annulus extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const inner = o.innerRadius ?? 1;
    const outer = o.outerRadius ?? 2;
    const center = v(o.arcCenter ?? ORIGIN);
    const outerArc = arcToCubics(outer, 0, TAU, center);
    const innerArc = arcToCubics(inner, 0, -TAU, center);
    this.points = [...outerArc, ...innerArc];
    this.closed = true;
  }
}

export class CubicBezier extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    this.points = [
      v(o.a0 ?? ORIGIN), v(o.h1 ?? [1, 1, 0]), v(o.h2 ?? [2, -1, 0]), v(o.a3 ?? [3, 0, 0]),
    ];
  }
}

/* ---------------- lines ---------------- */

export class Line extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const start = v(o.start ?? ORIGIN);
    const end = v(o.end ?? [1, 0, 0]);
    const buff = o.buff ?? 0;
    let pathArc = o.pathArc ?? 0;
    let s = start;
    let e = end;
    if (buff > 0) {
      const dir = norm(sub(e, s));
      s = add(s, mul(dir, buff));
      e = sub(e, mul(dir, buff));
    }
    if (pathArc !== 0) {
      // arc through midpoint offset
      const mid = mul(add(s, e), 0.5);
      const chord = sub(e, s);
      const perp: Vec3 = norm([-chord[1], chord[0], 0]);
      const r = Math.hypot(chord[0], chord[1]) / (2 * Math.sin(Math.abs(pathArc) / 2)) || 1;
      const h = r * Math.cos(Math.abs(pathArc) / 2);
      const ctrl = add(mid, mul(perp, (pathArc > 0 ? 1 : -1) * h * Math.tan(Math.abs(pathArc) / 4) * 1.33));
      this.points = [s, mul(add(s, ctrl), 1 / 3), mul(add(e, ctrl), 1 / 3), e];
    } else {
      this.points = cornersToCubics([s, e], false);
    }
  }
  putStartAndEndOn(start: Vec3, end: Vec3): this {
    const cur = [this.getStart(), this.getEnd()];
    // affine fit: translate + scale along direction
    const newLine = new Line({ start: v(start), end: v(end), pathArc: (this as any)._pathArc ?? 0 });
    this.points = newLine.points;
    return this;
  }
  getStart(): Vec3 { return this.points[0] ?? ORIGIN; }
  getEnd(): Vec3 { return this.points[this.points.length - 1] ?? ORIGIN; }
  getVector(): Vec3 { return sub(this.getEnd(), this.getStart()); }
  getUnitVector(): Vec3 { return norm(this.getVector()); }
  getAngle(): number { return Math.atan2(this.getVector()[1], this.getVector()[0]); }
  setAngle(a: number): this {
    return this.putStartAndEndOn(this.getStart(), add(this.getStart(), [
      Math.cos(a), Math.sin(a), 0,
    ] as Vec3));
  }
  setLengthByEndpoints(l: number): this {
    const dir = this.getUnitVector();
    return this.putStartAndEndOn(this.getStart(), add(this.getStart(), mul(dir, l)));
  }
}

export class DashedLine extends VGroup {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super();
    const line = new Line({ start: o.start, end: o.end });
    const dashed = line.asDashed(o.dashLength ?? 0.1, o.dashedRatio ?? 0.5);
    this.add(dashed);
    this.style = { ...line.style };
  }
}

/** Tip triangle (arrow head) as its own VMobject. */
export class ArrowTip extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const length = o.length ?? 0.25;
    const width = o.width ?? length * 0.6;
    const start = v(o.start ?? ORIGIN);
    const angle = o.angle ?? 0;
    const dir: Vec3 = [Math.cos(angle), Math.sin(angle), 0];
    const perp: Vec3 = [-dir[1], dir[0], 0];
    const tip = add(start, mul(dir, length));
    const b1 = add(start, mul(perp, width / 2));
    const b2 = sub(start, mul(perp, width / 2));
    this.points = cornersToCubics([b1, tip, b2, b1], true);
    this.closed = true;
    if (o.fill !== false) {
      this.style.fill = resolveColor(o.color ?? '#FFFFFF');
      this.style.fillOpacity = 1;
    }
  }
  static triangle(opts: any) { return new ArrowTip(opts); }
  static circle(opts: any = {}) {
    return new Circle({ radius: opts.width ?? 0.1, ...opts });
  }
}

export class Arrow extends VGroup {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super();
    const start = v(o.start ?? ORIGIN);
    const end = v(o.end ?? [1, 0, 0]);
    const buff = o.buff ?? 0;
    const tipLength = o.tipLength ?? 0.25;
    const maxRatio = o.maxTipLengthToLengthRatio ?? 0.25;
    let s = start;
    let e = end;
    const full = Math.hypot(e[0] - s[0], e[1] - s[1]);
    if (buff > 0) {
      const dir = norm(sub(e, s));
      s = add(s, mul(dir, buff));
      e = sub(e, mul(dir, buff));
    }
    const length = Math.hypot(e[0] - s[0], e[1] - s[1]);
    const tl = Math.min(tipLength, length * maxRatio);
    const dir = norm(sub(e, s));
    const bodyEnd = sub(e, mul(dir, tl));
    const body = new Line({ start: s, end: bodyEnd });
    const angle = Math.atan2(dir[1], dir[0]);
    const tip = new ArrowTip({ start: bodyEnd, angle, length: tl, color: o.color, tip: o.tip });
    this.add(body, tip);
    this.style.stroke = resolveColor(o.color ?? '#FFFFFF');
    body.style.stroke = this.style.stroke;
    tip.style.fill = this.style.stroke;
    (this as any).maxStrokeWidth = o.maxStrokeWidthToLengthRatio;
  }
  getStart(): Vec3 { return this.children[0]?.getStart() ?? ORIGIN; }
  getEnd(): Vec3 { return this.children[this.children.length - 1]?.getEnd() ?? ORIGIN; }
}

export class Vector extends Arrow {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const coords = v(o.coords ?? o.direction ?? [1, 0, 0]);
    const origin = v(o.origin ?? ORIGIN);
    super({ ...opts, start: origin, end: add(origin, coords) });
  }
}

export class DoubleArrow extends Arrow {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super(opts);
    // add second tip at start pointing back
    const body = this.children[0] as Line;
    const dir = body.getUnitVector();
    const tipLength = o.tipLength ?? 0.25;
    const back = new ArrowTip({
      start: body.getStart(),
      angle: Math.atan2(-dir[1], -dir[0]),
      length: tipLength,
      color: o.color,
    });
    this.add(back);
  }
}

export class CurvedArrow extends VGroup {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super();
    const arc = new ArcBetweenPoints({
      start: o.start, end: o.end, angle: o.angle ?? TAU / 4,
    });
    const angle = Math.atan2(
      arc.getEnd()[1] - arc.getCenter()[1],
      arc.getEnd()[0] - arc.getCenter()[0]
    );
    const tip = new ArrowTip({ start: arc.getEnd(), angle, color: o.color });
    this.add(arc, tip);
  }
}

export class CurvedDoubleArrow extends CurvedArrow {
  constructor(opts: any = {}) {
    super(opts);
    const arc = this.children[0] as Arc;
    const a0 = Math.atan2(arc.getStart()[1] - arc.getCenter()[1], arc.getStart()[0] - arc.getCenter()[0]);
    this.add(new ArrowTip({ start: arc.getStart(), angle: a0 + Math.PI, color: (opts as any).color }));
  }
}

export class Elbow extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const width = o.width ?? 0.5;
    const angle = o.angle ?? 0;
    const pts: Vec3[] = [[0, 0, 0], [width, 0, 0], [width, width, 0]];
    this.points = cornersToCubics(pts.map((p) => {
      const c = Math.cos(angle), s = Math.sin(angle);
      return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, 0] as Vec3;
    }), false);
  }
}

export class RightAngle extends VMobject {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const l1 = o.line1 as Line;
    const l2 = o.line2 as Line;
    const opts2 = normalizeOptions(opts);
    const length = opts2.length ?? 0.3;
    const intersection: Vec3 = l1.getEnd(); // assume lines share endpoint
    const d1 = l1.getUnitVector();
    const d2 = l2.getUnitVector();
    const a = add(intersection, mul(d1, length));
    const b = add(add(intersection, mul(d1, length)), mul(d2, length));
    const c = add(intersection, mul(d2, length));
    super(opts);
    this.points = cornersToCubics([a, b, c], false);
  }
}

export class Angle extends Arc {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const l1 = o.line1 as Line;
    const l2 = o.line2 as Line;
    const vertex = v(o.elbow ?? ORIGIN);
    const radius = o.radius ?? 0.5;
    const a1 = l1.getAngle();
    const a2 = l2.getAngle();
    let start = a2;
    let span = a1 - a2;
    if (o.otherAngle) {
      start = a1;
      span = TAU - (a1 - a2);
    }
    if (span < 0) span += TAU;
    const vertexPt = findIntersection(l1, l2);
    super({ ...opts, radius, startAngle: start, angle: span, arcCenter: vertexPt });
  }
}

function findIntersection(l1: Line, l2: Line): Vec3 {
  const p = l1.getStart(), r = sub(l1.getEnd(), l1.getStart());
  const q = l2.getStart(), s = sub(l2.getEnd(), l2.getStart());
  const rx = r[0], ry = r[1], sx = s[0], sy = s[1];
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return p;
  const t = ((q[0] - p[0]) * sy - (q[1] - p[1]) * sx) / denom;
  return [p[0] + rx * t, p[1] + ry * t, 0];
}

export class TangentLine extends Line {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const vm = o.vmobject as VMobject;
    const alpha = o.alpha ?? 0.5;
    const length = o.length ?? 1;
    const pt = vm.pointAt(alpha);
    const tangent = vm.tangentAt(alpha);
    super({ ...opts, start: sub(pt, mul(tangent, length / 2)), end: add(pt, mul(tangent, length / 2)) });
  }
}

/* ---------------- polygons ---------------- */

export class Polygram extends VMobject {
  constructor(opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const groups: Vec3[][] = o.vertexGroups ?? o.vertices ?? [[]];
    this.points = [];
    for (const g of groups) {
      this.points.push(...cornersToCubics(g.map((p) => v(p)), true));
    }
    this.closed = true;
  }
}

export class Polygon extends Polygram {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super({ ...opts, vertexGroups: [o.vertices ?? []] });
  }
}

export class RegularPolygon extends Polygon {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const n = o.n ?? o.sides ?? 6;
    const radius = o.radius ?? 1;
    const startAngle = o.startAngle ?? (Math.PI / 2 + Math.PI / n);
    const verts: Vec3[] = Array.from({ length: n }, (_, i) => {
      const a = startAngle + (i / n) * TAU;
      return [radius * Math.cos(a), radius * Math.sin(a), 0];
    });
    super({ ...opts, vertices: verts });
  }
}

export class Triangle extends RegularPolygon {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const side = o.side;
    super(side ? { ...opts, n: 3, radius: side / Math.sqrt(3) } : { ...opts, n: 3 });
  }
}

export class Square extends Polygon {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const side = o.side ?? o.sideLength ?? 2;
    const h = side / 2;
    super({ ...opts, vertices: [[-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0]] });
  }
}

export class Rectangle extends Polygon {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const w = o.width ?? 4;
    const h = o.height ?? 2;
    const gridX = o.gridXstep;
    const gridY = o.gridYstep;
    const hw = w / 2, hh = h / 2;
    super({ ...opts, vertices: [[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]] });
    if (gridX || gridY) {
      // grid lines as submobjects
      const lines: VMobject[] = [];
      if (gridX) for (let x = -hw + gridX; x < hw - 1e-9; x += gridX) {
        lines.push(new Line({ start: [x, -hh, 0], end: [x, hh, 0], strokeWidth: 1, color: o.gridColor ?? this.style.stroke }));
      }
      if (gridY) for (let y = -hh + gridY; y < hh - 1e-9; y += gridY) {
        lines.push(new Line({ start: [-hw, y, 0], end: [hw, y, 0], strokeWidth: 1, color: o.gridColor ?? this.style.stroke }));
      }
      const group = new VGroup(...lines);
      (this as any)._gridLines = group;
    }
  }
}

export class RoundedRectangle extends Polygon {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const w = o.width ?? 4;
    const h = o.height ?? 2;
    const r = Math.min(o.cornerRadius ?? 0.5, w / 2, h / 2);
    const hw = w / 2, hh = h / 2;
    // rounded rect from 4 arcs + 4 straight segments, all as cubics
    const arc = (cx: number, cy: number, a0: number) =>
      arcToCubics(r, a0, Math.PI / 2, [cx, cy, 0]);
    const pts: Vec3[] = [];
    const corners: Array<[number, number, number]> = [
      [hw - r, hh - r, Math.PI / 2],   // top-right
      [hw - r, -(hh - r), 0],           // bottom-right
      [-(hw - r), -(hh - r), -Math.PI / 2], // bottom-left
      [-(hw - r), hh - r, Math.PI],     // top-left
    ];
    for (const [cx, cy, a0] of corners) {
      pts.push(...arc(cx, cy, a0));
    }
    super({ ...opts });
    this.points = pts;
    this.closed = true;
  }
}

export class RegularPolygram extends Polygram {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const n = o.n ?? 6;
    const radius = o.radius ?? 2;
    const density = o.density ?? 2;
    const groups: Vec3[][] = [];
    for (let i = 0; i < density; i++) {
      const verts: Vec3[] = [];
      for (let j = i; j < n; j += density) {
        const a = (Math.PI / 2) + (j / n) * TAU;
        verts.push([radius * Math.cos(a), radius * Math.sin(a), 0]);
      }
      groups.push(verts);
    }
    super({ ...opts, vertexGroups: groups });
  }
}

export class Star extends Polygram {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const n = o.n ?? 5;
    const outer = o.outerRadius ?? 1;
    const inner = o.innerRadius ?? outer * 0.382;
    const density = o.density ?? 2;
    const pts: Vec3[] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI / 2) + (i / (n * 2)) * TAU;
      const r = i % 2 === 0 ? outer : inner;
      pts.push([r * Math.cos(a), r * Math.sin(a), 0]);
    }
    super({ ...opts, vertexGroups: [pts] });
  }
}

/** Convex hull of points (Andrew monotone chain). */
export class ConvexHull extends Polygon {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    const pts = (o.points ?? []).map((p: any) => v(p));
    const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o2: Vec3, a: Vec3, b: Vec3) =>
      (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]);
    const lower: Vec3[] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: Vec3[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    super({ ...opts, vertices: lower.slice(0, -1).concat(upper.slice(0, -1)) });
  }
}

/** Shape with holes (Cutout). */
export class Cutout extends VMobject {
  constructor(opts: any = {}) {
    const o = normalizeOptions(opts);
    super(opts);
    const main = o.main ?? o.shape as VMobject;
    const holes: VMobject[] = o.holes ?? [];
    this.points = [...main.points];
    for (const h of holes) this.points.push(...h.points);
    this.closed = true;
  }
}
