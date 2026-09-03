/**
 * Lumina — clock.ts
 * Wall-clock driver for live playback. Scene owns one; the Timeline (seek)
 * and the Player (transport controls) both read/drive it.
 */
export class Clock {
  /** Current scene time in seconds (monotonic during live play, jumps on seek). */
  time = 0;
  /** Delta of the last tick(), in seconds, already scaled by `speed`. */
  dt = 0;
  /** Playback speed multiplier (Player's speed control). */
  speed = 1;
  /** When true, tick() reports dt=0 (frame still renders, time frozen). */
  paused = false;

  private lastTs: number | null = null;

  /** Advance from a requestAnimationFrame timestamp; returns the scaled dt. */
  tick(ts: number): number {
    if (this.lastTs === null) {
      this.lastTs = ts;
      return 0;
    }
    const rawDt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (this.paused) {
      this.dt = 0;
      return 0;
    }
    const dt = rawDt * this.speed;
    this.time += dt;
    this.dt = dt;
    return dt;
  }

  /** Jump the playhead (Player scrubbing / Timeline seek). */
  seek(t: number): void {
    this.time = Math.max(0, t);
    this.dt = 0;
    this.lastTs = null; // next tick() computes dt from now, not from the old ts
  }

  setSpeed(s: number): void {
    this.speed = Math.max(0.0625, s);
  }

  /** Reset to t=0 (new construct() run). */
  reset(): void {
    this.time = 0;
    this.dt = 0;
    this.lastTs = null;
  }
}
