/**
 * Lumina — animation.ts
 * Animation base + interpolation plumbing (doc 06 §5).
 */
import { Mobject } from './mobject';
import { VMobject } from './vmobject';
import { smooth, RateFunc, resolveRateFunc } from '../math/rate-functions';
import { normalizeOptions } from './style';
import { lerpStyle } from './style';

export interface AnimOptions {
  runTime?: number;
  run_time?: number;
  rateFunc?: RateFunc | string;
  rate_func?: RateFunc | string;
  /** Real Manim `reverse_rate_function`: evaluates `rateFunc(1 - t)` rather
   *  than `1 - rateFunc(t)`. These coincide only for point-symmetric rate
   *  functions like `smooth`; for asymmetric ones (e.g. `rushInto`) they
   *  differ, so this must be a first-class flag, not a hand-rolled wrapper. */
  reverseRateFunc?: boolean;
  reverse_rate_function?: boolean;
  lagRatio?: number;
  lag_ratio?: number;
  remover?: boolean;
  introducer?: boolean;
  suspendMobjectUpdating?: boolean;
  suspend_mobject_updating?: boolean;
  name?: string;
}

export class Animation {
  mobject: Mobject | null;
  runTime: number;
  rateFunc: RateFunc;
  reverseRateFunc: boolean;
  lagRatio: number;
  remover = false;
  introducer = false;
  suspendMobjectUpdating = false;
  name: string;

  /** Start snapshots captured by the Scene before the clip begins. */
  protected startSnapshots: Map<Mobject, any> | null = null;

  constructor(mobject: Mobject | null, opts: AnimOptions = {}) {
    const o = normalizeOptions(opts) as Required<AnimOptions>;
    this.mobject = mobject;
    this.runTime = o.runTime ?? 1;
    this.rateFunc = resolveRateFunc(o.rateFunc as any);
    this.reverseRateFunc = o.reverseRateFunc ?? false;
    this.lagRatio = o.lagRatio ?? 0;
    this.remover = o.remover ?? false;
    this.introducer = o.introducer ?? false;
    // Real Manim defaults suspend_mobject_updating to True; Lumina keeps it
    // opt-in (false) since most Lumina animations read from an immutable
    // startSnapshot rather than mutating a live mobject an updater might
    // also be touching — but honor an explicit override either way.
    this.suspendMobjectUpdating = o.suspendMobjectUpdating ?? false;
    this.name = o.name ?? this.constructor.name;
  }

  isIntroducer(): boolean { return this.introducer; }
  isRemover(): boolean { return this.remover; }

  /**
   * Capture the starting state (called once at clip record time).
   * Snapshots the family of *every* target mobject (doc's
   * `getTargetMobjects()`), not just `this.mobject` — animations that
   * mutate a second mobject (FadeTransform, TransformMatchingTex) need
   * that second mobject's pre-state restored before each `apply()` too,
   * or its mutations compound across repeated seeks.
   */
  begin(): void {
    const targets = this.getTargetMobjects();
    const map = new Map<Mobject, any>();
    for (const t of targets) {
      for (const m of t.family()) {
        if (!map.has(m)) map.set(m, m.takeSnapshot());
      }
    }
    this.startSnapshots = map;
  }

  /**
   * Apply the animation at alpha ∈ [0,1] *relative to the recorded start*.
   * Pure: scene restores the start snapshot before calling.
   */
  apply(alpha: number): void {
    this.interpolateMobject(alpha);
  }

  /** Subclass interpolation point. */
  interpolateMobject(alpha: number): void {
    if (!this.mobject) return;
    // default: nothing (subclass responsibility)
  }

  /**
   * Sub-alpha for family member `i` of `n`, matching real ManimCE's
   * `Animation.get_sub_alpha` EXACTLY (verified against upstream source):
   *
   *   full_length = (n - 1) * lag_ratio + 1
   *   value = t * full_length
   *   lower = i * lag_ratio
   *   return rate_func(1 - (value - lower)) if reverse else rate_func(value - lower)
   *
   * `t` is the RAW (pre-rate-function) top-level alpha ∈ [0,1] — this method
   * applies `this.rateFunc` itself per-submobject, it does NOT take an
   * already-eased alpha. This is deliberately public (`computeSubAlpha`,
   * not the old private `subAlpha`) so creation/write-style animations in
   * animations/*.ts can share one correct implementation instead of each
   * hand-rolling their own (slightly different) staggering math.
   */
  computeSubAlpha(t: number, i: number, n: number): number {
    const lag = this.lagRatio;
    const fullLength = (n - 1) * lag + 1;
    const value = t * fullLength;
    const lower = i * lag;
    const raw = value - lower;
    return this.reverseRateFunc ? this.rateFunc(1 - raw) : this.rateFunc(raw);
  }

  /** Top-level alpha with rateFunc + reverseRateFunc applied (real Manim's
   *  `get_sub_alpha` degenerates to this when n=1, lagRatio=0). Timeline
   *  calls this instead of `anim.rateFunc(t)` directly so `reverseRateFunc`
   *  (real Manim's `Uncreate`/`Unwrite` flag) is honored correctly — unlike
   *  the coincidentally-equivalent `1 - rateFunc(t)` hand-rolled workaround
   *  this replaces, `rateFunc(1-t)` differs from `1-rateFunc(t)` for any
   *  rate function that isn't point-symmetric about (0.5, 0.5). */
  computeAlpha(t: number): number {
    return this.computeSubAlpha(t, 0, 1);
  }

  /** Jump to the end of the animation, respecting the rate function
   *  (e.g. `Indicate` uses `thereAndBack`, so its "end" equals its start). */
  finish(): void {
    this.apply(this.computeAlpha(1));
  }

  /** Restore every snapshotted mobject to its pre-animation state. Used by
   *  the Timeline before every `apply()` call so animations stay pure
   *  functions of alpha regardless of call order (seeking/scrubbing). */
  restoreStart(): void {
    if (!this.startSnapshots) return;
    for (const [m, snap] of this.startSnapshots) m.applySnapshot(snap);
  }

  /** Optional callback fired from `cleanUpFromScene` (real Manim's private
   *  `_on_finish`), settable by composition helpers (AnimationGroup etc). */
  onFinish: ((scene: any) => void) | null = null;

  /**
   * Scene-side bookkeeping at clip START (real Manim's `Animation._setup_scene`,
   * called by `Scene.begin_animations` BEFORE `begin()`): if this animation
   * introduces a mobject that the scene doesn't already know about, add it.
   * `Add`/`Create`/`FadeIn`/... all get this for free via `introducer=true`;
   * override for animations with bespoke scene-membership needs.
   */
  setupScene(scene: any): void {
    if (this.introducer && this.mobject) {
      const already = scene.getMobjectFamilyMembers?.().includes(this.mobject) ?? scene.mobjects?.includes(this.mobject);
      if (!already) scene.add(this.mobject);
    }
  }

  /** Scene-side bookkeeping at clip END (real Manim's `clean_up_from_scene`):
   *  fire `onFinish`, then remove the mobject if this animation is a remover. */
  cleanUpFromScene(scene: any): void {
    this.onFinish?.(scene);
    if (this.remover && this.mobject) scene.remove(this.mobject);
  }

  /** All mobjects this animation touches (for snapshotting). */
  getTargetMobjects(): Mobject[] {
    return this.mobject ? [this.mobject] : [];
  }

  /** Duration including lag staggering. */
  get duration(): number {
    return this.runTime;
  }
}

/** Late-bound Transform factory (avoids circular ESM imports). */
let transformFactory: ((a: Mobject, b: Mobject) => Animation) | null = null;
export function registerTransformFactory(f: (a: Mobject, b: Mobject) => Animation): void {
  transformFactory = f;
}

/** Squash an AnimationBuilder (.animate proxy) into a Transform-style anim. */
export function prepareAnimation(a: any): Animation {
  if (a instanceof Animation) return a;
  if (a && a.mobject && a.target) {
    // AnimationBuilder → interpolate mobject toward target
    if (!transformFactory) throw new Error('Transform module not loaded');
    return transformFactory(a.mobject as Mobject, a.target as Mobject);
  }
  throw new Error('play() expects Animation or .animate builder');
}
