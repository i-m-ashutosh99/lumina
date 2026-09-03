/**
 * Lumina — mobjects/text/text.ts
 * Text: real vector glyphs (via font.ts/opentype.js) laid out into a
 * VMobject tree (doc 07 §7). Registers itself as the geometry backend for
 * `LabeledDot` and other geometry that needs inline labels.
 *
 * Async note: font files are fetched over the network, so glyph geometry
 * cannot be ready synchronously in the constructor (unlike every other
 * Lumina mobject). `Text` therefore constructs as an *empty* VGroup
 * immediately (safe to add/animate/moveTo right away — it just has no
 * points until the font resolves) and exposes `ready: Promise<this>` for
 * callers who need to await actual glyph geometry (e.g. before measuring
 * width for layout, or before `Write`). This mirrors how real Manim's own
 * Text/MathTex construction is comparatively slow (subprocess call to
 * Pango/LaTeX) and is normally done once, up front, before `construct()`
 * assembles the animation timeline.
 */
import { Vec3, v } from '../../math/vec';
import { VMobject } from '../../core/vmobject';
import { VGroup } from '../../core/group';
import { normalizeOptions } from '../../core/style';
import { resolveColor } from '../../math/color';
import { DEFAULT_FONT_SIZE } from '../../math/constants';
import { loadFont, glyphToCubics } from './font';
import { registerTextCtor } from '../geometry/basic';

/** World-units-per-"pixel" conversion: Manim's font_size is in points at
 * a notional 96dpi-ish scale; we pick a constant so `fontSize: 48` (the
 * Manim default) yields a glyph roughly 1 world-unit cap-height tall —
 * matching the visual scale of a default Circle/Square (radius/side ~1-2). */
const FONT_SIZE_TO_WORLD = 1 / 96;

export interface TextOptions {
  font?: string; // 'sans' | 'mono' — logical family name
  fontSize?: number;
  color?: any;
  weight?: 'normal' | 'bold';
  slant?: 'normal' | 'italic';
  lineSpacing?: number;
  t2c?: Record<string, any>; // substring -> color
  t2f?: Record<string, string>; // substring -> font
  t2w?: Record<string, 'normal' | 'bold'>;
  t2s?: Record<string, 'normal' | 'italic'>;
}

function faceFor(family: string, weight: string, slant: string): string {
  if (family === 'mono') return 'mono-regular';
  if (weight === 'bold') return 'sans-bold';
  if (slant === 'italic') return 'sans-italic';
  return 'sans-regular';
}

/** One glyph = one VMobject leaf (Manim parity: one submobject per character). */
export class Glyph extends VMobject {
  char: string;
  constructor(char: string, opts?: any) {
    super(opts);
    this.char = char;
    this.style.fill = this.style.stroke; // glyphs are filled shapes, not stroked
    this.style.fillOpacity = 1;
    this.style.strokeWidth = 0;
  }
}

export class Text extends VGroup {
  raw: string;
  fontSize: number;
  ready: Promise<this>;

  constructor(text: string, opts: TextOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    this.raw = text;
    this.fontSize = o.fontSize ?? DEFAULT_FONT_SIZE;
    const color = o.color ? resolveColor(o.color) : '#FFFFFF';
    this.style.stroke = color;
    this.style.fill = color;
    this.style.fillOpacity = 1;
    this.style.strokeWidth = 0;

    this.ready = this.build(o, color).then(() => this);
  }

  private async build(o: any, defaultColor: string): Promise<void> {
    const family = o.font ?? 'sans';
    const weight = o.weight ?? 'normal';
    const slant = o.slant ?? 'normal';
    const face = faceFor(family, weight, slant);
    const { font } = await loadFont(face);

    const sizeWorld = this.fontSize * FONT_SIZE_TO_WORLD;
    const lineSpacing = (o.lineSpacing ?? 1) * sizeWorld * 1.3;
    const lines = this.raw.split('\n');

    const t2c: Record<string, any> = o.t2c ?? {};
    const colorForIndex = (globalIdx: number, ch: string): string => {
      for (const [sub, col] of Object.entries(t2c)) {
        if (sub && this.raw.includes(sub)) {
          const start = this.raw.indexOf(sub);
          if (globalIdx >= start && globalIdx < start + sub.length) return resolveColor(col);
        }
      }
      return defaultColor;
    };

    let globalIdx = 0;
    let cursorY = -((lines.length - 1) * lineSpacing) / 2;
    const rowGroups: VGroup[] = [];

    for (const line of lines) {
      const row = new VGroup();
      let cursorX = 0;
      for (const ch of line) {
        if (ch === ' ') {
          // advance width for space via the font's own metric
          const { advance } = glyphToCubics(font, ' ', sizeWorld);
          cursorX += advance || sizeWorld * 0.3;
          globalIdx++;
          continue;
        }
        const { cubics, advance } = glyphToCubics(font, ch, sizeWorld);
        const glyph = new Glyph(ch);
        glyph.points = cubics.map((p) => v([p[0] + cursorX, p[1], 0]));
        glyph.closed = true;
        const col = colorForIndex(globalIdx, ch);
        glyph.style.fill = col;
        glyph.style.stroke = col;
        glyph.style.fillOpacity = 1;
        glyph.style.strokeWidth = 0;
        row.add(glyph);
        cursorX += advance || sizeWorld * 0.5;
        globalIdx++;
      }
      // center each row horizontally about x=0, matching Manim's centered Text
      row.shift([-cursorX / 2, cursorY, 0]);
      rowGroups.push(row);
      cursorY -= lineSpacing;
      globalIdx++; // account for the '\n'
    }

    this.add(...rowGroups.flatMap((r) => r.children));
  }
}
registerTextCtor(Text as any);

/** Multi-paragraph text: identical to Text but preserves explicit line
 * breaks as separate top-level rows (Manim's Paragraph groups lines so
 * per-line alignment/coloring is possible). Implemented as a thin alias
 * since Text already lays out '\n'-separated lines independently. */
export class Paragraph extends Text {
  constructor(text: string | string[], opts: TextOptions = {}) {
    super(Array.isArray(text) ? text.join('\n') : text, opts);
  }
}

/** Title: a Text with an underline beneath it, placed at the top of frame. */
export class Title extends VGroup {
  ready: Promise<this>;
  constructor(text: string, opts: TextOptions & { includeUnderline?: boolean } = {}) {
    super();
    const o = normalizeOptions(opts as any);
    const label = new Text(text, { fontSize: (o.fontSize ?? DEFAULT_FONT_SIZE) * 1.0, ...opts });
    this.add(label);
    this.ready = label.ready.then(() => {
      label.toEdge([0, 1, 0], 0.4);
      if (o.includeUnderline !== false) {
        const w = Math.max(label.getWidth() + 0.5, 2);
        const underline = new VMobject();
        const y = label.getBottom()[1] - 0.15;
        underline.setPointsAsCorners([[-w / 2, y, 0], [w / 2, y, 0]]);
        underline.style.stroke = label.style.stroke;
        underline.style.strokeWidth = 3;
        this.add(underline);
      }
      return this;
    });
  }
}

/** BulletedList: one Text per item, each preceded by a bullet glyph, stacked. */
export class BulletedList extends VGroup {
  ready: Promise<this>;
  constructor(...items: string[]) {
    super();
    const opts: TextOptions =
      items.length && typeof items[items.length - 1] === 'object'
        ? (items.pop() as any)
        : {};
    const rows = items.map((item) => new Text(`\u2022 ${item}`, opts));
    this.add(...rows);
    this.ready = Promise.all(rows.map((r) => r.ready)).then(() => {
      let cursorY = 0;
      const bb0 = rows[0]?.getHeight() ?? 0.5;
      for (const r of rows) {
        r.moveTo([0, cursorY, 0]);
        cursorY -= r.getHeight() + 0.35;
      }
      // left-align all rows on the widest one
      const maxLeft = Math.min(...rows.map((r) => r.getLeft()[0]));
      for (const r of rows) r.shift([maxLeft - r.getLeft()[0], 0, 0]);
      return this;
    });
  }
}

/* ---------------- numeric text (synchronous — no font fetch needed for digits
   at construction time in the common case is still async under the hood,
   but DecimalNumber/Integer expose a synchronous-looking API by building
   through Text and forwarding `ready`). ---------------- */

export class DecimalNumber extends VGroup {
  ready: Promise<this>;
  private numDecimalPlaces: number;
  private unit: string;
  private includeSign: boolean;
  private opts: TextOptions;
  private _value: number;

  constructor(value = 0, opts: TextOptions & { numDecimalPlaces?: number; includeSign?: boolean; unit?: string } = {}) {
    super();
    const o = normalizeOptions(opts as any);
    this.numDecimalPlaces = o.numDecimalPlaces ?? 2;
    this.includeSign = o.includeSign ?? false;
    this.unit = o.unit ?? '';
    this.opts = opts;
    this._value = value;
    this.ready = this.rebuild(value);
  }

  private format(value: number): string {
    const sign = this.includeSign && value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(this.numDecimalPlaces)}${this.unit}`;
  }

  private async rebuild(value: number): Promise<this> {
    this.clear();
    const t = new Text(this.format(value), this.opts);
    await t.ready;
    this.add(...t.children);
    this._value = value;
    return this;
  }

  getValue(): number { return this._value; }

  /** Set the displayed value (used by ChangingDecimal / DecimalNumber.animate). */
  setValue(value: number): this {
    // Synchronous glyph regen from the already-loaded font cache (loadFont
    // resolves instantly once cached), so callers driving this every frame
    // via an updater don't need to await — schedule and forget.
    this.rebuild(value);
    return this;
  }
}

export class Integer extends DecimalNumber {
  constructor(value = 0, opts: TextOptions = {}) {
    super(Math.round(value), { ...opts, numDecimalPlaces: 0 });
  }
}

/** Variable: "label = value.value" bound to a ValueTracker, auto-updating. */
export class Variable extends VGroup {
  ready: Promise<this>;
  label: Text;
  valueMob: DecimalNumber;
  private tracker: any;

  constructor(labelTex: string, tracker: any, opts: TextOptions & { numDecimalPlaces?: number } = {}) {
    super();
    this.tracker = tracker;
    this.label = new Text(`${labelTex} = `, opts);
    this.valueMob = new DecimalNumber(tracker.getValue?.() ?? 0, opts);
    this.add(this.label, this.valueMob);
    this.ready = Promise.all([this.label.ready, this.valueMob.ready]).then(() => {
      this.valueMob.nextTo(this.label, [1, 0, 0], { buff: 0.1 });
      this.addUpdater(() => {
        this.valueMob.setValue(this.tracker.getValue());
        this.valueMob.nextTo(this.label, [1, 0, 0], { buff: 0.1 });
      });
      return this;
    });
  }
}
