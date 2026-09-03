/**
 * Lumina — scene.ts
 * The Scene: mobject membership, the record-then-seek Timeline, and the
 * `play()`/`wait()` orchestration point (doc 06 §4, doc 07 §3).
 *
 * Design cross-checked against real ManimCE's `Scene` source
 * (`manim.scene.scene.Scene`) and `Mobject._AnimationBuilder` /
 * `prepare_animation` (`manim.mobject.mobject`, `manim.animation.animation`)
 * fetched during this session's research pass. Real Manim's `Scene.play()`
 * lifecycle, verified from source, is:
 *
 *   1. compile_animation_data(*args, **kwargs)
 *        -> compile_animations: run `prepare_animation()` on every arg
 *           (Animation passthrough / `_AnimationBuilder.build()` for
 *           `.animate` proxies), apply play-time kwarg overrides.
 *        -> add_mobjects_from_animations: any animation target NOT already
 *           in the scene gets `scene.add()`ed immediately — UNLESS the
 *           animation `is_introducer()` (introducers decide their own
 *           scene membership later, in `_setup_scene`).
 *   2. begin_animations(): for each animation, `anim._setup_scene(scene)`
 *      (introducer-only: add to scene if not already a family member) THEN
 *      `anim.begin()` (which itself calls `interpolate(0)`).
 *   3. play_internal(): step through the time progression calling
 *      `update_to_time(t)` (interpolate + tick updaters) each frame.
 *   4. for each animation: `anim.finish()` (== `interpolate(1)`) THEN
 *      `anim.clean_up_from_scene(scene)` (remover-only: `scene.remove()`).
 *
 * Lumina's Scene reproduces this exact ordering, but since Lumina's
 * architecture is "run construct() once synchronously, recording a seekable
 * Timeline" rather than "render frame-by-frame to a video file", steps 2-4
 * collapse into ONE synchronous call per `play()` (`begin` immediately,
 * `finish`+`cleanUpFromScene` immediately after) whose ONLY externally
 * visible effect is: (a) mutate live mobjects to their end state so
 * subsequent `construct()` code sees correct `getCenter()`/etc results
 * (exactly like real Manim mutates `self.mobject` during rendering), and
 * (b) push a `ClipEntry` + membership `markers` onto `this.timeline` so
 * `render(t)` can later reproduce every intermediate frame purely.
 */
import { Mobject } from './mobject';
import { Animation, prepareAnimation } from './animation';
import { resolveRateFunc } from '../math/rate-functions';
import { Wait } from '../animations/creation';
import { Timeline } from './timeline';
import { Clock } from './clock';
import { Camera } from '../cameras/camera';
import { Canvas2DRenderer } from '../renderers/canvas2d';
import { Random } from '../math/rng';
import { normalizeOptions } from './style';
import { Vec3 } from '../math/vec';
import { FRAME_HEIGHT, FRAME_WIDTH } from '../math/constants';

export interface PlayOptions {
  runTime?: number;
  run_time?: number;
  rateFunc?: any;
  rate_func?: any;
  lagRatio?: number;
  lag_ratio?: number;
}

export interface SceneOptions {
  width?: number;
  height?: number;
  background?: string;
  frameHeight?: number;
  frameWidth?: number;
  fps?: number;
  renderer?: 'canvas2d' | 'webgl' | 'auto';
  seed?: number;
}

type Mount = { canvas: HTMLCanvasElement; overlay?: HTMLElement };

/** A single scene.expose() slider binding (doc 07 §12). */
export interface ExposedTracker {
  name: string;
  tracker: any; // ValueTracker
  ui?: { min?: number; max?: number; step?: number; label?: string };
}

export class Scene {
  mobjects: Mobject[] = [];
  foregroundMobjects: Mobject[] = [];
  camera: Camera = new Camera();
  clock = new Clock();
  timeline = new Timeline();
  rng: Random;
  pointer: Vec3 = [0, 0, 0];

  background = '#000000';
  fps = 60;

  private updaters: Array<(dt: number) => void> = [];
  private exposed: ExposedTracker[] = [];
  private renderer: Canvas2DRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private overlay: HTMLElement | null = null;
  private rafHandle: number | null = null;
  private playing = false;

  constructor(mount?: string | HTMLElement | Mount | null, options: SceneOptions = {}) {
    const o = normalizeOptions(options);
    this.background = o.background ?? '#000000';
    this.fps = o.fps ?? 60;
    this.rng = new Random(o.seed ?? 1);
    if (o.frameHeight) this.camera.setFrameHeight(o.frameHeight);
    if (o.frameWidth) this.camera.setFrameWidth(o.frameWidth);
    if (mount) this.mount(mount, o.width ?? 1280, o.height ?? 720);
  }

  /** Attach (or re-attach) to a DOM mount point. Safe to call from non-DOM
   *  (e.g. server-side prerender / test) environments — becomes a no-op. */
  mount(target: string | HTMLElement | Mount, width = 1280, height = 720): void {
    if (typeof document === 'undefined') return;
    let el: HTMLElement | null = null;
    if (typeof target === 'string') el = document.querySelector(target);
    else if ((target as Mount).canvas) {
      this.canvas = (target as Mount).canvas;
      this.overlay = (target as Mount).overlay ?? null;
    } else {
      el = target as HTMLElement;
    }
    if (el && !this.canvas) {
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      el.appendChild(canvas);
      this.canvas = canvas;
    }
    if (this.canvas) {
      this.renderer = new Canvas2DRenderer(this.canvas, this.camera);
      this.renderer.resize(width, height);
    }
  }

  get time(): number {
    return this.clock.time;
  }

  /* ------------------------------------------------------------------ */
  /* Mobject membership (real Manim Scene.add/remove/clear/bring*)      */
  /* ------------------------------------------------------------------ */

  /** Depth-first family members of every top-level scene mobject (real
   *  Manim's `get_mobject_family_members`). */
  getMobjectFamilyMembers(): Mobject[] {
    const out: Mobject[] = [];
    for (const m of this.mobjects) out.push(...m.family());
    return out;
  }

  add(...mobs: Mobject[]): this {
    const fam = new Set(this.getMobjectFamilyMembers());
    for (const m of mobs) {
      if (!this.mobjects.includes(m)) this.mobjects.push(m);
      for (const sub of m.family()) sub.__scene = this;
      this.timeline.markAdd(m);
    }
    return this;
  }

  remove(...mobs: Mobject[]): this {
    for (const m of mobs) {
      const i = this.mobjects.indexOf(m);
      if (i >= 0) this.mobjects.splice(i, 1);
      this.timeline.markRemove(m);
    }
    return this;
  }

  clear(): this {
    for (const m of [...this.mobjects]) this.timeline.markRemove(m);
    this.mobjects = [];
    this.foregroundMobjects = [];
    return this;
  }

  bringToFront(...mobs: Mobject[]): this {
    this.add(...mobs); // real Manim: re-add pushes to the end (draw-last = front)
    return this;
  }

  sendToBack(...mobs: Mobject[]): this {
    this.remove(...mobs);
    this.mobjects = [...mobs, ...this.mobjects];
    return this;
  }

  addForegroundMobjects(...mobs: Mobject[]): this {
    this.foregroundMobjects.push(...mobs);
    this.add(...mobs);
    return this;
  }

  /**
   * Real Manim's `add_mobjects_from_animations`: any non-introducer
   * animation's target that isn't already a scene family member gets
   * `add()`ed immediately, BEFORE `begin_animations`/`_setup_scene` runs.
   * Introducers (Create/FadeIn/Write/GrowFromCenter/Add/...) are exempt —
   * they decide their own scene membership via `setupScene()`.
   */
  private addMobjectsFromAnimations(anims: Animation[]): void {
    const curr = new Set(this.getMobjectFamilyMembers());
    for (const anim of anims) {
      if (anim.isIntroducer()) continue;
      const mob = anim.mobject;
      if (mob && !curr.has(mob)) {
        this.add(mob);
        for (const f of mob.family()) curr.add(f);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* play() / wait() — the record-then-seek orchestration point         */
  /* ------------------------------------------------------------------ */

  /**
   * Play one or more animations (or `.animate` builders) simultaneously.
   * Mirrors real Manim's play() ordering exactly (see file header), but
   * collapses the per-frame render loop into a single synchronous record
   * step — Lumina defers actual pixel rendering to `Timeline.render(t)`,
   * called by the Player/live-loop, not by `play()` itself.
   */
  async play(...args: Array<Animation | any | PlayOptions>): Promise<void> {
    let opts: PlayOptions = {};
    const last = args[args.length - 1];
    // A plain PlayOptions object is neither an Animation instance nor an
    // AnimationBuilder (`.animate` proxy — identifiable by its `.mobject`
    // AND `.target` both being actual Mobject instances, not just present
    // keys, since a stray options object could coincidentally have those
    // key names too).
    const isAnimationBuilder =
      last && typeof last === 'object' &&
      last.mobject instanceof Mobject && last.target instanceof Mobject;
    const isPlainOpts =
      last && typeof last === 'object' && !(last instanceof Animation) && !isAnimationBuilder &&
      (('runTime' in last) || ('run_time' in last) || ('rateFunc' in last) || ('rate_func' in last) || ('lagRatio' in last) || ('lag_ratio' in last));
    if (isPlainOpts) {
      opts = normalizeOptions(args.pop() as PlayOptions);
    }

    if (args.length === 0) return;

    // 1. compile_animations: prepare_animation() on each arg + apply overrides.
    const anims: Animation[] = args.map((a) => prepareAnimation(a));
    for (const a of anims) {
      if (opts.runTime !== undefined) a.runTime = opts.runTime;
      if (opts.rateFunc !== undefined) (a as any).rateFunc = resolveRateFunc(opts.rateFunc as any);
      if (opts.lagRatio !== undefined) a.lagRatio = opts.lagRatio;
    }

    // 2. add_mobjects_from_animations (non-introducer targets join the scene now).
    this.addMobjectsFromAnimations(anims);

    // 3. begin_animations: _setup_scene (introducers join here) then begin().
    for (const a of anims) {
      a.setupScene(this);
      a.begin();
    }

    const runTime = Math.max(...anims.map((a) => a.runTime), 0);

    // 4. Record the clip onto the seekable Timeline BEFORE mutating anything
    //    further, so Timeline.render() can replay every intermediate alpha.
    this.timeline.addClip(anims, runTime);

    // Also record membership transitions for extraMobjects (ephemeral helper
    // mobjects like Circumscribe's box / Flash's rays / FocusOn's dot /
    // Broadcast's rings) — these have no real-Manim analogue (they're scene-
    // internal helpers of a single animation), so Lumina wires them here:
    // visible for the clip's duration, gone once it finishes.
    const clipT0 = this.timeline.cursor - runTime;
    for (const a of anims) {
      const extra: Mobject[] = (a as any).extraMobjects ?? [];
      for (const m of extra) {
        this.timeline.markAdd(m, clipT0);
        this.timeline.markRemove(m, clipT0 + runTime);
      }
    }

    // 5. Advance the clock, tick updaters across the elapsed span, then
    //    finish() + cleanUpFromScene() exactly like real Manim's tail step.
    this.clock.time = this.timeline.cursor;
    this.updateSelf(runTime);
    for (const a of anims) {
      a.finish();
      a.cleanUpFromScene(this);
    }
  }

  /**
   * "No operation" animation (real ManimCE `Scene.wait`, which is literally
   * `self.play(Wait(run_time=duration, stop_condition=..., frozen_frame=...))`).
   * Lumina mirrors that exactly instead of special-casing wait as bare
   * Timeline dead-time, so `Wait` composes correctly inside
   * `AnimationGroup`/`Succession` and the Timeline stays the single source
   * of truth for scene duration.
   */
  async wait(duration = 1, opts: { stopCondition?: () => boolean; frozenFrame?: boolean } = {}): Promise<void> {
    await this.play(new Wait(duration, opts));
  }

  section(name: string, type = 'default'): void {
    this.timeline.addSection(name, type);
  }

  /** Optional sugar: `await scene.construct(async (s) => { ... })`. */
  async construct(fn: (scene: this) => Promise<void> | void): Promise<void> {
    this.clock.reset();
    this.timeline.reset();
    await fn(this);
  }

  /* ------------------------------------------------------------------ */
  /* Updaters (real Manim Scene.add_updater/remove_updater/update_self)  */
  /* ------------------------------------------------------------------ */

  addUpdater(fn: (dt: number) => void): void {
    this.updaters.push(fn);
  }

  removeUpdater(fn: (dt: number) => void): void {
    this.updaters = this.updaters.filter((f) => f !== fn);
  }

  /** Tick every mobject's own updaters, then every scene-level updater
   *  (real Manim: mobject updaters, then mesh updaters, then scene
   *  updaters — scene updaters always run last). */
  private updateSelf(dt: number): void {
    for (const m of this.mobjects) m.update(dt);
    for (const f of this.updaters) f(dt);
  }

  /* ------------------------------------------------------------------ */
  /* Sliders / exposed trackers (doc 07 §12)                             */
  /* ------------------------------------------------------------------ */

  expose(name: string, tracker: any, ui?: ExposedTracker['ui']): this {
    this.exposed.push({ name, tracker, ui });
    return this;
  }

  getExposedTrackers(): ExposedTracker[] {
    return this.exposed;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering (live loop; Player drives seeking separately)             */
  /* ------------------------------------------------------------------ */

  /** Render one frame at absolute scene time `t` (pure — safe to call from
   *  a scrubber). Mutates the recorded mobjects' points/style in place via
   *  `Timeline.render`, then draws whatever's currently a member. */
  renderAt(t: number): void {
    const visible = this.timeline.render(t);
    if (!this.renderer) return;
    const drawList = visible.filter((m) => !this.foregroundMobjects.includes(m));
    drawList.push(...this.foregroundMobjects.filter((m) => visible.includes(m)));
    this.renderer.render(drawList, this.background);
  }

  /** Draw the current live state without seeking (used right after a
   *  `play()`/`wait()` call completes, i.e. scrubber at the playhead). */
  renderNow(): void {
    this.renderAt(this.clock.time);
  }

  /** Start a real-time playback loop from `fromT` (Player transport). */
  startPlayback(fromT = this.clock.time): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    this.playing = true;
    this.clock.seek(fromT);
    const step = (ts: number) => {
      if (!this.playing) return;
      const dt = this.clock.tick(ts);
      if (this.clock.time >= this.timeline.duration) {
        this.clock.time = this.timeline.duration;
        this.renderAt(this.clock.time);
        this.playing = false;
        return;
      }
      this.renderAt(this.clock.time);
      this.rafHandle = requestAnimationFrame(step);
    };
    this.rafHandle = requestAnimationFrame(step);
  }

  pausePlayback(): void {
    this.playing = false;
    if (this.rafHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  seek(t: number): void {
    this.clock.seek(Math.max(0, Math.min(this.timeline.duration, t)));
    this.renderAt(this.clock.time);
  }

  addSound(_url: string, _timeOffset?: number): void {
    // Phase 3 (doc 07 §3): audio track synced to the Timeline. Not yet
    // implemented — intentionally a documented no-op stub for now.
  }

  destroy(): void {
    this.pausePlayback();
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}

/* ---------------- Scene subclasses (doc 07 §3) ---------------------- */

import { MovingCamera } from '../cameras/camera';

/** MovingCameraScene: camera.frame is itself an animatable mobject
 *  (`scene.camera.frame.animate.shift(...)` etc via `FrameMobject`). */
export class MovingCameraScene extends Scene {
  camera: MovingCamera = new MovingCamera();
}
