/**
 * Lumina — constants.ts
 * Manim-compatible direction vectors, buffers, and frame constants.
 */
import { Vec3 } from './vec';

export const PI = Math.PI;
export const TAU = Math.PI * 2;
export const DEGREES = Math.PI / 180;
export const DEG = DEGREES;

export const ORIGIN: Vec3 = [0, 0, 0];
export const UP: Vec3 = [0, 1, 0];
export const DOWN: Vec3 = [0, -1, 0];
export const RIGHT: Vec3 = [1, 0, 0];
export const LEFT: Vec3 = [-1, 0, 0];
export const OUT: Vec3 = [0, 0, 1];
export const IN: Vec3 = [0, 0, -1];
export const UL: Vec3 = [-1, 1, 0];
export const UR: Vec3 = [1, 1, 0];
export const DL: Vec3 = [-1, -1, 0];
export const DR: Vec3 = [1, -1, 0];

export const X_AXIS: Vec3 = [1, 0, 0];
export const Y_AXIS: Vec3 = [0, 1, 0];
export const Z_AXIS: Vec3 = [0, 0, 1];

export const SMALL_BUFF = 0.1;
export const MED_SMALL_BUFF = 0.25;
export const MED_LARGE_BUFF = 0.5;
export const LARGE_BUFF = 1.0;
export const DEFAULT_MOBJECT_TO_MOBJECT_BUFFER = MED_SMALL_BUFF;

export const DEFAULT_STROKE_WIDTH = 4;
export const DEFAULT_POINT_THICKNESS = 0.05;
export const DEFAULT_DOT_RADIUS = 0.08;
export const DEFAULT_FONT_SIZE = 48;

/** Default world frame: 8 units tall, Manim 16:9 ≈ 14.222 wide. */
export const FRAME_HEIGHT = 8;
export const FRAME_WIDTH = FRAME_HEIGHT * (16 / 9);
export const ASPECT = 16 / 9;

/** Quality presets (doc 02 §H). */
export const QUALITY: Record<string, { width: number; height: number }> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};
