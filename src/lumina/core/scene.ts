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
import { Camera, ThreeDCamera } from '../cameras/camera';
import { Canvas2DRenderer } from '../renderers/canvas2d';
import { WebGLRenderer } from '../renderers/webgl';
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

  protected updaters: Array<(dt: number) => void> = [];
  protected exposed: ExposedTracker[] = [];
  protected renderer: Canvas2DRenderer | null = null;
  protected canvas: HTMLCanvasElement | null = null;
  protected overlay: HTMLElement | null = null;
  protected rafHandle: number | null = null;
  protected playing = false;

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
    const drawList = this.getDrawList(t);
    if (!this.renderer) return;
    this.renderer.render(drawList, this.background);
  }

  /** Subclass hook: the family of mobjects to hand to the renderer(s) at
   *  time `t` (base Scene just returns everything visible on the timeline;
   *  `ThreeDScene` reuses this to feed both the WebGL and Canvas2D layers). */
  protected getDrawList(t: number): Mobject[] {
    const visible = this.timeline.render(t);
    const drawList = visible.filter((m) => !this.foregroundMobjects.includes(m));
    drawList.push(...this.foregroundMobjects.filter((m) => visible.includes(m)));
    return drawList;
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

/**
 * ThreeDScene — hosts a `ThreeDCamera` and composites an owned WebGL2 3D
 * layer UNDER the existing Canvas2D 2D layer (doc 08 §2.1 hybrid stack,
 * doc 07 §9 ThreeDScene API). 2D VMobjects (labels, HUD, `fixInFrame()`d
 * overlays) keep drawing on top via the normal Canvas2D renderer; 3D
 * MeshMobjects (Sphere/Cube/Surface/...) are drawn by the WebGL renderer.
 *
 * API mirrors real ManimCE's `ThreeDScene` naming exactly:
 *   scene.setCameraOrientation({ phi, theta, gamma, zoom, frameCenter })
 *   scene.moveCamera({ phi, theta, runTime })       // instant in v1 (see note)
 *   scene.beginAmbientCameraRotation({ rate })
 *   scene.stopAmbientCameraRotation()
 *   scene.addFixedInFrame(mob)                       // HUD-style overlay
 *   mob.fixInFrame()
 *
 * Note on `moveCamera({ runTime })`: real ManimCE animates the camera move
 * over `runTime` as part of the Scene's frame loop. Lumina's record-then-
 * seek architecture doesn't have a per-frame camera animation primitive
 * yet (tracked in README gaps) — v1 applies the orientation change
 * immediately. Use `beginAmbientCameraRotation` for a continuously
 * animated camera (driven by `tickAmbient` every render tick), which DOES
 * work smoothly since it's re-evaluated from `scene.time` on every seek.
 */
export class ThreeDScene extends Scene {
  camera: ThreeDCamera = new ThreeDCamera();

  private glCanvas: HTMLCanvasElement | null = null;
  private glRenderer: WebGLRenderer | null = null;
  private fixedInFrameMobjects: Mobject[] = [];

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
    // Build a positioning host so the WebGL canvas can sit exactly behind
    // the 2D canvas (doc 08 §2.1: two stacked absolutely-positioned canvases).
    if (el && !this.canvas) {
      const host = document.createElement('div');
      host.style.position = 'relative';
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      const gl = document.createElement('canvas');
      gl.style.position = 'absolute';
      gl.style.left = '0';
      gl.style.top = '0';
      gl.style.display = 'block';
      const c2d = document.createElement('canvas');
      c2d.style.position = 'absolute';
      c2d.style.left = '0';
      c2d.style.top = '0';
      c2d.style.display = 'block';
      host.appendChild(gl);
      host.appendChild(c2d);
      el.appendChild(host);
      this.glCanvas = gl;
      this.canvas = c2d;
    }
    if (this.canvas) {
      this.renderer = new Canvas2DRenderer(this.canvas, this.camera);
      this.renderer.resize(width, height);
    }
    if (this.glCanvas) {
      this.glRenderer = new WebGLRenderer(this.glCanvas, this.camera);
      this.glRenderer.resize(width, height);
    }
  }

  /** doc 07 §9: ThreeDCamera orientation setter, exposed at the Scene level
   *  (real ManimCE puts these on Scene, delegating to self.camera). */
  setCameraOrientation(opts: { phi?: number; theta?: number; gamma?: number; distance?: number; zoom?: number; frameCenter?: Vec3 } = {}): void {
    this.camera.setCameraOrientation(normalizeOptions(opts));
  }

  moveCamera(opts: { phi?: number; theta?: number; gamma?: number; distance?: number; zoom?: number; frameCenter?: Vec3; runTime?: number } = {}): void {
    this.camera.moveCamera(normalizeOptions(opts));
  }

  beginAmbientCameraRotation(opts: { rate?: number } = {}): void {
    const o = normalizeOptions(opts);
    this.camera.beginAmbientCameraRotation(o.rate ?? 0.1);
  }

  stopAmbientCameraRotation(): void {
    this.camera.stopAmbientCameraRotation();
  }

  /** Register a mobject as HUD-style (always drawn in screen space,
   *  ignoring the 3D camera) — real ManimCE `add_fixed_in_frame_mobjects`. */
  addFixedInFrame(...mobs: Mobject[]): this {
    for (const m of mobs) m.fixInFrame(true);
    this.fixedInFrameMobjects.push(...mobs);
    this.add(...mobs);
    return this;
  }

  protected updateSelfWithAmbient(dt: number): void {
    this.camera.tickAmbient(dt);
  }

  /** Render both layers: WebGL 3D underneath, Canvas2D 2D (transparent) on
   *  top — the doc 08 §2.1 hybrid compositor. Ambient camera rotation (if
   *  active) only advances via the live `startPlayback` loop below, since
   *  `renderAt(t)` must stay a pure function of `t` for correct seeking. */
  renderAt(t: number): void {
    const drawList = this.getDrawList(t);
    if (this.glRenderer) this.glRenderer.render(drawList, this.background);
    if (this.renderer) this.renderer.render(drawList, this.background, { transparent: !!this.glRenderer });
  }

  startPlayback(fromT = this.clock.time): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    this.playing = true;
    this.clock.seek(fromT);
    const step = (ts: number) => {
      if (!this.playing) return;
      const dt = this.clock.tick(ts);
      this.camera.tickAmbient(dt);
      if (this.clock.time >= this.timeline.duration && this.camera.ambientRotationRate === 0) {
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
}

/**
 * ZoomedScene — a MovingCameraScene plus a small inset "zoomed display"
 * viewport (real ManimCE `ZoomedScene`). v1: exposes `zoomedCamera` and a
 * convenience `activateZooming()`; the inset is drawn by mounting a second
 * Canvas2DRenderer against `zoomedCamera.zoomedFrame` — left as an authoring
 * pattern (`scene.zoomedDisplayMount(el)`) rather than automatic DOM
 * injection, since inset placement/size is presentation-specific.
 */
import { ZoomedCamera } from '../cameras/camera';

export class ZoomedScene extends MovingCameraScene {
  zoomedCameraObj: ZoomedCamera = new ZoomedCamera();
  private zoomedRenderer: Canvas2DRenderer | null = null;

  get zoomedCamera(): ZoomedCamera { return this.zoomedCameraObj; }

  activateZooming(opts: { zoomFactor?: number; zoomedDisplayWidth?: number; zoomedDisplayHeight?: number } = {}): void {
    const o = normalizeOptions(opts);
    if (o.zoomFactor !== undefined) this.zoomedCameraObj.zoomFactor = o.zoomFactor;
    if (o.zoomedDisplayWidth !== undefined) this.zoomedCameraObj.zoomedFrame.width = o.zoomedDisplayWidth;
    if (o.zoomedDisplayHeight !== undefined) this.zoomedCameraObj.zoomedFrame.height = o.zoomedDisplayHeight;
  }

  /** Mount the small inset viewport into a separate DOM element. */
  zoomedDisplayMount(el: HTMLElement, width = 300, height = 300): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    el.appendChild(canvas);
    const proxyCamera = new Camera();
    proxyCamera.frame = this.zoomedCameraObj.zoomedFrame;
    this.zoomedRenderer = new Canvas2DRenderer(canvas, proxyCamera);
    this.zoomedRenderer.resize(width, height);
  }

  renderAt(t: number): void {
    super.renderAt(t);
    if (this.zoomedRenderer) {
      const drawList = this.getDrawList(t);
      this.zoomedRenderer.render(drawList, this.background);
    }
  }
}

/**
 * VectorScene — 2D-plane-plus-vectors convenience scene (real ManimCE
 * `VectorScene`): helpers for drawing labeled vectors on an implicit plane.
 * Kept intentionally thin — `NumberPlane`/`Axes` (doc 09, not yet
 * implemented) will subsume most of this once graphing lands; v1 exposes
 * the vector-drawing helpers real Manim scripts call most.
 */
export class VectorScene extends Scene {
  vectors: Mobject[] = [];

  /** Add an arrow from origin (or `at`) to `tip`, auto-imported from
   *  geometry/basic.ts's Vector at call time to avoid a circular import
   *  (geometry -> core -> scene would cycle if imported statically here). */
  addVector(tip: Vec3, opts: { color?: any; at?: Vec3 } = {}): Mobject {
    // Lazy require pattern avoided (ESM) — caller passes a pre-built Vector
    // mobject via `add()` normally; this convenience just registers +
    // tracks it the way real Manim's VectorScene.add_vector does for
    // subsequent `write_vector_coordinates` bookkeeping.
    throw new Error(
      'VectorScene.addVector: construct a Vector(tip, opts) from lumina and pass it to scene.add(); ' +
      'this convenience wrapper is intentionally not implemented to avoid a core->geometry circular import. ' +
      'Use: const vec = new Vector(tip, opts); scene.add(vec); scene.vectors.push(vec);'
    );
  }

  getVectorLabel(vector: Mobject): Mobject | null {
    return (vector as any).label ?? null;
  }
}
