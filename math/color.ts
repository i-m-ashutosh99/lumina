/**
 * Lumina — color.ts
 * ManimCE-compatible named palette (approx. CE hexes) + GL variants, plus
 * color math: interpolation, gradients, alpha, inversion, brightness.
 *
 * Colors are '#rrggbb' strings — directly usable by Canvas2D and WebGL.
 */

export type ManimColor = string;

const hex = (h: string): ManimColor => h;

/* ---------------- ManimCE palette ---------------- */
export const BLUE = hex('#58C4DD');
export const BLUE_A = hex('#C4E9FF');
export const BLUE_B = hex('#71DDEA');
export const BLUE_C = hex('#46C6C2');
export const BLUE_D = hex('#30BCE5');
export const BLUE_E = hex('#1F6FAF');

export const TEAL = hex('#5CD0B3');
export const TEAL_A = hex('#ACEAD7');
export const TEAL_B = hex('#76CDB5');
export const TEAL_C = hex('#5CD0B3');
export const TEAL_D = hex('#40798E');
export const TEAL_E = hex('#2B5B66');

export const GREEN = hex('#83C167');
export const GREEN_A = hex('#C9E9A6');
export const GREEN_B = hex('#A8D97F');
export const GREEN_C = hex('#83C167');
export const GREEN_D = hex('#5B9E4D');
export const GREEN_E = hex('#367B28');

export const YELLOW = hex('#FFFF00');
export const YELLOW_A = hex('#FFF9B3');
export const YELLOW_B = hex('#FFF163');
export const YELLOW_C = hex('#FFFF00');
export const YELLOW_D = hex('#F0E500');
export const YELLOW_E = hex('#C9C300');

export const GOLD = hex('#FFC857');
export const GOLD_A = hex('#FFF0C4');
export const GOLD_B = hex('#FFDD88');
export const GOLD_C = hex('#FFC857');
export const GOLD_D = hex('#E6B31E');
export const GOLD_E = hex('#B98E14');

export const RED = hex('#FC6255');
export const RED_A = hex('#FFB5A7');
export const RED_B = hex('#FC8F82');
export const RED_C = hex('#FC6255');
export const RED_D = hex('#E63946');
export const RED_E = hex('#B5222D');

export const MAROON = hex('#C55F73');
export const MAROON_A = hex('#E5A3B1');
export const MAROON_B = hex('#D58098');
export const MAROON_C = hex('#C55F73');
export const MAROON_D = hex('#A34A5E');
export const MAROON_E = hex('#803546');

export const PURPLE = hex('#9A72AC');
export const PURPLE_A = hex('#C6AFE0');
export const PURPLE_B = hex('#B08FD1');
export const PURPLE_C = hex('#9A72AC');
export const PURPLE_D = hex('#7A4E8B');
export const PURPLE_E = hex('#5B2E69');

export const PINK = hex('#D147BD');
export const ORANGE = hex('#FF862F');
export const LIGHT_BROWN = hex('#C89C7B');
export const DARK_BROWN = hex('#7C4B00');

export const WHITE = hex('#FFFFFF');
export const BLACK = hex('#000000');
export const GRAY = hex('#888888');
export const GREY = GRAY;
export const GRAY_A = hex('#DDDDDD');
export const GRAY_B = hex('#BBBBBB');
export const GRAY_C = hex('#888888');
export const GRAY_D = hex('#444444');
export const GRAY_E = hex('#222222');
export const LIGHT_GRAY = hex('#BBBBBB');
export const DARKER_GRAY = hex('#444444');
export const GREY_A = GRAY_A; const _gB = GRAY_B;
export const GREY_B = GRAY_B; const _gD = GRAY_D;
export const GREY_D = GRAY_D;

export const LOGO_GREEN = hex('#87C541');
export const LOGO_BLUE = hex('#5CCDDF');
export const LOGO_RED = hex('#E2416B');
export const LOGO_BLACK = hex('#0E1E26');

export const PURE_RED = hex('#FF0000');
export const PURE_GREEN = hex('#00FF00');
export const PURE_BLUE = hex('#0000FF');

/** 3b1b basis-vector convention (doc 09 §3). */
export const I_HAT_COLOR = GREEN_E ?? GREEN;
export const J_HAT_COLOR = RED;
export const K_HAT_COLOR = BLUE;

/** GL aliases. */
export const GL_COLORS = {
  BLUE: '#58C4DD', GREEN: '#83C167', YELLOW: '#FFFF00', GOLD: '#FFC857',
  RED: '#FC6255', MAROON: '#C55F73', PURPLE: '#9A72AC', TEAL: '#5CD0B3',
  PINK: '#D147BD', ORANGE: '#FF862F', WHITE: '#FFFFFF', BLACK: '#000000',
  GREY_A: '#DDDDDD', GREY_B: '#BBBBBB', GREY_C: '#888888',
  GREY_D: '#444444', GREY_E: '#222222', BLUE_D: '#30BCE5', BLUE_E: '#1F6FAF',
} as const;

/** Full palette map for serialization / iteration. */
export const COLORS: Record<string, ManimColor> = {
  BLUE, BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E,
  TEAL, TEAL_A, TEAL_B, TEAL_C, TEAL_D, TEAL_E,
  GREEN, GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E,
  YELLOW, YELLOW_A, YELLOW_B, YELLOW_C, YELLOW_D, YELLOW_E,
  GOLD, GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E,
  RED, RED_A, RED_B, RED_C, RED_D, RED_E,
  MAROON, MAROON_A, MAROON_B, MAROON_C, MAROON_D, MAROON_E,
  PURPLE, PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E,
  PINK, ORANGE, LIGHT_BROWN, DARK_BROWN,
  WHITE, BLACK, GRAY, GREY, GRAY_A, GRAY_B, GRAY_C, GRAY_D, GRAY_E,
  LIGHT_GRAY, DARKER_GRAY,
  PURE_RED, PURE_GREEN, PURE_BLUE,
};

/* ---------------- color math ---------------- */

export function colorToRgb(c: ManimColor): [number, number, number] {
  let s = c.trim();
  if (s.startsWith('rgb(')) {
    return s.slice(4, -1).split(',').slice(0, 3).map((x) => parseFloat(x) / 255) as [number, number, number];
  }
  if (s[0] !== '#') s = '#' + s;
  const n = parseInt(s.slice(1), 16);
  if (s.length === 4) {
    return [((n >> 8) & 15) * 17 / 255, ((n >> 4) & 15) * 17 / 255, (n & 15) * 17 / 255];
  }
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255) as [number, number, number];
}

export function rgbToColor(r: number, g: number, b: number): ManimColor {
  const h = (x: number) =>
    Math.round(Math.min(1, Math.max(0, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function interpolateColors(a: ManimColor, b: ManimColor, t: number): ManimColor {
  const ca = colorToRgb(a);
  const cb = colorToRgb(b);
  return rgbToColor(
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t
  );
}

export const lerpColor = interpolateColors;

export function averageColor(...colors: ManimColor[]): ManimColor {
  if (!colors.length) return WHITE;
  let r = 0, g = 0, b = 0;
  for (const c of colors) {
    const [cr, cg, cb] = colorToRgb(c);
    r += cr; g += cg; b += cb;
  }
  return rgbToColor(r / colors.length, g / colors.length, b / colors.length);
}

export function invertColor(c: ManimColor): ManimColor {
  const [r, g, b] = colorToRgb(c);
  return rgbToColor(1 - r, 1 - g, 1 - b);
}

export function brightness(c: ManimColor): number {
  const [r, g, b] = colorToRgb(c);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** CSS color with alpha. */
export function withAlpha(c: ManimColor, a: number): ManimColor {
  const [r, g, b] = colorToRgb(c);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${Math.min(1, Math.max(0, a))})`;
}

/** Color gradient over 0..1 — Manim set_color_by_gradient analogue. */
export function gradientAt(colors: ManimColor[], t: number): ManimColor {
  if (colors.length === 0) return WHITE;
  if (colors.length === 1) return colors[0];
  const clamped = Math.min(0.999999, Math.max(0, t));
  const idx = Math.floor(clamped * (colors.length - 1));
  return interpolateColors(colors[idx], colors[idx + 1], (clamped * (colors.length - 1)) - idx);
}

export function colorGradient(colors: ManimColor[], n: number): ManimColor[] {
  return Array.from({ length: n }, (_, i) => gradientAt(colors, n <= 1 ? 0 : i / (n - 1)));
}

/** Resolve arbitrary color input: named constant, hex, rgb string, or array. */
export function resolveColor(c: any): ManimColor {
  if (!c) return WHITE;
  if (typeof c === 'string') {
    if (COLORS[c]) return COLORS[c];
    return c;
  }
  if (Array.isArray(c)) return rgbToColor(c[0], c[1], c[2]);
  if (typeof c === 'object' && 'r' in c) return rgbToColor(c.r, c.g, c.b);
  return WHITE;
}

export const randomBrightColor = (rng: () => number): ManimColor =>
  [BLUE, YELLOW, GREEN, RED, TEAL, MAROON, PURPLE, ORANGE][Math.floor(rng() * 8)];
