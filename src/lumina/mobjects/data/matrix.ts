/**
 * Lumina — mobjects/data/matrix.ts
 * Matrix / Table mobjects (doc 09 §10.1 "MatrixGrid", doc 09 §3.1 "Matrix /
 * IntegerMatrix / DecimalMatrix / MobjectMatrix" — real ManimCE's
 * `mobject.matrix` module reimplemented from scratch on top of the vector
 * `Text`/`DecimalNumber` primitives so every cell (and the surrounding
 * bracket) is a normal Transform-able VMobject).
 *
 * `Matrix` lays out an array of entries (numbers, strings, or arbitrary
 * Mobjects) into a grid and wraps it in a bracket ("[", "(", "{", or none).
 * `Table` is the more general "rows x cols with optional row/col
 * labels + separating lines" version used for DP tables, confusion
 * matrices, and truth tables (doc 09 §10.1 MatrixGrid / §11 ConfusionMatrix).
 */
import { Vec3, v } from '../../math/vec';
import { Mobject } from '../../core/mobject';
import { VMobject } from '../../core/vmobject';
import { VGroup } from '../../core/group';
import { normalizeOptions } from '../../core/style';
import { resolveColor } from '../../math/color';
import { Line, Rectangle } from '../geometry/basic';
import { DecimalNumber, Integer, Text } from '../text/text';

export type MatrixBracket = 'square' | 'paren' | 'brace' | 'none';
export type MatrixEntry = number | string | Mobject;

export interface MatrixOptions {
  bracket?: MatrixBracket;
  hBuff?: number;
  vBuff?: number;
  elementAlignment?: 'left' | 'center' | 'right';
  entryConfig?: any;
  color?: any;
  numDecimalPlaces?: number;
  /** Rebuild each entry as an `Integer` instead of a `DecimalNumber`
   *  (real ManimCE `IntegerMatrix`). */
  integer?: boolean;
}

/** Build a bracket VMobject ("[", "(", "{" — or its mirror) spanning
 *  `height`, offset horizontally by `side` (-1 = left bracket, +1 = right). */
function bracketOutline(kind: MatrixBracket, height: number, side: -1 | 1): VMobject | null {
  if (kind === 'none') return null;
  const vm = new VMobject();
  const h = height / 2;
  const tickW = 0.18;
  if (kind === 'square') {
    vm.setPointsAsCorners([
      [side * tickW, h, 0],
      [0, h, 0],
      [0, -h, 0],
      [side * tickW, -h, 0],
    ]);
    vm.closed = false;
  } else if (kind === 'paren') {
    // simple arc-like curve via a single cubic bulging outward
    const bulge = 0.22 * side;
    vm.setCubics([
      [0, h, 0],
      [bulge, h * 0.5, 0],
      [bulge, -h * 0.5, 0],
      [0, -h, 0],
    ]);
    vm.closed = false;
  } else if (kind === 'brace') {
    const bulge = 0.22 * side;
    vm.setCubics([
      [0, h, 0], [bulge, h * 0.6, 0], [bulge, h * 0.15, 0], [bulge * 1.3, 0, 0],
    ]);
    vm.appendCubic([bulge * 1.3, 0, 0], [bulge, -h * 0.15, 0], [bulge, -h * 0.6, 0], [0, -h, 0]);
    vm.closed = false;
  }
  vm.style.fill = vm.style.stroke;
  vm.style.fillOpacity = 0;
  vm.style.strokeWidth = 3;
  return vm;
}

/**
 * `Matrix` — a 2D array of entries laid out in a grid and wrapped in a
 * bracket. `entries` is a row-major `MatrixEntry[][]`.
 *
 * ```js
 * const m = new Matrix([[1, 2], [3, 4]]);
 * const im = new Matrix([[1, 0], [0, 1]], { integer: true, bracket: 'square' });
 * ```
 */
export class Matrix extends VGroup {
  rows: number;
  cols: number;
  entryMobjects: Mobject[][] = [];
  bracketLeft: VMobject | null = null;
  bracketRight: VMobject | null = null;
  ready: Promise<this>;

  constructor(entries: MatrixEntry[][], opts: MatrixOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    this.rows = entries.length;
    this.cols = entries[0]?.length ?? 0;
    this.ready = this.build(entries, o);
  }

  private async build(entries: MatrixEntry[][], o: any): Promise<this> {
    const hBuff = o.hBuff ?? 0.8;
    const vBuff = o.vBuff ?? 0.5;
    const color = o.color;
    const decimals = o.numDecimalPlaces ?? 2;

    const cellMobs: Mobject[][] = [];
    const readyPromises: Promise<any>[] = [];
    for (let r = 0; r < this.rows; r++) {
      const row: Mobject[] = [];
      for (let c = 0; c < this.cols; c++) {
        const raw = entries[r][c];
        let m: Mobject;
        if (raw instanceof Mobject) {
          m = raw;
        } else if (typeof raw === 'number') {
          m = o.integer
            ? new Integer(raw, { color, ...o.entryConfig })
            : new DecimalNumber(raw, { color, numDecimalPlaces: decimals, ...o.entryConfig });
          readyPromises.push((m as any).ready);
        } else {
          m = new Text(String(raw), { color, ...o.entryConfig });
          readyPromises.push((m as any).ready);
        }
        row.push(m);
        this.add(m);
      }
      cellMobs.push(row);
    }
    await Promise.all(readyPromises);
    this.entryMobjects = cellMobs;
    this.layout(cellMobs, hBuff, vBuff);

    const height = this.getHeight() + 0.3;
    const bracket = o.bracket ?? 'square';
    this.bracketLeft = bracketOutline(bracket, height, -1);
    this.bracketRight = bracketOutline(bracket, height, 1);
    if (this.bracketLeft) {
      this.bracketLeft.moveTo([this.getLeft()[0] - 0.35, this.getCenter()[1], 0]);
      if (color) this.bracketLeft.setColor(color);
      this.add(this.bracketLeft);
    }
    if (this.bracketRight) {
      this.bracketRight.moveTo([this.getRight()[0] + 0.35, this.getCenter()[1], 0]);
      if (color) this.bracketRight.setColor(color);
      this.add(this.bracketRight);
    }
    return this;
  }

  private layout(cellMobs: Mobject[][], hBuff: number, vBuff: number): void {
    const colWidths: number[] = new Array(this.cols).fill(0);
    const rowHeights: number[] = new Array(this.rows).fill(0);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        colWidths[c] = Math.max(colWidths[c], cellMobs[r][c].getWidth());
        rowHeights[r] = Math.max(rowHeights[r], cellMobs[r][c].getHeight());
      }
    }
    const colX: number[] = [];
    let x = 0;
    for (let c = 0; c < this.cols; c++) {
      colX.push(x + colWidths[c] / 2);
      x += colWidths[c] + hBuff;
    }
    const totalW = x - hBuff;
    const rowY: number[] = [];
    let y = 0;
    for (let r = 0; r < this.rows; r++) {
      rowY.push(y + rowHeights[r] / 2);
      y += rowHeights[r] + vBuff;
    }
    const totalH = y - vBuff;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        cellMobs[r][c].moveTo([colX[c] - totalW / 2, totalH / 2 - rowY[r], 0]);
      }
    }
  }

  /** ManimCE `Matrix.get_entries()` — flat row-major list of entry mobjects. */
  getEntries(): Mobject[] {
    return this.entryMobjects.flat();
  }

  getRow(i: number): Mobject[] { return this.entryMobjects[i] ?? []; }
  getColumn(j: number): Mobject[] { return this.entryMobjects.map((row) => row[j]); }
  getEntry(i: number, j: number): Mobject | undefined { return this.entryMobjects[i]?.[j]; }
}

export class IntegerMatrix extends Matrix {
  constructor(entries: number[][], opts: MatrixOptions = {}) {
    super(entries, { ...opts, integer: true });
  }
}

export class DecimalMatrix extends Matrix {
  constructor(entries: number[][], opts: MatrixOptions = {}) {
    super(entries, opts);
  }
}

export class MobjectMatrix extends Matrix {
  constructor(entries: Mobject[][], opts: MatrixOptions = {}) {
    super(entries, { ...opts, bracket: opts.bracket ?? 'none' });
  }
}

/* ====================================================================== */
/* Table — the more general grid used for DP tables / confusion matrices /  */
/* truth tables (doc 09 §10.1 MatrixGrid, §11 ConfusionMatrix)              */
/* ====================================================================== */

export interface TableOptions {
  rowLabels?: MatrixEntry[];
  colLabels?: MatrixEntry[];
  hBuff?: number;
  vBuff?: number;
  color?: any;
  includeOuterLines?: boolean;
  lineConfig?: any;
  /** Per-cell background color lookup, e.g. for heat-mapped confusion
   *  matrices (doc 09 §11 ConfusionMatrix "IntegerTable with heat color"). */
  cellColor?: (r: number, c: number, value: MatrixEntry) => any | undefined;
}

/**
 * `Table` — rows x cols of entries with optional row/column header labels
 * and separating grid lines. Real ManimCE `mobject.table.Table` family
 * (`IntegerTable`/`DecimalTable`/`MobjectTable`).
 *
 * ```js
 * const t = new Table([[1,2],[3,4]], { rowLabels: ['a','b'], colLabels: ['x','y'] });
 * ```
 */
export class Table extends VGroup {
  rows: number;
  cols: number;
  entryMobjects: Mobject[][] = [];
  cellBackgrounds: (VMobject | null)[][] = [];
  hLines: VMobject[] = [];
  vLines: VMobject[] = [];
  ready: Promise<this>;

  constructor(entries: MatrixEntry[][], opts: TableOptions = {}) {
    super();
    const o = normalizeOptions(opts as any);
    this.rows = entries.length;
    this.cols = entries[0]?.length ?? 0;
    this.ready = this.build(entries, o);
  }

  private async build(entries: MatrixEntry[][], o: TableOptions): Promise<this> {
    const hBuff = o.hBuff ?? 1.0;
    const vBuff = o.vBuff ?? 0.6;
    const color = o.color;

    const makeCell = async (raw: MatrixEntry): Promise<Mobject> => {
      if (raw instanceof Mobject) return raw;
      const m = typeof raw === 'number'
        ? new DecimalNumber(raw, { color, numDecimalPlaces: Number.isInteger(raw) ? 0 : 2 })
        : new Text(String(raw), { color });
      await (m as any).ready;
      return m;
    };

    const cellMobs: Mobject[][] = [];
    for (let r = 0; r < this.rows; r++) {
      const row: Mobject[] = [];
      for (let c = 0; c < this.cols; c++) row.push(await makeCell(entries[r][c]));
      cellMobs.push(row);
    }

    const rowLabelMobs = o.rowLabels ? await Promise.all(o.rowLabels.map(makeCell)) : null;
    const colLabelMobs = o.colLabels ? await Promise.all(o.colLabels.map(makeCell)) : null;

    // uniform cell size = max over all cells (incl. labels) for a clean grid
    const allForSizing = [...cellMobs.flat(), ...(rowLabelMobs ?? []), ...(colLabelMobs ?? [])];
    const cellW = Math.max(...allForSizing.map((m) => m.getWidth()), 0.5) + hBuff;
    const cellH = Math.max(...allForSizing.map((m) => m.getHeight()), 0.5) + vBuff;

    const rOffset = rowLabelMobs ? 1 : 0;
    const cOffset = colLabelMobs ? 1 : 0;
    const totalRows = this.rows + cOffset;
    const totalCols = this.cols + rOffset;

    const xAt = (col: number) => (col - (totalCols - 1) / 2) * cellW;
    const yAt = (row: number) => ((totalRows - 1) / 2 - row) * cellH;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        cellMobs[r][c].moveTo([xAt(c + rOffset), yAt(r + cOffset), 0]);
        this.add(cellMobs[r][c]);
        const bgColor = o.cellColor?.(r, c, entries[r][c]);
        if (bgColor !== undefined) {
          const bg = new Rectangle({
            width: cellW, height: cellH, color: resolveColor(bgColor),
            fillOpacity: 0.6, strokeWidth: 0,
          }) as VMobject;
          bg.moveTo([xAt(c + rOffset), yAt(r + cOffset), 0]);
          // insert the background BEHIND the already-added cell text: since
          // `this` is a VGroup and children draw in array order, re-adding
          // the text mobject after the background pushes it back on top.
          this.add(bg);
          cellMobs[r][c].bringToFront();
          this.cellBackgrounds[r] = this.cellBackgrounds[r] ?? [];
          this.cellBackgrounds[r][c] = bg;
        }
      }
    }
    if (rowLabelMobs) {
      rowLabelMobs.forEach((m, r) => { m.moveTo([xAt(0), yAt(r + cOffset), 0]); this.add(m); });
    }
    if (colLabelMobs) {
      colLabelMobs.forEach((m, c) => { m.moveTo([xAt(c + rOffset), yAt(0), 0]); this.add(m); });
    }

    if (o.includeOuterLines !== false) {
      const w = totalCols * cellW, h = totalRows * cellH;
      for (let i = 0; i <= totalRows; i++) {
        const y = h / 2 - i * cellH;
        const line = new Line({ start: [-w / 2, y, 0], end: [w / 2, y, 0], strokeWidth: 2, color, ...o.lineConfig });
        this.hLines.push(line);
        this.add(line);
      }
      for (let j = 0; j <= totalCols; j++) {
        const x = -w / 2 + j * cellW;
        const line = new Line({ start: [x, h / 2, 0], end: [x, -h / 2, 0], strokeWidth: 2, color, ...o.lineConfig });
        this.vLines.push(line);
        this.add(line);
      }
    }

    this.entryMobjects = cellMobs;
    return this;
  }

  getEntries(): Mobject[] { return this.entryMobjects.flat(); }
  getEntry(i: number, j: number): Mobject | undefined { return this.entryMobjects[i]?.[j]; }
  /** Highlight a cell (e.g. DP table fill order, doc 09 §10.3 DPTableScene). */
  getCellBackground(i: number, j: number): VMobject | null { return this.cellBackgrounds[i]?.[j] ?? null; }
}

export class IntegerTable extends Table {}
export class DecimalTable extends Table {}
export class MobjectTable extends Table {
  constructor(entries: Mobject[][], opts: TableOptions = {}) {
    super(entries, opts);
  }
}
