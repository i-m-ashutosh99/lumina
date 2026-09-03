/**
 * Lumina — mobjects/data/code.ts
 * `Code` — syntax-highlighted source code as a VGroup of per-token
 * VMobjects (doc 09 §10.4 "Code in core uses highlight.js/Prism tokens ->
 * per-token VMobjects (so Write and Indicate work)"), plus `CodeBlock`
 * (doc 09 §10.1/§10.4) which adds a current-line highlight and
 * `stepTo(line)`/`morphTo(newSrc)` stepping helpers for the CS pack.
 *
 * Highlighting is done with `highlight.js` at TOKEN granularity only (doc
 * 09 §15 "cs Code: highlight.js (token only)") — we never touch the DOM;
 * `hljs.highlight(src, { language }).value` returns an HTML string whose
 * `<span class="hljs-KIND">...</span>` runs we walk with a tiny parser
 * (`tokenize()` below) to get `{ text, className }` runs, decode HTML
 * entities, then lay each run's characters out as `Text` glyphs colored by
 * a small default token→color theme (overridable via `theme`).
 */
import hljs from 'highlight.js';
import { Vec3, v } from '../../math/vec';
import { VGroup } from '../../core/group';
import { VMobject } from '../../core/vmobject';
import { Mobject } from '../../core/mobject';
import { normalizeOptions } from '../../core/style';
import { resolveColor } from '../../math/color';
import { Text } from '../text/text';
import { Rectangle } from '../geometry/basic';
import { DEFAULT_FONT_SIZE } from '../../math/constants';
import { Animation } from '../../core/animation';

/** Default token-kind -> color theme (3b1b-adjacent dark-background palette,
 *  doc 09 §12 cross-cutting visual language — reuses the named palette). */
export const DEFAULT_CODE_THEME: Record<string, string> = {
  keyword: '#C586C0',
  built_in: '#4EC9B0',
  string: '#CE9178',
  number: '#B5CEA8',
  comment: '#6A9955',
  literal: '#569CD6',
  title: '#DCDCAA',
  'title.function_': '#DCDCAA',
  'title.class_': '#4EC9B0',
  params: '#9CDCFE',
  attr: '#9CDCFE',
  meta: '#569CD6',
  symbol: '#D4D4D4',
  regexp: '#D16969',
  variable: '#9CDCFE',
  operator: '#D4D4D4',
  punctuation: '#D4D4D4',
  default: '#D4D4D4',
};

interface TokenRun {
  text: string;
  className: string | null;
}

/** Decode the handful of HTML entities highlight.js's HTML renderer emits. */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Walk highlight.js's HTML output into a flat list of `{ text, className }`
 * runs (nested `<span>`s collapse to their innermost class, matching what
 * `hljs-KIND` token coloring needs — good enough for token-level coloring,
 * not a full DOM tree). No `DOMParser` dependency (works in SSR/build too).
 */
function tokenize(html: string): TokenRun[] {
  const runs: TokenRun[] = [];
  const classStack: string[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf.length) {
      runs.push({ text: decodeEntities(buf), className: classStack[classStack.length - 1] ?? null });
      buf = '';
    }
  };
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i);
      if (end === -1) { buf += html[i]; i++; continue; }
      const tag = html.slice(i + 1, end);
      flush();
      if (tag.startsWith('/')) {
        classStack.pop();
      } else {
        const m = /class="([^"]*)"/.exec(tag);
        const cls = m ? m[1].replace(/^hljs-/, '') : null;
        classStack.push(cls ?? classStack[classStack.length - 1] ?? '');
      }
      i = end + 1;
    } else {
      buf += html[i];
      i++;
    }
  }
  flush();
  return runs;
}

export interface CodeOptions {
  language?: string;
  fontSize?: number;
  theme?: Record<string, string>;
  tabSize?: number;
  backgroundColor?: any;
  insertLineNo?: boolean;
  lineNoColor?: any;
}

/**
 * `Code` — one `Text`-glyph-based VMobject tree per character, grouped into
 * per-line `VGroup`s (`this.lines[i]`), colored per-token by highlight.js
 * classification. Monospace font (`font: 'mono'`) for correct column
 * alignment. `ready: Promise<this>` resolves once glyphs are built (same
 * async-font pattern as `Text`/`MathTex`).
 *
 * ```js
 * const code = new Code(`def f(x):\n    return x*x`, { language: 'python' });
 * await code.ready;
 * scene.play(Write(code));
 * ```
 */
export class Code extends VGroup {
  source: string;
  language: string;
  lines: VGroup[] = [];
  lineNumbers: VGroup[] = [];
  background: VMobject | null = null;
  ready: Promise<this>;
  protected fontSize: number;
  protected theme: Record<string, string>;

  constructor(source: string, opts: CodeOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    this.source = source;
    this.language = o.language ?? 'plaintext';
    this.fontSize = o.fontSize ?? 28;
    this.theme = { ...DEFAULT_CODE_THEME, ...(o.theme ?? {}) };
    this.ready = this.build(o);
  }

  protected async build(o: any): Promise<this> {
    const tabSize = o.tabSize ?? 4;
    const normalized = this.source.replace(/\t/g, ' '.repeat(tabSize));
    const srcLines = normalized.split('\n');

    let highlighted: string[];
    try {
      const lang = hljs.getLanguage(this.language) ? this.language : undefined;
      const res = lang
        ? hljs.highlight(normalized, { language: lang })
        : hljs.highlightAuto(normalized);
      highlighted = res.value.split('\n');
    } catch {
      highlighted = srcLines.map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    }
    // highlight.js can leave an open <span> at a line break (multi-line
    // token like a block comment) — reopen/close per-line by tracking a
    // running "open tags" stack across lines so tokenize() sees valid HTML
    // for each line independently.
    const openStack: string[] = [];
    const perLineRuns: TokenRun[][] = highlighted.map((lineHtml) => {
      const prefix = openStack.map((c) => `<span class="hljs-${c}">`).join('');
      const full = prefix + lineHtml;
      const runs = tokenize(full);
      // update openStack: count net open spans in this raw line html
      const opens = [...lineHtml.matchAll(/<span class="hljs-([^"]*)"/g)].map((m) => m[1]);
      const closes = (lineHtml.match(/<\/span>/g) ?? []).length;
      for (const c of opens) openStack.push(c);
      for (let k = 0; k < closes; k++) openStack.pop();
      return runs;
    });

    const charW = this.fontSize * (1 / 96) * 0.62; // monospace advance approx
    const lineH = this.fontSize * (1 / 96) * 1.5;
    const readyPromises: Promise<any>[] = [];
    const lineGroups: VGroup[] = [];

    perLineRuns.forEach((runs, li) => {
      const row = new VGroup();
      let cursorX = 0;
      for (const run of runs) {
        if (run.text.length === 0) continue;
        const color = this.theme[run.className ?? 'default'] ?? this.theme.default;
        const t = new Text(run.text, { font: 'mono', fontSize: this.fontSize, color });
        readyPromises.push(t.ready.then(() => {
          t.moveTo([cursorX + t.getWidth() / 2, 0, 0]);
        }));
        row.add(t);
        cursorX += Math.max(run.text.length * charW, 0.001);
      }
      row.moveTo([0, -li * lineH, 0]);
      lineGroups.push(row);
      this.add(row);
    });

    await Promise.all(readyPromises);
    // Left-align every line on column 0 (rows are already built left-to-right
    // starting at x=0, but VGroup.add centers on add — re-home explicitly).
    for (const row of lineGroups) {
      const left = row.getLeft()[0];
      if (Number.isFinite(left)) row.shift([-left, 0, 0]);
    }
    this.lines = lineGroups;

    if (o.insertLineNo) {
      const numColor = o.lineNoColor ?? '#808080';
      const nums: VGroup[] = [];
      for (let li = 0; li < lineGroups.length; li++) {
        const n = new Text(String(li + 1), { font: 'mono', fontSize: this.fontSize, color: numColor });
        await n.ready;
        n.moveTo([-1.0, lineGroups[li].getCenter()[1], 0]);
        const g = new VGroup(n);
        nums.push(g);
        this.add(g);
      }
      this.lineNumbers = nums;
    }

    if (o.backgroundColor) {
      const bb = this.getBoundingBox();
      const bg = new Rectangle({
        width: bb.max[0] - bb.min[0] + 0.6,
        height: bb.max[1] - bb.min[1] + 0.6,
        color: resolveColor(o.backgroundColor),
        fillOpacity: 1,
        strokeWidth: 0,
      });
      bg.moveTo(this.getCenter());
      this.background = bg;
      this.add(bg);
      // background must draw first (behind text) — re-add all text rows
      // after it so array order puts them on top.
      for (const row of lineGroups) row.bringToFront();
      for (const g of this.lineNumbers) g.bringToFront();
    }
    return this;
  }

  /** Line `i` (0-indexed) as a single Mobject (for Indicate/Circumscribe). */
  getLine(i: number): VGroup | undefined { return this.lines[i]; }
}

/**
 * `CodeBlock` — a `Code` plus a movable current-line highlight rectangle
 * and step/morph helpers (doc 09 §10.4):
 *
 * ```js
 * const code = new CodeBlock(src, { language: 'python' });
 * await scene.play(code.stepTo(2));      // highlight + move pointer
 * await scene.play(code.morphTo(src2));  // TransformMatchingShapes-lite swap
 * ```
 */
export class CodeBlock extends VGroup {
  code: Code;
  highlightRect: VMobject | null = null;
  ready: Promise<this>;
  protected currentLine = -1;
  protected opts: CodeOptions;

  constructor(source: string, opts: CodeOptions = {}) {
    super();
    this.opts = opts;
    this.code = new Code(source, opts);
    this.add(this.code);
    this.ready = this.code.ready.then(() => this);
  }

  /** Returns an Animation-like plain object (a `{ begin, apply, ...}`-free
   *  synchronous highlight move) — implemented as a tiny custom Animation
   *  so it can go through `scene.play()` and be seekable like everything
   *  else. Highlights `line` (0-indexed) with a translucent rectangle,
   *  animating from wherever the highlight currently is. */
  stepTo(line: number, opts: { runTime?: number; color?: any } = {}): Animation {
    const target = this.code.getLine(line);
    const self = this;
    class StepHighlight extends Animation {
      private startRect: VMobject;
      private endRect: VMobject;
      constructor() {
        super(null, { runTime: opts.runTime ?? 0.4 });
        const color = opts.color ?? '#FFFF0033';
        const bb = target ? target.getBoundingBox() : { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 };
        const w = self.code.getWidth() + 0.4;
        const h = (bb.max[1] - bb.min[1]) || 0.4;
        this.endRect = new Rectangle({
          width: w, height: h + 0.15,
          color: opts.color ?? '#FFD966',
          fillOpacity: 0.18, strokeWidth: 1, strokeOpacity: 0.6,
        });
        this.endRect.moveTo([self.code.getCenter()[0], target ? target.getCenter()[1] : self.code.getCenter()[1], 0]);
        this.startRect = self.highlightRect ? (self.highlightRect.copy() as VMobject) : (this.endRect.copy() as VMobject);
        if (!self.highlightRect) this.startRect.setOpacity(0);
      }
      interpolateMobject(alpha: number): void {
        if (!self.highlightRect) {
          self.highlightRect = this.startRect.copy() as VMobject;
          self.add(self.highlightRect);
        }
        self.highlightRect.interpolatePoints(this.endRect, alpha);
        (self.highlightRect as VMobject).interpolateStyle(this.endRect, alpha);
      }
      finish(): void {
        this.apply(1);
        self.currentLine = line;
      }
    }
    return new StepHighlight();
  }

  /** Swap to new source (re-highlight from scratch) via a cross-fade
   *  Transform between the old and new Code mobjects — a lightweight
   *  stand-in for real TransformMatchingShapes token diffing (doc 09
   *  §10.4 `morphTo`). */
  morphTo(newSource: string, opts: CodeOptions & { runTime?: number } = {}): Animation {
    const self = this;
    const newCode = new Code(newSource, { ...self.opts, ...opts });
    class MorphCode extends Animation {
      private ready: Promise<void>;
      constructor() {
        super(null, { runTime: opts.runTime ?? 1 });
        newCode.moveTo(self.code.getCenter());
        this.ready = newCode.ready.then(() => {});
      }
      interpolateMobject(alpha: number): void {
        self.code.setOpacity(1 - alpha);
        newCode.setOpacity(alpha);
        if (alpha > 0 && !self.children.includes(newCode)) self.add(newCode);
      }
      finish(): void {
        this.apply(1);
        self.remove(self.code);
        self.code = newCode;
        self.currentLine = -1;
      }
    }
    return new MorphCode();
  }
}
