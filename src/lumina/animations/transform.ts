/**
 * Lumina — transform.ts
 * The 3b1b signature animations (doc 02 §B.13–B.14).
 */
import { Animation, AnimOptions, registerTransformFactory } from '../core/animation';
import { Mobject } from '../core/mobject';
import { VMobject } from '../core/vmobject';
import { MeshMobject } from '../core/mesh-mobject';
import { lerp } from '../math/vec';
import { normalizeOptions } from '../core/style';

export interface TransformOptions extends AnimOptions {
  pathArc?: number;
  replaceMobjectWithTargetInScene?: boolean;
}

export class Transform extends Animation {
  target: Mobject;
  pathArc = 0;
  protected alignedStart: Mobject | null = null;
  protected alignedTarget: Mobject | null = null;

  constructor(mobject: Mobject, target: Mobject, opts: TransformOptions = {}) {
    super(mobject, opts);
    const o = normalizeOptions(opts);
    this.target = target;
    this.pathArc = o.pathArc ?? 0;
  }

  begin(): void {
    super.begin();
    // Pre-align both sides so lerping is scribble-free (doc 06 §5).
    // MeshMobject (3D) has its own vertex-count-matched CPU-lerp path
    // (`interpolatePoints`) rather than VMobject's cubic-curve alignment —
    // skip alignment for it and let interpolateMobject dispatch below.
    if (this.mobject && this.target && !(this.mobject instanceof MeshMobject)) {
      const a = this.mobject;
      const b = this.target;
      const aV = a as VMobject;
      const bV = b as VMobject;
      if (aV.alignPointsBidirectional) {
        const [pa, pb] = aV.alignPointsBidirectional(bV);
        this.alignedStart = pa;
        this.alignedTarget = pb;
      } else {
        this.alignedStart = a;
        this.alignedTarget = b;
      }
    }
  }

  interpolateMobject(alpha: number): void {
    if (!this.mobject) return;
    // 3D path: MeshMobject interpolates its own vertex buffers (keeps
    // `positions`/`points` mirrored and lerps normals) — restoreStart()
    // already reset `this.mobject` to its start snapshot before this call,
    // so lerp from there toward `this.target`.
    if (this.mobject instanceof MeshMobject && this.target instanceof MeshMobject) {
      this.mobject.interpolatePoints(this.target, alpha);
      return;
    }
    if (!this.alignedStart || !this.alignedTarget) return;
    const a = this.alignedStart.points;
    const b = this.alignedTarget.points;
    const arc = this.pathArc;
    const m = this.mobject;
    m.points = a.map((p, i) => {
      const q = b[i] ?? b[b.length - 1];
      const straight = lerp(p, q, alpha);
      if (arc === 0) return straight;
      // path_arc: rotate around the midpoint by arc*alpha (ClockwiseTransform)
      const mid = lerp(p, q, 0.5) as [number, number, number];
      const dx = straight[0] - mid[0];
      const dy = straight[1] - mid[1];
      const ang = arc * Math.sin(alpha * Math.PI); // smooth arc bulge
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      return [
        mid[0] + dx * c - dy * s,
        mid[1] + dx * s + dy * c,
        straight[2],
      ] as [number, number, number];
    });
    m.interpolateStyle(this.alignedTarget, alpha);
  }

  getTargetMobjects(): Mobject[] {
    return [this.mobject!];
  }
}

// Register for prepareAnimation (the .animate pipeline)
registerTransformFactory((a, b) => new Transform(a, b));

/** Transform then replace A with B in the scene. */
export class ReplacementTransform extends Transform {
  replaceMobjectWithTargetInScene = true;
}

/** Transform a copy of A into B (A stays in the scene untouched). */
export class TransformFromCopy extends Transform {
  constructor(mobject: Mobject, target: Mobject, opts: TransformOptions = {}) {
    const copy = mobject.copy();
    super(copy, target, opts);
    this.introducer = true;
  }
}

export class ClockwiseTransform extends Transform {
  constructor(a: Mobject, b: Mobject, opts: TransformOptions = {}) {
    super(a, b, { ...opts, pathArc: opts.pathArc ?? -Math.PI / 2 });
  }
}

export class CounterclockwiseTransform extends Transform {
  constructor(a: Mobject, b: Mobject, opts: TransformOptions = {}) {
    super(a, b, { ...opts, pathArc: opts.pathArc ?? Math.PI / 2 });
  }
}

/** Crossfade + travel (when point structures mismatch badly, doc 02). */
export class FadeTransform extends Animation {
  target: Mobject;
  constructor(mobject: Mobject, target: Mobject, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.target = target;
  }
  interpolateMobject(alpha: number): void {
    if (!this.mobject) return;
    const m = this.mobject;
    m.style.strokeOpacity = this.startStyle.strokeOpacity * (1 - alpha);
    m.style.fillOpacity = this.startStyle.fillOpacity * (1 - alpha);
    const t = this.target;
    t.style.strokeOpacity = this.endStyle.strokeOpacity * alpha;
    t.style.fillOpacity = this.endStyle.fillOpacity * alpha;
    // gentle travel of A toward B's center
    const c0 = this.startCenter;
    const c1 = this.target.getCenter();
    m.shift([
      (c1[0] - c0[0]) * alpha * 0.3,
      (c1[1] - c0[1]) * alpha * 0.3,
      0,
    ]);
  }
  protected startStyle: any = null;
  protected endStyle: any = null;
  protected startCenter: [number, number, number] = [0, 0, 0];
  begin(): void {
    super.begin();
    if (this.mobject) {
      this.startStyle = { ...this.mobject.style };
      this.startCenter = this.mobject.getCenter() as [number, number, number];
      this.endStyle = { ...this.target.style };
      this.target.style.strokeOpacity = 0;
      this.target.style.fillOpacity = 0;
    }
  }
  finish(): void {
    super.finish();
    if (this.mobject) {
      this.mobject.style.strokeOpacity = 0;
      this.mobject.style.fillOpacity = 0;
      this.target.style.strokeOpacity = this.endStyle.strokeOpacity;
      this.target.style.fillOpacity = this.endStyle.fillOpacity;
    }
  }
  getTargetMobjects(): Mobject[] {
    return [this.mobject!, this.target];
  }
}

/** FadeTransform applied per matching submobject pair. */
export class FadeTransformPieces extends FadeTransform {
  interpolateMobject(alpha: number): void {
    const aSubs = this.mobject!.submobjects;
    const bSubs = this.target.submobjects;
    const n = Math.min(aSubs.length, bSubs.length);
    for (let i = 0; i < n; i++) {
      const a = aSubs[i];
      const b = bSubs[i];
      a.style.strokeOpacity = (this.startStyle.strokeOpacity ?? 1) * (1 - alpha);
      b.style.strokeOpacity = (b.style.strokeOpacity ?? 1);
    }
    super.interpolateMobject(alpha);
  }
}

/** Cycle positions of several mobjects (doc 02 CyclicReplace). */
export class CyclicReplace extends Animation {
  mobs: Mobject[];
  protected startCenters: [number, number, number][] = [];
  constructor(...args: any[]) {
    const mobs: Mobject[] = [];
    let opts: AnimOptions = {};
    for (const a of args) {
      if (a instanceof Mobject) mobs.push(a);
      else if (a && typeof a === 'object') opts = a;
    }
    super(null, opts);
    this.mobs = mobs;
  }
  begin(): void {
    this.startCenters = this.mobs.map((m) => m.getCenter() as [number, number, number]);
    this.startSnapshots = new Map();
    for (const m of this.mobs) (this.startSnapshots as any).set(m, m.takeSnapshot());
  }
  interpolateMobject(alpha: number): void {
    const n = this.mobs.length;
    this.mobs.forEach((m, i) => {
      const from = this.startCenters[i];
      const to = this.startCenters[(i + 1) % n];
      const c = m.getCenter();
      m.shift([
        (from[0] - c[0]) * (1 - alpha) + (to[0] - from[0]) * alpha - (c[0] - from[0]),
        (from[1] - c[1]) * (1 - alpha) + (to[1] - from[1]) * alpha - (c[1] - from[1]),
        0,
      ]);
    });
  }
  getTargetMobjects(): Mobject[] {
    return this.mobs;
  }
}

/** CyclicReplace of two (Swap). */
export class Swap extends CyclicReplace {}

/** Animate toward mob.target (generateTarget + MoveToTarget). */
export class MoveToTarget extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    if (!(mobject as any).target) {
      throw new Error('MoveToTarget requires mobject.generateTarget() first');
    }
    super(mobject, opts);
    this.targetMob = (mobject as any).target as Mobject;
  }
  targetMob: Mobject;
  interpolateMobject(alpha: number): void {
    if (!this.mobject) return;
    if (alpha === 0) return;
    this.mobject.points.length = this.mobject.points.length;
    const t = new Transform(this.mobject, this.targetMob);
    t.begin();
    t.interpolateMobject(alpha);
  }
  getTargetMobjects(): Mobject[] {
    return [this.mobject!];
  }
}

/** Apply R^3→R^3 to all points (doc 02 ApplyFunction). */
export class ApplyFunction extends Animation {
  constructor(fn: (p: any) => any, mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.fn = fn;
  }
  fn: (p: any) => any;
  begin(): void {
    super.begin();
    this.endPoints = this.mobject!.points.map((p) => this.fn(p));
  }
  protected endPoints: any[] = [];
  interpolateMobject(alpha: number): void {
    if (!this.mobject || !this.startSnapshots) return;
    const start = (this.startSnapshots.get(this.mobject!) as any).points;
    this.mobject.points = start.map((p: any, i: number) =>
      lerp(p, this.endPoints[i] ?? this.endPoints[this.endPoints.length - 1], alpha)
    );
  }
}

export class ApplyPointwiseFunction extends ApplyFunction {}
export class ApplyPointwiseFunctionToCenter extends Animation {
  constructor(fn: (c: any) => any, mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.fn = fn;
  }
  fn: (c: any) => any;
  begin(): void {
    super.begin();
    this.startCenter = this.mobject!.getCenter();
    this.endCenter = this.fn(this.startCenter);
  }
  startCenter: any = [0, 0, 0];
  endCenter: any = [0, 0, 0];
  interpolateMobject(alpha: number): void {
    const c = lerp(this.startCenter, this.endCenter, alpha);
    const cur = this.mobject!.getCenter();
    this.mobject!.shift([
      c[0] - cur[0], c[1] - cur[1], c[2] - cur[2],
    ]);
  }
}

/** 2x2/3x3 linear map on points — *the* 3b1b move (doc 02 ApplyMatrix). */
export class ApplyMatrix extends Animation {
  constructor(matrix: number[][] | any, mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.matrix = matrix;
  }
  matrix: any;
  begin(): void {
    super.begin();
    const m = this.matrix;
    const is2x2 = m.length === 2;
    this.transformed = this.mobject!.points.map((p) => {
      if (is2x2) {
        const x = m[0][0] * p[0] + m[0][1] * p[1];
        const y = m[1][0] * p[0] + m[1][1] * p[1];
        return [x, y, p[2]];
      }
      return [
        m[0][0] * p[0] + m[0][1] * p[1] + (m[0][2] ?? 0) * p[2],
        m[1][0] * p[0] + m[1][1] * p[1] + (m[1][2] ?? 0) * p[2],
        (m[2]?.[0] ?? 0) * p[0] + (m[2]?.[1] ?? 0) * p[1] + (m[2]?.[2] ?? 1) * p[2],
      ];
    });
  }
  transformed: any[] = [];
  interpolateMobject(alpha: number): void {
    const start = (this.startSnapshots!.get(this.mobject!) as any).points;
    this.mobject!.points = start.map((p: any, i: number) =>
      lerp(p, this.transformed[i], alpha)
    );
  }
}

/**
 * Interpret xy as complex and apply f: C -> C.
 * `fn` receives and must return a plain `{ re, im }` pair (JS has no
 * complex literal). A bare number result is treated as `{ re, im: 0 }`.
 */
export class ApplyComplexFunction extends ApplyMatrix {
  constructor(fn: (z: { re: number; im: number }) => { re: number; im: number } | number, mobject: Mobject, opts: AnimOptions = {}) {
    super([[1, 0], [0, 1]], mobject, opts);
    this.cfn = fn;
  }
  cfn!: (z: { re: number; im: number }) => { re: number; im: number } | number;
  begin(): void {
    super.begin();
    this.transformed = this.mobject!.points.map((p) => {
      const z = this.cfn({ re: p[0], im: p[1] });
      const re = typeof z === 'number' ? z : z.re;
      const im = typeof z === 'number' ? 0 : z.im;
      return [re, im, p[2]];
    });
  }
}

/** Animate a method call on a mobject (legacy; prefer .animate). */
export class ApplyMethod extends Animation {
  constructor(mobject: Mobject, method: (...args: any[]) => any, args: any[] = [], opts: AnimOptions = {}) {
    super(mobject, opts);
    this.method = method;
    this.args = args;
  }
  method: (...args: any[]) => any;
  args: any[];
  begin(): void {
    super.begin();
    const target = this.mobject!.copy();
    (target as any)[this.method.name]?.(...this.args);
    // fallback: call method bound to target
    try { this.method.apply(target, this.args); } catch { /* ignore */ }
    this.targetPoints = target.points;
  }
  targetPoints: any[] = [];
  interpolateMobject(alpha: number): void {
    const start = (this.startSnapshots!.get(this.mobject!) as any).points;
    this.mobject!.points = start.map((p: any, i: number) =>
      lerp(p, this.targetPoints[i] ?? p, alpha)
    );
  }
}

/* ---------- utility animation factories ---------- */

export class FadeToColor extends Animation {
  constructor(mobject: Mobject, color: string, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.color = color;
  }
  color: string;
  begin(): void {
    super.begin();
    this.startStroke = this.mobject!.style.stroke;
    this.startFill = this.mobject!.style.fill;
  }
  startStroke: any = '#fff';
  startFill: any = null;
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    m.style.stroke = lerpColorHex(this.startStroke, this.color, alpha);
    if (this.startFill) m.style.fill = lerpColorHex(this.startFill, this.color, alpha);
  }
}

function lerpColorHex(a: string, b: string, t: number): string {
  const pa = parseInt((a[0] === '#' ? a.slice(1) : a).padEnd(6, '0').slice(0, 6), 16);
  const pb = parseInt((b[0] === '#' ? b.slice(1) : b).padEnd(6, '0').slice(0, 6), 16);
  const ch = (x: number, s: number) => (Math.round(((x >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t) & 255);
  const r = ch(pa & 0xff0000, 16), g = ch(pa & 0x00ff00, 8), bl = ch(pa & 0x0000ff, 0);
  const R = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t;
  const G = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t;
  const B = (pa & 255) * (1 - t) + (b === undefined ? 0 : (pb & 255)) * t;
  return `#${hex(R)}${hex(G)}${hex(B)}`;
}
function hex(x: number): string {
  return Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0');
}

export class ScaleInPlace extends Animation {
  constructor(mobject: Mobject, factor: number, opts: AnimOptions = {}) {
    super(mobject, opts);
    this.factor = factor;
  }
  factor: number;
  begin(): void {
    super.begin();
  }
  interpolateMobject(alpha: number): void {
    const snap = this.startSnapshots!.get(this.mobject!) as any;
    this.mobject!.points = snap.points;
    this.mobject!.scale(1 + (this.factor - 1) * alpha, {
      aboutPoint: this.mobject!.getCenter(),
    });
  }
}

export class ShrinkToCenter extends ScaleInPlace {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, 0, opts);
  }
}

export class Restore extends Animation {
  constructor(mobject: Mobject, opts: AnimOptions = {}) {
    super(mobject, opts);
    if (!mobject.savedStates.has(mobject)) {
      throw new Error('Restore requires mobject.saveState() first');
    }
    this.saved = mobject.savedStates.get(mobject)!;
  }
  saved: any;
  interpolateMobject(alpha: number): void {
    const m = this.mobject!;
    const start = (this.startSnapshots!.get(m) as any);
    m.points = start.points.map((p: any, i: number) =>
      lerp(p, this.saved.points[i], alpha)
    );
    m.style.strokeOpacity = start.style.strokeOpacity + (this.saved.style.strokeOpacity - start.style.strokeOpacity) * alpha;
  }
}

/* ---------- TransformMatchingParts (formula morphing, doc 02 §B.14) ---------- */

import { VGroup } from '../core/group';

/** Match submobjects by a key function, then Transform matches + fade rest. */
export abstract class TransformMatchingAbstractBase extends Animation {
  keyMap?: Record<string, string>;
  transformMismatches = true;
  fadeTransformMismatches = true;

  constructor(
    protected source: Mobject,
    protected target: Mobject,
    opts: {
      keyMap?: Record<string, string>;
      transformMismatches?: boolean;
      fadeTransformMismatches?: boolean;
      runTime?: number;
      rateFunc?: any;
    } = {}
  ) {
    super(source, opts);
    this.keyMap = opts.keyMap;
    this.transformMismatches = opts.transformMismatches ?? true;
    this.fadeTransformMismatches = opts.fadeTransformMismatches ?? true;
  }

  abstract getKeys(m: Mobject): Map<Mobject, string>;

  begin(): void {
    super.begin();
    const srcKeys = this.getKeys(this.source);
    const tgtKeys = this.getKeys(this.target);
    const pairs: Array<[Mobject, Mobject]> = [];
    const usedTarget = new Set<Mobject>();
    for (const [sm, sk] of srcKeys) {
      let match: Mobject | undefined;
      for (const [tm, tk] of tgtKeys) {
        if (usedTarget.has(tm)) continue;
        if (tk === (this.keyMap?.[sk] ?? sk)) { match = tm; break; }
      }
      if (match) {
        pairs.push([sm, match]);
        usedTarget.add(match);
      }
    }
    this.pairs = pairs;
    this.unmatchedSource = [...srcKeys.keys()].filter((m) => !pairs.some((p) => p[0] === m));
    this.unmatchedTarget = [...tgtKeys.keys()].filter((m) => !usedTarget.has(m));
  }

  pairs: Array<[Mobject, Mobject]> = [];
  unmatchedSource: Mobject[] = [];
  unmatchedTarget: Mobject[] = [];

  interpolateMobject(alpha: number): void {
    for (const [a, b] of this.pairs) {
      const start = (this.startSnapshots as any)?.get(a);
      if (!start) continue;
      a.applySnapshot(start);
      if (a instanceof VMobject) {
        const t = new Transform(a, b);
        t.begin();
        t.interpolateMobject(alpha);
      } else {
        a.points = start.points.map((p: any, i: number) => lerp(p, b.points[i] ?? p, alpha));
      }
    }
    for (const m of this.unmatchedSource) {
      const start = (this.startSnapshots as any)?.get(m);
      if (start) {
        m.applySnapshot(start);
        m.style.strokeOpacity = start.style.strokeOpacity * (1 - alpha);
        m.style.fillOpacity = start.style.fillOpacity * (1 - alpha);
      }
    }
    for (const m of this.unmatchedTarget) {
      m.style.strokeOpacity = (m.style.strokeOpacity ?? 1) * alpha;
      m.style.fillOpacity = (m.style.fillOpacity ?? 1) * alpha;
    }
  }

  getTargetMobjects(): Mobject[] {
    return [this.source, this.target];
  }
}

import { VMobject as VM } from '../core/vmobject';

/** Match by shape geometry hash. */
export class TransformMatchingShapes extends TransformMatchingAbstractBase {
  getKeys(m: Mobject): Map<Mobject, string> {
    const map = new Map<Mobject, string>();
    const visit = (node: Mobject) => {
      for (const c of node.children) visit(c);
      if (!node.isGroup && node.points.length) {
        // hash: rounded points
        const h = node.points
          .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
          .join(';')
          .slice(0, 400);
        map.set(node, hashStr(h));
      }
    };
    visit(m);
    return map;
  }
}

/** Match MathTex submobjects by tex string (formula morph). */
export class TransformMatchingTex extends TransformMatchingAbstractBase {
  getKeys(m: Mobject): Map<Mobject, string> {
    const map = new Map<Mobject, string>();
    const visit = (node: Mobject) => {
      for (const c of node.children) visit(c);
      if (!node.isGroup && (node as any).tex !== undefined) {
        map.set(node, (node as any).tex);
      } else if (!node.isGroup && node.points.length && (node as any).texString !== undefined) {
        map.set(node, (node as any).texString);
      }
    };
    visit(m);
    return map;
  }
}

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `h${h}`;
}
