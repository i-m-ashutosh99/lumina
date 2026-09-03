/**
 * Lumina — style.ts
 * Shared visual style for mobjects + snake_case→camelCase option
 * normalization (doc 07 §16).
 */
import { ManimColor, resolveColor, interpolateColors } from '../math/color';
import { DEFAULT_STROKE_WIDTH } from '../math/constants';

export interface Style {
  fill: ManimColor | null;
  fillOpacity: number;
  stroke: ManimColor | null;
  strokeWidth: number;
  strokeOpacity: number;
  backgroundStroke: ManimColor | null;
  backgroundStrokeWidth: number;
  backgroundStrokeOpacity: number;
  sheen: number;
  sheenDirection: [number, number, number];
  shading?: number; // 3D flatness 0..1
}

export function defaultStyle(): Style {
  return {
    fill: null,
    fillOpacity: 0,
    stroke: '#FFFFFF',
    strokeWidth: DEFAULT_STROKE_WIDTH,
    strokeOpacity: 1,
    backgroundStroke: null,
    backgroundStrokeWidth: DEFAULT_STROKE_WIDTH * 2,
    backgroundStrokeOpacity: 1,
    sheen: 0,
    sheenDirection: [-0.28125, 0.28125, 0.0],
    shading: 0.2,
  };
}

/** Normalize snake_case option keys to camelCase (Python muscle memory). */
export function normalizeOptions<T extends object>(opts: T | undefined): T {
  if (!opts) return {} as T;
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(opts)) {
    const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = val;
  }
  return out as T;
}

export function lerpStyle(a: Style, b: Style, t: number): Style {
  return {
    fill: t < 0.5 ? a.fill : b.fill,
    fillOpacity: a.fillOpacity + (b.fillOpacity - a.fillOpacity) * t,
    stroke: t < 0.5 ? a.stroke : b.stroke,
    strokeWidth: a.strokeWidth + (b.strokeWidth - a.strokeWidth) * t,
    strokeOpacity: a.strokeOpacity + (b.strokeOpacity - a.strokeOpacity) * t,
    backgroundStroke: t < 0.5 ? a.backgroundStroke : b.backgroundStroke,
    backgroundStrokeWidth:
      a.backgroundStrokeWidth + (b.backgroundStrokeWidth - a.backgroundStrokeWidth) * t,
    backgroundStrokeOpacity:
      a.backgroundStrokeOpacity + (b.backgroundStrokeOpacity - a.backgroundStrokeOpacity) * t,
    sheen: a.sheen + (b.sheen - a.sheen) * t,
    sheenDirection: a.sheenDirection,
    shading: (a.shading ?? 0.2) + ((b.shading ?? 0.2) - (a.shading ?? 0.2)) * t,
  };
}

/** Apply user style keys (color, fillOpacity, ...) onto a Style. */
export function applyStyleOverrides(style: Style, opts: any): Style {
  const s = { ...style };
  if (!opts) return s;
  const o = normalizeOptions(opts);
  if (o.color !== undefined) {
    s.stroke = resolveColor(o.color);
    if (o.fillColor === undefined && o.fillOpacity !== undefined && s.fill === null) {
      s.fill = resolveColor(o.color);
    }
  }
  if (o.fillColor !== undefined) s.fill = resolveColor(o.fillColor);
  if (o.fillOpacity !== undefined) {
    s.fillOpacity = o.fillOpacity;
    if (s.fill === null) s.fill = s.stroke;
  }
  if (o.strokeColor !== undefined) s.stroke = resolveColor(o.strokeColor);
  if (o.strokeWidth !== undefined) s.strokeWidth = o.strokeWidth;
  if (o.strokeOpacity !== undefined) s.strokeOpacity = o.strokeOpacity;
  if (o.backgroundStrokeColor !== undefined) s.backgroundStroke = resolveColor(o.backgroundStrokeColor);
  if (o.backgroundStrokeWidth !== undefined) s.backgroundStrokeWidth = o.backgroundStrokeWidth;
  if (o.backgroundStrokeOpacity !== undefined) s.backgroundStrokeOpacity = o.backgroundStrokeOpacity;
  if (o.opacity !== undefined) {
    s.fillOpacity = (s.fillOpacity) * o.opacity;
    s.strokeOpacity = (s.strokeOpacity) * o.opacity;
  }
  if (o.sheen !== undefined) s.sheen = o.sheen;
  if (o.shading !== undefined) s.shading = o.shading;
  return s;
}

export const styleColorAt = (colors: ManimColor[], t: number) =>
  colors.length === 1 ? colors[0] : interpolateColors(colors[0], colors[colors.length - 1] ?? colors[0], t);
