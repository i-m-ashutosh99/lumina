/**
 * Lumina — player/player.ts
 * `Player`: the first-party JS transport-control wrapper around `Scene`
 * (doc 08 §4.4 "Player JS API for custom chrome"). This is consumption
 * mode 2 from doc 08 §1: "your HTML/CSS, our renderer".
 *
 * Player does NOT paint any DOM — it wraps `Scene.startPlayback` /
 * `pausePlayback` / `seek` / `this.timeline.duration` (already implemented
 * in core/scene.ts) with:
 *   - play/pause/toggle
 *   - seek(t) / seekSection(i)
 *   - setSpeed(x) (drives `scene.clock.speed`)
 *   - setLoop(bool) (restarts from 0 when the timeline ends)
 *   - enterFullscreen() / exitFullscreen()
 *   - keyboard shortcuts (doc 08 §4.1 table) — opt-in via `attachKeyboard()`
 *   - section navigation (`scene.timeline.sections`, doc 08 §4.1 "[ ] keys")
 *   - `.on(event, cb)` — 'time' | 'section' | 'ended' | 'play' | 'pause'
 *
 * `<lumina-player>` (player/element.ts) is a thin custom-element shell that
 * constructs one of these and paints default chrome on top — authors who
 * want their own chrome use this class directly with `controls: false`.
 */
import type { Scene } from '../core/scene';

export type PlayerEvent = 'time' | 'section' | 'ended' | 'play' | 'pause' | 'loop' | 'speed';

export interface PlayerOptions {
  /** Mount point for the canvas (forwarded to `scene.mount()` if the scene
   *  isn't already mounted). Optional — pass an already-mounted Scene and
   *  omit this. */
  mount?: string | HTMLElement;
  /** An already-constructed Scene (already ran `construct()` — i.e. its
   *  timeline is fully recorded) OR a zero-arg factory returning one
   *  (sync or async) that Player will construct + await on `Player.ready`. */
  scene: Scene | (() => Scene | Promise<Scene>);
  /** Loop back to t=0 when playback reaches the end. Default false. */
  loop?: boolean;
  /** Initial speed multiplier. Default 1. */
  speed?: number;
  /** Respect `prefers-reduced-motion` (doc 08 §4.5): jump to each section's
   *  last frame instead of animating through it. Default false. */
  respectPrefersReducedMotion?: boolean;
}

type Listener = (payload: any) => void;

/**
 * Player — framework-agnostic transport controller for one Scene.
 *
 * ```js
 * const player = new Player({ scene: myScene, loop: true });
 * await player.ready;
 * player.play();
 * player.on('time', ({ t, duration }) => updateMySlider(t, duration));
 * ```
 */
export class Player {
  scene: Scene;
  loop: boolean;
  respectPrefersReducedMotion: boolean;

  /** Resolves once the scene (if given as a factory) is constructed and
   *  the timeline is ready to seek/play. */
  ready: Promise<void>;

  private listeners: Map<PlayerEvent, Set<Listener>> = new Map();
  private rafHandle: number | null = null;
  private _playing = false;
  private _currentSection = -1;
  private _fullscreenEl: HTMLElement | null = null;
  private _keyboardTarget: HTMLElement | Document | null = null;
  private _keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
  private _tickHandle: number | null = null;

  constructor(opts: PlayerOptions) {
    this.loop = opts.loop ?? false;
    this.respectPrefersReducedMotion = opts.respectPrefersReducedMotion ?? false;

    if (typeof opts.scene === 'function') {
      // Factory: Player owns construction. `scene` is assigned synchronously
      // to a placeholder-free reference once the promise resolves; until
      // then most calls no-op (checked via `this.scene` truthiness).
      this.scene = undefined as any;
      this.ready = Promise.resolve(opts.scene()).then((s) => {
        this.scene = s;
        if (opts.speed !== undefined) this.scene.clock.setSpeed(opts.speed);
        this._wireSceneLoopEnd();
      });
    } else {
      this.scene = opts.scene;
      if (opts.speed !== undefined) this.scene.clock.setSpeed(opts.speed);
      this._wireSceneLoopEnd();
      this.ready = Promise.resolve();
    }
  }

  /* ---------------- event bus ---------------- */

  on(event: PlayerEvent, cb: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return this;
  }

  off(event: PlayerEvent, cb: Listener): this {
    this.listeners.get(event)?.delete(cb);
    return this;
  }

  private emit(event: PlayerEvent, payload?: any): void {
    for (const cb of this.listeners.get(event) ?? []) cb(payload);
  }

  /* ---------------- transport ---------------- */

  get duration(): number {
    return this.scene?.timeline.duration ?? 0;
  }

  get time(): number {
    return this.scene?.clock.time ?? 0;
  }

  get playing(): boolean {
    return this._playing;
  }

  get speed(): number {
    return this.scene?.clock.speed ?? 1;
  }

  /** Start (or resume) playback from the current playhead. */
  play(): void {
    if (!this.scene || this._playing) return;
    this._playing = true;
    // If we're already at the end and not looping, restart from 0 (common
    // "press play after it finished" UX — real <video> elements do this).
    const atEnd = this.time >= this.duration - 1e-6;
    this.scene.startPlayback(atEnd ? 0 : this.time);
    this._startTicking();
    this.emit('play');
  }

  pause(): void {
    if (!this.scene || !this._playing) return;
    this._playing = false;
    this.scene.pausePlayback();
    this._stopTicking();
    this.emit('pause');
  }

  toggle(): void {
    if (this._playing) this.pause();
    else this.play();
  }

  /** Seek to an absolute time in seconds, clamped to [0, duration]. */
  seek(t: number): void {
    if (!this.scene) return;
    const clamped = Math.max(0, Math.min(this.duration, t));
    this.scene.seek(clamped);
    this._updateCurrentSection();
    this.emit('time', { t: clamped, duration: this.duration });
  }

  /** Seek by a relative delta (doc 08 §4.1 "Skip ±5s"). */
  seekBy(deltaSeconds: number): void {
    this.seek(this.time + deltaSeconds);
  }

  /** Jump to the start time of section `i` (doc 08 §4.1 prev/next section). */
  seekSection(i: number): void {
    const sections = this.scene?.timeline.sections ?? [];
    if (i < 0 || i >= sections.length) return;
    this.seek(sections[i].t);
    this._currentSection = i;
    this.emit('section', { index: i, name: sections[i].name });
  }

  nextSection(): void {
    const sections = this.scene?.timeline.sections ?? [];
    const i = this._currentSectionIndex();
    if (i + 1 < sections.length) this.seekSection(i + 1);
    else this.seekSection(sections.length - 1);
  }

  prevSection(): void {
    const i = this._currentSectionIndex();
    this.seekSection(Math.max(0, i - 1));
  }

  private _currentSectionIndex(): number {
    const sections = this.scene?.timeline.sections ?? [];
    let idx = 0;
    for (let i = 0; i < sections.length; i++) if (sections[i].t <= this.time) idx = i;
    return idx;
  }

  private _updateCurrentSection(): void {
    const idx = this._currentSectionIndex();
    if (idx !== this._currentSection) {
      this._currentSection = idx;
      const sections = this.scene?.timeline.sections ?? [];
      if (sections[idx]) this.emit('section', { index: idx, name: sections[idx].name });
    }
  }

  /** Step one frame forward while paused (doc 08 §4.1 "s" key), assuming
   *  the scene's configured fps. */
  stepFrame(dir: 1 | -1 = 1): void {
    if (this._playing) this.pause();
    const dt = 1 / (this.scene?.fps ?? 60);
    this.seek(this.time + dir * dt);
  }

  setSpeed(x: number): void {
    if (!this.scene) return;
    this.scene.clock.setSpeed(x);
    this.emit('speed', { speed: this.scene.clock.speed });
  }

  setLoop(v: boolean): void {
    this.loop = v;
    this.emit('loop', { loop: v });
  }

  /* ---------------- fullscreen (doc 08 §4.1 "f") ---------------- */

  enterFullscreen(el?: HTMLElement): void {
    const target = el ?? this._fullscreenTarget();
    if (!target || typeof document === 'undefined') return;
    (target.requestFullscreen?.() ?? Promise.resolve()).catch(() => {});
  }

  exitFullscreen(): void {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  toggleFullscreen(el?: HTMLElement): void {
    if (typeof document !== 'undefined' && document.fullscreenElement) this.exitFullscreen();
    else this.enterFullscreen(el);
  }

  private _fullscreenTarget(): HTMLElement | null {
    if (this._fullscreenEl) return this._fullscreenEl;
    return (this.scene as any)?.canvas?.parentElement ?? (this.scene as any)?.canvas ?? null;
  }

  setFullscreenTarget(el: HTMLElement): void {
    this._fullscreenEl = el;
  }

  /* ---------------- keyboard (doc 08 §4.1 table) ---------------- */

  /**
   * Wire the doc 08 §4.1 keyboard shortcuts onto `target` (default:
   * `document`). Returns a disposer. Idempotent — calling twice replaces
   * the previous binding.
   *
   *   space        play/pause
   *   ←/→          seek ±5s
   *   [ / ]        prev/next section
   *   1..5         speed 0.25/0.5/1/1.5/2
   *   l            toggle loop
   *   f            fullscreen
   *   s            step one frame (pauses first)
   */
  attachKeyboard(target: HTMLElement | Document = typeof document !== 'undefined' ? document : (null as any)): () => void {
    this.detachKeyboard();
    if (!target) return () => {};
    const speeds = [0.25, 0.5, 1, 1.5, 2];
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.toggle();
          break;
        case 'ArrowLeft':
          this.seekBy(-5);
          break;
        case 'ArrowRight':
          this.seekBy(5);
          break;
        case '[':
          this.prevSection();
          break;
        case ']':
          this.nextSection();
          break;
        case 'l':
        case 'L':
          this.setLoop(!this.loop);
          break;
        case 'f':
        case 'F':
          this.toggleFullscreen();
          break;
        case 's':
        case 'S':
          this.stepFrame(1);
          break;
        default: {
          const n = Number(e.key);
          if (n >= 1 && n <= 5) this.setSpeed(speeds[n - 1]);
        }
      }
    };
    (target as any).addEventListener('keydown', handler);
    this._keyboardTarget = target;
    this._keyboardHandler = handler;
    return () => this.detachKeyboard();
  }

  detachKeyboard(): void {
    if (this._keyboardTarget && this._keyboardHandler) {
      (this._keyboardTarget as any).removeEventListener('keydown', this._keyboardHandler);
    }
    this._keyboardTarget = null;
    this._keyboardHandler = null;
  }

  /* ---------------- internal: time-event ticking + loop-at-end ---------------- */

  /** `Scene.startPlayback` runs its own rAF loop internally; Player layers
   *  a second lightweight rAF tick on top purely to emit 'time'/'section'/
   *  'ended' events without modifying scene.ts. */
  private _startTicking(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    const tick = () => {
      if (!this._playing) return;
      this.emit('time', { t: this.time, duration: this.duration });
      this._updateCurrentSection();
      if (this.time >= this.duration - 1e-6) {
        this._playing = false;
        if (this.loop) {
          this.scene.startPlayback(0);
          this._playing = true;
          this.emit('loop', { loop: true, restarted: true });
        } else {
          this.emit('ended');
        }
      }
      this._tickHandle = requestAnimationFrame(tick);
    };
    this._tickHandle = requestAnimationFrame(tick);
  }

  private _stopTicking(): void {
    if (this._tickHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._tickHandle);
    }
    this._tickHandle = null;
  }

  /** No-op placeholder kept for symmetry / future scene 'ended' hook wiring
   *  (Scene itself has no event emitter — Player's own tick loop above is
   *  the single source of 'ended'/'loop' events). */
  private _wireSceneLoopEnd(): void {}

  /* ---------------- teardown ---------------- */

  destroy(): void {
    this.pause();
    this.detachKeyboard();
    this.listeners.clear();
  }
}
