/**
 * Lumina — renderers/webgl.ts
 * Owned WebGL2 renderer for 3D MeshMobjects (doc 08 §2.5). NOT Three.js —
 * a minimal, purpose-built forward renderer: one Lambert+ambient shader,
 * vertex positions/normals, per-mobject flat color (`meshStyle.color`).
 *
 * Composited UNDER the Canvas2D 2D layer per the v1 hybrid-compositor plan
 * (doc 08 §2.1): `ThreeDScene` stacks this canvas behind the 2D canvas and
 * clears it with the scene background; the 2D canvas above must then be
 * cleared to *transparent* so the 3D layer shows through (see
 * `Canvas2DRenderer.render(..., { transparent: true })`).
 *
 * Buffers are rebuilt whenever a mobject's `positions`/`indices` array
 * reference changes (cheap reference check) — matches the Canvas2D
 * renderer's "rebuild Path2D every frame" philosophy; Lumina's
 * record-then-seek architecture always re-derives geometry per frame
 * during an active animation anyway.
 */
import { MeshMobject } from '../core/mesh-mobject';
import { Mobject } from '../core/mobject';
import { ThreeDCamera } from '../cameras/camera';
import { Vec3, dist, sub } from '../math/vec';
import { Mat4 } from '../math/mat';

export interface WebGLRenderStats {
  drawn: number;
  culled: number;
  ms: number;
}

// Flat-color shader (every MeshMobject without a bound texture) — layout
// locations 0/1 shared with the textured variant below so a single VAO-less
// bind sequence (positions -> loc 0, normals -> loc 1) works for both.
const VERT_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vNormal;
out vec3 vWorldPos;
void main() {
  vWorldPos = aPosition;
  vNormal = aNormal;
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPos;
uniform vec3 uColor;
uniform float uOpacity;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform float uAmbient;
uniform float uShaded;
uniform int uLightKind; // 0 = point, 1 = directional, 2 = ambient-only
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = (uLightKind == 1) ? normalize(uLightPos) : normalize(uLightPos - vWorldPos);
  float diff = max(dot(N, L), 0.0);
  float lit = uAmbient + (1.0 - uAmbient) * diff * uLightIntensity;
  lit = mix(1.0, lit, uShaded);
  vec3 rgb = uColor * lit * uLightColor;
  fragColor = vec4(rgb, uOpacity);
}
`;

// Textured shader (doc 13 audit gap G16 "3D follow-ups: textures") — adds a
// UV attribute (location 2) and samples `uDayTex`, blending toward
// `uNightTex` on the fragment's unlit hemisphere (real ManimCE
// `TexturedSurface` day/night blend by `diff`, its "how directly the
// fragment faces the light" term — same `diff` the flat shader already
// computes for its Lambert term, reused here as the blend factor).
const TEX_VERT_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vNormal;
out vec3 vWorldPos;
out vec2 vUv;
void main() {
  vWorldPos = aPosition;
  vNormal = aNormal;
  vUv = aUv;
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}
`;

const TEX_FRAG_SRC = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vUv;
uniform float uOpacity;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform float uAmbient;
uniform float uShaded;
uniform int uLightKind;
uniform sampler2D uDayTex;
uniform sampler2D uNightTex;
uniform bool uHasNight;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = (uLightKind == 1) ? normalize(uLightPos) : normalize(uLightPos - vWorldPos);
  float diff = max(dot(N, L), 0.0);
  float lit = uAmbient + (1.0 - uAmbient) * diff * uLightIntensity;
  lit = mix(1.0, lit, uShaded);
  vec3 dayColor = texture(uDayTex, vUv).rgb;
  vec3 base = dayColor;
  if (uHasNight) {
    vec3 nightColor = texture(uNightTex, vUv).rgb;
    // diff in [0,1]: 1 = fully lit (day-facing), 0 = fully dark (night side).
    base = mix(nightColor, dayColor, clamp(diff, 0.0, 1.0));
  }
  vec3 rgb = base * lit * uLightColor;
  fragColor = vec4(rgb, uOpacity);
}
`;

interface GPUMeshRecord {
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer | null;
  indexBuffer: WebGLBuffer;
  indexCount: number;
  wireframeBuffer: WebGLBuffer | null;
  wireframeCount: number;
  lastPositions: Vec3[] | null;
  lastIndices: number[] | null;
  lastUvs: [number, number][] | null;
}

interface GPUTextureRecord {
  texture: WebGLTexture;
  lastSource: HTMLImageElement | ImageBitmap | null;
}

function hexToRgb01(c: string): [number, number, number] {
  let s = c.trim();
  if (s[0] !== '#') s = '#' + s;
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class WebGLRenderer {
  gl: WebGL2RenderingContext;
  dpr = 1;
  lastStats: WebGLRenderStats = { drawn: 0, culled: 0, ms: 0 };

  private program: WebGLProgram;
  private uView: WebGLUniformLocation | null;
  private uProjection: WebGLUniformLocation | null;
  private uColor: WebGLUniformLocation | null;
  private uOpacity: WebGLUniformLocation | null;
  private uLightPos: WebGLUniformLocation | null;
  private uLightColor: WebGLUniformLocation | null;
  private uLightIntensity: WebGLUniformLocation | null;
  private uAmbient: WebGLUniformLocation | null;
  private uShaded: WebGLUniformLocation | null;
  private uLightKind: WebGLUniformLocation | null;

  // Textured-surface program (doc 13 audit gap G16) — separate program
  // object since it has an extra vertex attribute (UV) and two sampler
  // uniforms; kept as a fully independent pipeline rather than branching
  // inside one shader so the common (untextured) draw path pays zero cost.
  private texProgram: WebGLProgram;
  private tuView: WebGLUniformLocation | null;
  private tuProjection: WebGLUniformLocation | null;
  private tuOpacity: WebGLUniformLocation | null;
  private tuLightPos: WebGLUniformLocation | null;
  private tuLightColor: WebGLUniformLocation | null;
  private tuLightIntensity: WebGLUniformLocation | null;
  private tuAmbient: WebGLUniformLocation | null;
  private tuShaded: WebGLUniformLocation | null;
  private tuLightKind: WebGLUniformLocation | null;
  private tuDayTex: WebGLUniformLocation | null;
  private tuNightTex: WebGLUniformLocation | null;
  private tuHasNight: WebGLUniformLocation | null;

  private cache = new WeakMap<MeshMobject, GPUMeshRecord>();
  private texCache = new WeakMap<HTMLImageElement | ImageBitmap, GPUTextureRecord>();

  constructor(public canvas: HTMLCanvasElement, public camera: ThreeDCamera) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) throw new Error('Lumina WebGLRenderer: WebGL2 is not available in this browser.');
    this.gl = gl;
    this.program = this.compileProgram(VERT_SRC, FRAG_SRC);
    this.uView = gl.getUniformLocation(this.program, 'uView');
    this.uProjection = gl.getUniformLocation(this.program, 'uProjection');
    this.uColor = gl.getUniformLocation(this.program, 'uColor');
    this.uOpacity = gl.getUniformLocation(this.program, 'uOpacity');
    this.uLightPos = gl.getUniformLocation(this.program, 'uLightPos');
    this.uLightColor = gl.getUniformLocation(this.program, 'uLightColor');
    this.uLightIntensity = gl.getUniformLocation(this.program, 'uLightIntensity');
    this.uAmbient = gl.getUniformLocation(this.program, 'uAmbient');
    this.uShaded = gl.getUniformLocation(this.program, 'uShaded');
    this.uLightKind = gl.getUniformLocation(this.program, 'uLightKind');

    this.texProgram = this.compileProgram(TEX_VERT_SRC, TEX_FRAG_SRC);
    this.tuView = gl.getUniformLocation(this.texProgram, 'uView');
    this.tuProjection = gl.getUniformLocation(this.texProgram, 'uProjection');
    this.tuOpacity = gl.getUniformLocation(this.texProgram, 'uOpacity');
    this.tuLightPos = gl.getUniformLocation(this.texProgram, 'uLightPos');
    this.tuLightColor = gl.getUniformLocation(this.texProgram, 'uLightColor');
    this.tuLightIntensity = gl.getUniformLocation(this.texProgram, 'uLightIntensity');
    this.tuAmbient = gl.getUniformLocation(this.texProgram, 'uAmbient');
    this.tuShaded = gl.getUniformLocation(this.texProgram, 'uShaded');
    this.tuLightKind = gl.getUniformLocation(this.texProgram, 'uLightKind');
    this.tuDayTex = gl.getUniformLocation(this.texProgram, 'uDayTex');
    this.tuNightTex = gl.getUniformLocation(this.texProgram, 'uNightTex');
    this.tuHasNight = gl.getUniformLocation(this.texProgram, 'uHasNight');
  }

  private compileProgram(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string): WebGLShader => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error(`Lumina WebGLRenderer: shader compile error: ${log}`);
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      throw new Error(`Lumina WebGLRenderer: program link error: ${log}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private getOrBuildRecord(m: MeshMobject): GPUMeshRecord {
    const gl = this.gl;
    let rec = this.cache.get(m);
    if (!rec) {
      rec = {
        positionBuffer: gl.createBuffer()!,
        normalBuffer: gl.createBuffer()!,
        uvBuffer: null,
        indexBuffer: gl.createBuffer()!,
        indexCount: 0,
        wireframeBuffer: null,
        wireframeCount: 0,
        lastPositions: null,
        lastIndices: null,
        lastUvs: null,
      };
      this.cache.set(m, rec);
    }
    if (m.texture?.dayImage && rec.lastUvs !== m.uvs) {
      const flatUv = new Float32Array(m.uvs.length * 2);
      for (let i = 0; i < m.uvs.length; i++) {
        flatUv[i * 2] = m.uvs[i][0];
        flatUv[i * 2 + 1] = m.uvs[i][1];
      }
      rec.uvBuffer = rec.uvBuffer ?? gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, rec.uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, flatUv, gl.DYNAMIC_DRAW);
      rec.lastUvs = m.uvs;
    }
    if (rec.lastPositions !== m.positions) {
      const flatPos = new Float32Array(m.positions.length * 3);
      const flatNorm = new Float32Array(m.normals.length * 3);
      for (let i = 0; i < m.positions.length; i++) {
        flatPos[i * 3] = m.positions[i][0];
        flatPos[i * 3 + 1] = m.positions[i][1];
        flatPos[i * 3 + 2] = m.positions[i][2];
        const n = m.normals[i] ?? [0, 1, 0];
        flatNorm[i * 3] = n[0];
        flatNorm[i * 3 + 1] = n[1];
        flatNorm[i * 3 + 2] = n[2];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, rec.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, flatPos, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, rec.normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, flatNorm, gl.DYNAMIC_DRAW);
      rec.lastPositions = m.positions;
    }
    if (rec.lastIndices !== m.indices) {
      const idx = new Uint32Array(m.indices);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rec.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW);
      rec.indexCount = m.indices.length;
      // Wireframe: unique edges from triangle list.
      const edgeSet = new Set<string>();
      const edges: number[] = [];
      for (let i = 0; i + 2 < m.indices.length; i += 3) {
        const tri = [m.indices[i], m.indices[i + 1], m.indices[i + 2]];
        for (let k = 0; k < 3; k++) {
          const a = tri[k], b = tri[(k + 1) % 3];
          const key = a < b ? `${a}_${b}` : `${b}_${a}`;
          if (!edgeSet.has(key)) { edgeSet.add(key); edges.push(a, b); }
        }
      }
      rec.wireframeBuffer = rec.wireframeBuffer ?? gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rec.wireframeBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(edges), gl.DYNAMIC_DRAW);
      rec.wireframeCount = edges.length;
      rec.lastIndices = m.indices;
    }
    return rec;
  }

  /** Upload (once) + cache a `HTMLImageElement`/`ImageBitmap` as a
   *  `WebGLTexture`, keyed by object identity so the same decoded image
   *  reused across multiple `TexturedSurface`s (or re-rendered every frame
   *  of a seek) is uploaded to the GPU exactly once. */
  private getOrBuildTexture(img: HTMLImageElement | ImageBitmap): WebGLTexture {
    const gl = this.gl;
    let rec = this.texCache.get(img);
    if (rec && rec.lastSource === img) return rec.texture;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.texCache.set(img, { texture, lastSource: img });
    return texture;
  }

  /** Collect drawable MeshMobjects from scene roots (family-wide). */
  private collect(roots: Mobject[]): MeshMobject[] {
    const out: MeshMobject[] = [];
    for (const root of roots) {
      for (const m of root.family()) {
        if (!m.visible) continue;
        if (m instanceof MeshMobject && m.isDrawable) out.push(m);
      }
    }
    return out;
  }

  render(roots: Mobject[], background = '#000000'): WebGLRenderStats {
    const t0 = performance.now();
    const gl = this.gl;
    const [br, bg, bb] = hexToRgb01(background);
    gl.clearColor(br, bg, bb, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE); // robustness over perf: user parametric surfaces may have inconsistent winding
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const meshes = this.collect(roots);
    if (meshes.length === 0) {
      this.lastStats = { drawn: 0, culled: 0, ms: performance.now() - t0 };
      return this.lastStats;
    }

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const view = this.camera.viewMatrix();
    const proj = this.camera.projectionMatrix(aspect);
    const eye = this.camera.getEye();
    const light = this.camera.lightSource;
    const uniforms = light.uniforms();

    // Painter's algorithm: back-to-front by distance from eye (handles the
    // common case of a few dozen translucent solids correctly enough for v1).
    const sorted = [...meshes].sort((a, b) => {
      const da = dist(a.getCenter(), eye);
      const db = dist(b.getCenter(), eye);
      return db - da;
    });

    // Track which program is currently bound so mixed textured/untextured
    // scenes don't re-bind + re-set camera/light uniforms on every draw call
    // (only when the mesh actually needs the other pipeline).
    let activeProgram: 'flat' | 'tex' | null = null;
    const bindFlat = () => {
      if (activeProgram === 'flat') return;
      activeProgram = 'flat';
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.uView, false, view);
      gl.uniformMatrix4fv(this.uProjection, false, proj);
      gl.uniform3fv(this.uLightPos, uniforms.position);
      gl.uniform3fv(this.uLightColor, uniforms.color);
      gl.uniform1f(this.uLightIntensity, uniforms.intensity);
      gl.uniform1i(this.uLightKind, uniforms.kind);
    };
    const bindTex = () => {
      if (activeProgram === 'tex') return;
      activeProgram = 'tex';
      gl.useProgram(this.texProgram);
      gl.uniformMatrix4fv(this.tuView, false, view);
      gl.uniformMatrix4fv(this.tuProjection, false, proj);
      gl.uniform3fv(this.tuLightPos, uniforms.position);
      gl.uniform3fv(this.tuLightColor, uniforms.color);
      gl.uniform1f(this.tuLightIntensity, uniforms.intensity);
      gl.uniform1i(this.tuLightKind, uniforms.kind);
    };

    let drawn = 0;
    for (const m of sorted) {
      const rec = this.getOrBuildRecord(m);
      if (rec.indexCount === 0) continue;

      const textured = !!(m.texture?.dayImage && rec.uvBuffer);
      if (textured) {
        bindTex();
        const dayTex = this.getOrBuildTexture(m.texture!.dayImage!);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dayTex);
        gl.uniform1i(this.tuDayTex, 0);
        const hasNight = !!m.texture!.nightImage;
        gl.uniform1i(this.tuHasNight, hasNight ? 1 : 0);
        if (hasNight) {
          const nightTex = this.getOrBuildTexture(m.texture!.nightImage!);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, nightTex);
          gl.uniform1i(this.tuNightTex, 1);
        }
        gl.uniform1f(this.tuOpacity, m.meshStyle.opacity);
        gl.uniform1f(this.tuAmbient, 0.35);
        gl.uniform1f(this.tuShaded, m.meshStyle.shaded ? m.meshStyle.shadeIntensity : 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, rec.positionBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, rec.normalBuffer);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, rec.uvBuffer!);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      } else {
        bindFlat();
        const [cr, cg, cb] = hexToRgb01(m.meshStyle.color);
        gl.uniform3f(this.uColor, cr, cg, cb);
        gl.uniform1f(this.uOpacity, m.meshStyle.opacity);
        gl.uniform1f(this.uAmbient, 0.35);
        gl.uniform1f(this.uShaded, m.meshStyle.shaded ? m.meshStyle.shadeIntensity : 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, rec.positionBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, rec.normalBuffer);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(2);
      }

      if (m.meshStyle.wireframe && rec.wireframeBuffer && rec.wireframeCount > 0) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rec.wireframeBuffer);
        gl.drawElements(gl.LINES, rec.wireframeCount, gl.UNSIGNED_INT, 0);
      } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rec.indexBuffer);
        gl.drawElements(gl.TRIANGLES, rec.indexCount, gl.UNSIGNED_INT, 0);
      }
      drawn++;
    }

    this.lastStats = { drawn, culled: meshes.length - drawn, ms: performance.now() - t0 };
    return this.lastStats;
  }
}

/** True if any mobject in the family tree is a MeshMobject (Scene uses this
 *  to decide whether to lazily create the WebGL layer at all). */
export function hasMeshMobjects(roots: Mobject[]): boolean {
  for (const root of roots) {
    for (const m of root.family()) if (m instanceof MeshMobject) return true;
  }
  return false;
}
