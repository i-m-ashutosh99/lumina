/**
 * Lumina — export/webm.ts
 * WebM export via `HTMLCanvasElement.captureStream()` + `MediaRecorder`
 * (doc 08 §6.1). Drives the clock OFFLINE (frame-by-frame `renderAt(t)`
 * rather than relying on live rAF), per the doc's explicit caveat: relying
 * on rAF timing to line up with captureStream's frame delivery drops
 * frames on a loaded machine, so we explicitly wait one rAF (a real
 * "paint has happened" signal) after each `renderAt(t)` call before
 * advancing to the next frame.
 */
import type { Scene } from '../core/scene';

export interface WebmExportOptions {
  fps?: number;
  /** 0..1, forwarded to `MediaRecorder`'s `videoBitsPerSecond` heuristic. */
  quality?: number;
  mimeType?: string;
  /** Explicit duration override (defaults to `scene.timeline.duration`). */
  duration?: number;
  onProgress?: (frac: number) => void;
}

/** Wait for one real paint (doc 08 §6.1: "await requestAnimationFrame so
 *  the recorder actually sees the frame"). */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      resolve();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function pickMimeType(preferred?: string): string {
  const candidates = preferred
    ? [preferred]
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return candidates[candidates.length - 1];
}

/**
 * Export a Scene's fully-recorded Timeline as a WebM (or MP4 fallback)
 * Blob. `scene` must already be mounted (has a `.canvas`) and have run
 * `construct()` so `timeline.duration` is known.
 */
export async function exportWebm(scene: Scene, opts: WebmExportOptions = {}): Promise<Blob> {
  const canvas = (scene as any).canvas as HTMLCanvasElement | null;
  if (!canvas) throw new Error('exportWebm: scene has no mounted canvas — call scene.mount() first.');
  if (typeof (canvas as any).captureStream !== 'function') {
    throw new Error('exportWebm: this browser does not support HTMLCanvasElement.captureStream().');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('exportWebm: this browser does not support MediaRecorder.');
  }

  const fps = opts.fps ?? scene.fps ?? 30;
  const duration = opts.duration ?? scene.timeline.duration;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const mimeType = pickMimeType(opts.mimeType);
  const quality = opts.quality ?? 0.9;

  const stream = (canvas as any).captureStream(fps) as MediaStream;
  const bitsPerSecond = Math.round(2_500_000 * Math.max(0.1, Math.min(1, quality)));
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitsPerSecond } as any);

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  const wasPlaying = (scene as any).playing;
  scene.pausePlayback();

  for (let i = 0; i < totalFrames; i++) {
    const t = (i / (totalFrames - 1 || 1)) * duration;
    scene.renderAt(t);
    await nextPaint();
    opts.onProgress?.((i + 1) / totalFrames);
  }
  // Ensure the final frame is exactly the end state.
  scene.renderAt(duration);
  await nextPaint();

  recorder.stop();
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());

  if (wasPlaying) scene.startPlayback(scene.clock.time);

  return new Blob(chunks, { type: mimeType.split(';')[0] });
}

/** Convenience: export + trigger a browser download. No-op outside a DOM. */
export async function downloadWebm(scene: Scene, filename = 'lumina-export.webm', opts: WebmExportOptions = {}): Promise<Blob> {
  const blob = await exportWebm(scene, opts);
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
