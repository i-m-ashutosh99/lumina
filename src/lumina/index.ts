/**
 * Lumina — public barrel.
 * `import { Scene, Circle, Create, Transform } from 'lumina'`
 *
 * This barrel re-exports every implemented module. Anything NOT exported
 * here does not exist yet — see README.md "Implementation status" for the
 * authoritative gap list (MathTex, Axes/graphing, 3D, Player, boolean ops,
 * Graph/DiGraph, domain packs are not implemented yet).
 */

// ---- math kernel ----
export * from './math/vec';
export * from './math/mat';
export * from './math/color';
export * from './math/bezier';
export * from './math/rng';
export * from './math/constants';
export * from './math/rate-functions';

// ---- core ----
export { Mobject, AnimationBuilder, buildAnimateProxy } from './core/mobject';
export type { Updater, Snapshot } from './core/mobject';
export { VMobject, VectorizedPoint, CurvesAsSubmobjects } from './core/vmobject';
export { Group, VGroup, VDict } from './core/group';
export { Animation, prepareAnimation, registerTransformFactory } from './core/animation';
export type { AnimOptions } from './core/animation';
export { Scene, MovingCameraScene } from './core/scene';
export type { SceneOptions, PlayOptions, ExposedTracker } from './core/scene';
export { Clock } from './core/clock';
export { Timeline } from './core/timeline';
export type { ClipEntry } from './core/timeline';
export { Style, defaultStyle, applyStyleOverrides, lerpStyle, normalizeOptions } from './core/style';
export {
  ValueTracker, ComplexValueTracker, always, fAlways, alwaysRedraw,
} from './core/updater';

// ---- cameras ----
export { Camera, MovingCamera, FrameMobject } from './cameras/camera';
export type { Frame } from './cameras/camera';

// ---- renderers ----
export { Canvas2DRenderer } from './renderers/canvas2d';
export type { RenderStats } from './renderers/canvas2d';

// ---- geometry ----
export * from './mobjects/geometry/basic';

// ---- graphing (partial — NumberLine/UnitInterval only; Axes/NumberPlane NOT implemented) ----
export { NumberLine, UnitInterval } from './mobjects/graphing/number-line';
export type { NumberLineOptions } from './mobjects/graphing/number-line';

// ---- text (real vector glyphs; MathTex/KaTeX NOT implemented) ----
export {
  Text, Paragraph, Title, BulletedList, DecimalNumber, Integer, Variable, Glyph,
} from './mobjects/text/text';
export type { TextOptions } from './mobjects/text/text';
export { loadFont, glyphToCubics, preloadDefaultFonts } from './mobjects/text/font';

// ---- animations ----
export * from './animations/creation';
export * from './animations/composition';
export * from './animations/transform';
export * from './animations/indication';
export * from './animations/movement';
export * from './animations/changing';
