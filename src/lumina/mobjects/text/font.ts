/**
 * Lumina — mobjects/text/font.ts
 * Runtime font loading + glyph→Bézier conversion via opentype.js.
 *
 * Design (mirrors real Manim's role division, different backend): real
 * ManimCE rasterizes text via Pango/Cairo and extracts vector paths from
 * the system font. Browsers have no such API, so Lumina fetches actual
 * font binaries (woff/ttf) from a CDN at runtime, parses them with
 * opentype.js, and converts each glyph's outline directly into a VMobject
 * built from cubic Béziers — the same end result (real typeface vector
 * shapes that can Write/Transform/morph), a different acquisition path.
 *
 * Fonts are cached by name+weight+style; parse happens once per font file.
 */
import opentype from 'opentype.js';
import { Vec3 } from '../../math/vec';

export interface LoadedFont {
  font: any; // opentype.Font
  unitsPerEm: number;
}

const CDN = 'https://cdn.jsdelivr.net/npm';

/** Named font faces resolvable by Text/MathTex without the caller knowing URLs. */
const FACE_URLS: Record<string, string> = {
  'sans-regular': `${CDN}/@fontsource/roboto@5.3.0/files/roboto-latin-400-normal.woff`,
  'sans-bold': `${CDN}/@fontsource/roboto@5.3.0/files/roboto-latin-700-normal.woff`,
  'sans-italic': `${CDN}/@fontsource/roboto@5.3.0/files/roboto-latin-400-italic.woff`,
  'mono-regular': `${CDN}/@fontsource/roboto-mono@5.3.0/files/roboto-mono-latin-400-normal.woff`,
  // KaTeX math fonts — used for MathTex glyph lookup (letters, digits, Greek,
  // operators, and symbol glyphs; see katexSymbol() below for encoding).
  'math-italic': `${CDN}/katex@0.16.22/dist/fonts/KaTeX_Math-Italic.ttf`,
  'math-main': `${CDN}/katex@0.16.22/dist/fonts/KaTeX_Main-Regular.ttf`,
  'math-bold': `${CDN}/katex@0.16.22/dist/fonts/KaTeX_Main-Bold.ttf`,
  'math-ams': `${CDN}/katex@0.16.22/dist/fonts/KaTeX_AMS-Regular.ttf`,
  'math-size1': `${CDN}/katex@0.16.22/dist/fonts/KaTeX_Size1-Regular.ttf`,
  'math-size2': `${CDN}/katex@0.16.22/dist/fonts/KaTeX_Size2-Regular.ttf`,
};

const cache = new Map<string, Promise<LoadedFont>>();

/** Fetch + parse a font face by logical name (see FACE_URLS) or raw URL. */
export function loadFont(face: string): Promise<LoadedFont> {
  const url = FACE_URLS[face] ?? face;
  if (cache.has(url)) return cache.get(url)!;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Lumina: failed to fetch font "${face}" (${url}): ${res.status}`);
    const buf = await res.arrayBuffer();
    const font = opentype.parse(buf);
    return { font, unitsPerEm: font.unitsPerEm as number };
  })();
  cache.set(url, p);
  return p;
}

/** Preload the default faces; call once (e.g. app bootstrap) to avoid
 * first-Text-render latency. Safe to skip — loadFont() lazy-loads anyway. */
export async function preloadDefaultFonts(): Promise<void> {
  await Promise.all(['sans-regular', 'math-italic', 'math-main'].map(loadFont));
}

/**
 * Convert one glyph outline to cubic-Bézier points (Vec3 flat list, 4 per
 * curve — VMobject's native format), in *font units scaled to `size`*,
 * with the pen origin at (0, 0) and baseline at y = 0. opentype.js paths
 * are quadratic-or-cubic; we upgrade quadratics to cubics and flatten
 * arcs/lines to degenerate cubics so the result is uniformly VMobject-ready.
 */
export function glyphToCubics(font: any, glyphName: string, size: number): { cubics: Vec3[]; advance: number } {
  const glyph = font.charToGlyph(glyphName);
  const scale = size / font.unitsPerEm;
  const path = glyph.getPath(0, 0, size);
  const cubics: Vec3[] = [];
  let start: Vec3 = [0, 0, 0];
  let cur: Vec3 = [0, 0, 0];
  const P = (x: number, y: number): Vec3 => [x, y, 0];
  for (const cmd of path.commands) {
    if (cmd.type === 'M') {
      cur = P(cmd.x, cmd.y);
      start = cur;
    } else if (cmd.type === 'L') {
      const to = P(cmd.x, cmd.y);
      // straight segment as a degenerate cubic (handles at 1/3, 2/3)
      const h1: Vec3 = [cur[0] + (to[0] - cur[0]) / 3, cur[1] + (to[1] - cur[1]) / 3, 0];
      const h2: Vec3 = [cur[0] + 2 * (to[0] - cur[0]) / 3, cur[1] + 2 * (to[1] - cur[1]) / 3, 0];
      cubics.push(cur, h1, h2, to);
      cur = to;
    } else if (cmd.type === 'Q') {
      // quadratic -> cubic (standard degree-raise)
      const q: Vec3 = P(cmd.x1, cmd.y1);
      const to = P(cmd.x, cmd.y);
      const h1: Vec3 = [cur[0] + 2 / 3 * (q[0] - cur[0]), cur[1] + 2 / 3 * (q[1] - cur[1]), 0];
      const h2: Vec3 = [to[0] + 2 / 3 * (q[0] - to[0]), to[1] + 2 / 3 * (q[1] - to[1]), 0];
      cubics.push(cur, h1, h2, to);
      cur = to;
    } else if (cmd.type === 'C') {
      const h1: Vec3 = P(cmd.x1, cmd.y1);
      const h2: Vec3 = P(cmd.x2, cmd.y2);
      const to: Vec3 = P(cmd.x, cmd.y);
      cubics.push(cur, h1, h2, to);
      cur = to;
    } else if (cmd.type === 'Z') {
      if (cur[0] !== start[0] || cur[1] !== start[1]) {
        const h1: Vec3 = [cur[0] + (start[0] - cur[0]) / 3, cur[1] + (start[1] - cur[1]) / 3, 0];
        const h2: Vec3 = [cur[0] + 2 * (start[0] - cur[0]) / 3, cur[1] + 2 * (start[1] - cur[1]) / 3, 0];
        cubics.push(cur, h1, h2, start);
      }
      cur = start;
    }
  }
  return { cubics, advance: glyph.advanceWidth * scale };
}
