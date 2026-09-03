/**
 * Lumina — mobjects/three-d/light.ts
 * Light: an animatable mobject, matching ManimGL's convention that the
 * light source is itself a Mobject with a position you can `.animate.shift`
 * or attach an updater to (doc 06 §7 `lightSource: Mobject`, doc 07 §9,
 * doc 10 §4.5 "light as mobject").
 *
 * v1 lighting model (doc 08 §2.5 minimum shader set): one directional/point
 * light + a fixed ambient term, Lambertian (N·L) shading. `Light` carries
 * the parameters the WebGL renderer reads every frame; moving the Light
 * mobject (via the normal placement API) moves the light in the scene
 * exactly like moving any other mobject.
 */
import { Vec3, v, norm, sub } from '../../math/vec';
import { Mobject } from '../../core/mobject';
import { ManimColor, resolveColor } from '../../math/color';
import { normalizeOptions } from '../../core/style';

export type LightKind = 'point' | 'directional' | 'ambient';

export interface LightOptions {
  kind?: LightKind;
  color?: ManimColor;
  intensity?: number;
  /** For 'directional': the direction the light travels (not its position). */
  direction?: Vec3;
}

/**
 * A Light is a zero-geometry Mobject (like ValueTracker) whose *position*
 * (via the normal `shift`/`moveTo`/`.animate` API) IS the light position for
 * 'point' lights, and whose `direction` field is the light direction for
 * 'directional' lights. `ThreeDScene`/`Camera.lightSource` reference an
 * instance of this class; the WebGL renderer reads `.uniforms()` each frame.
 */
export class Light extends Mobject {
  kind: LightKind;
  color: ManimColor;
  intensity: number;
  direction: Vec3;

  constructor(opts: LightOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    this.kind = o.kind ?? 'point';
    this.color = o.color ? resolveColor(o.color) : '#FFFFFF';
    this.intensity = o.intensity ?? 1;
    this.direction = o.direction ? v(o.direction) : [-1, -1, -1];
    // Dummy zero-size geometry so getCenter()/shift() have something to
    // move — the light's "position" IS this point (doc 06 §7). Starts at
    // the origin; `defaultLight()` below shifts it to its key-light spot.
    this.points = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  }

  applyOptions(): void {}

  get isDrawable(): boolean { return false; }

  getPosition(): Vec3 {
    return this.getCenter();
  }

  /** Direction FROM a surface point TOWARD the light (for N·L shading). */
  directionFrom(surfacePoint: Vec3): Vec3 {
    if (this.kind === 'directional') return norm([-this.direction[0], -this.direction[1], -this.direction[2]]);
    return norm(sub(this.getPosition(), surfacePoint));
  }

  /** Uniform bundle consumed by the WebGL renderer's fragment shader. */
  uniforms(): { position: Vec3; color: [number, number, number]; intensity: number; kind: number } {
    const [r, g, b] = hexToRgb01(this.color);
    return {
      position: this.kind === 'directional' ? norm(mul(this.direction, -1)) : this.getPosition(),
      color: [r, g, b],
      intensity: this.intensity,
      kind: this.kind === 'ambient' ? 2 : this.kind === 'directional' ? 1 : 0,
    };
  }

  copy(): this {
    const c = super.copy() as this;
    c.kind = this.kind;
    c.color = this.color;
    c.intensity = this.intensity;
    c.direction = [...this.direction] as Vec3;
    return c;
  }
}

function mul(a: Vec3, s: number): Vec3 { return [a[0] * s, a[1] * s, a[2] * s]; }

function hexToRgb01(c: string): [number, number, number] {
  let s = c.trim();
  if (s[0] !== '#') s = '#' + s;
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Convenience factory matching ManimGL's default key light. */
export function defaultLight(): Light {
  return new Light({ kind: 'point', color: '#FFFFFF', intensity: 1 }).shift([-3, 3, 5]) as Light;
}

export const AMBIENT_LIGHT_DEFAULT = 0.35;
