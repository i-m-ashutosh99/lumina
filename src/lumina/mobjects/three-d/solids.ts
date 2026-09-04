/**
 * Lumina — mobjects/three-d/solids.ts
 * 3D primitive mobjects (doc 07 §9, doc 10 §4.5): Sphere, Cube, Prism,
 * Cone, Cylinder, Torus, platonic solids, Dot3D/Line3D/Arrow3D, Surface.
 * All built on MeshMobject so they inherit the generic placement API
 * (shift/moveTo/scale/rotate) and are Transform-able (CPU vertex lerp).
 */
import { Vec3, v, add, sub, mul, norm, cross, dist } from '../../math/vec';
import { MeshMobject } from '../../core/mesh-mobject';
import { Group } from '../../core/group';
import { normalizeOptions } from '../../core/style';
import {
  sphereMesh, cubeMesh, prismMesh, cylinderMesh, coneMesh, torusMesh,
  tetrahedronMesh, octahedronMesh, icosahedronMesh, dodecahedronMesh,
  parametricSurfaceMesh, MeshData,
} from '../../math/mesh';

export class Sphere extends MeshMobject {
  radius: number;
  constructor(opts: { radius?: number; color?: any; resolution?: [number, number] } = {}) {
    const o = normalizeOptions(opts as any);
    const radius = o.radius ?? 1;
    const [w, h] = o.resolution ?? [24, 16];
    super(sphereMesh(radius, w, h), opts);
    this.radius = radius;
  }
}

export class Cube extends MeshMobject {
  sideLength: number;
  constructor(opts: { sideLength?: number; color?: any } = {}) {
    const o = normalizeOptions(opts as any);
    const s = o.sideLength ?? 2;
    super(cubeMesh(s), opts);
    this.sideLength = s;
  }
}

export class Prism extends MeshMobject {
  constructor(opts: { width?: number; height?: number; depth?: number; color?: any } = {}) {
    const o = normalizeOptions(opts as any);
    super(prismMesh(o.width ?? 2, o.height ?? 2, o.depth ?? 2), opts);
  }
}

export class Cylinder extends MeshMobject {
  constructor(opts: { radius?: number; height?: number; color?: any; resolution?: number } = {}) {
    const o = normalizeOptions(opts as any);
    super(cylinderMesh(o.radius ?? 1, o.height ?? 2, o.resolution ?? 24, true), opts);
  }
}

export class Cone extends MeshMobject {
  constructor(opts: { radius?: number; height?: number; color?: any; resolution?: number } = {}) {
    const o = normalizeOptions(opts as any);
    super(coneMesh(o.radius ?? 1, o.height ?? 2, o.resolution ?? 24, true), opts);
  }
}

export class Torus extends MeshMobject {
  constructor(opts: { radius?: number; tubeRadius?: number; color?: any } = {}) {
    const o = normalizeOptions(opts as any);
    super(torusMesh(o.radius ?? 1, o.tubeRadius ?? 0.35, 32, 16), opts);
  }
}

export class Tetrahedron extends MeshMobject {
  constructor(opts: { radius?: number; color?: any } = {}) {
    const o = normalizeOptions(opts as any);
    super(tetrahedronMesh(o.radius ?? 1), opts);
  }
}

export class Octahedron extends MeshMobject {
  constructor(opts: { radius?: number; color?: any } = {}) {
    const o = normalizeOptions(opts as any);
    super(octahedronMesh(o.radius ?? 1), opts);
  }
}

export class Icosahedron extends MeshMobject {
  constructor(opts: { radius?: number; color?: any } = {}) {
    const o = normalizeOptions(opts as any);
    super(icosahedronMesh(o.radius ?? 1), opts);
  }
}

export class Dodecahedron extends MeshMobject {
  constructor(opts: { radius?: number; color?: any } = {}) {
    const o = normalizeOptions(opts as any);
    super(dodecahedronMesh(o.radius ?? 1), opts);
  }
}

/** Generic Platonic-solid factory (real ManimCE has this convenience). */
export function polyhedron(kind: 'tetrahedron' | 'cube' | 'octahedron' | 'icosahedron' | 'dodecahedron', opts: any = {}): MeshMobject {
  switch (kind) {
    case 'tetrahedron': return new Tetrahedron(opts);
    case 'cube': return new Cube(opts);
    case 'octahedron': return new Octahedron(opts);
    case 'icosahedron': return new Icosahedron(opts);
    default: return new Dodecahedron(opts);
  }
}

/** Small filled sphere, the 3D analogue of Dot (doc 07 §9). */
export class Dot3D extends Sphere {
  constructor(point: Vec3 = [0, 0, 0], opts: { radius?: number; color?: any } = {}) {
    super({ radius: opts.radius ?? 0.08, color: opts.color, resolution: [12, 8] });
    this.shift(v(point));
  }
}

/** 3D line segment: a thin cylinder between two points (WebGL has no
 *  native line-width control worth relying on, so real geometry instead). */
export class Line3D extends MeshMobject {
  constructor(start: Vec3, end: Vec3, opts: { thickness?: number; color?: any } = {}) {
    const o = normalizeOptions(opts as any);
    const thickness = o.thickness ?? 0.02;
    const a = v(start), b = v(end);
    const height = dist(a, b);
    const mesh = cylinderMesh(thickness, height || 1e-6, 10, true);
    super(mesh, opts);
    this.orientAndPlace(a, b);
  }

  protected orientAndPlace(a: Vec3, b: Vec3): void {
    const dir = norm(sub(b, a));
    const mid = mul(add(a, b), 0.5);
    // cylinderMesh is built along +Y; rotate +Y onto `dir`.
    const yAxis: Vec3 = [0, 1, 0];
    const axis = cross(yAxis, dir);
    const axisLen = Math.hypot(axis[0], axis[1], axis[2]);
    const angle = Math.acos(Math.min(1, Math.max(-1, yAxis[0] * dir[0] + yAxis[1] * dir[1] + yAxis[2] * dir[2])));
    if (axisLen > 1e-9) this.rotate(angle, { axis: norm(axis) });
    else if (angle > Math.PI / 2) this.rotate(Math.PI, { axis: [1, 0, 0] });
    this.shift(mid);
  }

  rotate(angle: number, opts?: { axis?: Vec3; aboutPoint?: Vec3 }): this {
    return super.rotate(angle, opts) as this;
  }
}

/** 3D arrow: a Line3D shaft + a small cone head at the end. */
export class Arrow3D extends Group {
  constructor(start: Vec3 = [0, 0, 0], end: Vec3 = [1, 0, 0], opts: { thickness?: number; color?: any } = {}) {
    super();
    const o = normalizeOptions(opts as any);
    const a = v(start), b = v(end);
    const dir = norm(sub(b, a));
    const headLen = Math.min(0.3, dist(a, b) * 0.35);
    const shaftEnd = sub(b, mul(dir, headLen));
    const thickness = o.thickness ?? 0.02;
    const shaft = new Line3D(a, shaftEnd, { thickness, color: o.color });
    const head = new Cone3DHead(shaftEnd, b, thickness * 4, o.color);
    this.add(shaft, head);
  }
}

class Cone3DHead extends MeshMobject {
  constructor(base: Vec3, tip: Vec3, radius: number, color: any) {
    const height = dist(base, tip);
    super(coneMesh(radius, height || 1e-6, 16, true), { color });
    const dir = norm(sub(tip, base));
    const mid = mul(add(base, tip), 0.5);
    const yAxis: Vec3 = [0, 1, 0];
    const axis = cross(yAxis, dir);
    const axisLen = Math.hypot(axis[0], axis[1], axis[2]);
    const angle = Math.acos(Math.min(1, Math.max(-1, yAxis[0] * dir[0] + yAxis[1] * dir[1] + yAxis[2] * dir[2])));
    if (axisLen > 1e-9) this.rotate(angle, { axis: norm(axis) });
    this.shift(mid);
  }
}

/** Parametric surface z = f(x,y) or fn(u,v) -> Vec3 (doc 07 §9 Surface). */
export class Surface extends MeshMobject {
  constructor(
    fn: (u: number, v: number) => Vec3,
    opts: { uRange?: [number, number]; vRange?: [number, number]; resolution?: [number, number]; color?: any } = {}
  ) {
    const o = normalizeOptions(opts as any);
    const [uSeg, vSeg] = o.resolution ?? [32, 32];
    super(parametricSurfaceMesh(fn, uSeg, vSeg, o.uRange ?? [0, 1], o.vRange ?? [0, 1]), opts);
  }
}

/** z = f(x,y) convenience over Surface — the common "3D function graph". */
export function functionSurface(
  f: (x: number, y: number) => number,
  opts: { xRange?: [number, number]; yRange?: [number, number]; resolution?: [number, number]; color?: any } = {}
): Surface {
  const o = normalizeOptions(opts as any);
  const xr = o.xRange ?? [-3, 3];
  const yr = o.yRange ?? [-3, 3];
  return new Surface(
    (u, w) => {
      const x = xr[0] + (xr[1] - xr[0]) * u;
      const y = yr[0] + (yr[1] - yr[0]) * w;
      return [x, y, f(x, y)];
    },
    { resolution: o.resolution ?? [40, 40], color: o.color }
  );
}

/** SurfaceMesh — a Surface rendered as wireframe lines (doc 06 §7). */
export class SurfaceMesh extends Surface {
  constructor(fn: (u: number, v: number) => Vec3, opts: any = {}) {
    super(fn, opts);
    this.meshStyle.wireframe = true;
  }
}

/**
 * TexturedSurface — a `Surface` sampling an image texture instead of a flat
 * `meshStyle.color` (doc 07 §9 `new TexturedSurface(surface, dayUrl,
 * nightUrl?)`, doc 13 audit gap G16 "3D follow-ups: textures").
 *
 * Real ManimCE's `TexturedSurface` blends a "day" and "night" image by how
 * directly each fragment's normal faces the light (so e.g. a textured globe
 * shows its lit hemisphere with the day map and its dark hemisphere with
 * the night map) — `renderers/webgl.ts`'s texture-variant fragment shader
 * reproduces that exact blend. If only `dayUrl` is given, the whole surface
 * just samples that one texture (no blend).
 *
 * Construction is synchronous (mirrors `Surface`'s geometry immediately, so
 * placement/bounding-box calls work right away); the image itself loads
 * asynchronously — `await surf.ready` before the first render if the image
 * must be guaranteed decoded (matches `Text`/`MathTex`/`Code`'s existing
 * async-ready pattern used throughout this codebase). Uses the browser's
 * `Image()` constructor directly (no bundler asset pipeline dependency,
 * works with any same-origin or CORS-enabled URL) and is a safe no-op
 * outside a DOM environment (SSR/build).
 *
 * ```js
 * const globe = new TexturedSurface(
 *   (u, v) => sphereParamPoint(u, v, 2),
 *   '/textures/earth-day.jpg', '/textures/earth-night.jpg',
 *   { resolution: [64, 32] }
 * );
 * await globe.ready;
 * scene.add(globe);
 * ```
 */
export class TexturedSurface extends Surface {
  dayUrl: string;
  nightUrl: string | null;
  ready: Promise<this>;

  constructor(
    fn: (u: number, v: number) => Vec3,
    dayUrl: string,
    nightUrl?: string | null,
    opts: { uRange?: [number, number]; vRange?: [number, number]; resolution?: [number, number]; color?: any } = {}
  ) {
    super(fn, opts);
    this.dayUrl = dayUrl;
    this.nightUrl = nightUrl ?? null;
    this.texture = { dayImage: null, nightImage: null };
    this.ready = this.loadImages();
  }

  private async loadImages(): Promise<this> {
    if (typeof Image === 'undefined') return this; // SSR/build: no-op, geometry still valid
    const load = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`TexturedSurface: failed to load "${url}"`));
        img.src = url;
      });
    const [day, night] = await Promise.all([
      load(this.dayUrl),
      this.nightUrl ? load(this.nightUrl) : Promise.resolve(null),
    ]);
    this.texture = { dayImage: day, nightImage: night };
    return this;
  }
}
