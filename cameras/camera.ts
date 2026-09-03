/**
 * Lumina — camera.ts
 * 2D camera: world→pixel mapping via a `frame` (center, width, height,
 * rotation). MovingCamera animates the frame as if it were a mobject.
 */
import { Vec3, v, add, sub, mul } from '../math/vec';
import { FRAME_HEIGHT, FRAME_WIDTH } from '../math/constants';
import { Mobject } from '../core/mobject';
import { rotatePoint } from '../math/vec';

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
