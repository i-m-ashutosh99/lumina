/**
 * Lumina — math/mesh.ts
 * Parametric mesh generators for 3D primitives (doc 07 §9, doc 10 §4.5).
 * Pure functions returning { positions, normals, uvs, indices } — consumed
 * by mobjects/three-d/solids.ts to build MeshMobject instances. No WebGL
 * here; this is geometry only, same spirit as math/bezier.ts for 2D.
 */
import { Vec3, add, sub, cross, norm, mul } from './vec';

export interface MeshData {
  positions: Vec3[];
  normals: Vec3[];
  uvs: [number, number][];
  indices: number[];
}

function emptyMesh(): MeshData {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

/** UV sphere. */
export function sphereMesh(radius = 1, widthSegments = 24, heightSegments = 16): MeshData {
  const m = emptyMesh();
  for (let y = 0; y <= heightSegments; y++) {
    const v = y / heightSegments;
    const theta = v * Math.PI; // 0..PI from +Y pole
    for (let x = 0; x <= widthSegments; x++) {
      const u = x / widthSegments;
      const phi = u * Math.PI * 2;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      const sinP = Math.sin(phi), cosP = Math.cos(phi);
      const px = -radius * cosP * sinT;
      const py = radius * cosT;
      const pz = radius * sinP * sinT;
      m.positions.push([px, py, pz]);
      m.normals.push(norm([px, py, pz]));
      m.uvs.push([u, 1 - v]);
    }
  }
  const rowSize = widthSegments + 1;
  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < widthSegments; x++) {
      const a = y * rowSize + x;
      const b = a + rowSize;
      const c = a + 1;
      const d = b + 1;
      m.indices.push(a, b, c, b, d, c);
    }
  }
  return m;
}

/** Axis-aligned box, per-face normals (flat shading looks right for a cube). */
export function cubeMesh(sideLength = 2): MeshData {
  const s = sideLength / 2;
  const faces: Array<{ n: Vec3; u: Vec3; v: Vec3 }> = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  ];
  const m = emptyMesh();
  for (const f of faces) {
    const center = mul(f.n, s);
    const p00 = add(center, add(mul(f.u, -s), mul(f.v, -s)));
    const p10 = add(center, add(mul(f.u, s), mul(f.v, -s)));
    const p01 = add(center, add(mul(f.u, -s), mul(f.v, s)));
    const p11 = add(center, add(mul(f.u, s), mul(f.v, s)));
    const base = m.positions.length;
    m.positions.push(p00, p10, p01, p11);
    for (let i = 0; i < 4; i++) { m.normals.push(f.n); }
    m.uvs.push([0, 0], [1, 0], [0, 1], [1, 1]);
    m.indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  return m;
}

/** Rectangular prism (box with independent width/height/depth). */
export function prismMesh(width = 2, height = 2, depth = 2): MeshData {
  const m = cubeMesh(1);
  m.positions = m.positions.map((p) => [p[0] * width, p[1] * height, p[2] * depth]);
  return m;
}

/** Cylinder along Y axis, optional caps. */
export function cylinderMesh(radius = 1, height = 2, radialSegments = 24, capped = true): MeshData {
  const m = emptyMesh();
  const halfH = height / 2;
  for (let y = 0; y <= 1; y++) {
    const py = y === 0 ? halfH : -halfH;
    for (let i = 0; i <= radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);
      m.positions.push([x, py, z]);
      m.normals.push(norm([x, 0, z]));
      m.uvs.push([i / radialSegments, y]);
    }
  }
  const rowSize = radialSegments + 1;
  for (let i = 0; i < radialSegments; i++) {
    const a = i, b = i + rowSize, c = i + 1, d = i + 1 + rowSize;
    m.indices.push(a, b, c, b, d, c);
  }
  if (capped) {
    for (const [y, ny] of [[halfH, 1], [-halfH, -1]] as [number, number][]) {
      const centerIdx = m.positions.length;
      m.positions.push([0, y, 0]);
      m.normals.push([0, ny, 0]);
      m.uvs.push([0.5, 0.5]);
      const ringStart = m.positions.length;
      for (let i = 0; i <= radialSegments; i++) {
        const theta = (i / radialSegments) * Math.PI * 2;
        m.positions.push([radius * Math.cos(theta), y, radius * Math.sin(theta)]);
        m.normals.push([0, ny, 0]);
        m.uvs.push([0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta)]);
      }
      for (let i = 0; i < radialSegments; i++) {
        if (ny > 0) m.indices.push(centerIdx, ringStart + i, ringStart + i + 1);
        else m.indices.push(centerIdx, ringStart + i + 1, ringStart + i);
      }
    }
  }
  return m;
}

/** Cone along Y axis, apex up. */
export function coneMesh(radius = 1, height = 2, radialSegments = 24, capped = true): MeshData {
  const m = emptyMesh();
  const halfH = height / 2;
  const apex: Vec3 = [0, halfH, 0];
  const slantLen = Math.hypot(radius, height);
  for (let i = 0; i <= radialSegments; i++) {
    const theta = (i / radialSegments) * Math.PI * 2;
    const x = radius * Math.cos(theta);
    const z = radius * Math.sin(theta);
    const nY = radius / slantLen;
    const nXZ = height / slantLen;
    m.positions.push([x, -halfH, z]);
    m.normals.push(norm([Math.cos(theta) * nXZ, nY, Math.sin(theta) * nXZ]));
    m.uvs.push([i / radialSegments, 0]);
  }
  for (let i = 0; i <= radialSegments; i++) {
    const theta = (i / radialSegments) * Math.PI * 2;
    const nY = radius / slantLen;
    const nXZ = height / slantLen;
    m.positions.push(apex);
    m.normals.push(norm([Math.cos(theta) * nXZ, nY, Math.sin(theta) * nXZ]));
    m.uvs.push([i / radialSegments, 1]);
  }
  const rowSize = radialSegments + 1;
  for (let i = 0; i < radialSegments; i++) {
    m.indices.push(i, rowSize + i, i + 1);
  }
  if (capped) {
    const centerIdx = m.positions.length;
    m.positions.push([0, -halfH, 0]);
    m.normals.push([0, -1, 0]);
    m.uvs.push([0.5, 0.5]);
    const ringStart = m.positions.length;
    for (let i = 0; i <= radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      m.positions.push([radius * Math.cos(theta), -halfH, radius * Math.sin(theta)]);
      m.normals.push([0, -1, 0]);
      m.uvs.push([0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta)]);
    }
    for (let i = 0; i < radialSegments; i++) {
      m.indices.push(centerIdx, ringStart + i + 1, ringStart + i);
    }
  }
  return m;
}

/** Torus in the XZ plane, tube along Y. */
export function torusMesh(radius = 1, tubeRadius = 0.35, radialSegments = 32, tubularSegments = 16): MeshData {
  const m = emptyMesh();
  for (let j = 0; j <= radialSegments; j++) {
    const u = (j / radialSegments) * Math.PI * 2;
    for (let i = 0; i <= tubularSegments; i++) {
      const v = (i / tubularSegments) * Math.PI * 2;
      const cx = radius * Math.cos(u);
      const cz = radius * Math.sin(u);
      const x = (radius + tubeRadius * Math.cos(v)) * Math.cos(u);
      const y = tubeRadius * Math.sin(v);
      const z = (radius + tubeRadius * Math.cos(v)) * Math.sin(u);
      m.positions.push([x, y, z]);
      m.normals.push(norm([x - cx, y, z - cz]));
      m.uvs.push([j / radialSegments, i / tubularSegments]);
    }
  }
  const rowSize = tubularSegments + 1;
  for (let j = 0; j < radialSegments; j++) {
    for (let i = 0; i < tubularSegments; i++) {
      const a = j * rowSize + i;
      const b = a + rowSize;
      const c = a + 1;
      const d = b + 1;
      m.indices.push(a, b, c, b, d, c);
    }
  }
  return m;
}

/** Regular n-gon platonic-ish "prism" convenience: not a platonic solid
 *  generator itself, but the requested Prism uses this via prismMesh. */

/** Parametric surface: fn(u, v) -> Vec3, u,v in [0,1] by default (caller
 *  remaps into their own domain before calling, or passes uRange/vRange). */
export function parametricSurfaceMesh(
  fn: (u: number, v: number) => Vec3,
  uSegments = 32,
  vSegments = 32,
  uRange: [number, number] = [0, 1],
  vRange: [number, number] = [0, 1]
): MeshData {
  const m = emptyMesh();
  const grid: Vec3[][] = [];
  for (let j = 0; j <= vSegments; j++) {
    const v = vRange[0] + (vRange[1] - vRange[0]) * (j / vSegments);
    const row: Vec3[] = [];
    for (let i = 0; i <= uSegments; i++) {
      const u = uRange[0] + (uRange[1] - uRange[0]) * (i / uSegments);
      row.push(fn(u, v));
    }
    grid.push(row);
  }
  for (let j = 0; j <= vSegments; j++) {
    for (let i = 0; i <= uSegments; i++) {
      const p = grid[j][i];
      // finite-difference normal from neighbors (robust for any fn)
      const pu = grid[j][Math.min(uSegments, i + 1)];
      const pu0 = grid[j][Math.max(0, i - 1)];
      const pv = grid[Math.min(vSegments, j + 1)][i];
      const pv0 = grid[Math.max(0, j - 1)][i];
      const du = sub(pu, pu0);
      const dv = sub(pv, pv0);
      let n = norm(cross(du, dv));
      if (!isFinite(n[0]) || (n[0] === 0 && n[1] === 0 && n[2] === 0)) n = [0, 1, 0];
      m.positions.push(p);
      m.normals.push(n);
      m.uvs.push([i / uSegments, j / vSegments]);
    }
  }
  const rowSize = uSegments + 1;
  for (let j = 0; j < vSegments; j++) {
    for (let i = 0; i < uSegments; i++) {
      const a = j * rowSize + i;
      const b = a + rowSize;
      const c = a + 1;
      const d = b + 1;
      m.indices.push(a, b, c, b, d, c);
    }
  }
  return m;
}

/** Convex-hull-free Platonic solids (explicit vertex/face lists). */
export function tetrahedronMesh(radius = 1): MeshData {
  const a = 1 / Math.sqrt(3);
  const verts: Vec3[] = [
    [a, a, a], [a, -a, -a], [-a, a, -a], [-a, -a, a],
  ].map((p) => norm(p as Vec3)).map((p) => mul(p, radius));
  const faces: [number, number, number][] = [
    [0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2],
  ];
  return facesToFlatMesh(verts, faces);
}

export function octahedronMesh(radius = 1): MeshData {
  const verts: Vec3[] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ].map((p) => mul(p as Vec3, radius));
  const faces: [number, number, number][] = [
    [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
    [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
  ];
  return facesToFlatMesh(verts, faces);
}

/** Raw (indexed, shared-vertex) icosahedron topology — used internally by
 *  `dodecahedronMesh`'s dual construction, which needs the true 12-vertex/
 *  20-face adjacency (unlike `icosahedronMesh`'s public flat-shaded output,
 *  which duplicates each vertex per face for per-face normals and therefore
 *  has no shared-vertex topology to walk). */
function icosahedronTopology(radius = 1): { verts: Vec3[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: Vec3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const verts = raw.map((p) => mul(norm(p as Vec3), radius));
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { verts, faces };
}

export function icosahedronMesh(radius = 1): MeshData {
  const { verts, faces } = icosahedronTopology(radius);
  return facesToFlatMesh(verts, faces);
}

export function dodecahedronMesh(radius = 1): MeshData {
  // Dodecahedron = dual of the icosahedron: each of the 20 icosahedron
  // FACE centroids becomes a dodecahedron VERTEX, and each icosahedron
  // VERTEX (12 of them, each touching exactly 5 faces, by construction of
  // a regular icosahedron) becomes one dodecahedron pentagonal face made
  // of those 5 centroids — a standard, always-correct dual construction
  // (no hand-derived face table needed). Uses the raw SHARED-vertex
  // icosahedron topology (not the public flat-shaded `icosahedronMesh`
  // output, which duplicates vertices per face and has no adjacency left
  // to walk).
  const { verts, faces } = icosahedronTopology(1);
  const nFaces = faces.length;
  const centroids: Vec3[] = faces.map(([i0, i1, i2]) => {
    const p0 = verts[i0], p1 = verts[i1], p2 = verts[i2];
    return mul(norm([
      (p0[0] + p1[0] + p2[0]) / 3,
      (p0[1] + p1[1] + p2[1]) / 3,
      (p0[2] + p1[2] + p2[2]) / 3,
    ] as Vec3), radius);
  });
  // Group face indices by which of the 12 shared vertices they touch —
  // each of the 12 vertices touches exactly 5 faces in a regular icosahedron.
  const vertexFaces: number[][] = Array.from({ length: verts.length }, () => []);
  for (let f = 0; f < nFaces; f++) {
    for (let k = 0; k < 3; k++) vertexFaces[faces[f][k]].push(f);
  }
  const m = emptyMesh();
  for (const faceIdxList of vertexFaces) {
    if (faceIdxList.length < 3) continue;
    // Order the 5 centroids around their shared vertex by angle so the fan
    // triangulation doesn't self-intersect.
    const pts = faceIdxList.map((fi) => centroids[fi]);
    const centerN = norm(pts.reduce((acc, p) => add(acc, p), [0, 0, 0] as Vec3));
    const ref = norm(cross(centerN, Math.abs(centerN[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const ref2 = cross(centerN, ref);
    const ordered = [...pts].sort((a, b) => {
      const angA = Math.atan2(
        (a[0] - centerN[0]) * ref2[0] + (a[1] - centerN[1]) * ref2[1] + (a[2] - centerN[2]) * ref2[2],
        (a[0] - centerN[0]) * ref[0] + (a[1] - centerN[1]) * ref[1] + (a[2] - centerN[2]) * ref[2]
      );
      const angB = Math.atan2(
        (b[0] - centerN[0]) * ref2[0] + (b[1] - centerN[1]) * ref2[1] + (b[2] - centerN[2]) * ref2[2],
        (b[0] - centerN[0]) * ref[0] + (b[1] - centerN[1]) * ref[1] + (b[2] - centerN[2]) * ref[2]
      );
      return angA - angB;
    });
    const n = centerN;
    for (let k = 1; k < ordered.length - 1; k++) {
      const base = m.positions.length;
      m.positions.push(ordered[0], ordered[k], ordered[k + 1]);
      m.normals.push(n, n, n);
      m.uvs.push([0, 0], [1, 0], [0.5, 1]);
      m.indices.push(base, base + 1, base + 2);
    }
  }
  return m;
}

function facesToFlatMesh(verts: Vec3[], faces: [number, number, number][]): MeshData {
  const m = emptyMesh();
  for (const [i0, i1, i2] of faces) {
    const p0 = verts[i0], p1 = verts[i1], p2 = verts[i2];
    if (!p0 || !p1 || !p2) continue;
    const n = norm(cross(sub(p1, p0), sub(p2, p0)));
    const base = m.positions.length;
    m.positions.push(p0, p1, p2);
    m.normals.push(n, n, n);
    m.uvs.push([0, 0], [1, 0], [0, 1]);
    m.indices.push(base, base + 1, base + 2);
  }
  return m;
}
