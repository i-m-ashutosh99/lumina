/**
 * Lumina — timeline.ts
 * Seekable clip recording + pure `render(t)` (doc 06 §5, doc 10 §12).
 *
 * Scene.construct() runs ONCE, synchronously fast-forwarding through every
 * `await scene.play(...)` / `scene.wait(...)` call. Each `play()` records a
 * ClipEntry whose animations already captured an immutable `startSnapshots`
 * map (via `Animation.begin()`). Because every clip's start state is frozen
 * at record time, `render(t)` can jump to ANY t by simply re-applying each
 * clip that has started by time t, in order — `restoreStart()` then
 * `apply(computeAlpha(localT))` — with no dependency on having "played
 * through" intermediate frames.
 *
 * Two concerns are deliberately kept SEPARATE (this mirrors real ManimCE's
 * split between `interpolate()` for visuals and `add`/`remove`/`_setup_scene`/
 * `clean_up_from_scene` for scene membership — see the animation.py /
 * scene.py research this module's design was cross-checked against):
 *
 *   1. VISUALS (point/style mutation) — driven entirely by `clips`, replayed
 *      by re-running each animation's `interpolateMobject` at the right
 *      local alpha. Pure function of t.
 *   2. MEMBERSHIP (which top-level mobjects are currently "on screen") —
 *      driven entirely by `markers`, explicit add/remove events that
 *      `Scene.play()`/`Scene.add()`/`Scene.remove()` push at RECORD time,
 *      exactly mirroring when real Manim's `Scene.add`/`Scene.remove` would
 *      have fired (immediately for `scene.add()`; at clip-start for
 *      introducers via `_setup_scene`; at clip-end for removers via
 *      `clean_up_from_scene`). `render(t)` never *infers* membership from
 *      animation flags — Scene decided that once, at record time, and the
 *      Timeline just replays the decision. This avoids the previous ad-hoc
 *      "infer visibility from anim.introducer/remover inside render()"
 *      approach, which had no way to distinguish "this clip's target was
 *      already independently on screen before this animation touched it"
 *      from "this animation is what put it there".
 *
 * Known limitation (documented, not solved here — see build plan §12):
 * non-idempotent updaters that *integrate* dt (e.g. hand-rolled physics)
 * are not re-derivable from an arbitrary t; updaters that are pure
 * functions of absolute scene time or of a ValueTracker (the vast
 * majority of real usage — always_redraw, DecimalNumber, moving dots)
 * work correctly under seeking because they're recomputed fresh every call.
 */
import { Mobject } from './mobject';
import { Animation } from './animation';

export interface ClipEntry {
  t0: number;
  t1: number;
  animations: Animation[];
}

interface Marker {
  t: number;
  mobject: Mobject;
  add: boolean;
}

export class Timeline {
  clips: ClipEntry[] = [];
  markers: Marker[] = [];
  /** Named bookmarks for Player chapter navigation (doc 08 §4.4 sections). */
  sections: Array<{ name: string; type: string; t: number }> = [];

  /** Current "recording playhead" — advances as play()/wait() are recorded. */
  cursor = 0;

  get duration(): number {
    return this.cursor;
  }

  /** Membership event: mobject becomes visible at time `t` (Scene decides
   *  this once, at record time — see file header). */
  markAdd(m: Mobject, t: number = this.cursor): void {
    this.markers.push({ t, mobject: m, add: true });
  }

  markRemove(m: Mobject, t: number = this.cursor): void {
    this.markers.push({ t, mobject: m, add: false });
  }

  /** Record a clip of simultaneous animations; advances the cursor. */
  addClip(animations: Animation[], runTime: number): ClipEntry {
    const clip: ClipEntry = { t0: this.cursor, t1: this.cursor + runTime, animations };
    this.clips.push(clip);
    this.cursor = clip.t1;
    return clip;
  }

  /** Record dead time (Scene.wait) — nothing changes, duration still grows. */
  addWait(duration: number): void {
    this.cursor += duration;
  }

  addSection(name: string, type = 'default'): void {
    this.sections.push({ name, type, t: this.cursor });
  }

  reset(): void {
    this.clips = [];
    this.markers = [];
    this.sections = [];
    this.cursor = 0;
  }

  /** Which top-level mobjects are on screen at time t, per recorded markers.
   *  Ties (add and remove at the same t) resolve in insertion order, same as
   *  replaying `Scene.add`/`Scene.remove` calls in the order they happened. */
  membershipAt(t: number): Set<Mobject> {
    const visible = new Set<Mobject>();
    for (const mk of this.markers) {
      if (mk.t > t) continue;
      if (mk.add) visible.add(mk.mobject);
      else visible.delete(mk.mobject);
    }
    return visible;
  }

  /**
   * Pure render at time t: mutates every touched mobject's points/style to
   * exactly what they should look like at t, and returns the set of
   * top-level mobjects that should currently be visible/drawn (per markers).
   */
  render(t: number): Mobject[] {
    for (const clip of this.clips) {
      if (clip.t0 > t) break; // clips are recorded in chronological order
      const clipRunTime = Math.max(1e-9, clip.t1 - clip.t0);
      for (const anim of clip.animations) {
        anim.restoreStart();
        const animSpan = Math.min(anim.runTime || clipRunTime, clipRunTime) || clipRunTime;
        const rawT = Math.min(1, Math.max(0, (t - clip.t0) / animSpan));
        anim.apply(anim.computeAlpha(rawT));
      }
    }
    return [...this.membershipAt(t)];
  }
}
