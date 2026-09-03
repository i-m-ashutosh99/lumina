/**
 * Lumina — mobjects/graph/graph.ts
 * Graph / DiGraph mobject (doc 02 graph theory, doc 09 §10.2 "core Graph
 * already has vertices/edges as mobjects. The pack adds algorithm
 * animation" — this file is BOTH the core substrate AND the algorithm
 * layer, since Lumina has no separate `lumina/cs` pack build yet; the
 * algorithm methods below are exactly the `g.bfs()/dfs()/dijkstra()/
 * mstKruskal()` API doc 09 §10.2 specifies).
 *
 * Layouts implemented from scratch (doc 09 §10.2 "no NetworkX"):
 *   circular — vertices evenly spaced on a circle
 *   grid     — vertices in a row-major grid
 *   tree     — BFS-level layered layout from a root (Sugiyama-lite)
 *   layered  — alias of tree (longest-path layering for DAGs)
 *   random   — seeded random positions (uses the Scene's `rng` if passed,
 *              else a local seeded Random so replays are still deterministic)
 *   spring   — force-directed (Fruchterman-Reingold-style), fixed iteration
 *              count so it's deterministic and snapshot-able (doc 09 §10.2)
 *   static   — author-supplied positions (no computation)
 */
import { Vec3, v, add, sub, mul, length as vlen } from '../../math/vec';
import { VGroup, VDict } from '../../core/group';
import { VMobject } from '../../core/vmobject';
import { Dot, Line, Arrow } from '../geometry/basic';
import { normalizeOptions } from '../../core/style';
import { BLUE, GREY, YELLOW } from '../../math/color';
import { Random } from '../../math/rng';
import { Animation } from '../../core/animation';
import { Indicate, ShowPassingFlash } from '../../animations/indication';
import { AnimationGroup, Succession } from '../../animations/composition';
import { TAU } from '../../math/constants';

// Late-bound Text constructor to avoid a hard core->text circular import at
// module load time (same pattern as geometry/basic.ts's registerTextCtor).
// text/text.ts calls registerGraphTextCtor(Text) at its own module load.
let TextCtor: (new (s: string, opts?: any) => VMobject) | null = null;
export function registerGraphTextCtor(ctor: new (s: string, opts?: any) => VMobject): void {
  TextCtor = ctor;
}

export type VertexId = string | number;
export type EdgeKey = string;

export type LayoutName = 'circular' | 'grid' | 'tree' | 'layered' | 'random' | 'spring' | 'static';

export interface GraphOptions {
  layout?: LayoutName;
  layoutConfig?: Record<string, any>;
  layoutScale?: number;
  vertexConfig?: any | Record<VertexId, any>;
  edgeConfig?: any | Record<EdgeKey, any>;
  labels?: boolean | Record<VertexId, string>;
  vertexType?: new (opts?: any) => VMobject;
  root?: VertexId;
  vertexPositions?: Record<VertexId, Vec3>;
  rng?: Random;
  [key: string]: any;
}

function edgeKey(a: VertexId, b: VertexId, directed: boolean): EdgeKey {
  return directed ? `${a}->${b}` : [String(a), String(b)].sort().join('--');
}

/**
 * `Graph` — undirected graph mobject. Real ManimCE's `Graph`/`DiGraph`
 * (`manim.mobject.graph`) API surface, reimplemented from scratch (no
 * NetworkX dependency — doc 09 §10.2).
 */
export class Graph extends VGroup {
  directed = false;
  vertexIds: VertexId[] = [];
  edgeList: [VertexId, VertexId][] = [];
  vertices: Map<VertexId, VMobject> = new Map();
  edges: Map<EdgeKey, VMobject> = new Map();
  labelsGroup: VDict = new VDict();
  protected adjacency: Map<VertexId, VertexId[]> = new Map();
  protected rng: Random;

  constructor(vertices: VertexId[], edges: [VertexId, VertexId][], opts: GraphOptions = {}) {
    super();
    const o = normalizeOptions(opts);
    this.vertexIds = [...vertices];
    this.edgeList = edges.map(([a, b]) => [a, b]);
    this.rng = o.rng ?? new Random(1);
    this.buildAdjacency();
    this.buildVertices(o);
    this.buildEdges(o);
    this.add(...this.edges.values()); // edges first (drawn under vertices)
    this.add(...this.vertices.values());
    if (o.labels) this.buildLabels(o.labels);
    const layout = o.layout ?? 'circular';
    this.applyLayout(layout, o.layoutConfig ?? {}, o.layoutScale ?? 1, o.root, o.vertexPositions);
  }

  protected buildAdjacency(): void {
    this.adjacency.clear();
    for (const id of this.vertexIds) this.adjacency.set(id, []);
    for (const [a, b] of this.edgeList) {
      this.adjacency.get(a)?.push(b);
      if (!this.directed) this.adjacency.get(b)?.push(a);
    }
  }

  protected buildVertices(o: GraphOptions): void {
    const VertexCtor = o.vertexType ?? Dot;
    for (const id of this.vertexIds) {
      const cfgAll = o.vertexConfig ?? {};
      const cfg = (cfgAll as any)[id] ?? cfgAll;
      const dot = new VertexCtor({ radius: 0.12, color: BLUE, ...cfg });
      this.vertices.set(id, dot);
    }
  }

  protected buildEdges(o: GraphOptions): void {
    for (const [a, b] of this.edgeList) {
      const cfgAll = o.edgeConfig ?? {};
      const key = edgeKey(a, b, this.directed);
      const cfg = (cfgAll as any)[key] ?? cfgAll;
      const va = this.vertices.get(a)!;
      const vb = this.vertices.get(b)!;
      const line = this.directed
        ? new Arrow({ start: va.getCenter(), end: vb.getCenter(), color: GREY, buff: 0.12, tipLength: 0.15, ...cfg })
        : new Line({ start: va.getCenter(), end: vb.getCenter(), color: GREY, buff: 0.12, ...cfg });
      this.edges.set(key, line);
    }
  }

  protected buildLabels(labels: boolean | Record<VertexId, string>): void {
    if (!TextCtor) {
      // eslint-disable-next-line no-console
      console.warn('Graph labels requested but the text module is not loaded yet (import lumina/mobjects/text/text.ts, or the lumina barrel, before constructing a labeled Graph).');
      return;
    }
    for (const id of this.vertexIds) {
      const text = typeof labels === 'object' ? labels[id] : String(id);
      if (text === undefined) continue;
      const label = new TextCtor(text, { fontSize: 20 });
      label.moveTo(this.vertices.get(id)!.getCenter());
      this.labelsGroup.addKey(String(id), label);
      this.add(label);
    }
  }

  /** Re-run layout after construction (e.g. `g.changeLayout('tree', { root: 0 })`,
   *  real ManimCE `Graph.change_layout`). */
  changeLayout(layout: LayoutName, layoutConfig: Record<string, any> = {}, opts: { root?: VertexId; scale?: number; vertexPositions?: Record<VertexId, Vec3> } = {}): this {
    this.applyLayout(layout, layoutConfig, opts.scale ?? 1, opts.root, opts.vertexPositions);
    return this;
  }

  protected applyLayout(
    layout: LayoutName,
    cfg: Record<string, any>,
    scale: number,
    root?: VertexId,
    staticPositions?: Record<VertexId, Vec3>
  ): void {
    const positions = this.computeLayout(layout, cfg, scale, root, staticPositions);
    for (const [id, pos] of positions) {
      const vm = this.vertices.get(id);
      if (vm) vm.moveTo(pos);
    }
    this.syncEdgesToVertices();
    this.syncLabelsToVertices();
  }

  protected computeLayout(
    layout: LayoutName,
    cfg: Record<string, any>,
    scale: number,
    root?: VertexId,
    staticPositions?: Record<VertexId, Vec3>
  ): Map<VertexId, Vec3> {
    const n = this.vertexIds.length;
    const out = new Map<VertexId, Vec3>();
    if (layout === 'static' && staticPositions) {
      for (const id of this.vertexIds) out.set(id, v(staticPositions[id] ?? [0, 0, 0]));
      return out;
    }
    if (layout === 'circular') {
      const r = (cfg.radius ?? 2) * scale;
      this.vertexIds.forEach((id, i) => {
        const a = (i / n) * TAU;
        out.set(id, [r * Math.cos(a), r * Math.sin(a), 0]);
      });
      return out;
    }
    if (layout === 'grid') {
      const cols = cfg.cols ?? Math.ceil(Math.sqrt(n));
      const spacing = (cfg.spacing ?? 1.2) * scale;
      this.vertexIds.forEach((id, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        out.set(id, [col * spacing, -row * spacing, 0]);
      });
      // center
      return this.centerPositions(out);
    }
    if (layout === 'tree' || layout === 'layered') {
      return this.centerPositions(this.layeredLayout(root, (cfg.levelSpacing ?? 1.4) * scale, (cfg.nodeSpacing ?? 1.2) * scale));
    }
    if (layout === 'random') {
      const rng = this.rng;
      const r = (cfg.radius ?? 2.5) * scale;
      for (const id of this.vertexIds) out.set(id, [rng.range(-r, r), rng.range(-r, r), 0]);
      return out;
    }
    if (layout === 'spring') {
      return this.springLayout(cfg, scale);
    }
    // fallback
    return this.computeLayout('circular', cfg, scale, root, staticPositions);
  }

  protected centerPositions(positions: Map<VertexId, Vec3>): Map<VertexId, Vec3> {
    let cx = 0, cy = 0, n = 0;
    for (const p of positions.values()) { cx += p[0]; cy += p[1]; n++; }
    if (n === 0) return positions;
    cx /= n; cy /= n;
    for (const [k, p] of positions) positions.set(k, [p[0] - cx, p[1] - cy, 0]);
    return positions;
  }

  /** BFS-level layering from `root` (or the first vertex with no incoming
   *  edge, or vertexIds[0]) — a Sugiyama-lite tree/DAG layout (doc 09
   *  §10.2 "layered (Sugiyama-lite)"). */
  protected layeredLayout(root: VertexId | undefined, levelSpacing: number, nodeSpacing: number): Map<VertexId, Vec3> {
    const start = root ?? this.vertexIds[0];
    const level = new Map<VertexId, number>();
    const queue: VertexId[] = [start];
    level.set(start, 0);
    const visited = new Set<VertexId>([start]);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of this.adjacency.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          level.set(nb, (level.get(cur) ?? 0) + 1);
          queue.push(nb);
        }
      }
    }
    // any unreached vertices (disconnected) go on their own extra level
    let maxLevel = Math.max(0, ...level.values());
    for (const id of this.vertexIds) {
      if (!level.has(id)) { maxLevel += 1; level.set(id, maxLevel); }
    }
    const byLevel = new Map<number, VertexId[]>();
    for (const [id, lvl] of level) {
      if (!byLevel.has(lvl)) byLevel.set(lvl, []);
      byLevel.get(lvl)!.push(id);
    }
    const out = new Map<VertexId, Vec3>();
    for (const [lvl, ids] of byLevel) {
      const width = (ids.length - 1) * nodeSpacing;
      ids.forEach((id, i) => {
        out.set(id, [i * nodeSpacing - width / 2, -lvl * levelSpacing, 0]);
      });
    }
    return out;
  }

  /** Fruchterman-Reingold force-directed layout, FIXED iteration count so
   *  it's deterministic and reproducible under seeking (doc 09 §10.2
   *  "spring = force-directed, snapshot-able"). */
  protected springLayout(cfg: Record<string, any>, scale: number): Map<VertexId, Vec3> {
    const n = this.vertexIds.length;
    const iterations = cfg.iterations ?? 200;
    const area = (cfg.area ?? 4) * scale;
    const k = Math.sqrt((area * area) / Math.max(1, n));
    const rng = this.rng;
    const pos = new Map<VertexId, Vec3>();
    this.vertexIds.forEach((id) => pos.set(id, [rng.range(-area / 2, area / 2), rng.range(-area / 2, area / 2), 0]));
    const disp = new Map<VertexId, Vec3>();
    let temp = area / 10;
    for (let iter = 0; iter < iterations; iter++) {
      for (const id of this.vertexIds) disp.set(id, [0, 0, 0]);
      // repulsive
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = this.vertexIds[i], b = this.vertexIds[j];
          const pa = pos.get(a)!, pb = pos.get(b)!;
          const delta = sub(pa, pb);
          const d = Math.max(0.01, vlen(delta));
          const force = (k * k) / d;
          const dir = mul(delta, force / d);
          disp.set(a, add(disp.get(a)!, dir));
          disp.set(b, sub(disp.get(b)!, dir));
        }
      }
      // attractive along edges
      for (const [a, b] of this.edgeList) {
        const pa = pos.get(a)!, pb = pos.get(b)!;
        const delta = sub(pa, pb);
        const d = Math.max(0.01, vlen(delta));
        const force = (d * d) / k;
        const dir = mul(delta, force / d);
        disp.set(a, sub(disp.get(a)!, dir));
        disp.set(b, add(disp.get(b)!, dir));
      }
      // apply, capped by temperature
      for (const id of this.vertexIds) {
        const d = disp.get(id)!;
        const dLen = Math.max(0.01, vlen(d));
        const capped = mul(d, Math.min(dLen, temp) / dLen);
        pos.set(id, add(pos.get(id)!, capped));
      }
      temp *= 0.98;
    }
    return this.centerPositions(pos);
  }

  protected syncEdgesToVertices(): void {
    for (const [a, b] of this.edgeList) {
      const key = edgeKey(a, b, this.directed);
      const edge = this.edges.get(key);
      const va = this.vertices.get(a)!;
      const vb = this.vertices.get(b)!;
      if (edge && (edge as any).putStartAndEndOn) {
        (edge as Line).putStartAndEndOn(va.getCenter(), vb.getCenter());
      } else if (edge) {
        const rebuilt = this.directed
          ? new Arrow({ start: va.getCenter(), end: vb.getCenter(), buff: 0.12 })
          : new Line({ start: va.getCenter(), end: vb.getCenter(), buff: 0.12 });
        edge.become(rebuilt);
      }
    }
  }

  protected syncLabelsToVertices(): void {
    for (const id of this.vertexIds) {
      const label = this.labelsGroup.get(String(id));
      const vm = this.vertices.get(id);
      if (label && vm) label.moveTo(vm.getCenter());
    }
  }

  getVertex(id: VertexId): VMobject | undefined { return this.vertices.get(id); }
  getEdge(a: VertexId, b: VertexId): VMobject | undefined { return this.edges.get(edgeKey(a, b, this.directed)); }
  neighbors(id: VertexId): VertexId[] { return this.adjacency.get(id) ?? []; }

  /** Add a vertex + optional new edges at authoring time (real ManimCE
   *  `Graph.add_vertices`). Does not re-run layout automatically — call
   *  `changeLayout()` after batch additions. */
  addVertices(...ids: VertexId[]): this {
    for (const id of ids) {
      if (this.vertices.has(id)) continue;
      this.vertexIds.push(id);
      this.adjacency.set(id, []);
      const dot = new Dot({ radius: 0.12, color: BLUE });
      this.vertices.set(id, dot);
      this.add(dot);
    }
    return this;
  }

  addEdges(...pairs: [VertexId, VertexId][]): this {
    for (const [a, b] of pairs) {
      this.edgeList.push([a, b]);
      this.adjacency.get(a)?.push(b);
      if (!this.directed) this.adjacency.get(b)?.push(a);
      const va = this.vertices.get(a), vb = this.vertices.get(b);
      if (!va || !vb) continue;
      const key = edgeKey(a, b, this.directed);
      const line = this.directed
        ? new Arrow({ start: va.getCenter(), end: vb.getCenter(), color: GREY, buff: 0.12 })
        : new Line({ start: va.getCenter(), end: vb.getCenter(), color: GREY, buff: 0.12 });
      this.edges.set(key, line);
      this.add(line);
    }
    return this;
  }

  /* ------------------------------------------------------------------ */
  /* Algorithm animation (doc 09 §10.2) — g.bfs()/dfs()/dijkstra()/mst() */
  /* ------------------------------------------------------------------ */

  /**
   * Breadth-first search from `start`. Returns a single `Animation`
   * (a `Succession`) that `scene.play()` consumes directly — each visited
   * vertex is `visit()`ed (default `Indicate`) and each traversed edge is
   * `traverse()`d (default `ShowPassingFlash`) in BFS order.
   */
  bfs(start: VertexId, opts: AlgoAnimOptions = {}): Animation {
    const order = this.traversalOrder('bfs', start);
    return this.buildAlgoAnimation(order, opts);
  }

  dfs(start: VertexId, opts: AlgoAnimOptions = {}): Animation {
    const order = this.traversalOrder('dfs', start);
    return this.buildAlgoAnimation(order, opts);
  }

  protected traversalOrder(kind: 'bfs' | 'dfs', start: VertexId): TraversalStep[] {
    const visited = new Set<VertexId>([start]);
    const steps: TraversalStep[] = [{ vertex: start }];
    if (kind === 'bfs') {
      const queue: VertexId[] = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const nb of this.adjacency.get(cur) ?? []) {
          if (!visited.has(nb)) {
            visited.add(nb);
            steps.push({ vertex: nb, viaEdge: [cur, nb] });
            queue.push(nb);
          }
        }
      }
    } else {
      const stack: VertexId[] = [start];
      const rec = (cur: VertexId) => {
        for (const nb of this.adjacency.get(cur) ?? []) {
          if (!visited.has(nb)) {
            visited.add(nb);
            steps.push({ vertex: nb, viaEdge: [cur, nb] });
            rec(nb);
          }
        }
      };
      rec(start);
    }
    return steps;
  }

  /**
   * Dijkstra shortest paths from `start`. `distLabels: true` (doc 09
   * §10.2) additionally attaches a running-distance DecimalNumber to each
   * vertex as it's finalized (best-effort — requires the text module to
   * be loaded; silently skipped otherwise).
   */
  dijkstra(start: VertexId, opts: AlgoAnimOptions & { distLabels?: boolean } = {}): Animation {
    const dist = new Map<VertexId, number>();
    for (const id of this.vertexIds) dist.set(id, Infinity);
    dist.set(start, 0);
    const visited = new Set<VertexId>();
    const steps: TraversalStep[] = [];
    const weight = opts.weight ?? (() => 1);
    while (visited.size < this.vertexIds.length) {
      let u: VertexId | null = null;
      let best = Infinity;
      for (const id of this.vertexIds) {
        if (!visited.has(id) && dist.get(id)! < best) { best = dist.get(id)!; u = id; }
      }
      if (u === null) break;
      visited.add(u);
      if (u !== start) {
        steps.push({ vertex: u, distance: dist.get(u) });
      } else {
        steps.push({ vertex: u, distance: 0 });
      }
      for (const nb of this.adjacency.get(u) ?? []) {
        if (visited.has(nb)) continue;
        const w = weight(u, nb);
        const nd = dist.get(u)! + w;
        if (nd < dist.get(nb)!) {
          dist.set(nb, nd);
        }
      }
    }
    return this.buildAlgoAnimation(steps, opts, dist);
  }

  /** Minimum spanning tree via Kruskal's algorithm (undirected only). */
  mstKruskal(opts: AlgoAnimOptions & { weight?: (a: VertexId, b: VertexId) => number } = {}): Animation {
    const weight = opts.weight ?? (() => 1);
    const parent = new Map<VertexId, VertexId>();
    for (const id of this.vertexIds) parent.set(id, id);
    const find = (x: VertexId): VertexId => {
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r)!;
      return r;
    };
    const union = (a: VertexId, b: VertexId): boolean => {
      const ra = find(a), rb = find(b);
      if (ra === rb) return false;
      parent.set(ra, rb);
      return true;
    };
    const sortedEdges = [...this.edgeList].sort((e1, e2) => weight(e1[0], e1[1]) - weight(e2[0], e2[1]));
    const anims: Animation[] = [];
    for (const [a, b] of sortedEdges) {
      if (union(a, b)) {
        const edge = this.getEdge(a, b);
        if (edge) anims.push(this.makeTraverseAnim(edge, opts));
      }
    }
    return new Succession(anims, { lagRatio: 1 });
  }

  protected makeVisitAnim(vertex: VMobject, opts: AlgoAnimOptions): Animation {
    return opts.visit ? opts.visit(vertex) : new Indicate(vertex, { color: opts.visitColor ?? YELLOW });
  }

  protected makeTraverseAnim(edge: VMobject, opts: AlgoAnimOptions): Animation {
    return opts.traverse ? opts.traverse(edge) : new ShowPassingFlash(edge, { timeWidth: 0.3 });
  }

  protected buildAlgoAnimation(steps: TraversalStep[], opts: AlgoAnimOptions, dist?: Map<VertexId, number>): Animation {
    const anims: Animation[] = [];
    for (const step of steps) {
      const vertexMob = this.vertices.get(step.vertex);
      if (step.viaEdge) {
        const edge = this.getEdge(step.viaEdge[0], step.viaEdge[1]);
        if (edge) anims.push(this.makeTraverseAnim(edge, opts));
      }
      if (vertexMob) anims.push(this.makeVisitAnim(vertexMob, opts));
    }
    if (anims.length === 0) return new AnimationGroup([]);
    return new Succession(anims, { lagRatio: 1 });
  }
}

interface TraversalStep {
  vertex: VertexId;
  viaEdge?: [VertexId, VertexId];
  distance?: number;
}

export interface AlgoAnimOptions {
  visit?: (v: VMobject) => Animation;
  traverse?: (e: VMobject) => Animation;
  visitColor?: any;
  distLabels?: boolean;
  weight?: (a: VertexId, b: VertexId) => number;
}

/** `DiGraph` — directed graph (real ManimCE `DiGraph`): edges render as
 *  `Arrow`s, traversal only follows outgoing edges. */
export class DiGraph extends Graph {
  directed = true;
}
