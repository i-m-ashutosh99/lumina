/**
 * Lumina — updater.ts
 * ValueTracker / ComplexValueTracker + updater helpers (doc 07 §9).
 *
 * ValueTracker stores its number in `points[0][0]` (not a private field) —
 * this is the same trick real Manim uses so that the generic `.animate`
 * pipeline (Transform lerping raw `points`) can animate `.setValue()` for
 * free, with no special-casing in Transform.
 */
import { Mobject, Updater } from './mobject';

export class ValueTracker extends Mobject {
  constructor(value = 0, opts?: any) {
    super(opts);
    this.setValue(value);
  }

  getValue(): number {
    return this.points[0]?.[0] ?? 0;
  }

  setValue(v: number): this {
    this.points = [[v, 0, 0], [v, 0, 0], [v, 0, 0], [v, 0, 0]];
    return this;
  }

  get value(): number { return this.getValue(); }
  set value(v: number) { this.setValue(v); }

  increment(d: number): this { return this.setValue(this.getValue() + d); }

  /** Not drawn by the renderer — it's pure data. */
  get isDrawable(): boolean { return false; }
}

/** Tracks a complex number as (re, im) packed into points[0][0..1]. */
export class ComplexValueTracker extends ValueTracker {
  constructor(re = 0, im = 0, opts?: any) {
    super(0, opts);
    this.setComplexValue({ re, im });
  }

  getComplexValue(): { re: number; im: number } {
    const p = this.points[0] ?? [0, 0, 0];
    return { re: p[0], im: p[1] };
  }

  setComplexValue(z: { re: number; im: number }): this {
    this.points = [[z.re, z.im, 0], [z.re, z.im, 0], [z.re, z.im, 0], [z.re, z.im, 0]];
    return this;
  }
}

/** Updater that calls `mobject[method](...args)` every frame (doc 07 always). */
export function always(method: string, ...args: any[]): Updater {
  return (m: Mobject) => { (m as any)[method]?.(...args); };
}

/** Like `always`, but arguments are re-evaluated from thunks every frame. */
export function fAlways(method: string, ...argFns: Array<() => any>): Updater {
  return (m: Mobject) => { (m as any)[method]?.(...argFns.map((f) => f())); };
}

/**
 * Standalone factory (doc 07 always_redraw): returns a NEW mobject that
 * rebuilds itself from `factory()` every frame. Distinct from the
 * `Mobject.prototype.alwaysRedraw` instance method (which mutates an
 * existing mobject in place) — this one is the free-function form used as
 * `const dot = alwaysRedraw(() => new Dot(tracker.getValue()))`.
 */
export function alwaysRedraw(factory: () => Mobject): Mobject {
  const initial = factory();
  initial.addUpdater((m) => { (m as Mobject).become(factory()); });
  return initial;
}
