/**
 * Lumina — camera.ts
 * 2D camera: world→pixel mapping via a `frame` (center, width, height,
 * rotation). MovingCamera animates the frame as if it were a mobject.
 *
 * ThreeDCamera (below) extends this with the Euler-angle 3D camera doc 06
 * §7 specifies (`phi`, `theta`, `gamma`, `focalDistance`, `zoom`,
 * `lightSource`) — matching real ManimCE's `ThreeDCamera` naming so GL/CE
 * scenes with `set_camera_orientation(phi=..., theta=...)` port directly.
 */
import { Vec3, v, add, sub, mul, norm, cross } from '../math/vec';
import { Mat4, mat4 } from '../math/mat';
import { FRAME_HEIGHT, FRAME_WIDTH } from '../math/constants';
import { Mobject } from '../core/mobject';
import { rotatePoint } from '../math/vec';
import { Light, defaultLight } from '../mobjects/three-d/light';

export interface Frame {
  center: Vec3;
  width: number;
  height: number;
  rotation: number;
}

export class Camera {
  frame: Frame = {
    center: [0, 0, 0],
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    rotation: 0,
  };

  /** Pixels per world unit at current canvas size. */
  pixelsPerUnit(pixelsWide: number, pixelsHigh: number): number {
    return Math.min(pixelsWide / this.frame.width, pixelsHigh / this.frame.height);
  }

  /** World point → pixel coordinates (y flipped). */
  worldToPixel(p: Vec3, pixelsWide: number, pixelsHigh: number): [number, number] {
    const ppu = this.pixelsPerUnit(pixelsWide, pixelsHigh);
    const c = this.frame.center;
    let x = p[0] - c[0];
    let y = p[1] - c[1];
    if (this.frame.rotation !== 0) {
      const r = rotatePoint([x, y, 0], -this.frame.rotation, [0, 0, 1]);
      x = r[0];
      y = r[1];
    }
    const px = pixelsWide / 2 + x * ppu;
    const py = pixelsHigh / 2 - y * ppu;
    return [px, py];
  }

  /** Pixel → world (for pointer interaction). */
  pixelToWorld(px: number, py: number, pixelsWide: number, pixelsHigh: number): Vec3 {
    const ppu = this.pixelsPerUnit(pixelsWide, pixelsHigh);
    let x = (px - pixelsWide / 2) / ppu;
    let y = (pixelsHigh / 2 - py) / ppu;
    if (this.frame.rotation !== 0) {
      const r = rotatePoint([x, y, 0], this.frame.rotation, [0, 0, 1]);
      x = r[0];
      y = r[1];
    }
    const c = this.frame.center;
    return [x + c[0], y + c[1], 0];
  }

  /** Apply frame motion methods (used via camera.frame.animate...). */
  shiftFrame(d: Vec3): void {
    this.frame.center = add(this.frame.center, v(d));
  }

  setFrameWidth(w: number): void {
    const h = this.frame.height * (w / this.frame.width);
    this.frame.width = w;
    this.frame.height = h;
  }

  setFrameHeight(h: number): void {
    const w = this.frame.width * (h / this.frame.height);
    this.frame.width = w;
    this.frame.height = h;
  }

  scaleFrame(f: number): void {
    this.frame.width *= f;
    this.frame.height *= f;
  }

  rotateFrame(angle: number): void {
    this.frame.rotation += angle;
  }

  copyFrame(): Frame {
    return { center: [...this.frame.center] as Vec3, width: this.frame.width, height: this.frame.height, rotation: this.frame.rotation };
  }
}

/**
 * MovingCamera — camera whose frame is animatable.
 * Exposed as scene.camera.frame with `.animate`-compatible methods via
 * FrameMobject (a lightweight mobject wrapper for the timeline).
 */
export class FrameMobject extends Mobject {
  constructor(private camera: Camera) {
    super();
    this.isGroup = false;
    this.points = [
      [-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0],
    ] as Vec3[]; // dummy geometry so placement math works
  }

  applyOptions(o: any): void {}

  shift(d: Vec3): this {
    this.camera.shiftFrame(d);
    return this;
  }

  scale(f: number, opts?: any): this {
    if (typeof f === 'number') this.camera.scaleFrame(f);
    return this;
  }

  setWidth(w: number): this {
    this.camera.setFrameWidth(w);
    return this;
  }

  setHeight(h: number): this {
    this.camera.setFrameHeight(h);
    return this;
  }

  rotate(a: number): this {
    this.camera.rotateFrame(a);
    return this;
  }

  moveTo(p: Vec3 | Mobject): this {
    const c = p instanceof Mobject ? p.getCenter() : v(p);
    this.camera.frame.center = c;
    return this;
  }

  getCenter(): Vec3 {
    return [...this.camera.frame.center] as Vec3;
  }

  getWidth(): number { return this.camera.frame.width; }
  getHeight(): number { return this.camera.frame.height; }

  copy(): this {
    // animate proxy copies the frame wrapper; keep same camera reference
    const c = new FrameMobject(this.camera);
    return c as this;
  }
}

export class MovingCamera extends Camera {
  frameMobject: FrameMobject;

  constructor() {
    super();
    this.frameMobject = new FrameMobject(this);
  }

  get frameM(): FrameMobject {
    return this.frameMobject;
  }
}

/**
 * ZoomedCamera — MovingCamera plus a second, smaller "zoomed display"
 * frame (real ManimCE `ZoomedScene`'s `zoomed_camera`). The main frame
 * behaves exactly like MovingCamera; `zoomedFrame` is an independent
 * Frame that a `ZoomedScene` renders into a small inset viewport.
 */
export class ZoomedCamera extends MovingCamera {
  zoomedFrame: Frame = {
    center: [0, 0, 0],
    width: FRAME_WIDTH * 0.3,
    height: FRAME_HEIGHT * 0.3,
    rotation: 0,
  };
  zoomFactor = 2;

  zoomedFrameMobject(): FrameMobject {
    const proxyCamera = new Camera();
    proxyCamera.frame = this.zoomedFrame;
    const fm = new FrameMobject(proxyCamera);
    return fm;
  }
}

/* ==================================================================== */
/* ThreeDCamera — Euler-angle 3D camera (doc 06 §7, doc 08 §2.2)         */
/* ==================================================================== */

/**
 * ThreeDCamera — perspective camera matching real ManimCE's `ThreeDCamera`
 * naming:
 *   - `phi`   — polar angle from +Z (0 = looking straight down +Z axis)
 *   - `theta` — azimuthal angle around Z
 *   - `gamma` — roll (rotation about the view direction)
 *   - `focalDistance` — distance from the eye to `frameCenter` (dolly)
 *   - `zoom`  — multiplies the effective field of view (>1 = zoomed in)
 *   - `lightSource` — a `Light` mobject the WebGL renderer reads for
 *     Lambert shading (doc 06 §7 `lightSource: Mobject`)
 *
 * The eye position is derived from spherical coordinates around
 * `frameCenter`, exactly like ManimCE/ManimGL's convention, so
 * `setCameraOrientation({ phi: 75*DEGREES, theta: -45*DEGREES })` ports.
 */
export class ThreeDCamera extends Camera {
  phi = 0; // 0 = top-down (looking along -Z), matches Manim's default
  theta = -Math.PI / 2;
  gamma = 0;
  focalDistance = 20;
  distance = 8; // eye-to-frameCenter radius (Manim's default ~ zoom-dependent)
  zoom = 1;
  frameCenter: Vec3 = [0, 0, 0];
  fovDegrees = 45;
  lightSource: Light = defaultLight();
  ambientRotationRate = 0; // radians/sec around Z; set by beginAmbientCameraRotation

  /** Eye (camera world position) from spherical (distance, phi, theta). */
  getEye(): Vec3 {
    const r = this.distance;
    const sinPhi = Math.sin(this.phi), cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta), cosTheta = Math.cos(this.theta);
    return add(this.frameCenter, [
      r * sinPhi * cosTheta,
      r * sinPhi * sinTheta,
      r * cosPhi,
    ] as Vec3);
  }

  getUp(): Vec3 {
    // Roll (gamma) rotates the up vector about the view axis.
    const base: Vec3 = [0, 0, 1];
    const viewDir = norm(sub(this.frameCenter, this.getEye()));
    return rotatePoint(base, this.gamma, viewDir, [0, 0, 0]);
  }

  viewMatrix(): Mat4 {
    return mat4.lookAt(this.getEye(), this.frameCenter, this.getUp());
  }

  projectionMatrix(aspect: number): Mat4 {
    const fov = (this.fovDegrees * Math.PI / 180) / Math.max(this.zoom, 1e-3);
    return mat4.perspective(fov, aspect, 0.1, 1000);
  }

  setCameraOrientation(opts: { phi?: number; theta?: number; gamma?: number; distance?: number; zoom?: number; frameCenter?: Vec3 } = {}): void {
    if (opts.phi !== undefined) this.phi = opts.phi;
    if (opts.theta !== undefined) this.theta = opts.theta;
    if (opts.gamma !== undefined) this.gamma = opts.gamma;
    if (opts.distance !== undefined) this.distance = opts.distance;
    if (opts.zoom !== undefined) this.zoom = opts.zoom;
    if (opts.frameCenter !== undefined) this.frameCenter = v(opts.frameCenter);
  }

  /** Smoothly animated camera move (Player/Scene call this across a runTime;
   *  Lumina's record-then-seek architecture applies it via a CameraMoveAnimation
   *  registered in animations/movement.ts, this method is the raw setter). */
  moveCamera(opts: { phi?: number; theta?: number; gamma?: number; distance?: number; zoom?: number; frameCenter?: Vec3 } = {}): void {
    this.setCameraOrientation(opts);
  }

  beginAmbientCameraRotation(rate = 0.1): void {
    this.ambientRotationRate = rate;
  }

  stopAmbientCameraRotation(): void {
    this.ambientRotationRate = 0;
  }

  /** Called each frame by Scene.updateSelf if ambient rotation is active. */
  tickAmbient(dt: number): void {
    if (this.ambientRotationRate !== 0) this.theta += this.ambientRotationRate * dt;
  }
}

/**
 * World point (with optional per-point `fixedInFrame` override handled by
 * the renderer, not here) → normalized device coords via the 3D camera.
 * Returned z is the clip-space depth (for painter's-algorithm sort/z-test).
 */
export function projectPoint3D(cam: ThreeDCamera, p: Vec3, aspect: number): Vec3 {
  const view = cam.viewMatrix();
  const proj = cam.projectionMatrix(aspect);
  const vp = mat4.mul(proj, view);
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const z = vp[2] * p[0] + vp[6] * p[1] + vp[10] * p[2] + vp[14];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  const invW = w !== 0 ? 1 / w : 1;
  return [x * invW, y * invW, z * invW];
}
