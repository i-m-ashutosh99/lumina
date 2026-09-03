/**
 * Lumina — mat.ts
 * Minimal 3x3 / 4x4 matrix math for linear transformations and the 3D camera.
 * Row-major flat arrays.
 */
import { Vec3, v } from './vec';

export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Mat4 = Float32Array; // 16, column-major (WebGL convention)

export const mat3 = {
  identity(): Mat3 {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  },
  fromRows(a: number[], b: number[], c: number[]): Mat3 {
    return [a[0], a[1], a[2] ?? 0, b[0], b[1], b[2] ?? 0, c[0], c[1], c[2] ?? 0];
  },
  /** 2x2 (as rows of 2) → Mat3, xy-plane linear map. */
  from2x2(m: number[][]): Mat3 {
    return [m[0][0], m[0][1], 0, m[1][0], m[1][1], 0, 0, 0, 1];
  },
  mul(a: Mat3, b: Mat3): Mat3 {
    const o = new Array(9).fill(0) as unknown as Mat3;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += a[r * 3 + k] * b[k * 3 + c];
        o[r * 3 + c] = s;
      }
    return o;
  },
  apply(m: Mat3, p: Vec3): Vec3 {
    return [
      m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
      m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
      m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
    ];
  },
  transpose(m: Mat3): Mat3 {
    return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  },
  det(m: Mat3): number {
    return (
      m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6])
    );
  },
  inv(m: Mat3): Mat3 {
    const d = mat3.det(m);
    if (Math.abs(d) < 1e-12) return mat3.identity();
    const invD = 1 / d;
    return [
      (m[4] * m[8] - m[5] * m[7]) * invD, (m[2] * m[7] - m[1] * m[8]) * invD, (m[1] * m[5] - m[2] * m[4]) * invD,
      (m[5] * m[6] - m[3] * m[8]) * invD, (m[0] * m[8] - m[2] * m[6]) * invD, (m[2] * m[3] - m[0] * m[5]) * invD,
      (m[3] * m[7] - m[4] * m[6]) * invD, (m[1] * m[6] - m[0] * m[7]) * invD, (m[0] * m[4] - m[1] * m[3]) * invD,
    ];
  },
  rotationAbout(axis: Vec3, angle: number): Mat3 {
    const n = v(axis);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    const [x, y, z] = [n[0] / l, n[1] / l, n[2] / l];
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    return [
      t * x * x + c, t * x * y - s * z, t * x * z + s * y,
      t * x * y + s * z, t * y * y + c, t * y * z - s * x,
      t * x * z - s * y, t * y * z + s * x, t * z * z + c,
    ];
  },
  scale(f: number): Mat3 {
    return [f, 0, 0, 0, f, 0, 0, 0, f];
  },
};

/** 2x2 inverse for LinearTransformationScene etc. */
export function inv2x2(m: number[][]): number[][] {
  const d = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (Math.abs(d) < 1e-12) return [[1, 0], [0, 1]];
  return [[m[1][1] / d, -m[0][1] / d], [-m[1][0] / d, m[0][0] / d]];
}

/* ---------------- 4x4 (column-major, for WebGL) ---------------- */

export const mat4 = {
  identity(): Mat4 {
    // prettier-ignore
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },
  mul(a: Mat4, b: Mat4): Mat4 {
    const o = new Float32Array(16);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    return o;
  },
  perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    // prettier-ignore
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  },
  lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
    const z = norm3(sub3(eye, center));
    const x = norm3(cross3(up, z));
    const y = cross3(z, x);
    // prettier-ignore
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
    ]);
  },
  ortho(l: number, r: number, b: number, t: number, n: number, f: number): Mat4 {
    // prettier-ignore
    return new Float32Array([
      2/(r-l), 0, 0, 0,
      0, 2/(t-b), 0, 0,
      0, 0, -2/(f-n), 0,
      -(r+l)/(r-l), -(t+b)/(t-b), -(f+n)/(f-n), 1,
    ]);
  },
};

// small local helpers to avoid circular import churn
const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
