/**
 * Lumina — vec.ts
 * 3-component vector helpers. Vectors are plain number arrays [x, y, z] so
 * they are cheap, iterable, serializable, and accepted everywhere in the API.
 * All functions are pure.
 */

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export const EPSILON = 1e-9;

/** Coerce anything (array, {x,y,z}, scalar-as-x) into a Vec3. */
export function v(x: any, y = 0, z = 0): Vec3 {
  if (Array.isArray(x)) return [x[0] ?? 0, x[1] ?? 0, x[2] ?? 0];
  if (x && typeof x === 'object') return [x.x ?? 0, x.y ?? 0, x.z ?? 0];
  return [x, y, z];
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** Elementwise product; pass a scalar to scale. */
export const mul = (a: Vec3, b: Vec3 | number): Vec3 =>
  typeof b === 'number' ? [a[0] * b, a[1] * b, a[2] * b] : [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
export const div = (a: Vec3, b: number): Vec3 => [a[0] / b, a[1] / b, a[2] / b];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => {
  const l = length(a);
  return l < EPSILON ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
};
export const normalize = norm;
export const negate = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]];
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dist2d = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

export const angleBetween = (a: Vec3, b: Vec3): number => {
  const c = dot(norm(a), norm(b));
  return Math.acos(Math.min(1, Math.max(-1, c)));
};

export function rotatePoint(p: Vec3, angle: number, axis: Vec3 = [0, 0, 1], aboutPoint: Vec3 = [0, 0, 0]): Vec3 {
  const q = sub(p, aboutPoint);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const n = norm(axis);
  const dotC = dot(n, q) * (1 - c);
  const cr = cross(n, q);
  const r: Vec3 = [
    q[0] * c + dotC * n[0] + s * cr[0],
    q[1] * c + dotC * n[1] + s * cr[1],
    q[2] * c + dotC * n[2] + s * cr[2],
  ];
  return add(r, aboutPoint);
}

/** Manhattan-ish helpers used by placement code. */
export const maxDim = (a: Vec3): number => Math.max(Math.abs(a[0]), Math.abs(a[1]), Math.abs(a[2]));
