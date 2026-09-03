/**
 * Lumina — export/png.ts
 * PNG sequence export (doc 08 §6.3) + last-frame screenshot (doc 08 §6.4).
 */
import type { Scene } from '../core/scene';

export interface PngSequenceOptions {
  fps?: number;
  duration?: number;
  /** Zero-padded digit count in filenames (`frame-000123.png`). */
  padding?: number;
  onProgress?: (frac: number) => void;
}

export interface PngFrame {
  name: string;
  blob: Blob;
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      resolve();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

/**
 * Export a Scene's Timeline as a sequence of PNG blobs, one per frame
 * (doc 08 §6.3: "Teachers drag into Premiere / Resolve"). Composites
 * whatever canvas(es) the scene owns (Canvas2D, or WebGL+Canvas2D for
 * ThreeDScene) into a single flat PNG per frame via an offscreen canvas.
 */
export async function exportPngSequence(scene: Scene, opts: PngSequenceOptions = {}): Promise<PngFrame[]> {
  const canvas = (scene as any).canvas as HTMLCanvasElement | null;
  const glCanvas = (scene as any).glCanvas as HTMLCanvasElement | null;
  if (!canvas) throw new Error('exportPngSequence: scene has no mounted canvas — call scene.mount() first.');
  if (typeof document === 'undefined') throw new Error('exportPngSequence: requires a DOM environment.');

  const fps = opts.fps ?? scene.fps ?? 30;
  const duration = opts.duration ?? scene.timeline.duration;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const pad = opts.padding ?? 6;

  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const octx = off.getContext('2d')!;

  const wasPlaying = (scene as any).playing;
  scene.pausePlayback();

  const frames: PngFrame[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const t = (i / (totalFrames - 1 || 1)) * duration;
    scene.renderAt(t);
    await nextPaint();

    octx.clearRect(0, 0, off.width, off.height);
    if (glCanvas) octx.drawImage(glCanvas, 0, 0, off.width, off.height);
    octx.drawImage(canvas, 0, 0, off.width, off.height);

    const blob = await canvasToBlob(off);
    frames.push({ name: `frame-${String(i).padStart(pad, '0')}.png`, blob });
    opts.onProgress?.((i + 1) / totalFrames);
  }

  if (wasPlaying) scene.startPlayback(scene.clock.time);
  return frames;
}

/** Last-frame screenshot (doc 08 §6.4, real ManimGL `-s` analogue). */
export async function screenshot(scene: Scene, opts: { t?: number } = {}): Promise<Blob> {
  const canvas = (scene as any).canvas as HTMLCanvasElement | null;
  const glCanvas = (scene as any).glCanvas as HTMLCanvasElement | null;
  if (!canvas) throw new Error('screenshot: scene has no mounted canvas — call scene.mount() first.');
  const t = opts.t ?? scene.clock.time;
  scene.renderAt(t);
  await nextPaint();

  if (!glCanvas) return canvasToBlob(canvas);

  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const octx = off.getContext('2d')!;
  octx.drawImage(glCanvas, 0, 0, off.width, off.height);
  octx.drawImage(canvas, 0, 0, off.width, off.height);
  return canvasToBlob(off);
}

/** Download all frames as individual files (no zip dependency — doc 08
 *  §6.3 marks zip as "optional"; authors needing a single archive can zip
 *  client-side with their own library). */
export async function downloadPngSequence(scene: Scene, opts: PngSequenceOptions = {}): Promise<PngFrame[]> {
  const frames = await exportPngSequence(scene, opts);
  if (typeof document !== 'undefined') {
    for (const f of frames) {
      const url = URL.createObjectURL(f.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
  return frames;
}

export async function downloadScreenshot(scene: Scene, filename = 'lumina-frame.png', opts: { t?: number } = {}): Promise<Blob> {
  const blob = await screenshot(scene, opts);
  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return blob;
}
