/**
 * Lumina — export/gif.ts
 * GIF export (doc 08 §6.2) via `gifenc` (palette 256, capped resolution —
 * GIF is huge at full size, so `maxWidth` defaults to 480p-equivalent).
 */
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { Scene } from '../core/scene';

export interface GifExportOptions {
  fps?: number;
  /** Cap output width; height scales to preserve aspect (doc 08 §6.2
   *  "Cap resolution 480p default"). Pass `Infinity` to disable capping. */
  maxWidth?: number;
  duration?: number;
  /** ms per frame override; defaults to 1000/fps. */
  delayMs?: number;
  onProgress?: (frac: number) => void;
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

/**
 * Export a Scene's Timeline as an animated GIF Blob. Renders each frame to
 * an offscreen canvas at (possibly downscaled) resolution, quantizes to a
 * 256-color palette per gifenc's recommended flow, and writes a looping
 * GIF89a.
 */
export async function exportGif(scene: Scene, opts: GifExportOptions = {}): Promise<Blob> {
  const srcCanvas = (scene as any).canvas as HTMLCanvasElement | null;
  if (!srcCanvas) throw new Error('exportGif: scene has no mounted canvas — call scene.mount() first.');
  if (typeof document === 'undefined') throw new Error('exportGif: requires a DOM environment.');

  const fps = opts.fps ?? 15; // GIFs don't need 60fps; keep file size sane by default
  const duration = opts.duration ?? scene.timeline.duration;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const delay = opts.delayMs ?? Math.round(1000 / fps);

  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  const maxWidth = opts.maxWidth ?? 854; // ~480p-ish width cap, doc 08 §6.2
  const scale = Math.min(1, maxWidth / srcW);
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const off = document.createElement('canvas');
  off.width = outW;
  off.height = outH;
  const octx = off.getContext('2d')!;

  const gif = GIFEncoder();

  const wasPlaying = (scene as any).playing;
  scene.pausePlayback();

  for (let i = 0; i < totalFrames; i++) {
    const t = (i / (totalFrames - 1 || 1)) * duration;
    scene.renderAt(t);
    await nextPaint();

    octx.clearRect(0, 0, outW, outH);
    octx.drawImage(srcCanvas, 0, 0, outW, outH);
    const { data } = octx.getImageData(0, 0, outW, outH);

    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, outW, outH, { palette, delay, repeat: 0, first: i === 0 });

    opts.onProgress?.((i + 1) / totalFrames);
  }

  gif.finish();
  if (wasPlaying) scene.startPlayback(scene.clock.time);

  return new Blob([gif.bytesView().slice() as BlobPart], { type: 'image/gif' });
}

export async function downloadGif(scene: Scene, filename = 'lumina-export.gif', opts: GifExportOptions = {}): Promise<Blob> {
  const blob = await exportGif(scene, opts);
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
