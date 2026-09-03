/**
 * Lumina — creation.ts
 * Creation animations (doc 02 §B.4). Create uses pointwiseBecomePartial
 * (physical path shortening, never lineDash).
 *
 * Staggering: every ShowPartial-family animation supports `lagRatio` across
 * its immediate children (falling back to itself when childless), using
 * `Animation.computeSubAlpha` — the exact real-ManimCE `get_sub_alpha`
 * formula — instead of each animation hand-rolling its own local-alpha
 * arithmetic (verified against upstream `manim.animation.animation.Animation`).
 */
import { Animation, AnimOptions } from '../core/animation';
import { Mobject } from '../core/mobject';
import { VMobject } from '../core/vmobject';
import { Group } from '../core/group';
import { smooth, linear } from '../math/rate-functions';

export class ShowPartial extends Animation {
  /** Family members this animation staggers across (doc's lagRatio). Default:
   *  direct children if any exist, else the mobject itself (single unit). */
  protected staggerTargets(): Mobject[] {
    const kids = this.mobject!.children;
    return kids.length ? kids : [this.mobject!];
  }

  interpolateMobject(t: number): void {
    if (!this.mobject) return;
    const subs = this.staggerTargets();
    const n = subs.length;
    subs.forEach((sm, i) => {
      const local = this.computeSubAlpha(t, i, n);
      this.applyPartial(sm as VMobject, local);
    });
  }

  /**
   * Partial the path from the ORIGINAL full snapshot, never from the
   * mobject's current (possibly already-truncated) live points. Calling
   * `vm.pointwiseBecomePartial(vm, ...)` on the live object would compound
   * truncation across repeated apply() calls during scrubbing — this is
   * the stop-the-line bug the build plan warns about.
   */
  applyPartial(vm: VMobject, alpha: number): void {
    const snap = this.startSnapshots?.get(vm) as any;
    const full = snap ? snap.points : vm.points;
    vm.points = fullPartial(full, 0, alpha);
  }
}

/** De-Casteljau partial extraction against an immutable point array. */
function fullPartial(points: any[], a: number, b: number) {
  const tmp = new VMobject();
  (tmp as any).points = points;
  const out = new VMobject();
  out.pointwiseBecomePartial(tmp, a, b);
  return out.points;
}

export class Create extends ShowPartial {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { introducer: true, runTime: 1.5, ...opts });
  }
}

/** ManimGL name. */
export class ShowCreation extends Create {}

/**
 * Uncreate = Create played backwards. Real Manim implements this via
 * `reverse_rate_function=True` (not a hand-rolled `1 - rateFunc(t)` rate
 * func) — the two are only coincidentally equal for symmetric `smooth`;
 * for asymmetric rate functions they'd diverge, so we mirror the real flag.
 */
export class Uncreate extends ShowPartial {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { runTime: 1.5, reverseRateFunc: true, remover: true, ...opts });
  }
}

/** Stroke draws on, then fill fades in. Supports lagRatio staggering across
 *  children exactly like ShowPartial (real Manim's Write subclasses this
 *  with a nonzero default lagRatio; DrawBorderThenFill defaults to 0, i.e.
 *  all children animate in lockstep). */
export class DrawBorderThenFill extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { introducer: true, runTime: 2, ...opts });
  }

  protected staggerTargets(): Mobject[] {
    const kids = this.mobject!.children;
    return kids.length ? kids : [this.mobject!];
  }

  protected drawBorderThenFillOne(m: VMobject, local: number): void {
    const snap = this.startSnapshots!.get(m) as any;
    const fullPoints = snap ? snap.points : m.points;
    const fullFillOpacity = snap ? snap.style.fillOpacity : m.style.fillOpacity;
    if (local < 0.5) {
      m.points = fullPartial(fullPoints, 0, local / 0.5);
      m.style.fillOpacity = 0;
    } else {
      m.points = fullPoints.map((p: any) => [...p]);
      m.style.fillOpacity = (fullFillOpacity ?? 1) * ((local - 0.5) / 0.5);
    }
  }

  interpolateMobject(t: number): void {
    const subs = this.staggerTargets();
    const n = subs.length;
    subs.forEach((sm, i) => {
      const local = this.computeSubAlpha(t, i, n);
      this.drawBorderThenFillOne(sm as VMobject, local);
    });
  }
}

/** Write — border then fill, staggered across submobjects (for text). Real
 *  Manim's Write defaults `lagRatio` from glyph count (~4/n, clamped);
 *  Lumina keeps a fixed sensible default and lets callers override. */
export class Write extends DrawBorderThenFill {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { runTime: 2, lagRatio: 0.1, ...opts });
  }
}

export class Unwrite extends Write {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { reverseRateFunc: true, remover: true, ...opts });
  }
}

/** Add submobjects one after another (growing subset). */
export class ShowIncreasingSubsets extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { introducer: true, ...opts });
  }
  interpolateMobject(alpha: number): void {
    const subs = this.mobject!.children;
    const n = Math.floor(alpha * subs.length);
    subs.forEach((sm, i) => {
      sm.visible = i <= n;
    });
  }
}

/** Show one child at a time. */
export class ShowSubmobjectsOneByOne extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { introducer: true, ...opts });
  }
  interpolateMobject(alpha: number): void {
    const subs = this.mobject!.children;
    const idx = Math.floor(alpha * subs.length);
    subs.forEach((sm, i) => {
      sm.visible = i === idx;
    });
  }
}

/** Spiral into place. */
export class SpiralIn extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { introducer: true, ...opts });
  }
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    m.points = snap.points.map((p: any) => [...p]);
    const c = m.getCenter();
    const ang = (1 - alpha) * Math.PI * 2;
    const f = 1 + (1 - alpha) * 2;
    m.scale(f, { aboutPoint: c });
    m.rotate(ang, { aboutPoint: c });
    m.style.strokeOpacity = snap.style.strokeOpacity * alpha;
  }
}

/** Type text per glyph. */
export class AddTextLetterByLetter extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, { introducer: true, ...opts });
  }
  interpolateMobject(alpha: number): void {
    const subs = this.mobject!.children;
    const n = Math.ceil(alpha * subs.length);
    subs.forEach((sm, i) => { sm.visible = i < n; });
  }
}

export class AddTextWordByWord extends AddTextLetterByLetter {}
export class RemoveTextLetterByLetter extends AddTextLetterByLetter {
  interpolateMobject(alpha: number): void {
    const subs = this.mobject!.children;
    const n = Math.ceil((1 - alpha) * subs.length);
    subs.forEach((sm, i) => { sm.visible = i < n; });
  }
}

/** Typewriter with cursor mobject. */
export class TypeWithCursor extends Animation {
  constructor(mobject: Mobject, cursor: Mobject, opts: AnimOptions = {}) {
    super(mobject, { introducer: true, ...opts });
    this.cursor = cursor;
  }
  cursor: Mobject;
  interpolateMobject(alpha: number): void {
    const subs = this.mobject!.children;
    const n = Math.ceil(alpha * subs.length);
    subs.forEach((sm, i) => { sm.visible = i < n; });
    if (subs[n]) this.cursor.moveTo(subs[n].getRight());
  }
  /** Cursor is a scene-visible helper mobject alongside `mobject`. */
  get extraMobjects(): Mobject[] { return [this.cursor]; }
}

export class UntypeWithCursor extends TypeWithCursor {
  interpolateMobject(alpha: number): void {
    const subs = this.mobject!.children;
    const n = Math.ceil((1 - alpha) * subs.length);
    subs.forEach((sm, i) => { sm.visible = i < n; });
  }
}

/**
 * Instantly add one or more mobjects to the scene (real ManimCE `Add`:
 * `Add(*mobjects, run_time=0.0)`, variadic — multiple mobjects are wrapped
 * in a `Group` so a single Animation/clip introduces all of them together).
 * All lifecycle methods besides `setupScene`/`cleanUpFromScene` are no-ops,
 * matching upstream (`begin`/`finish`/`interpolate` all `pass`).
 */
export class Add extends Animation {
  constructor(...args: any[]) {
    // Trailing plain-object AnimOptions (e.g. { runTime }) vs. mobjects.
    let opts: AnimOptions = {};
    let mobjects: Mobject[] = args as Mobject[];
    const last = args[args.length - 1];
    if (last && !(last instanceof Mobject)) {
      opts = last as AnimOptions;
      mobjects = args.slice(0, -1) as Mobject[];
    }
    const target = mobjects.length === 1 ? mobjects[0] : new Group(...mobjects);
    super(target, { runTime: 0, introducer: true, ...opts });
  }
  begin(): void {}
  finish(): void {}
  interpolateMobject(): void {}
}

/**
 * "No operation" animation (real ManimCE `Wait`) — a genuine Animation
 * instance (not just Timeline dead-time bookkeeping) so it composes inside
 * `AnimationGroup`/`Succession` and so `Scene.wait()` can be expressed as
 * `scene.play(new Wait(seconds))` for API parity with upstream, matching
 * `Scene.wait()`'s real implementation (`self.play(Wait(run_time=duration, ...))`).
 * All lifecycle hooks are no-ops (matches upstream exactly); a `stopCondition`
 * is stored for callers that want to end the wait early during live playback
 * (Lumina's record-then-seek Timeline itself just uses the fixed duration).
 */
export class Wait extends Animation {
  stopCondition: (() => boolean) | null;
  isStaticWait: boolean | null;

  constructor(runTime = 1, opts: AnimOptions & { stopCondition?: () => boolean; frozenFrame?: boolean } = {}) {
    super(null, { runTime, rateFunc: linear, ...opts });
    this.stopCondition = opts.stopCondition ?? null;
    this.isStaticWait = opts.frozenFrame ?? null;
  }
  begin(): void {}
  finish(): void {}
  cleanUpFromScene(): void {}
  interpolateMobject(): void {}
}
