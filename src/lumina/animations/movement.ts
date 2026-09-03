/**
 * Lumina — movement.ts
 * MoveAlongPath / Homotopy / ComplexHomotopy / PhaseFlow / Rotate / Rotating
 * / ChangingDecimal / ChangeDecimalToValue (doc 07 §10 "move / rotate /
 * numbers" group — confirmed missing via export-manifest audit).
 */
import { Animation, AnimOptions } from '../core/animation';
import { Mobject } from '../core/mobject';
import { VMobject } from '../core/vmobject';
import { Vec3 } from '../math/vec';

/** Move a mobject's center along an arbitrary path mobject's arc-length
 *  parameterization (real ManimCE `MoveAlongPath`). `suspendMobjectUpdating`
 *  defaults true upstream so any of the mobject's own updaters don't fight
 *  the path placement mid-animation; Lumina's pure-snapshot model achieves
 *  the same effect implicitly (we always restore from a frozen snapshot). */
export class MoveAlongPath extends Animation {
  path: VMobject;
  constructor(mobject: Mobject, path: VMobject, opts: AnimOptions & { suspendMobjectUpdating?: boolean } = {}) {
    super(mobject, opts);
    this.path = path;
  }
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    const pt = this.path.pointAt(alpha);
    const c = this.getSnapshotCenter(snap);
    const d: Vec3 = [pt[0] - c[0], pt[1] - c[1], pt[2] - c[2]];
    m.points = snap.points.map((p: any) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]]);
  }
  private getSnapshotCenter(snap: any): Vec3 {
    const pts = snap.points as Vec3[];
    if (!pts.length) return [0, 0, 0];
    let x = 0, y = 0, z = 0;
    for (const p of pts) { x += p[0]; y += p[1]; z += p[2]; }
    return [x / pts.length, y / pts.length, z / pts.length];
  }
}

/** Apply a time-dependent flow `(x, y, z, t) -> [x', y', z']` to every point
 *  of a VMobject family (real ManimCE `Homotopy`). `t` is the animation's
 *  own alpha ∈ [0, 1] fed straight to `fn`, matching upstream's contract of
 *  `homotopy(x, y, z, t)` where `t` already ranges over the unit interval. */
export class Homotopy extends Animation {
  fn: (x: number, y: number, z: number, t: number) => [number, number, number];
  constructor(
    fn: (x: number, y: number, z: number, t: number) => [number, number, number],
    mobject: Mobject,
    opts: AnimOptions = {}
  ) {
    super(mobject, opts);
    this.fn = fn;
  }
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    for (const sub of m.family()) {
      const snap = this.startSnapshots!.get(sub) as any;
      if (!snap) continue;
      sub.points = snap.points.map((p: Vec3) => {
        const [x, y, z] = this.fn(p[0], p[1], p[2], alpha);
        return [x, y, z] as Vec3;
      });
    }
  }
}

/** Homotopy specialized for a complex-plane function `z(t) -> z'`, treating
 *  point.x as Re(z) and point.y as Im(z) (real ManimCE `ComplexHomotopy`). */
export class ComplexHomotopy extends Homotopy {
  constructor(
    complexFn: (z: { re: number; im: number }, t: number) => { re: number; im: number },
    mobject: Mobject,
    opts: AnimOptions = {}
  ) {
    super((x, y, z, t) => {
      const out = complexFn({ re: x, im: y }, t);
      return [out.re, out.im, z];
    }, mobject, opts);
  }
}

/**
 * Integrate a vector-field-like ODE `dPoint/dt = fn(point)` for `runTime`
 * seconds of "virtual time" spread across the animation's alpha (real
 * ManimCE `PhaseFlow`), via fixed-step Euler integration — sufficient for
 * illustrative flow-field demos (streamlines etc. use finer sampling).
 */
export class PhaseFlow extends Animation {
  fn: (p: Vec3) => Vec3;
  virtualTime: number;
  steps: number;
  constructor(
    fn: (p: Vec3) => Vec3,
    mobject: Mobject,
    opts: AnimOptions & { virtualTime?: number; steps?: number } = {}
  ) {
    super(mobject, opts);
    this.fn = fn;
    this.virtualTime = opts.virtualTime ?? 1;
    this.steps = opts.steps ?? 50;
  }
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const dt = (this.virtualTime * alpha) / this.steps;
    for (const sub of m.family()) {
      const snap = this.startSnapshots!.get(sub) as any;
      if (!snap) continue;
      sub.points = snap.points.map((p0: Vec3) => {
        let p: Vec3 = [...p0];
        for (let i = 0; i < this.steps; i++) {
          const d = this.fn(p);
          p = [p[0] + d[0] * dt, p[1] + d[1] * dt, p[2] + d[2] * dt];
        }
        return p;
      });
    }
  }
}

/**
 * Rotate a mobject by a fixed angle over the animation's run time (real
 * ManimCE `Rotate`; default `aboutPoint` is the mobject's OWN center at
 * `begin()` time, matching upstream's `about_point=mobject.get_center()`
 * default rather than the world origin).
 */
export class Rotate extends Animation {
  angle: number;
  axis: Vec3;
  aboutPoint: Vec3 | null;
  private resolvedAbout: Vec3 = [0, 0, 0];

  constructor(
    mobject: Mobject,
    angle: number = Math.PI,
    opts: AnimOptions & { axis?: Vec3; aboutPoint?: Vec3; about_point?: Vec3 } = {}
  ) {
    super(mobject, opts);
    this.angle = angle;
    this.axis = opts.axis ?? [0, 0, 1];
    this.aboutPoint = opts.aboutPoint ?? opts.about_point ?? null;
  }

  begin(): void {
    super.begin();
    this.resolvedAbout = this.aboutPoint ?? this.mobject!.getCenter();
  }

  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    m.points = snap.points.map((p: Vec3) => [...p]);
    m.rotate(this.angle * alpha, { axis: this.axis, aboutPoint: this.resolvedAbout });
  }
}

/**
 * Continuous rotation for the full run time — real ManimGL/CE `Rotating`
 * (an infinite/indicator-style spin, expressed here as a fixed-duration
 * `Rotate` driven by `radians` total instead of a target angle so it reads
 * naturally as "spin this many radians over the clip").
 */
export class Rotating extends Rotate {
  constructor(
    mobject: Mobject,
    opts: AnimOptions & { axis?: Vec3; aboutPoint?: Vec3; radians?: number } = {}
  ) {
    super(mobject, opts.radians ?? Math.PI * 2, { runTime: 5, rateFunc: 'linear', ...opts });
  }
}

/**
 * Drive a DecimalNumber/Integer's displayed value via an arbitrary
 * `fn(alpha) -> number` each frame (real ManimCE `ChangingDecimal`).
 * `decimal` needs a `.setValue(number)` method (DecimalNumber/Integer both
 * qualify) — duck-typed rather than importing text.ts to avoid a cycle.
 */
export class ChangingDecimal extends Animation {
  fn: (alpha: number) => number;
  constructor(decimal: Mobject & { setValue: (v: number) => any }, fn: (alpha: number) => number, opts: AnimOptions = {}) {
    super(decimal, opts);
    this.fn = fn;
  }
  interpolateMobject(alpha: number): void {
    (this.mobject as any).setValue(this.fn(alpha));
  }
}

/** Animate a DecimalNumber/Integer smoothly from its current value to
 *  `targetValue` (real ManimCE `ChangeDecimalToValue`). */
export class ChangeDecimalToValue extends ChangingDecimal {
  constructor(decimal: Mobject & { getValue: () => number; setValue: (v: number) => any }, targetValue: number, opts: AnimOptions = {}) {
    const startValue = decimal.getValue();
    super(decimal, (alpha) => startValue + (targetValue - startValue) * alpha, opts);
  }
}
