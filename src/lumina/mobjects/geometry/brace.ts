/**
 * Lumina — mobjects/geometry/brace.ts
 * ManimCE Brace family (doc 02 §C.14): a curly brace adjacent to a
 * mobject or spanning two points, optionally with a text/MathTex label.
 *
 * The brace outline is built as a single closed cubic-Bézier path in a
 * local "unit brace" coordinate frame (pointing left, i.e. the tip points
 * in +x / "opens" toward -x — matching ManimCE's default `Brace` which
 * points DOWN by default and is authored pointing left then rotated),
 * then scaled to the requested width and rotated/translated to the
 * requested direction. This keeps the outline resolution-independent and
 * `Transform`-able like every other Lumina VMobject.
 */
import { Vec3, v, add, sub, mul, norm, rotatePoint } from '../../math/vec';
import { VMobject } from '../../core/vmobject';
import { VGroup } from '../../core/group';
import { Mobject } from '../../core/mobject';
import { normalizeOptions } from '../../core/style';
import { PI } from '../../math/constants';

/**
 * Build one half of a curly-brace tip as a sequence of cubic points along
 * a vertical run of length `length`, bulging outward by `depth` toward
 * +x, tapering to a point at the middle. Returns a flat cubic point list
 * (a single open path from (0, -length/2) to (0, length/2)).
 */
function braceOutline(length: number, depth: number): Vec3[] {
  const half = length / 2;
  // Four cubic segments approximating the classic "{" glyph: two S-curves
  // meeting at a sharp tip in the middle, each an out-then-in bulge.
  const pts: Vec3[] = [];
  const seg = (y0: number, y1: number, x0: number, xTip: number) => {
    const p0: Vec3 = [x0, y0, 0];
    const p1: Vec3 = [xTip, y0 + (y1 - y0) * 0.35, 0];
    const p2: Vec3 = [xTip, y0 + (y1 - y0) * 0.65, 0];
    const p3: Vec3 = [x0, y1, 0];
    return [p0, p1, p2, p3];
  };
  // bottom half: from bottom end curving out to the tip
  pts.push(...seg(-half, -half * 0.08, 0, depth));
  pts.push(...seg(-half * 0.08, 0, depth, depth * 1.6));
  // top half: mirror
  pts.push(...seg(0, half * 0.08, depth * 1.6, depth));
  pts.push(...seg(half * 0.08, half, depth, 0));
  return pts;
}

/**
 * Curly brace adjacent to a mobject, pointing `direction` away from it
 * (default DOWN). Manim: `Brace(mobject, direction=DOWN, buff=0.2)`.
 */
export class Brace extends VMobject {
  constructor(mobject: Mobject, opts: any = {}) {
    super(opts);
    const o = normalizeOptions(opts);
    const direction: Vec3 = v(o.direction ?? [0, -1, 0]);
    const buff = o.buff ?? 0.2;
    const dir = norm(direction);
    // brace spans the mobject's extent perpendicular to `direction`
    const bb = mobject.getBoundingBox();
    const isVertical = Math.abs(dir[0]) > Math.abs(dir[1]);
    const length = isVertical ? (bb.max[1] - bb.min[1]) : (bb.max[0] - bb.min[0]);
    const spanLength = Math.max(length + 0.4, 0.6);
    const depth = o.depth ?? 0.2;
    let outline = braceOutline(spanLength, depth);
    // outline authored with its bulge toward +x and span along y; rotate
    // so the bulge points along `direction`.
    const angle = Math.atan2(dir[1], dir[0]);
    outline = outline.map((p) => rotatePoint(p, angle, [0, 0, 1]));
    this.points = outline;
    this.closed = false;
    this.style.fill = this.style.stroke;
    this.style.fillOpacity = 1;
    this.style.strokeWidth = 0;
    const center = mobject.getCenter();
    const edge = mobject.edgePoint(dir);
    this.moveTo(add(edge, mul(dir, buff + depth * 0.5)));
    this.direction = dir;
    this.mobject = mobject;
  }
  direction: Vec3;
  mobject: Mobject;

  /** Point where a label attached to this brace should be centered. */
  getTip(): Vec3 {
    return this.getCenter();
  }
  /** Move (and orient) a mobject to sit just outside the brace's tip. */
  putAtTip(m: Mobject, buff = 0.1): Mobject {
    const tip = add(this.getCenter(), mul(this.direction, buff + 0.2));
    m.moveTo(tip);
    return m;
  }
}

/**
 * A Brace with a label mobject positioned at its tip.
 * Manim: `BraceLabel(mobject, text)` (label constructor is pluggable so
 * this also covers `BraceText`; pass a MathTex/Text instance directly).
 */
export class BraceLabel extends VGroup {
  constructor(mobject: Mobject, label: Mobject, opts: any = {}) {
    super();
    const o = normalizeOptions(opts);
    const brace = new Brace(mobject, opts);
    brace.putAtTip(label, o.buff ?? 0.1);
    this.add(brace, label);
    this.brace = brace;
    this.label = label;
  }
  brace: Brace;
  label: Mobject;
}

/** Alias matching ManimCE's `BraceText` (label is any Text/MathTex mobject). */
export class BraceText extends BraceLabel {}

/**
 * A Brace spanning two explicit points rather than a mobject's bounding
 * box. Manim: `BraceBetweenPoints(p1, p2, direction=...)`.
 */
export class BraceBetweenPoints extends Brace {
  constructor(p1: Vec3, p2: Vec3, opts: any = {}) {
    const o = normalizeOptions(opts);
    const a = v(p1), b = v(p2);
    const mid = mul(add(a, b), 0.5);
    const along = norm(sub(b, a));
    // perpendicular direction (rotate along by -90°) unless caller specified one
    const perp: Vec3 = o.direction ? v(o.direction) : [along[1], -along[0], 0];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Fake a zero-size mobject at `mid` with the right bounding box by
    // using a lightweight anonymous Mobject subclass instance.
    const stub = new (class extends Mobject {})();
    stub.points = [
      [mid[0] - length / 2, mid[1], 0],
      [mid[0] + length / 2, mid[1], 0],
    ];
    super(stub, { ...opts, direction: perp });
  }
}
