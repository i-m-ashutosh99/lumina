/**
 * Lumina — fading.ts / growing.ts / indication.ts / movement.ts / rotation.ts
 * (combined into thematic files; this one: fade + grow + indicate).
 */
import { Animation, AnimOptions } from '../core/animation';
import { Mobject } from '../core/mobject';
import { VMobject } from '../core/vmobject';
import { thereAndBack, smooth } from '../math/rate-functions';
import { interpolateColors } from '../math/color';
import { Vec3, v } from '../math/vec';
import { Rectangle, Circle, Line, Dot } from '../mobjects/geometry/basic';

/* ---------------- fading ---------------- */

export class Fade extends Animation {
  shiftVec: Vec3 = [0, 0, 0];
  scaleF: number | null = null;

  constructor(mobject: Mobject, direction: 1 | -1, opts: any = {}) {
    super(mobject, opts);
    this.direction = direction; // 1 = in, -1 = out
    const o = opts ?? {};
    if (o.shift) this.shiftVec = v(o.shift);
    else if (o.targetPosition) this.shiftVec = [0, 0, 0];
    if (o.scale !== undefined) this.scaleF = o.scale;
    if (direction === -1) this.remover = true;
    if (direction === 1) this.introducer = true;
  }
  direction: 1 | -1;

  begin(): void {
    super.begin();
    if (this.direction === 1) {
      this.mobject!.style.strokeOpacity = 0;
      this.mobject!.style.fillOpacity = 0;
    }
  }

  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    const a = this.direction === 1 ? alpha : 1 - alpha;
    m.style.strokeOpacity = (snap.style.strokeOpacity ?? 1) * a;
    m.style.fillOpacity = (snap.style.fillOpacity ?? 0) * a;
    if (this.shiftVec[0] || this.shiftVec[1] || this.shiftVec[2]) {
      m.points = snap.points.map((p: any) => [
        p[0] + this.shiftVec[0] * (1 - a),
        p[1] + this.shiftVec[1] * (1 - a),
        p[2] + this.shiftVec[2] * (1 - a),
      ]);
    }
    if (this.scaleF !== null) {
      m.points = snap.points.map((p: any) => [...p]);
      const f = 1 + (this.scaleF - 1) * (1 - a);
      m.scale(f, { aboutPoint: m.getCenter() });
    }
  }
}

export class FadeIn extends Fade {
  constructor(mobject: Mobject, shiftOrOpts?: any, opts?: any) {
    // GL positional: FadeIn(mob, UP); CE: FadeIn(mob, { shift: UP })
    const merged = { ...(opts ?? {}) };
    if (shiftOrOpts && !((shiftOrOpts as any).runTime !== undefined || (shiftOrOpts as any).run_time !== undefined)) {
      if (Array.isArray(shiftOrOpts) || typeof shiftOrOpts === 'string' || typeof shiftOrOpts === 'number') {
        merged.shift = shiftOrOpts;
      } else {
        Object.assign(merged, shiftOrOpts);
      }
    }
    super(mobject, 1, merged);
  }
}

export class FadeOut extends Fade {
  constructor(mobject: Mobject, shiftOrOpts?: any, opts?: any) {
    const merged = { ...(opts ?? {}) };
    if (shiftOrOpts && !((shiftOrOpts as any).runTime !== undefined || (shiftOrOpts as any).run_time !== undefined)) {
      if (Array.isArray(shiftOrOpts) || typeof shiftOrOpts === 'string' || typeof shiftOrOpts === 'number') {
        merged.shift = shiftOrOpts;
      } else {
        Object.assign(merged, shiftOrOpts);
      }
    }
    super(mobject, -1, merged);
  }
}

/* ---------------- growing ---------------- */

export class GrowFromPoint extends Animation {
  constructor(mobject: Mobject, point: Vec3, opts: AnimOptions = {}) {
    super(mobject, { introducer: true, ...opts });
    this.point = v(point);
  }
  point: Vec3;
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    m.points = snap.points.map((p: any) => [...p]);
    const s = 1e-6 + alpha;
    m.scale(Math.max(0.0001, alpha), { aboutPoint: this.point });
    m.style.strokeOpacity = snap.style.strokeOpacity * Math.min(1, alpha * 2);
  }
}

export class GrowFromCenter extends GrowFromPoint {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, mobject.getCenter(), opts);
  }
}

export class GrowFromEdge extends GrowFromPoint {
  constructor(mobject: Mobject, edge: Vec3, opts: AnimOptions = {}) {
    super(mobject, mobject.edgePoint(v(edge)), opts);
  }
}

export class GrowArrow extends GrowFromPoint {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, (mobject as any).getStart?.() ?? mobject.getCenter(), opts);
  }
}

export class SpinInFromNothing extends GrowFromCenter {
  interpolateMobject(alpha: number): void {
    super.interpolateMobject(alpha);
    this.mobject!.rotate((1 - alpha) * Math.PI * 2, { aboutPoint: this.mobject!.getCenter() });
  }
}

/* ---------------- indication ---------------- */

export class Indicate extends Animation {
  constructor(mobject: Mobject, opts: any = {}) {
    super(mobject, { rateFunc: thereAndBack, runTime: 1.5, ...opts });
    this.scaleFactor = opts.scaleFactor ?? 1.2;
    this.color = opts.color ?? '#FFFF00';
  }
  scaleFactor: number;
  color: string;
  begin(): void {
    super.begin();
    this.startStroke = this.mobject!.style.stroke ?? '#fff';
    this.startFill = this.mobject!.style.fill;
  }
  startStroke = '#fff';
  startFill: string | null = null;
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    m.points = snap.points.map((p: any) => [...p]);
    m.scale(1 + (this.scaleFactor - 1) * alpha, { aboutPoint: m.getCenter() });
    m.style.stroke = interpolateColors(this.startStroke, this.color, alpha);
    if (this.startFill) m.style.fill = interpolateColors(this.startFill, this.color, alpha);
  }
}

export class Wiggle extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { rateFunc: thereAndBack, ...opts });
  }
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    m.points = snap.points.map((p: any) => [...p]);
    m.rotate(0.3 * Math.sin(alpha * Math.PI * 4), { aboutPoint: m.getCenter() });
  }
}

export class Circumscribe extends Animation {
  constructor(mobject: Mobject, opts: any = {}) {
    super(mobject, { runTime: 1.5, rateFunc: thereAndBack, ...opts });
    this.shape = opts.shape ?? 'rectangle';
    this.color = opts.color ?? '#FFFF00';
    this.buff = opts.buff ?? 0.1;
  }
  shape: 'rectangle' | 'circle' = 'rectangle';
  color: string;
  buff: number;
  box: VMobject | null = null;
  begin(): void {
    super.begin();
    // Build surrounding shape lazily using minimal deps
    const bb = this.mobject!.getBoundingBox();
    const w = bb.max[0] - bb.min[0] + this.buff * 2;
    const h = bb.max[1] - bb.min[1] + this.buff * 2;
    const c = this.mobject!.getCenter();
    this.box = this.shape === 'rectangle'
      ? new Rectangle({ width: w, height: h, color: this.color })
      : new Circle({ radius: Math.max(w, h) / 2, color: this.color });
    this.box.moveTo(c);
  }
  interpolateMobject(alpha: number): void {
    if (!this.box) return;
    this.box.pointwiseBecomePartial(this.box, 0, alpha);
  }
  getTargetMobjects(): Mobject[] {
    return [this.mobject!];
  }
  /** Extra mobject introduced by this animation (scene adds it). */
  get extraMobjects(): Mobject[] {
    return this.box ? [this.box] : [];
  }
}

export class Flash extends Animation {
  constructor(point: Vec3, opts: any = {}) {
    super(null, { runTime: 1, ...opts });
    this.point = v(point);
    this.lineLength = opts.lineLength ?? 0.2;
    this.numLines = opts.numLines ?? 12;
    this.color = opts.color ?? '#FFFF00';
    this.lines = [];
  }
  point: Vec3;
  lineLength: number;
  numLines: number;
  color: string;
  lines: Mobject[];
  begin(): void {
    this.lines = [];
    for (let i = 0; i < this.numLines; i++) {
      const ang = (i / this.numLines) * Math.PI * 2;
      const dir: Vec3 = [Math.cos(ang), Math.sin(ang), 0];
      const inner = 0.05;
      const l = new Line({
        start: [this.point[0] + dir[0] * inner, this.point[1] + dir[1] * inner, 0],
        end: [this.point[0] + dir[0] * (inner + this.lineLength), this.point[1] + dir[1] * (inner + this.lineLength), 0],
        color: this.color,
      });
      this.lines.push(l);
    }
  }
  interpolateMobject(alpha: number): void {
    for (const l of this.lines) {
      l.style.strokeOpacity = 1 - alpha;
      l.scale(0.4 + alpha, { aboutPoint: this.point });
    }
  }
  getTargetMobjects(): Mobject[] {
    return [];
  }
  get extraMobjects(): Mobject[] {
    return this.lines;
  }
}

export class FocusOn extends Animation {
  constructor(point: Vec3, opts: AnimOptions = {}) {
    super(null, { runTime: 1, ...opts });
    this.point = v(point);
  }
  point: Vec3;
  dot: Mobject | null = null;
  begin(): void {
    this.dot = new Dot({ point: this.point, radius: 0.35, color: '#B22222' });
  }
  interpolateMobject(alpha: number): void {
    if (!this.dot) return;
    this.dot.scale(1 - alpha, { aboutPoint: this.point });
  }
  getTargetMobjects(): Mobject[] { return []; }
  get extraMobjects(): Mobject[] { return this.dot ? [this.dot] : []; }
}

export class ApplyWave extends Animation {
  constructor(mobject: Mobject, opts: any = {}) {
    super(mobject, opts);
    this.direction = v(opts.direction ?? [0, 1, 0]);
    this.amplitude = opts.amplitude ?? 0.2;
    this.timeWidth = opts.timeWidth ?? 1;
  }
  direction: Vec3;
  amplitude: number;
  timeWidth: number;
  interpolateMobject(alpha: number): void {
    const snap = this.startSnapshots!.get(this.mobject!) as any;
    const m = this.mobject!;
    const c = m.getCenter();
    m.points = snap.points.map((p: any) => {
      const dx = p[0] - c[0];
      const phase = alpha * Math.PI * 2 - dx * this.timeWidth;
      const offset = this.amplitude * Math.sin(phase) * Math.exp(-dx * dx * 0.1);
      return [
        p[0] + this.direction[0] * offset,
        p[1] + this.direction[1] * offset,
        p[2],
      ];
    });
  }
}

export class Blink extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { runTime: 1, rateFunc: thereAndBack, ...opts });
  }
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    m.style.strokeOpacity = snap.style.strokeOpacity * (1 - alpha);
    m.style.fillOpacity = snap.style.fillOpacity * (1 - alpha);
  }
}

export class ShowPassingFlash extends Animation {
  constructor(mobject: Mobject, opts: any = {}) {
    super(mobject, { runTime: 1, ...opts });
    this.timeWidth = opts.timeWidth ?? 0.1;
  }
  timeWidth: number;
  interpolateMobject(alpha: number): void {
    const m = this.mobject as VMobject;
    const snap = this.startSnapshots!.get(m) as any;
    m.points = snap.points.map((p: any) => [...p]);
    const lo = alpha - this.timeWidth;
    const hi = alpha + this.timeWidth;
    if (lo > 0 || hi < 1) m.pointwiseBecomePartial(m, Math.max(0, lo), Math.min(1, hi));
  }
}

export class Broadcast extends Animation {
  constructor(point: Vec3, opts: any = {}) {
    super(null, { runTime: 2, ...opts });
    this.point = v(point);
    this.nRings = opts.nRings ?? 4;
    this.focalDistance = opts.focalDistance ?? 3;
  }
  point: Vec3;
  nRings: number;
  focalDistance: number;
  rings: Mobject[] = [];
  begin(): void {
    this.rings = Array.from({ length: this.nRings }, (_, i) =>
      new Circle({ radius: 0.1, color: '#FFFFCC' }).moveTo(this.point)
    );
  }
  interpolateMobject(alpha: number): void {
    this.rings.forEach((r, i) => {
      const local = (alpha * this.nRings - i) / 1;
      const rr = local < 0 || local > 1 ? -1 : local;
      if (rr < 0) {
        r.style.strokeOpacity = 0;
      } else {
        r.scaleTo?.(this.focalDistance * rr + 0.05);
        (r as any).points = (r as any).points; // keep
        r.style.strokeOpacity = 1 - rr;
      }
    });
  }
  getTargetMobjects(): Mobject[] { return []; }
  get extraMobjects(): Mobject[] { return this.rings; }
}
