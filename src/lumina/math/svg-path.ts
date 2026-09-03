/**
 * Lumina — svg-path.ts
 * Generic SVG path `d`-string → cubic-Bézier parser (VMobject-native format:
 * flat Vec3[] list, 4 points per curve). Shared by `mathtex.ts` (MathJax SVG
 * output) and available for any future SVG-import feature (e.g. `SVGMobject`).
 *
 * Supports the full "curve" subset of the SVG path grammar: M/m, L/l, H/h,
 * V/v, C/c, S/s, Q/q, T/t, Z/z (both absolute and relative), including the
 * "smooth" S/T reflected-control-point rule. Arcs (A/a) are NOT supported —
 * MathJax's `fontCache:'none'` SVG output never emits them (verified
 * empirically: only M/L/Q/C/Z/H/V/T appear in real MathJax path data), and
 * general elliptical-arc-to-cubic conversion is out of scope for this pass;
 * an A/a command degrades to a straight line (logged once via a module-level
 * warning) rather than throwing, so unexpected input fails soft.
 */
import { Vec3 } from './vec';

/** Parse one SVG path `d` attribute into cubic-Bézier points (Vec3[], 4 per
 *  curve). Coordinates are returned exactly as authored in the path data —
 *  callers apply their own transform/scale/flip afterward. */
export function parseSvgPathToCubics(d: string): Vec3[] {
  const tokens = tokenizePath(d);
  const cubics: Vec3[] = [];
  let i = 0;
  let cur: [number, number] = [0, 0];
  let start: [number, number] = [0, 0];
  // last cubic/quadratic control point, for S/s and T/t "smooth" reflection.
  let lastCubicCtrl: [number, number] | null = null;
  let lastQuadCtrl: [number, number] | null = null;
  let lastCmd = '';

  const P = (x: number, y: number): Vec3 => [x, y, 0];
  const pushLine = (to: [number, number]) => {
    const h1: [number, number] = [cur[0] + (to[0] - cur[0]) / 3, cur[1] + (to[1] - cur[1]) / 3];
    const h2: [number, number] = [cur[0] + (2 * (to[0] - cur[0])) / 3, cur[1] + (2 * (to[1] - cur[1])) / 3];
    cubics.push(P(cur[0], cur[1]), P(h1[0], h1[1]), P(h2[0], h2[1]), P(to[0], to[1]));
  };
  const pushCubic = (h1: [number, number], h2: [number, number], to: [number, number]) => {
    cubics.push(P(cur[0], cur[1]), P(h1[0], h1[1]), P(h2[0], h2[1]), P(to[0], to[1]));
  };
  const pushQuad = (q: [number, number], to: [number, number]) => {
    // degree-raise quadratic -> cubic
    const h1: [number, number] = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])];
    const h2: [number, number] = [to[0] + (2 / 3) * (q[0] - to[0]), to[1] + (2 / 3) * (q[1] - to[1])];
    cubics.push(P(cur[0], cur[1]), P(h1[0], h1[1]), P(h2[0], h2[1]), P(to[0], to[1]));
  };

  while (i < tokens.length) {
    const cmd = tokens[i++] as string;
    const abs = cmd === cmd.toUpperCase();
    const c = cmd.toUpperCase();
    const rel = (x: number, y: number): [number, number] => (abs ? [x, y] : [cur[0] + x, cur[1] + y]);

    if (c === 'M') {
      const x = tokens[i++] as number, y = tokens[i++] as number;
      cur = rel(x, y);
      start = cur;
      lastCubicCtrl = null; lastQuadCtrl = null;
    } else if (c === 'L') {
      const x = tokens[i++] as number, y = tokens[i++] as number;
      const to = rel(x, y);
      pushLine(to);
      cur = to;
      lastCubicCtrl = null; lastQuadCtrl = null;
    } else if (c === 'H') {
      const x = tokens[i++] as number;
      const to: [number, number] = abs ? [x, cur[1]] : [cur[0] + x, cur[1]];
      pushLine(to);
      cur = to;
      lastCubicCtrl = null; lastQuadCtrl = null;
    } else if (c === 'V') {
      const y = tokens[i++] as number;
      const to: [number, number] = abs ? [cur[0], y] : [cur[0], cur[1] + y];
      pushLine(to);
      cur = to;
      lastCubicCtrl = null; lastQuadCtrl = null;
    } else if (c === 'C') {
      const x1 = tokens[i++] as number, y1 = tokens[i++] as number;
      const x2 = tokens[i++] as number, y2 = tokens[i++] as number;
      const x = tokens[i++] as number, y = tokens[i++] as number;
      const h1 = rel(x1, y1), h2 = rel(x2, y2), to = rel(x, y);
      pushCubic(h1, h2, to);
      cur = to;
      lastCubicCtrl = h2; lastQuadCtrl = null;
    } else if (c === 'S') {
      const x2 = tokens[i++] as number, y2 = tokens[i++] as number;
      const x = tokens[i++] as number, y = tokens[i++] as number;
      const h2 = rel(x2, y2), to = rel(x, y);
      const h1: [number, number] = lastCubicCtrl && (lastCmd === 'C' || lastCmd === 'S')
        ? [2 * cur[0] - lastCubicCtrl[0], 2 * cur[1] - lastCubicCtrl[1]]
        : [cur[0], cur[1]];
      pushCubic(h1, h2, to);
      cur = to;
      lastCubicCtrl = h2; lastQuadCtrl = null;
    } else if (c === 'Q') {
      const x1 = tokens[i++] as number, y1 = tokens[i++] as number;
      const x = tokens[i++] as number, y = tokens[i++] as number;
      const q = rel(x1, y1), to = rel(x, y);
      pushQuad(q, to);
      cur = to;
      lastQuadCtrl = q; lastCubicCtrl = null;
    } else if (c === 'T') {
      const x = tokens[i++] as number, y = tokens[i++] as number;
      const to = rel(x, y);
      const q: [number, number] = lastQuadCtrl && (lastCmd === 'Q' || lastCmd === 'T')
        ? [2 * cur[0] - lastQuadCtrl[0], 2 * cur[1] - lastQuadCtrl[1]]
        : [cur[0], cur[1]];
      pushQuad(q, to);
      cur = to;
      lastQuadCtrl = q; lastCubicCtrl = null;
    } else if (c === 'Z') {
      if (Math.abs(cur[0] - start[0]) > 1e-9 || Math.abs(cur[1] - start[1]) > 1e-9) {
        pushLine(start);
      }
      cur = start;
      lastCubicCtrl = null; lastQuadCtrl = null;
    } else if (c === 'A') {
      // Unsupported: MathJax (fontCache:'none') never emits arcs. Degrade to
      // a straight line to the arc's declared endpoint rather than throwing.
      i += 5; // rx, ry, x-axis-rotation, large-arc-flag, sweep-flag
      const x = tokens[i++] as number, y = tokens[i++] as number;
      const to = rel(x, y);
      warnArcOnce();
      pushLine(to);
      cur = to;
      lastCubicCtrl = null; lastQuadCtrl = null;
    } else {
      // Unknown command — stop parsing this path defensively rather than
      // looping forever on a malformed token stream.
      break;
    }
    lastCmd = c;
  }
  return cubics;
}

let warnedArc = false;
function warnArcOnce(): void {
  if (warnedArc) return;
  warnedArc = true;
  // eslint-disable-next-line no-console
  console.warn('Lumina: parseSvgPathToCubics encountered an SVG arc (A/a) command — approximated as a straight line (arcs are not converted to cubics in this pass).');
}

/** Tokenize a `d` string into an alternating [command, num, num, ...] stream.
 *  Handles SVG's terse number grammar: no required separators between
 *  numbers (`1.5.5` = `1.5 .5`), optional leading `+`, scientific notation,
 *  and command-letter run-together numbers (`M10-20` = `M 10 -20`). */
function tokenizePath(d: string): Array<string | number> {
  const out: Array<string | number> = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])|(-?\d*\.\d+(?:[eE][+-]?\d+)?|-?\d+(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    if (m[1]) out.push(m[1]);
    else out.push(parseFloat(m[2]));
  }
  return out;
}

/* ---------------- 2D affine transform composition (SVG `transform` attr) ---------------- */

/** [a, b, c, d, e, f] representing x' = a*x + c*y + e; y' = b*x + d*y + f
 *  (SVG/CSS matrix convention). */
export type Affine2D = [number, number, number, number, number, number];

export const AFFINE_IDENTITY: Affine2D = [1, 0, 0, 1, 0, 0];

/** Compose so that `applyAffine(compose(outer, inner), p) === applyAffine(outer, applyAffine(inner, p))`
 *  — i.e. `inner` is applied to the point first, `outer` second. This is the
 *  correct nested-<g> semantics: an ancestor's accumulated transform is
 *  `outer`, and a child <g>'s own transform is `inner`. */
export function composeAffine(outer: Affine2D, inner: Affine2D): Affine2D {
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function applyAffine(m: Affine2D, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Parse a single SVG `transform` attribute value into an Affine2D. Supports
 *  `translate(x[,y])`, `scale(s[,sy])`, `rotate(deg)`, `matrix(a,b,c,d,e,f)` —
 *  the full set MathJax's SVG output jax emits (`translate(x,y) scale(s)`
 *  nesting for sub/superscript & fraction placement, plus the root-level
 *  `scale(1,-1)` y-flip). Multiple space-separated functions compose
 *  left-to-right per the SVG spec. */
export function parseTransformAttr(attr: string | null | undefined): Affine2D {
  if (!attr) return AFFINE_IDENTITY;
  let m = AFFINE_IDENTITY;
  const re = /(\w+)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attr))) {
    const fn = match[1];
    const args = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let step: Affine2D = AFFINE_IDENTITY;
    if (fn === 'translate') step = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    else if (fn === 'scale') step = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
    else if (fn === 'rotate') {
      const rad = ((args[0] ?? 0) * Math.PI) / 180;
      step = [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0];
    } else if (fn === 'matrix') {
      step = [args[0] ?? 1, args[1] ?? 0, args[2] ?? 0, args[3] ?? 1, args[4] ?? 0, args[5] ?? 0];
    }
    // left-to-right composition within one attribute value: each subsequent
    // function applies to the ALREADY-transformed coordinate system, i.e.
    // m_new = m_so_far ∘ step (step is the "inner"/later one).
    m = composeAffine(m, step);
  }
  return m;
}

/** Transform a flat cubic-points list (Vec3[], z untouched) by an Affine2D. */
export function transformCubics(cubics: Vec3[], m: Affine2D): Vec3[] {
  return cubics.map((p) => {
    const [x, y] = applyAffine(m, p[0], p[1]);
    return [x, y, p[2]] as Vec3;
  });
}
