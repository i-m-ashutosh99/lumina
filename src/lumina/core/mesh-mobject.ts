/**
 * Lumina — core/mesh-mobject.ts
 * MeshMobject: the 3D counterpart of VMobject (doc 06 §3, doc 06 §6.2).
 * Geometry lives in `positions`/`normals`/`uvs`/`indices` (flat vertex
 * buffers) rather than VMobject's cubic-Bézier `points`. Rendered by the
 * owned WebGL2 renderer (`renderers/webgl.ts`), composited UNDER the
 * Canvas2D 2D layer per the v1 hybrid-compositor plan.
 *
 * `Mobject.points` is kept in sync (one point per vertex) purely so the
 * existing placement API (`shift`/`moveTo`/`scale`/`rotate`/`getCenter`/
 * bounding box) works unmodified on 3D objects too — the base class only
 * ever reads/writes `points`, so MeshMobject overrides `applyToPoints` to
 * keep `positions` and `points` mirrored, and recomputes normals when a
 * rigid transform changes orientation.
 */
import { Vec3, add, sub, cross, norm, mul, dot } from '../math/vec';
import { Mobject } from './mobject';
import { MeshData } from '../math/mesh';
import { normalizeOptions } from './style';
import { resolveColor } from '../math/color';

export interface MeshStyle {
  color: string;
  opacity: number;
  wireframe: boolean;
  shaded: boolean;
  /** 0 = fully flat/unlit (checker-style debug), 1 = full Lambert+ambient. */
  shadeIntensity: number;
}

/**
 * Optional image-texture binding (doc 07 §9 `TexturedSurface(surface,
 * dayUrl, nightUrl?)`, doc 13 audit gap G16). Populated by `TexturedSurface`
 * (`mobjects/three-d/solids.ts`) once its `ready` promise resolves;
 * `renderers/webgl.ts` samples `dayImage`/`nightImage` (real ManimCE's
 * day/night texture blend, mixed by how much each fragment's normal faces
 * the light) instead of the flat `meshStyle.color` whenever `dayImage` is
 * set. Left `null` for every other MeshMobject — zero cost when unused.
 */
export interface MeshTexture {
  dayImage: HTMLImageElement | ImageBitmap | null;
  nightImage: HTMLImageElement | ImageBitmap | null;
}

export class MeshMobject extends Mobject {
  positions: Vec3[] = [];
  normals: Vec3[] = [];
  uvs: [number, number][] = [];
  indices: number[] = [];

  meshStyle: MeshStyle = {
    color: '#58C4DD',
    opacity: 1,
    wireframe: false,
    shaded: true,
    shadeIntensity: 1,
  };

  /** null unless a texture has been bound (see `MeshTexture` doc above). */
  texture: MeshTexture | null = null;

  constructor(mesh?: MeshData, opts?: any) {
    super(opts);
    if (mesh) this.setMesh(mesh);
    const o = normalizeOptions(opts ?? {});
    if (o.color !== undefined) this.meshStyle.color = resolveColor(o.color);
    if (o.opacity !== undefined) this.meshStyle.opacity = o.opacity;
    if (o.wireframe !== undefined) this.meshStyle.wireframe = o.wireframe;
    if (o.shaded !== undefined) this.meshStyle.shaded = o.shaded;
  }

  setMesh(mesh: MeshData): this {
    this.positions = mesh.positions.map((p) => [...p] as Vec3);
    this.normals = mesh.normals.map((n) => [...n] as Vec3);
    this.uvs = mesh.uvs.map((u) => [...u] as [number, number]);
    this.indices = [...mesh.indices];
    // Mirror into `points` so Mobject's generic placement math (getCenter,
    // getBoundingBox, shift, scale, rotate) works without any overrides.
    this.points = this.positions as Vec3[];
    return this;
  }

  /** Override: MeshMobject has real 3D triangles, not cubics-of-4. */
  get isDrawable(): boolean {
    return !this.isGroup && this.positions.length > 0 && this.indices.length > 0;
  }

  /** Recompute smooth per-vertex normals from the current positions/indices
   *  (needed after a nonlinear/`applyFunction` deform; rigid transforms
   *  rotate existing normals directly in `applyToPoints` instead, which is
   *  cheaper and exact). */
  recomputeNormals(): this {
    const n = this.positions.length;
    const acc: Vec3[] = Array.from({ length: n }, () => [0, 0, 0] as Vec3);
    for (let i = 0; i + 2 < this.indices.length; i += 3) {
      const ia = this.indices[i], ib = this.indices[i + 1], ic = this.indices[i + 2];
      const pa = this.positions[ia], pb = this.positions[ib], pc = this.positions[ic];
      if (!pa || !pb || !pc) continue;
      const fn = cross(sub(pb, pa), sub(pc, pa));
      acc[ia] = add(acc[ia], fn);
      acc[ib] = add(acc[ib], fn);
      acc[ic] = add(acc[ic], fn);
    }
    this.normals = acc.map((a) => (a[0] === 0 && a[1] === 0 && a[2] === 0 ? [0, 1, 0] : norm(a)));
    return this;
  }

  /** Applies fn to every vertex position AND rotates normals by the same
   *  linear part when it's detectable as rigid (rotate/scale/shift use this
   *  path via Mobject.applyToPoints, which MeshMobject overrides below). */
  applyToPoints(fn: (p: Vec3) => Vec3): void {
    if (!this.isGroup) {
      const before = this.positions;
      const after = before.map(fn);
      this.positions = after;
      this.points = this.positions;
      // Best-effort normal transform: for a uniform rigid map (rotation +
      // translation, no scale/shear) the direction from a reference origin
      // to (origin + normal) transforms the same way positions do; we
      // approximate this by transforming `p + normal*epsilon` and
      // re-deriving direction, which is exact for rotation/translation and
      // a reasonable approximation under uniform scale.
      const eps = 1e-4;
      this.normals = before.map((p, i) => {
        const n = this.normals[i] ?? [0, 1, 0];
        const p2 = fn(add(p, mul(n, eps)));
        const d = sub(p2, after[i]);
        return norm(d);
      });
    }
    for (const c of this.children) c.applyToPoints(fn);
  }

  copy(): this {
    const c = super.copy() as this;
    c.positions = this.positions.map((p) => [...p] as Vec3);
    c.normals = this.normals.map((n) => [...n] as Vec3);
    c.uvs = this.uvs.map((u) => [...u] as [number, number]);
    c.indices = [...this.indices];
    c.meshStyle = { ...this.meshStyle };
    c.texture = this.texture; // images are shared (immutable), not cloned
    c.points = c.positions;
    return c;
  }

  setColor(c: any): this {
    this.meshStyle.color = resolveColor(c);
    for (const m of this.family()) {
      if (m === this) continue;
      if (m instanceof MeshMobject) m.meshStyle.color = this.meshStyle.color;
    }
    return this;
  }

  setOpacity(o: number): this {
    this.meshStyle.opacity = o;
    for (const m of this.family()) {
      if (m === this) continue;
      if (m instanceof MeshMobject) m.meshStyle.opacity = o;
    }
    return this;
  }

  /** Interpolate toward another MeshMobject (CPU vertex lerp — doc 08 §2.5). */
  interpolatePoints(other: Mobject, alpha: number): this {
    if (other instanceof MeshMobject && this.positions.length === other.positions.length) {
      this.positions = this.positions.map((p, i) => {
        const q = other.positions[i];
        return [p[0] + (q[0] - p[0]) * alpha, p[1] + (q[1] - p[1]) * alpha, p[2] + (q[2] - p[2]) * alpha] as Vec3;
      });
      this.normals = this.normals.map((n, i) => {
        const q = other.normals[i] ?? n;
        return norm([
          n[0] + (q[0] - n[0]) * alpha,
          n[1] + (q[1] - n[1]) * alpha,
          n[2] + (q[2] - n[2]) * alpha,
        ] as Vec3);
      });
      this.points = this.positions;
      this.meshStyle.color = alpha < 0.5 ? this.meshStyle.color : other.meshStyle.color;
      this.meshStyle.opacity = this.meshStyle.opacity + (other.meshStyle.opacity - this.meshStyle.opacity) * alpha;
    }
    return this;
  }
}
