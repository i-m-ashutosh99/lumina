/**
 * Lumina — composition.ts
 * AnimationGroup / LaggedStart / LaggedStartMap / Succession (doc 07 §10,
 * doc 10 §3.2 "must" list — confirmed missing via export-manifest audit).
 *
 * Timing model cross-checked against real ManimCE's `AnimationGroup`
 * (`manim.animation.composition`):
 *   start_time_i = curr_time (running cursor)
 *   end_time_i   = start_time_i + anim_i.run_time
 *   curr_time'   = start_time_i + (end_time_i - start_time_i) * lag_ratio
 *   group.run_time = max(end_time_i) over all i (unless overridden)
 * `Succession` is exactly `AnimationGroup` with `lagRatio = 1` (each anim's
 * cursor only advances to the NEXT start once the current one fully ends);
 * `LaggedStart` is `AnimationGroup` with a small default `lagRatio` (0.05).
 *
 * Every composition is itself a single `Animation` (so Scene.play() records
 * ONE clip, matching Lumina's record-then-seek Timeline architecture) that
 * fans begin/setupScene/restoreStart/apply/finish/cleanUpFromScene out to
 * its children at the correct sub-alpha.
 */
import { Animation, AnimOptions, prepareAnimation } from '../core/animation';
import { Mobject } from '../core/mobject';

export interface CompositionOptions extends AnimOptions {
  lagRatio?: number;
  lag_ratio?: number;
}

interface Timing {
  anim: Animation;
  start: number;
  end: number;
}

/** Split `(...args)` into `{ anims, opts }`. Supports two call forms:
 *    (anim1, anim2, ..., opts?)      — variadic, trailing plain-object opts
 *    ([anim1, anim2, ...], opts?)    — single leading array, trailing opts
 *  The array form is unambiguous regardless of how many total arguments
 *  follow it (fixes a bug where `new AnimationGroup([a, b], opts)` — the
 *  exact form `LaggedStart`/`Succession`/`LaggedStartMap` use internally —
 *  was being mis-parsed as a single animation-like arg `[a, b]` plus opts,
 *  then crashing because `prepareAnimation` was called on the array itself
 *  instead of on each element). */
function splitAnimsOpts(args: any[]): { anims: Animation[]; opts: CompositionOptions } {
  if (args.length >= 1 && Array.isArray(args[0])) {
    const arr = args[0];
    const maybeOpts = args[1];
    const opts: CompositionOptions =
      args.length > 1 && maybeOpts && typeof maybeOpts === 'object' && !(maybeOpts instanceof Animation)
        ? maybeOpts
        : {};
    return { anims: arr.map((a: any) => prepareAnimation(a)), opts };
  }
  let raw = args;
  let opts: CompositionOptions = {};
  const last = raw[raw.length - 1];
  const isAnimLike = last instanceof Animation || (last && last.mobject instanceof Mobject && last.target instanceof Mobject);
  if (last && typeof last === 'object' && !isAnimLike && !Array.isArray(last)) {
    opts = raw[raw.length - 1];
    raw = raw.slice(0, -1);
  }
  const anims = raw.map((a) => prepareAnimation(a));
  return { anims, opts };
}

export class AnimationGroup extends Animation {
  children: Animation[];
  protected timings: Timing[] = [];

  constructor(...args: any[]) {
    const { anims, opts } = splitAnimsOpts(args);
    const lagRatio = opts.lagRatio ?? opts.lag_ratio ?? 0;
    super(null, { ...opts, lagRatio });
    this.children = anims;
    this.buildTimings(lagRatio);
    if (opts.runTime === undefined && opts.run_time === undefined) {
      this.runTime = this.timings.length
        ? Math.max(...this.timings.map((t) => t.end), 0)
        : 0;
    }
  }

  private buildTimings(lagRatio: number): void {
    let cursor = 0;
    this.timings = this.children.map((anim) => {
      const start = cursor;
      const end = start + anim.runTime;
      cursor = start + (end - start) * lagRatio;
      return { anim, start, end };
    });
  }

  getTargetMobjects(): Mobject[] {
    const out: Mobject[] = [];
    const seen = new Set<Mobject>();
    for (const { anim } of this.timings) {
      for (const m of anim.getTargetMobjects()) {
        if (!seen.has(m)) { seen.add(m); out.push(m); }
      }
    }
    return out;
  }

  setupScene(scene: any): void {
    for (const { anim } of this.timings) anim.setupScene(scene);
  }

  begin(): void {
    for (const { anim } of this.timings) anim.begin();
  }

  restoreStart(): void {
    for (const { anim } of this.timings) anim.restoreStart();
  }

  /** `t` here is already this GROUP's own rate-func'd alpha (linear by
   *  default) — real Manim's AnimationGroup.interpolate_mobject is linear
   *  in absolute group time, so we do NOT re-apply a rate func per child
   *  beyond what each child's own `computeAlpha` already contributes. */
  interpolateMobject(t: number): void {
    const T = t * (this.runTime || 1e-9);
    for (const { anim, start, end } of this.timings) {
      const span = Math.max(end - start, 1e-9);
      const subT = Math.min(1, Math.max(0, (T - start) / span));
      anim.apply(anim.computeAlpha(subT));
    }
  }

  cleanUpFromScene(scene: any): void {
    this.onFinish?.(scene);
    for (const { anim } of this.timings) anim.cleanUpFromScene(scene);
  }
}

/** Overlapping cascade: each animation starts once the previous has played
 *  through `lagRatio` of its own duration (real Manim default 0.05). */
export class LaggedStart extends AnimationGroup {
  constructor(...args: any[]) {
    const { anims, opts } = splitAnimsOpts(args);
    super(anims, { lagRatio: 0.05, ...opts });
  }
}

/** Apply `AnimClass` to every element of `group` (its `children`, or the
 *  array itself if already a plain list), then `LaggedStart` the results —
 *  real Manim's `LaggedStartMap(AnimClass, group, **kwargs)`. */
export class LaggedStartMap extends LaggedStart {
  constructor(
    AnimClass: new (m: Mobject, opts?: any) => Animation,
    group: Mobject | Mobject[],
    opts: CompositionOptions & { animConfig?: any } = {}
  ) {
    const items: Mobject[] = Array.isArray(group) ? group : group.children;
    const { animConfig, ...rest } = opts;
    const anims = items.map((m) => new AnimClass(m, animConfig));
    super(anims, rest);
  }
}

/** Strict sequence: each animation starts exactly when the previous ends
 *  (real Manim's `Succession` — equivalent to `lagRatio = 1`). */
export class Succession extends AnimationGroup {
  constructor(...args: any[]) {
    const { anims, opts } = splitAnimsOpts(args);
    super(anims, { lagRatio: 1, ...opts });
  }
}
