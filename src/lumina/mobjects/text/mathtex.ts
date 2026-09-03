/**
 * Lumina — mobjects/text/mathtex.ts
 * MathTex / Tex: LaTeX rendered to real vector Béziers via `mathjax-full`'s
 * TeX-input → SVG-output pipeline (`liteAdaptor`, no DOM needed — works in
 * any JS environment). This is the de-risked path documented in the
 * project's audit: MathJax has already solved TeX box-layout (sub/super-
 * script placement, fractions, radicals, matrices, ...) the same way real
 * Manim's LaTeX+dvisvgm pipeline does, emitting a tree of `<path d="...">`
 * (glyph outlines, `M/L/Q/C/Z/H/V/T` commands only when `fontCache:'none'`)
 * and `<rect>` (fraction bars / sqrt bars / rules) wrapped in
 * `<g transform="translate(x,y) scale(s)">` nesting — Lumina just needs to
 * walk that tree, accumulate the transform stack, and convert each leaf to
 * cubic-Bézier VMobject points. No TeX-layout math is reimplemented here.
 *
 * Coordinate pipeline (verified empirically against mathjax-full@3.2.1):
 *   1. MathJax SVG output uses 1000 raw units per em (verified: font.params
 *      rule_thickness=0.06em produced a literal `<rect height="60">` for
 *      `\frac{1}{2}` — 60/1000 = 0.06, exact).
 *   2. The whole tree sits under one root `<g transform="scale(1,-1)">`
 *      (MathJax's own font glyphs are authored y-up/baseline-0, same as
 *      TrueType; this flips them into standard SVG y-down for correct
 *      on-screen rendering) with further `translate(...)/scale(...)` nesting
 *      per sub/superscript/fraction placement.
 *   3. We accumulate the FULL transform chain (including that root
 *      scale(1,-1)) exactly as MathJax intends, producing correct SVG
 *      y-down pixel coordinates — then negate y exactly ONCE at the very
 *      end to convert into Lumina's y-up world (same pattern `font.ts` uses
 *      for opentype.js glyphs: flip once, on final coordinates, never fold
 *      an extra flip into the middle of a transform stack).
 *   4. Scale factor: `fontSize * FONT_SIZE_TO_WORLD` gives "world units per
 *      em" — the exact same convention `text.ts` uses for opentype glyphs —
 *      divided by 1000 (raw units per em) to get world-units-per-raw-unit.
 *
 * `\cssId{name}{...}` (MathJax's `html` extension, part of `AllPackages`)
 * survives into the output tree as a literal `id` attribute on the wrapping
 * `<g>` — used here as the per-part tagging mechanism: every top-level
 * "part" (each variadic constructor argument, or each `isolate`d substring)
 * gets wrapped in its own `\cssId{p<i>}{...}`, and every glyph/rect found
 * inside that subtree is grouped into one `MathTexPart` (a VGroup) tagged
 * `.tex = <that part's source text>` — which `TransformMatchingTex`
 * (animations/transform.ts) matches on directly for formula-morph
 * animations (`3Blue1Brown`-style `x^2 + y^2` → `y^2 + x^2`).
 *
 * Async note: same reasoning as `Text` — MathJax's own module set and its
 * webfont metrics are loaded lazily via dynamic `import()` (kept out of the
 * main bundle: this is a ~600KB-gzipped LaTeX engine, not something every
 * page needs), so `ready: Promise<this>` is required before this mobject
 * has real geometry, exactly like `Text.ready`.
 */
import { Vec3 } from '../../math/vec';
import { VMobject } from '../../core/vmobject';
import { VGroup } from '../../core/group';
import { Mobject } from '../../core/mobject';
import { cornersToCubics } from '../../math/bezier';
import { normalizeOptions } from '../../core/style';
import { resolveColor } from '../../math/color';
import { DEFAULT_FONT_SIZE } from '../../math/constants';
import {
  parseSvgPathToCubics, parseTransformAttr, composeAffine, transformCubics,
  AFFINE_IDENTITY, Affine2D,
} from '../../math/svg-path';

/** Same convention as `text.ts`'s `FONT_SIZE_TO_WORLD` — kept identical so
 *  a MathTex glyph and a Text glyph at the same `fontSize` are visually
 *  consistent (e.g. `MathTex('x')` next to `Text('x')` should look the
 *  same size). */
const FONT_SIZE_TO_WORLD = 1 / 96;

/** MathJax SVG output's raw-units-per-em (verified: font.params.rule_thickness
 *  = 0.06em ⇒ literal `<rect height="60">`, i.e. 60/1000 = 0.06, exact). */
const MATHJAX_UNITS_PER_EM = 1000;

export interface MathTexOptions {
  color?: any;
  fontSize?: number;
  /** Substrings to split out as their own `TransformMatchingTex`-matchable
   *  parts (Manim's `isolate=[...]`). Applied to EVERY positional tex
   *  string passed to the constructor. Longest-match-first, left-to-right,
   *  non-overlapping. Caveat (same as real Manim): splitting mid-token
   *  (e.g. inside `\frac{...}`) produces invalid TeX — isolate on
   *  complete sub-expressions. */
  isolate?: string[];
  /** Substring → color map (Manim's `tex_to_color_map`); implies isolating
   *  each key (union'd with `isolate`) so it can be colored independently. */
  texToColorMap?: Record<string, any>;
  /** Separator inserted between top-level parts before typesetting
   *  (Manim's `arg_separator`, default `' '`). A space is the safe default:
   *  concatenating parts with NO separator can glue a trailing macro name
   *  into the next part's first letter (e.g. `\alpha` + `x` → `\alphax`,
   *  an undefined macro). */
  argSeparator?: string;
}

/** One top-level tagged part of a MathTex/Tex expression — a VGroup whose
 *  `.tex` field is this part's exact source text. `TransformMatchingTex`
 *  (animations/transform.ts) matches on individual LEAF mobjects, not
 *  `VGroup` containers (a group's own `points` is empty, so `Transform`
 *  between two groups would be a visual no-op) — this container exists for
 *  `getPartByTex`/manual access; every glyph leaf inside is ALSO tagged
 *  `.tex` with the same value (see `MathTex.build`) so the matcher works. */
export class MathTexPart extends VGroup {
  tex: string;
  constructor(tex: string, ...mobs: Mobject[]) {
    super(...mobs);
    this.tex = tex;
  }
  copy(): this {
    const c = super.copy() as this;
    c.tex = this.tex;
    return c;
  }
}

/* ---------------- MathJax engine singleton (lazy dynamic import) ---------------- */

let enginePromise: Promise<{ html: any; adaptor: any }> | null = null;

/** Lazily import + construct mathjax-full's TeX→SVG pipeline exactly once,
 *  reused across every MathTex/Tex instance. `liteAdaptor` needs no real
 *  DOM (works in workers / SSR / any JS runtime), and `html.convert(...)`
 *  is synchronous once the modules are loaded (verified empirically). */
function getMathJaxEngine(): Promise<{ html: any; adaptor: any }> {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const [
      { mathjax },
      { TeX },
      { SVG },
      { liteAdaptor },
      { RegisterHTMLHandler },
      { AllPackages },
    ] = await Promise.all([
      import('mathjax-full/js/mathjax.js'),
      import('mathjax-full/js/input/tex.js'),
      import('mathjax-full/js/output/svg.js'),
      import('mathjax-full/js/adaptors/liteAdaptor.js'),
      import('mathjax-full/js/handlers/html.js'),
      import('mathjax-full/js/input/tex/AllPackages.js'),
    ]);
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const tex = new TeX({ packages: AllPackages });
    const svgOutput = new SVG({ fontCache: 'none' });
    const html = mathjax.document('', { InputJax: tex, OutputJax: svgOutput });
    return { html, adaptor };
  })();
  return enginePromise;
}

/** Force-load the MathJax engine ahead of time (e.g. app bootstrap), same
 *  role as `font.ts`'s `preloadDefaultFonts` — avoids first-MathTex latency. */
export async function preloadMathJax(): Promise<void> {
  await getMathJaxEngine();
}

/* ---------------- isolate splitting ---------------- */

/** Partition `text` into an ordered list of substrings, splitting out each
 *  occurrence of an `isolate` string as its own element (longest-match-
 *  first at each scan position, left-to-right, non-overlapping). Filler
 *  text between matches is kept as its own (untagged-but-still-a-part)
 *  element so every character of the input ends up in exactly one part. */
function splitByIsolate(text: string, isolate: string[]): string[] {
  const needles = [...new Set(isolate.filter((s) => s.length > 0))].sort((a, b) => b.length - a.length);
  if (needles.length === 0) return [text];
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let matched: string | null = null;
    for (const n of needles) {
      if (text.startsWith(n, i)) { matched = n; break; }
    }
    if (matched) {
      out.push(matched);
      i += matched.length;
      continue;
    }
    let j = i + 1;
    scan: while (j < text.length) {
      for (const n of needles) if (text.startsWith(n, j)) break scan;
      j++;
    }
    out.push(text.slice(i, j));
    i = j;
  }
  return out;
}

function isPlainOptions(x: any): boolean {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/* ---------------- MathTex ---------------- */

export class MathTex extends VGroup {
  ready: Promise<this>;
  /** Combined source text of every part, concatenated (no separators,
   *  no `\cssId` wrapping) — for reference/debugging/`.tex` on the whole. */
  tex: string;
  /** One VGroup per top-level part, in source order; each tagged `.tex`
   *  with that part's exact source text for `TransformMatchingTex`. */
  parts: MathTexPart[] = [];
  /** Tex/text-mode subclasses (see `Tex` below) set this before the
   *  microtask that reads it runs (see class-field-ordering note below). */
  protected textMode = false;

  constructor(...args: any[]) {
    super();
    let opts: MathTexOptions = {};
    if (args.length && isPlainOptions(args[args.length - 1])) opts = args.pop();
    const raw: string[] = args.length === 1 && Array.isArray(args[0])
      ? args[0].map(String)
      : args.map(String);
    const o = normalizeOptions(opts as any);
    const color = o.color ? resolveColor(o.color) : '#FFFFFF';
    this.style.stroke = color;
    this.style.fill = color;
    this.style.fillOpacity = 1;
    this.style.strokeWidth = 0;

    const isolate = [...(o.isolate ?? []), ...Object.keys(o.texToColorMap ?? {})];
    const partsText = raw.length
      ? raw.flatMap((s: string) => (isolate.length ? splitByIsolate(s, isolate) : [s]))
      : [''];
    this.tex = partsText.join('');

    const fontSize = o.fontSize ?? DEFAULT_FONT_SIZE;
    const argSeparator = o.argSeparator ?? ' ';
    // NOTE on class-field ordering: `this.build(...)` below awaits
    // `getMathJaxEngine()` as its very first statement, and only reads
    // `this.textMode`/`this.wrapPart` in the code AFTER that await. Since a
    // subclass's own field initializers (e.g. `Tex`'s `textMode = true`)
    // run synchronously immediately after `super(...)` returns — which is
    // strictly before ANY promise continuation can run — `this.textMode`
    // is guaranteed correct by the time the post-await code executes, even
    // though `build()` is *called* from inside this base constructor.
    this.ready = this.build(partsText, fontSize, color, argSeparator, o.texToColorMap).then(() => this);
  }

  /** Subclass hook: `Tex` wraps each part in `\text{...}` so it renders
   *  upright (non-italic) like normal prose instead of math-mode variables. */
  protected wrapPart(text: string): string {
    return this.textMode ? `\\text{${text}}` : text;
  }

  private async build(
    partsText: string[],
    fontSize: number,
    defaultColor: string,
    argSeparator: string,
    texToColorMap?: Record<string, any>
  ): Promise<void> {
    const { html, adaptor } = await getMathJaxEngine();

    const combined = partsText
      .map((p, i) => `\\cssId{p${i}}{${this.wrapPart(p)}}`)
      .join(argSeparator);

    let container: any;
    try {
      container = html.convert(combined, { display: !this.textMode });
    } catch (err) {
      throw new Error(`Lumina MathTex: failed to typeset "${this.tex}": ${(err as Error).message}`);
    }
    const svgEl = adaptor.childNodes(container)[0];
    if (!svgEl) return; // empty input — leave this MathTex with zero geometry

    type Leaf = { partIdx: number; cubics: Vec3[] };
    const leaves: Leaf[] = [];

    const getAttr = (n: any, a: string): string | null => {
      try { return adaptor.getAttribute(n, a); } catch { return null; }
    };

    const collect = (n: any, accum: Affine2D, partIdx: number): void => {
      if (!n || n.kind === 'text') return;
      const t = getAttr(n, 'transform');
      const nextAccum = t ? composeAffine(accum, parseTransformAttr(t)) : accum;
      let nextPartIdx = partIdx;
      const idAttr = getAttr(n, 'id');
      if (idAttr) {
        const m = /^p(\d+)$/.exec(idAttr);
        if (m) nextPartIdx = parseInt(m[1], 10);
      }
      if (n.kind === 'path') {
        const d = getAttr(n, 'd');
        if (d) leaves.push({ partIdx: nextPartIdx, cubics: transformCubics(parseSvgPathToCubics(d), nextAccum) });
      } else if (n.kind === 'rect') {
        const x = parseFloat(getAttr(n, 'x') ?? '0');
        const y = parseFloat(getAttr(n, 'y') ?? '0');
        const w = parseFloat(getAttr(n, 'width') ?? '0');
        const h = parseFloat(getAttr(n, 'height') ?? '0');
        const corners: Vec3[] = [[x, y, 0], [x + w, y, 0], [x + w, y + h, 0], [x, y + h, 0]];
        leaves.push({ partIdx: nextPartIdx, cubics: transformCubics(cornersToCubics(corners, true), nextAccum) });
      }
      const kids = adaptor.childNodes(n);
      for (const c of kids) collect(c, nextAccum, nextPartIdx);
    };

    for (const child of adaptor.childNodes(svgEl)) collect(child, AFFINE_IDENTITY, -1);

    const sizeWorld = fontSize * FONT_SIZE_TO_WORLD; // world units per em
    const unitScale = sizeWorld / MATHJAX_UNITS_PER_EM;

    const partGroups = partsText.map((text) => new MathTexPart(text));
    const ungrouped = new VGroup();

    for (const leaf of leaves) {
      if (leaf.cubics.length === 0) continue;
      const glyph = new VMobject();
      // Single final y-negation converts MathJax's fully-composed SVG
      // y-down pixel coordinates into Lumina's y-up world (see file header).
      glyph.points = leaf.cubics.map((p) => [p[0] * unitScale, -p[1] * unitScale, 0] as Vec3);
      glyph.closed = true;
      let col = defaultColor;
      const partText = leaf.partIdx >= 0 ? partsText[leaf.partIdx] : undefined;
      if (texToColorMap && partText !== undefined && texToColorMap[partText] !== undefined) {
        col = resolveColor(texToColorMap[partText]);
      }
      glyph.style.fill = col;
      glyph.style.stroke = col;
      glyph.style.fillOpacity = 1;
      glyph.style.strokeWidth = 0;
      // Tag the LEAF itself with `.tex` (not just its MathTexPart container)
      // so `TransformMatchingTex` — which matches leaves, since a VGroup's
      // own `points` is always empty — can pair glyphs across a formula
      // morph. See `MathTexPart` doc comment above.
      if (partText !== undefined) (glyph as any).tex = partText;
      const target = leaf.partIdx >= 0 ? partGroups[leaf.partIdx] : ungrouped;
      (target ?? ungrouped).add(glyph);
    }

    this.parts = partGroups;
    this.add(...partGroups);
    if (ungrouped.children.length) this.add(ungrouped);
    this.center();
  }

  /** Real Manim's `get_part_by_tex` — find the first part whose source text
   *  exactly matches (or, if none match exactly, the first that contains). */
  getPartByTex(tex: string): MathTexPart | undefined {
    return this.parts.find((p) => p.tex === tex) ?? this.parts.find((p) => p.tex.includes(tex));
  }

  copy(): this {
    return super.copy() as this;
  }
}

/** Tex: same pipeline, but each part is wrapped in `\text{...}` so it
 *  renders as upright prose rather than italic math variables — Lumina's
 *  approximation of real Manim's `Tex` (which uses a full LaTeX article
 *  text environment; MathJax has no such "text document" input mode, so
 *  `\text{}` inside inline math is the closest equivalent achievable
 *  without shipping a second, much heavier, text-layout engine). */
export class Tex extends MathTex {
  protected textMode = true;
}

/** A single, un-isolated tex string as one part (no per-part splitting) —
 *  real Manim's `SingleStringMathTex` building block. Provided for parity;
 *  `MathTex`/`Tex` already default to this when called with one string and
 *  no `isolate` option, so this is mostly useful as an explicit type. */
export class SingleStringMathTex extends MathTex {
  constructor(texString: string, opts: Omit<MathTexOptions, 'isolate'> = {}) {
    super(texString, { ...opts, isolate: [] });
  }
}
