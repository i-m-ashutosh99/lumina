/**
 * Lumina — mobject.ts
 * Mobject base: identity, hierarchy, placement API (doc 02 §A.4),
 * updaters, snapshots, and the `.animate` proxy.
 *
 * Geometry lives in subclasses: VMobject (Bézier points), MeshMobject (3D),
 * and Group (union of children).
 */
import { Vec3, v, add, sub, mul, dot, norm, lerp, rotatePoint } from '../math/vec';
import { mat3, Mat3 } from '../math/mat';
import { ManimColor, resolveColor, gradientAt } from '../math/color';
import {
  Style, defaultStyle, applyStyleOverrides, lerpStyle, normalizeOptions,
} from './style';
import { smooth } from '../math/rate-functions';
import { FRAME_WIDTH, FRAME_HEIGHT, MED_LARGE_BUFF } from '../math/constants';

let NEXT_ID = 1;

export type Updater = (m: Mobject, dt?: number) => void;

export interface Snapshot {
  points: Vec3[];
  style: Style;
  visible: boolean;
  zIndex: number;
  savedStates: Map<Mobject, any>;
}

export class Mobject {
  id: number = NEXT_ID++;
  name?: string;
  tags: string[] = [];

  parent: Mobject | null = null;
  children: Mobject[] = [];

  points: Vec3[] = [];

  style: Style = defaultStyle();

  /** Scene-frame override: skip camera transform (HUD). */
  fixedInFrame = false;
  zIndex = 0;
  visible = true;
  isFixedOrientation = false;

  /** Extra transforms applied on top of points at draw time (3D local). */
  position: Vec3 = [0, 0, 0];
  rotation: Vec3 = [0, 0, 0];
  scaleVec: Vec3 = [1, 1, 1];

  updaters: Updater[] = [];
  savedStates: Map<Mobject, any> = new Map();

  /** True when this node has no own geometry (Group). */
  isGroup = false;

  /** User payload. */
  data: Map<string, any> = new Map();

  /** Saved state for restore() (doc 02 save_state/restore). */
  protected _saved: Snapshot | null = null;

  constructor(opts?: any) {
    if (opts) {
      const o = normalizeOptions(opts);
      this.name = o.name;
      if (o.tags) this.tags = [...o.tags];
      this.style = applyStyleOverrides(this.style, o);
      if (o.zIndex !== undefined) this.zIndex = o.zIndex;
      this.applyOptions?.(o);
    }
  }

  /** Subclass hook for constructor options. */
  applyOptions?(o: any): void;

  /* ---------------- hierarchy ---------------- */

  add(...mobs: Mobject[]): this {
    for (const m of mobs) {
      if (m.parent) m.parent.remove(m);
      m.parent = this;
      this.children.push(m);
    }
    return this;
  }

  remove(...mobs: Mobject[]): this {
    for (const m of mobs) {
      const i = this.children.indexOf(m);
      if (i >= 0) this.children.splice(i, 1);
      if (m.parent === this) m.parent = null;
    }
    return this;
  }

  clear(): this {
    for (const c of [...this.children]) this.remove(c);
    return this;
  }

  /** Depth-first list including self. */
  family(): Mobject[] {
    const out: Mobject[] = [];
    const visit = (m: Mobject) => {
      out.push(m);
      for (const c of m.children) visit(c);
    };
    visit(this);
    return out;
  }

  /** All leaf mobjects (drawable). */
  familyMembersWithPoints(): Mobject[] {
    return this.family().filter((m) => m.points.length > 0 || m.isGroup === false && m.points.length > 0);
  }

  setSubmobjects(mobs: Mobject[]): this {
    this.clear();
    this.add(...mobs);
    return this;
  }

  get submobjects(): Mobject[] {
    return this.children;
  }

  /* ---------------- geometry queries ---------------- */

  /** Center of bounding box of all points (family-wide). */
  getCenter(): Vec3 {
    const pts = this.allPoints();
    if (!pts.length) return [this.position[0], this.position[1], this.position[2]];
    let x = 0, y = 0, z = 0;
    for (const p of pts) { x += p[0]; y += p[1]; z += p[2]; }
    return [x / pts.length, y / pts.length, z / pts.length];
  }

  /** Axis-aligned bounding box: {min, max}. */
  getBoundingBox(): { min: Vec3; max: Vec3 } {
    const pts = this.allPoints();
    if (!pts.length) return { min: [0, 0, 0], max: [0, 0, 0] };
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of pts) {
      for (let d = 0; d < 3; d++) {
        if (p[d] < min[d]) min[d] = p[d];
        if (p[d] > max[d]) max[d] = p[d];
      }
    }
    return { min, max };
  }

  protected allPoints(): Vec3[] {
    if (this.isGroup) {
      const out: Vec3[] = [];
      for (const c of this.children) out.push(...c.allPoints());
      return out;
    }
    return this.points;
  }

  extent(d: 0 | 1 | 2): number {
    const bb = this.getBoundingBox();
    return (bb.max[d] - bb.min[d]) / 2;
  }

  getTop(): Vec3 { return this.edgePoint([0, 1, 0]); }
  getBottom(): Vec3 { return this.edgePoint([0, -1, 0]); }
  getLeft(): Vec3 { return this.edgePoint([-1, 0, 0]); }
  getRight(): Vec3 { return this.edgePoint([1, 0, 0]); }

  edgePoint(dir: Vec3): Vec3 {
    const bb = this.getBoundingBox();
    const c = this.getCenter();
    const half: Vec3 = [(bb.max[0] - bb.min[0]) / 2, (bb.max[1] - bb.min[1]) / 2, (bb.max[2] - bb.min[2]) / 2];
    return [
      c[0] + dir[0] * half[0],
      c[1] + dir[1] * half[1],
      c[2] + dir[2] * half[2],
    ];
  }

  getCorner(dir: Vec3): Vec3 {
    return this.edgePoint(dir);
  }

  getWidth(): number { return this.extent(0) * 2; }
  getHeight(): number { return this.extent(1) * 2; }
  getDepth(): number { return this.extent(2) * 2; }

  /* ---------------- placement ---------------- */

  shift(vec: Vec3 | number): this {
    const d = typeof vec === 'number' ? v(vec) : v(vec);
    this.applyToPoints((p) => add(p, d));
    this.position = add(this.position, d);
    return this;
  }

  moveTo(target: Vec3 | Mobject): this {
    const c = target instanceof Mobject ? target.getCenter() : v(target);
    return this.shift(sub(c, this.getCenter()));
  }

  moveToExact(target: Vec3 | Mobject): this {
    return this.moveTo(target);
  }

  nextTo(
    target: Mobject | Vec3,
    direction: Vec3 = [1, 0, 0],
    opts?: { buff?: number; alignedEdge?: Vec3 }
  ): this {
    const o = normalizeOptions(opts ?? {});
    const buff = o.buff ?? 0.25;
    const dir = v(norm(direction as Vec3));
    const targetCenter = target instanceof Mobject ? target.getCenter() : v(target);
    const targetEdge = target instanceof Mobject
      ? target.edgePoint(dir as Vec3)
      : targetCenter;
    const myEdge = this.edgePoint(dir as Vec3);
    const myCenter = this.getCenter();
    // place so myEdge is buff away from targetEdge along dir
    const desired = add(targetEdge, mul(dir, buff));
    const offset = sub(desired, myEdge);
    this.shift(offset);
    if (o.alignedEdge !== undefined) {
      const ae = v(o.alignedEdge);
      const perp: Vec3 = [-dir[1], dir[0], 0];
      const alignDir: Vec3 = [ae[0] * dir[1] !== 0 || true ? ae[0] : 0, ae[1], 0];
      const tEdge = target instanceof Mobject
        ? target.edgePoint(alignDir)
        : targetCenter;
      const mEdge = this.edgePoint(alignDir);
      this.shift(sub(tEdge, mEdge));
    }
    return this;
  }

  alignTo(target: Mobject | Vec3, direction: Vec3 = [1, 0, 0]): this {
    const dir = v(norm(direction));
    const dim = Math.abs(dir[0]) > Math.abs(dir[1]) ? 0 : 1;
    const tv = target instanceof Mobject
      ? (dir[0] < 0 || dir[1] < 0
        ? target.edgePoint(mul(dir, -1))
        : target.edgePoint(dir))
      : v(target);
    const mv = this.edgePoint(dir);
    const delta = tv[dim] - mv[dim];
    this.shift(dim === 0 ? [delta, 0, 0] : [0, delta, 0]);
    return this;
  }

  toEdge(direction: Vec3, buff = MED_LARGE_BUFF): this {
    const dir = v(norm(direction));
    const edgeCenter: Vec3 = [
      dir[0] * FRAME_WIDTH / 2,
      dir[1] * FRAME_HEIGHT / 2,
      0,
    ];
    this.moveTo(edgeCenter);
    const targetEdge = add(edgeCenter, mul(dir, -buff));
    const myEdge = this.edgePoint(dir);
    this.shift(sub(targetEdge, myEdge));
    return this;
  }

  toCorner(corner: Vec3, buff = MED_LARGE_BUFF): this {
    const dir = v(norm(corner));
    const cx = dir[0] * FRAME_WIDTH / 2;
    const cy = dir[1] * FRAME_HEIGHT / 2;
    const pt: Vec3 = [cx, cy, 0];
    this.moveTo(pt);
    const targetEdge = [cx - dir[0] * buff, cy - dir[1] * buff, 0] as Vec3;
    const myEdge = this.edgePoint(dir);
    this.shift(sub(targetEdge, myEdge));
    return this;
  }

  center(): this {
    return this.moveTo([0, 0, 0]);
  }

  scale(factor: number, opts?: { aboutPoint?: Vec3; aboutEdge?: Vec3 }): this {
    const o = normalizeOptions(opts ?? {});
    let about: Vec3 | null = null;
    if (o.aboutPoint !== undefined) about = v(o.aboutPoint);
    else if (o.aboutEdge !== undefined) about = this.edgePoint(v(o.aboutEdge));
    const f = typeof factor === 'number' ? factor : 1;
    const applyPoint = (p: Vec3): Vec3 => {
      if (!about) return mul(p, f);
      return add(about, mul(sub(p, about), f));
    };
    this.applyToPoints(applyPoint);
    this.scaleVec = mul(this.scaleVec, f);
    return this;
  }

  stretch(factor: number, dim: 0 | 1 | 2): this {
    this.applyToPoints((p) => {
      const q = [...p] as Vec3;
      q[dim] = q[dim] * factor;
      return q;
    });
    return this;
  }

  stretchToFitWidth(w: number): this {
    const cur = this.getWidth();
    if (cur > 1e-12) this.stretch(w / cur, 0);
    return this;
  }

  stretchToFitHeight(h: number): this {
    const cur = this.getHeight();
    if (cur > 1e-12) this.stretch(h / cur, 1);
    return this;
  }

  stretchToFitDepth(d: number): this {
    const cur = this.getDepth();
    if (cur > 1e-12) this.stretch(d / cur, 2);
    return this;
  }

  setWidth(w: number, stretch = false): this {
    if (stretch) return this.stretchToFitWidth(w);
    return this.scale(w / (this.getWidth() || 1), { aboutPoint: this.getCenter() });
  }

  setHeight(h: number, stretch = false): this {
    if (stretch) return this.stretchToFitHeight(h);
    return this.scale(h / (this.getHeight() || 1), { aboutPoint: this.getCenter() });
  }

  setDepth(d: number, stretch = false): this {
    if (stretch) return this.stretchToFitDepth(d);
    return this.scale(d / (this.getDepth() || 1), { aboutPoint: this.getCenter() });
  }

  resizeToWidth(w: number): this { return this.setWidth(w); }
  resizeToHeight(h: number): this { return this.setHeight(h); }
  resize(h: number, w: number): this { this.setWidth(w); return this.setHeight(h); }

  rotate(angle: number, opts?: { axis?: Vec3; aboutPoint?: Vec3 }): this {
    const o = normalizeOptions(opts ?? {});
    const axis = v(o.axis ?? [0, 0, 1]);
    const about = o.aboutPoint !== undefined ? v(o.aboutPoint) : this.getCenter();
    this.applyToPoints((p) => rotatePoint(p, angle, axis, about));
    return this;
  }

  flip(axis: Vec3 = [0, 1, 0], aboutPoint?: Vec3): this {
    const n = v(norm(axis));
    const about = aboutPoint !== undefined ? v(aboutPoint) : this.getCenter();
    // reflect across line through 'about' along n
    this.applyToPoints((p) => {
      const d = sub(p, about);
      const proj = mul(n, dot(d, n));
      return add(add(about, proj), sub(proj, d));
    });
    return this;
  }

  setX(x: number): this {
    const c = this.getCenter();
    return this.shift([x - c[0], 0, 0]);
  }
  setY(y: number): this {
    const c = this.getCenter();
    return this.shift([0, y - c[1], 0]);
  }
  setZ(z: number): this {
    const c = this.getCenter();
    return this.shift([0, 0, z - c[2]]);
  }

  /* ---------------- point application ---------------- */

  /** Mutate all points of this node and children (geometric ops). */
  applyToPoints(fn: (p: Vec3) => Vec3): void {
    if (!this.isGroup) {
      this.points = this.points.map(fn);
    }
    for (const c of this.children) c.applyToPoints(fn);
  }

  /* ---------------- style ---------------- */

  setColor(c: ManimColor): this {
    const col = resolveColor(c);
    this.style.stroke = col;
    for (const m of this.family()) {
      if (m === this) continue;
      m.style.stroke = col;
      if (m.style.fill) m.style.fill = col;
    }
    return this;
  }

  setFill(c: ManimColor | null, opacity?: number): this {
    const col = c === null ? null : resolveColor(c);
    this.style.fill = col ?? this.style.stroke ?? '#FFFFFF';
    if (col) this.style.fill = col;
    if (opacity !== undefined) this.style.fillOpacity = opacity;
    for (const m of this.family()) {
      if (m === this) continue;
      if (col) m.style.fill = col;
      if (opacity !== undefined) m.style.fillOpacity = opacity;
    }
    return this;
  }

  setStroke(c: ManimColor | null, width?: number, opacity?: number): this {
    if (c !== null && c !== undefined) {
      const col = resolveColor(c);
      this.style.stroke = col;
    }
    if (width !== undefined) this.style.strokeWidth = width;
    if (opacity !== undefined) this.style.strokeOpacity = opacity;
    for (const m of this.family()) {
      if (m === this) continue;
      if (c) m.style.stroke = this.style.stroke;
      if (width !== undefined) m.style.strokeWidth = width;
      if (opacity !== undefined) m.style.strokeOpacity = opacity;
    }
    return this;
  }

  setBackgroundStroke(c: ManimColor | null, width?: number, opacity?: number): this {
    if (c) this.style.backgroundStroke = resolveColor(c);
    if (width !== undefined) this.style.backgroundStrokeWidth = width;
    if (opacity !== undefined) this.style.backgroundStrokeOpacity = opacity;
    for (const m of this.family()) {
      if (m === this) continue;
      if (c) m.style.backgroundStroke = this.style.backgroundStroke;
      if (width !== undefined) m.style.backgroundStrokeWidth = width;
      if (opacity !== undefined) m.style.backgroundStrokeOpacity = opacity;
    }
    return this;
  }

  setOpacity(o: number): this {
    for (const m of this.family()) {
      if (m.style.fill !== null) m.style.fillOpacity = o;
      m.style.strokeOpacity = o;
      if (m.style.backgroundStroke) m.style.backgroundStrokeOpacity = o;
    }
    return this;
  }

  setShade(shade: Partial<Style>): this {
    Object.assign(this.style, shade);
    return this;
  }

  setColorByGradient(...colors: ManimColor[]): this {
    const fam = this.family().filter((m) => !m.isGroup);
    const n = Math.max(1, fam.length);
    fam.forEach((m, i) => {
      const col = gradientAt(colors, i / (n - 1 || 1));
      m.style.stroke = col;
      if (m.style.fill) m.style.fill = col;
    });
    return this;
  }

  highlight(color: ManimColor = '#FFFF00'): this {
    return this.setFill(color, 0.75);
  }

  /* ---------------- lifecycle / copies ---------------- */

  /** Deep copy. Subclasses override to preserve constructor identity. */
  copy(): this {
    const Ctor = this.constructor as new (opts?: any) => Mobject;
    const c = new Ctor();
    this.copyOnto(c);
    return c as this;
  }

  protected copyOnto(target: Mobject): void {
    target.points = this.points.map((p) => [...p] as Vec3);
    target.style = { ...this.style, sheenDirection: [...this.style.sheenDirection] as [number, number, number] };
    target.name = this.name;
    target.tags = [...this.tags];
    target.zIndex = this.zIndex;
    target.visible = this.visible;
    target.fixedInFrame = this.fixedInFrame;
    target.position = [...this.position] as Vec3;
    target.scaleVec = [...this.scaleVec] as Vec3;
    target.rotation = [...this.rotation] as Vec3;
    target.data = new Map(this.data);
    for (const child of this.children) target.add(child.copy());
  }

  become(other: Mobject): this {
    other.copyOnto(this);
    return this;
  }

  saveState(): this {
    this.savedStates.set(this, this.takeSnapshot());
    return this;
  }

  restore(): this {
    const snap = this.savedStates.get(this);
    if (snap) this.applySnapshot(snap);
    return this;
  }

  takeSnapshot(): Snapshot {
    return {
      points: this.points.map((p) => [...p] as Vec3),
      style: { ...this.style },
      visible: this.visible,
      zIndex: this.zIndex,
      savedStates: new Map(this.savedStates),
    };
  }

  applySnapshot(s: Snapshot): void {
    this.points = s.points.map((p) => [...p] as Vec3);
    this.style = { ...s.style };
    this.visible = s.visible;
    this.zIndex = s.zIndex;
    this.savedStates = new Map(s.savedStates);
  }

  /** Full-family snapshot (Scene/Animation use). */
  snapshotFamily(): Map<Mobject, Snapshot> {
    const map = new Map<Mobject, Snapshot>();
    for (const m of this.family()) map.set(m, m.takeSnapshot());
    return map;
  }

  restoreFamily(map: Map<Mobject, Snapshot>): void {
    for (const [m, s] of map) m.applySnapshot(s);
  }

  /** Old-style animation target (doc 02 generate_target + MoveToTarget). */
  generateTarget(): this {
    const t = this.copy();
    (this as any).target = t;
    return t;
  }
  get target(): Mobject | null {
    return (this as any)._target ?? null;
  }
  set target(t: Mobject | null) {
    (this as any)._target = t;
  }

  /* ---------------- updaters ---------------- */

  addUpdater(fn: Updater): this {
    this.updaters.push(fn);
    return this;
  }

  removeUpdater(fn: Updater): this {
    const i = this.updaters.indexOf(fn);
    if (i >= 0) this.updaters.splice(i, 1);
    return this;
  }

  clearUpdaters(): this {
    this.updaters = [];
    return this;
  }

  hasUpdaters(): boolean {
    return this.updaters.length > 0 || this.children.some((c) => c.hasUpdaters());
  }

  update(dt: number): void {
    for (const u of this.updaters) u(this, dt);
    for (const c of this.children) c.update(dt);
  }

  /* ---------------- drawing interface ---------------- */

  /** True if the renderer should draw this node itself (leaf + geometry). */
  get isDrawable(): boolean {
    return !this.isGroup && this.points.length > 0;
  }

  fixInFrame(flag = true): this {
    this.fixedInFrame = flag;
    for (const m of this.family()) if (m !== this) m.fixedInFrame = flag;
    return this;
  }

  /** Back-reference set by Scene.add() so mobjects can query scene time. */
  __scene: any = null;

  getSceneTime(): number {
    return this.__scene?.time ?? 0;
  }

  /**
   * Rebuild this mobject every frame from a factory (doc 07 always_redraw).
   * The factory receives `this` and returns a fresh mobject whose state
   * `become()`s copied onto `this` each update — keeps graphs/labels that
   * depend on a ValueTracker in sync without manual updater plumbing.
   */
  alwaysRedraw(factory: (m?: this) => Mobject): this {
    this.addUpdater((m) => {
      const fresh = factory(m as this);
      (m as Mobject).become(fresh);
    });
    return this;
  }

  setZIndex(z: number): this {
    this.zIndex = z;
    return this;
  }

  /* ---------------- .animate proxy ---------------- */

  get animate(): AnimationBuilder<Mobject> {
    const target = this.copy();
    return new AnimationBuilder(this, target);
  }

  /* ---------------- z / draw ordering ---------------- */

  bringToFront(): void {
    if (this.parent) {
      this.parent.remove(this);
      this.parent.children.push(this);
      this.parent = this.parent;
    }
  }

  sendToBack(): void {
    if (this.parent) {
      this.parent.remove(this);
      this.parent.children.unshift(this);
      this.parent = this.parent;
    }
  }

  /* ---------------- serialization ---------------- */

  toJSON(): any {
    return {
      type: this.constructor.name,
      name: this.name,
      points: this.points,
      style: this.style,
      zIndex: this.zIndex,
      visible: this.visible,
      children: this.children.map((c) => c.toJSON()),
    };
  }

  /* ---------------- utils ---------------- */

  /** Interpolate style toward another mobject's style (Transform support). */
  interpolateStyle(other: Mobject, alpha: number): this {
    this.style = lerpStyle(this.style, other.style, alpha);
    return this;
  }

  /** Arrange children in a row/column/grid (doc 02 arrange / arrange_in_grid). */
  arrange(direction: Vec3 = [1, 0, 0], opts?: { buff?: number }): this {
    const o = normalizeOptions(opts ?? {});
    const buff = o.buff ?? 0.25;
    const dir = v(norm(direction));
    const horiz = Math.abs(dir[0]) >= Math.abs(dir[1]);
    let cursor = 0;
    for (const c of this.children) {
      const size = horiz ? c.getWidth() : c.getHeight();
      if (cursor === 0) {
        cursor = size / 2;
      } else {
        cursor += buff + size / 2;
      }
      const pos = horiz ? [dir[0] * cursor, 0, 0] : [0, dir[1] * cursor, 0];
      c.moveTo([pos[0], pos[1], pos[2]]);
      cursor += size / 2;
    }
    // re-center the row on this mobject's current center
    const c0 = this.getCenter();
    const bb = this.getBoundingBox();
    const mid: Vec3 = [
      (bb.min[0] + bb.max[0]) / 2,
      (bb.min[1] + bb.max[1]) / 2,
      (bb.min[2] + bb.max[2]) / 2,
    ];
    this.shift(sub(c0, mid));
    return this;
  }

  arrangeInGrid(rows?: number, cols?: number, opts?: { buff?: number }): this {
    const o = normalizeOptions(opts ?? {});
    const buff = o.buff ?? 0.25;
    const n = this.children.length;
    if (!rows && !cols) { cols = Math.ceil(Math.sqrt(n)); rows = Math.ceil(n / cols); }
    else if (rows && !cols) cols = Math.ceil(n / rows);
    else if (!rows && cols) rows = Math.ceil(n / cols);
    const R = rows!, C = cols!;
    const cellW = Math.max(...this.children.map((c) => c.getWidth()), 0.1);
    const cellH = Math.max(...this.children.map((c) => c.getHeight()), 0.1);
    this.children.forEach((c, i) => {
      const r = Math.floor(i / C);
      const col = i % C;
      c.moveTo([
        (col - (C - 1) / 2) * (cellW + buff),
        -(r - (R - 1) / 2) * (cellH + buff),
        0,
      ]);
    });
    return this;
  }

  /** Interpolate points toward another mobject (Transform core). */
  interpolatePoints(other: Mobject, alpha: number): this {
    if (this.points.length === other.points.length) {
      this.points = this.points.map((p, i) => lerp(p, other.points[i], alpha));
    } else {
      // naive fallback: lerp bounding-center + scale (rare; VMobject overrides)
      this.interpolateStyle(other, alpha);
    }
    return this;
  }

  /** Apply a matrix to points (2x2 or 3x3, about center for linear-algebra use). */
  applyMatrixToPoints(m: Mat3 | number[][]): this {
    let M: Mat3;
    if (Array.isArray(m) && typeof m[0] === 'number') M = m as Mat3;
    else M = mat3.from2x2(m as number[][]);
    this.applyToPoints((p) => mat3.apply(M, p));
    return this;
  }
}

/* ---------------- AnimationBuilder (.animate) ---------------- */

type Chainable = { [k: string]: (...args: any[]) => any };

/**
 * Records method calls against a *copy*, then produces a Transform-like
 * animation when passed to play() (doc 07 §4).
 */
export class AnimationBuilder<T extends Mobject> {
  constructor(
    public mobject: T,
    public target: T,
    public operations: Array<[string, any[]]> = []
  ) {}

  /** Chain any method call; recorded against the target copy. */
  then(method: string, ...args: any[]): this {
    (this.target as any)[method]?.(...args);
    this.operations.push([method, args]);
    return this;
  }
}

/**
 * Proxy-based `.animate`: square.animate.shift(RIGHT).scale(0.5)
 * Every method call is recorded on the builder and applied to the target copy.
 */
export function buildAnimateProxy(builder: AnimationBuilder<any>): any {
  return new Proxy(builder, {
    get(b, prop: string) {
      if (prop === 'then' || typeof prop === 'symbol') return (b as any)[prop];
      if (prop in b) return (b as any)[prop];
      return (...args: any[]) => {
        (b.target as any)[prop]?.(...args);
        b.operations.push([prop, args]);
        return buildAnimateProxy(b);
      };
    },
  });
}

// Patch Mobject.animate to use the proxy so chains work naturally.
const origAnimate = Object.getOwnPropertyDescriptor(Mobject.prototype, 'animate');
Object.defineProperty(Mobject.prototype, 'animate', {
  get(this: Mobject) {
    const target = this.copy();
    const builder = new AnimationBuilder(this, target);
    return buildAnimateProxy(builder);
  },
  configurable: true,
});

export { smooth };
