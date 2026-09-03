/**
 * Lumina — canvas2d.ts
 * Canvas2D renderer: crisp 2D Bézier rendering of VMobjects (doc 08 §2.3).
 * Background stroke (3b1b readability trick), dpr-aware, frame-culling.
 */
import { Mobject } from '../core/mobject';
import { VMobject } from '../core/vmobject';
import { Camera } from '../cameras/camera';
import { resolveColor, withAlpha } from '../math/color';

export interface RenderStats {
  drawn: number;
  culled: number;
  ms: number;
}

export class Canvas2DRenderer {
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  lastStats: RenderStats = { drawn: 0, culled: 0, ms: 0 };

  constructor(public canvas: HTMLCanvasElement, public camera: Camera) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }

  /**
   * Render one frame of the given mobject roots.
   * `transparent`: when true, clear to transparent instead of filling
   * `background` — used by ThreeDScene to composite this 2D layer OVER an
   * already-drawn WebGL 3D layer beneath it (doc 08 §2.1 hybrid stack).
   */
  render(mobjects: Mobject[], background = '#000000', opts: { transparent?: boolean } = {}): RenderStats {
    const t0 = performance.now();
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (opts.transparent) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const pxW = W / this.dpr;
    const pxH = H / this.dpr;
    const ppu = this.camera.pixelsPerUnit(pxW, pxH);

    const drawList: Mobject[] = [];
    for (const root of mobjects) {
      for (const m of root.family()) {
        if (!m.visible) continue;
        if (m.isGroup) continue;
        if (m instanceof VMobject && m.points.length === 0) continue;
        drawList.push(m);
      }
    }
    drawList.sort((a, b) => a.zIndex - b.zIndex);

    let drawn = 0;
    let culled = 0;
    const frame = this.camera.frame;
    const pad = 1;

    for (const m of drawList) {
      const bb = m.getBoundingBox();
      const outside =
        bb.max[0] < frame.center[0] - frame.width / 2 * pad ||
        bb.min[0] > frame.center[0] + frame.width / 2 * pad ||
        bb.max[1] < frame.center[1] - frame.height / 2 * pad ||
        bb.min[1] > frame.center[1] + frame.height / 2 * pad;
      if (outside) { culled++; continue; }
      if (m instanceof VMobject) this.drawVMobject(m, pxW, pxH, ppu);
      drawn++;
    }

    this.lastStats = { drawn, culled, ms: performance.now() - t0 };
    return this.lastStats;
  }

  drawVMobject(m: VMobject, pxW: number, pxH: number, ppu: number): void {
    const ctx = this.ctx;
    const path = this.buildPath(m, pxW, pxH);
    const style = m.style;
    const scale = m.fixedInFrame ? 1 : ppu / this.camera.pixelsPerUnit(pxW, pxH);

    // background stroke (drawn fat & dark behind, 3b1b style)
    if (style.backgroundStroke && style.backgroundStrokeOpacity > 0 && style.backgroundStrokeWidth > 0 && style.strokeWidth > 0) {
      ctx.save();
      ctx.globalAlpha = style.backgroundStrokeOpacity;
      ctx.strokeStyle = resolveColor(style.backgroundStroke);
      ctx.lineWidth = Math.max(style.strokeWidth, 0.01) * ppu + style.backgroundStrokeWidth * 0.25 * ppu;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(path);
      ctx.restore();
    }

    // fill
    if (style.fill && style.fillOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = style.fillOpacity;
      ctx.fillStyle = resolveColor(style.fill);
      ctx.fill(path, m.closed ? 'nonzero' : 'nonzero');
      ctx.restore();
    }

    // stroke
    if (style.stroke && style.strokeOpacity > 0 && style.strokeWidth > 0) {
      ctx.save();
      ctx.globalAlpha = style.strokeOpacity;
      ctx.strokeStyle = resolveColor(style.stroke);
      ctx.lineWidth = style.strokeWidth * ppu;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(path);
      ctx.restore();
    }
  }

  /** Build Path2D from cubics, world→pixel. */
  buildPath(m: VMobject, pxW: number, pxH: number): Path2D {
    const path = new Path2D();
    const pts = m.points;
    const cam = this.camera;
    const toPx = (p: [number, number, number]): [number, number] =>
      m.fixedInFrame
        ? [
            pxW / 2 + (p[0] - cam.frame.center[0]) * (pxW / cam.frame.width),
            pxH / 2 - (p[1] - cam.frame.center[1]) * (pxH / cam.frame.height),
          ]
        : cam.worldToPixel(p, pxW, pxH);

    let prevEnd: [number, number] | null = null;
    for (let i = 0; i + 3 < pts.length; i += 4) {
      const a = toPx(pts[i]);
      const h1 = toPx(pts[i + 1]);
      const h2 = toPx(pts[i + 2]);
      const b = toPx(pts[i + 3]);
      const gap = prevEnd === null || Math.hypot(a[0] - prevEnd[0], a[1] - prevEnd[1]) > 2;
      if (gap) path.moveTo(a[0], a[1]);
      path.bezierCurveTo(h1[0], h1[1], h2[0], h2[1], b[0], b[1]);
      prevEnd = b;
    }
    if (m.closed && pts.length >= 4) {
      const first = toPx(pts[0]);
      path.closePath();
    }
    return path;
  }
}
