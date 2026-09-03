/**
 * Lumina — changing.ts
 * TracedPath / AnimatedBoundary / ChangeSpeed / UpdateFromFunc /
 * UpdateFromAlphaFunc / MaintainPositionRelativeTo (doc 07 §10 "misc"
 * group — confirmed missing via export-manifest audit).
 *
 * Known architectural caveat (documented in core/timeline.ts's header):
 * Lumina's Timeline is a pure record-then-seek replay of `Animation`
 * clips; a plain `Mobject.addUpdater` callback (not wrapped in an
 * Animation) only ticks once per `Scene.play()` call at RECORD time —
 * it is not re-derived when later seeking to an arbitrary earlier t.
 * TracedPath and AnimatedBoundary below use `addUpdater` (matching real
 * ManimCE's own implementation, which is also a live per-frame updater,
 * not something `interpolate()`-driven), so they trace correctly during
 * forward playback/recording but — like real Manim's own updater-based
 * mobjects — are not perfectly reconstructable from a scrub to a t in the
 * past. This mirrors upstream behavior closely enough for the vast
 * majority of real usage (they're always added once and left running).
 */
import { Animation, AnimOptions } from '../core/animation';
import { Mobject } from '../core/mobject';
import { VMobject } from '../core/vmobject';
import { ManimColor, resolveColor, interpolateColors } from '../math/color';
import { Vec3, v } from '../math/vec';

/**
 * A VMobject that grows a polyline tracing `tracedPointFunc()` every time
 * its updater ticks (real ManimCE `TracedPath`). Not an Animation — add it
 * to the scene directly (`scene.add(new TracedPath(() => dot.getCenter()))`)
 * alongside whatever's animating the traced point.
 */
export class TracedPath extends VMobject {
  tracedPointFunc: () => Vec3;
  dissipatingTime: number | null;
  private history: Array<{ t: number; p: Vec3 }> = [];

  constructor(
    tracedPointFunc: () => Vec3,
    opts: { strokeColor?: ManimColor; strokeWidth?: number; dissipatingTime?: number } = {}
  ) {
    super(opts);
    this.tracedPointFunc = tracedPointFunc;
    this.dissipatingTime = opts.dissipatingTime ?? null;
    if (opts.strokeColor) this.style.stroke = resolveColor(opts.strokeColor);
    if (opts.strokeWidth !== undefined) this.style.strokeWidth = opts.strokeWidth;
    this.addUpdater(() => this.tick());
  }

  private tick(): void {
    const now = this.getSceneTime();
    this.history.push({ t: now, p: v(this.tracedPointFunc()) });
    if (this.dissipatingTime !== null) {
      const cutoff = now - this.dissipatingTime;
      while (this.history.length && this.history[0].t < cutoff) this.history.shift();
    }
    const pts = this.history.map((h) => h.p);
    if (pts.length < 2) { this.points = []; return; }
    // straight-segment cubics between consecutive traced points (matches
    // real Manim's TracedPath, which also just accumulates a polyline).
    const out: Vec3[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      out.push(a, [(2 * a[0] + b[0]) / 3, (2 * a[1] + b[1]) / 3, (2 * a[2] + b[2]) / 3],
        [(a[0] + 2 * b[0]) / 3, (a[1] + 2 * b[1]) / 3, (a[2] + 2 * b[2]) / 3], b);
    }
    this.points = out;
  }
}

/**
 * A pulsing/color-cycling outline that hugs a target mobject's own path
 * (real ManimCE `AnimatedBoundary`). Its updater re-copies the target's
 * current points every tick and cycles the stroke color through `colors`
 * over `cycleTime` seconds, giving the "shimmering boundary" look used to
 * draw attention to a shape without obscuring it.
 */
export class AnimatedBoundary extends VMobject {
  boundaryTarget: VMobject;
  colors: ManimColor[];
  cycleTime: number;

  constructor(
    target: VMobject,
    opts: { colors?: ManimColor[]; maxStrokeWidth?: number; cycleTime?: number } = {}
  ) {
    super();
    this.boundaryTarget = target;
    this.colors = (opts.colors ?? ['#3B82F6', '#22D3EE', '#3B82F6']).map(resolveColor);
    this.cycleTime = opts.cycleTime ?? 3;
    this.style.strokeWidth = opts.maxStrokeWidth ?? 4;
    this.style.fillOpacity = 0;
    this.addUpdater(() => this.tick());
  }

  private tick(): void {
    this.points = this.boundaryTarget.points.map((p) => [...p] as Vec3);
    this.closed = this.boundaryTarget.closed;
    const phase = (this.getSceneTime() % this.cycleTime) / this.cycleTime;
    const n = this.colors.length;
    const idx = Math.min(n - 2, Math.floor(phase * (n - 1)));
    const local = phase * (n - 1) - idx;
    this.style.stroke = interpolateColors(this.colors[idx], this.colors[idx + 1] ?? this.colors[idx], local);
  }
}

/**
 * Wrap an existing Animation and rescale how quickly it moves through its
 * own alpha (real ManimCE `ChangeSpeed`). `speedinfo` maps a *time ratio*
 * (0..1 of the wrapped anim's original duration) to a relative speed
 * multiplier at that point; ratios are pieced together into a monotonic
 * remapping of alpha via numeric integration, so `{ 0: 1, 0.5: 3, 1: 1 }`
 * plays at normal speed, speeds through the middle, then normal again —
 * while `runTime` is inherited unchanged unless overridden.
 */
export class ChangeSpeed extends Animation {
  private inner: Animation;
  private remap: (t: number) => number;

  constructor(anim: Animation, opts: AnimOptions & { speedinfo?: Record<string, number>; speedRatio?: number } = {}) {
    const { speedinfo, speedRatio, ...rest } = opts;
    super(anim.mobject, { runTime: anim.runTime, ...rest });
    this.inner = anim;
    if (speedinfo) {
      const entries = Object.entries(speedinfo).map(([k, v]) => [parseFloat(k), v] as [number, number]).sort((a, b) => a[0] - b[0]);
      this.remap = buildSpeedRemap(entries);
    } else {
      const r = speedRatio ?? 1;
      this.remap = (t) => Math.min(1, t * r);
    }
  }
  getTargetMobjects(): Mobject[] { return this.inner.getTargetMobjects(); }
  setupScene(scene: any): void { this.inner.setupScene(scene); }
  begin(): void { this.inner.begin(); }
  restoreStart(): void { this.inner.restoreStart(); }
  interpolateMobject(t: number): void {
    this.inner.apply(this.inner.computeAlpha(this.remap(t)));
  }
  cleanUpFromScene(scene: any): void {
    this.onFinish?.(scene);
    this.inner.cleanUpFromScene(scene);
  }
}

/** Numerically integrate a piecewise-linear speed-multiplier curve into a
 *  monotonic alpha remap sampled at 256 points, then linearly interpolate. */
function buildSpeedRemap(entries: Array<[number, number]>): (t: number) => number {
  if (entries.length === 0) return (t) => t;
  const speedAt = (t: number): number => {
    if (t <= entries[0][0]) return entries[0][1];
    for (let i = 1; i < entries.length; i++) {
      if (t <= entries[i][0]) {
        const [t0, s0] = entries[i - 1];
        const [t1, s1] = entries[i];
        const local = (t - t0) / Math.max(1e-9, t1 - t0);
        return s0 + (s1 - s0) * local;
      }
    }
    return entries[entries.length - 1][1];
  };
  const N = 256;
  const raw = new Array(N + 1).fill(0);
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    raw[i] = raw[i - 1] + speedAt(t) * (1 / N);
  }
  const total = raw[N] || 1;
  const norm = raw.map((x) => x / total);
  return (t: number) => {
    const idx = Math.min(N, Math.max(0, Math.round(t * N)));
    return norm[idx];
  };
}

/** Call `fn(mobject)` every frame without altering points automatically
 *  (real ManimCE `UpdateFromFunc`) — the function itself is responsible
 *  for any mutation (shift/setColor/etc.). */
export class UpdateFromFunc extends Animation {
  fn: (m: Mobject) => void;
  constructor(mobject: Mobject, fn: (m: Mobject) => void, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.fn = fn;
  }
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    if (snap) m.applySnapshot(snap);
    this.fn(m);
  }
}

/** Like `UpdateFromFunc` but the callback also receives the current alpha
 *  (real ManimCE `UpdateFromAlphaFunc`). */
export class UpdateFromAlphaFunc extends Animation {
  fn: (m: Mobject, alpha: number) => void;
  constructor(mobject: Mobject, fn: (m: Mobject, alpha: number) => void, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.fn = fn;
  }
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const snap = this.startSnapshots!.get(m) as any;
    if (snap) m.applySnapshot(snap);
    this.fn(m, alpha);
  }
}

/**
 * Keep `mobject` glued to `target` at their initial relative offset for
 * the duration of the clip (real ManimCE `MaintainPositionRelativeTo`) —
 * useful when `target` is itself being moved by a simultaneous animation
 * in the same `play()` call.
 */
export class MaintainPositionRelativeTo extends Animation {
  target: Mobject;
  private offset: Vec3 = [0, 0, 0];
  constructor(mobject: Mobject, target: Mobject, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.target = target;
  }
  begin(): void {
    super.begin();
    const mc = this.mobject!.getCenter();
    const tc = this.target.getCenter();
    this.offset = [mc[0] - tc[0], mc[1] - tc[1], mc[2] - tc[2]];
  }
  interpolateMobject(): void {
    const tc = this.target.getCenter();
    this.mobject!.moveTo([tc[0] + this.offset[0], tc[1] + this.offset[1], tc[2] + this.offset[2]]);
  }
}
