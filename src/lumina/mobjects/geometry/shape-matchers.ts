/**
 * Lumina — mobjects/geometry/shape-matchers.ts
 * ManimCE "shape matcher" mobjects (doc 02 §C.7): annotate/mark another
 * mobject without changing it. SurroundingRectangle, BackgroundRectangle,
 * Cross, Underline, Checkmark.
 */
import { Vec3, v, add, sub, mul, norm } from '../../math/vec';
import { VMobject } from '../../core/vmobject';
import { VGroup } from '../../core/group';
import { Mobject } from '../../core/mobject';
import { normalizeOptions } from '../../core/style';
import { RoundedRectangle, Rectangle, Line } from './basic';
import { resolveColor, YELLOW, RED, GREEN } from '../../math/color';

/**
 * Rectangle (optionally rounded) that surrounds a mobject's bounding box
 * with a buffer. The canonical way to "circle" or highlight a mobject
 * without mutating it (Manim: `SurroundingRectangle(mob, color=YELLOW)`).
 */
export class SurroundingRectangle extends RoundedRectangle {
  constructor(mobject: Mobject, opts: any = {}) {
    const o = normalizeOptions(opts);
    const buff = o.buff ?? 0.1;
    const bb = mobject.getBoundingBox();
    const w = bb.max[0] - bb.min[0] + buff * 2;
    const h = bb.max[1] - bb.min[1] + buff * 2;
    super({
      color: YELLOW,
      cornerRadius: o.cornerRadius ?? 0.05,
      ...opts,
      width: w,
      height: h,
    });
    this.moveTo(mobject.getCenter());
    this.mobject = mobject;
    this.buff = buff;
  }
  mobject: Mobject;
  buff: number;
}

/**
 * A rectangle placed *behind* a mobject (lower z-order — added before it),
 * usually with a dark fill and some opacity, to improve legibility over a
 * busy background. Manim: `BackgroundRectangle(text, color=BLACK, fill_opacity=0.75)`.
 */
export class BackgroundRectangle extends Rectangle {
  constructor(mobject: Mobject, opts: any = {}) {
    const o = normalizeOptions(opts);
    const buff = o.buff ?? 0.1;
    const bb = mobject.getBoundingBox();
    const w = bb.max[0] - bb.min[0] + buff * 2;
    const h = bb.max[1] - bb.min[1] + buff * 2;
    super({
      color: '#000000',
      fillOpacity: 0.75,
      strokeWidth: 0,
      ...opts,
      width: w,
      height: h,
    });
    this.style.fill = resolveColor(o.color ?? '#000000');
    this.style.fillOpacity = o.fillOpacity ?? 0.75;
    this.style.strokeWidth = o.strokeWidth ?? 0;
    this.moveTo(mobject.getCenter());
    this.mobject = mobject;
  }
  mobject: Mobject;
  /** Re-fit to the (possibly since-transformed) target mobject's box. */
  updateForNewMobject(): this {
    const bb = this.mobject.getBoundingBox();
    const buff = 0.1;
    const w = bb.max[0] - bb.min[0] + buff * 2;
    const h = bb.max[1] - bb.min[1] + buff * 2;
    this.setWidth(w);
    this.setHeight(h);
    this.moveTo(this.mobject.getCenter());
    return this;
  }
}

/**
 * An X mark drawn across a mobject's bounding box.
 * Manim: `Cross(mobject, stroke_color=RED, stroke_width=6)`.
 */
export class Cross extends VGroup {
  constructor(mobject: Mobject | null = null, opts: any = {}) {
    super();
    const o = normalizeOptions(opts);
    const strokeColor = o.strokeColor ?? o.color ?? RED;
    const strokeWidth = o.strokeWidth ?? 6;
    let hw = 1, hh = 1, center: Vec3 = [0, 0, 0];
    if (mobject) {
      const bb = mobject.getBoundingBox();
      const buff = o.buff ?? 0.1;
      hw = (bb.max[0] - bb.min[0]) / 2 + buff;
      hh = (bb.max[1] - bb.min[1]) / 2 + buff;
      center = mobject.getCenter();
    } else {
      hw = o.width ? o.width / 2 : 1;
      hh = o.height ? o.height / 2 : 1;
    }
    const l1 = new Line({ start: [-hw, -hh, 0], end: [hw, hh, 0], color: strokeColor, strokeWidth });
    const l2 = new Line({ start: [-hw, hh, 0], end: [hw, -hh, 0], color: strokeColor, strokeWidth });
    this.add(l1, l2);
    this.moveTo(center);
  }
}

/**
 * A line placed just below a mobject's bounding box.
 * Manim: `Underline(mobject, color=WHITE, buff=0.1)`.
 */
export class Underline extends Line {
  constructor(mobject: Mobject, opts: any = {}) {
    const o = normalizeOptions(opts);
    const buff = o.buff ?? 0.1;
    const bb = mobject.getBoundingBox();
    const y = bb.min[1] - buff;
    const pad = o.padding ?? 0.05;
    super({
      start: [bb.min[0] - pad, y, 0],
      end: [bb.max[0] + pad, y, 0],
      color: '#FFFFFF',
      ...opts,
    });
  }
}

/**
 * A checkmark (✓) glyph built from two line segments, optionally placed
 * over/near a mobject. Not in ManimCE core but a common "shape matcher"
 * pattern (correctness indication) requested for completeness.
 */
export class Checkmark extends VGroup {
  constructor(opts: any = {}) {
    super();
    const o = normalizeOptions(opts);
    const color = o.color ?? GREEN;
    const strokeWidth = o.strokeWidth ?? 6;
    const scale = o.scale ?? 1;
    const short = new Line({ start: [-0.5 * scale, 0, 0], end: [-0.1 * scale, -0.4 * scale, 0], color, strokeWidth });
    const long = new Line({ start: [-0.1 * scale, -0.4 * scale, 0], end: [0.6 * scale, 0.5 * scale, 0], color, strokeWidth });
    this.add(short, long);
    if (o.mobject instanceof Mobject) this.moveTo(o.mobject.getCenter());
  }
}
