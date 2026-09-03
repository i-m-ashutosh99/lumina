/**
 * Minimal type shim for `gifenc` (ships no TypeScript types — doc 08 §6.2
 * dependency). Only the surface Lumina's export/gif.ts uses is declared.
 */
declare module 'gifenc' {
  export interface GifWriteFrameOptions {
    palette?: number[][] | null;
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    first?: boolean;
    dispose?: number;
    colorDepth?: number;
  }

  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: GifWriteFrameOptions
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GifEncoderInstance;
  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: Record<string, any>
  ): number[][];
  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string
  ): Uint8Array;
  export function prequantize(data: Uint8Array, opts?: Record<string, any>): void;
  export function nearestColor(pixel: number[], palette: number[][]): number[];
  export function nearestColorIndex(pixel: number[], palette: number[][]): number;
}
