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
export {
  parseSvgPathToCubics, parseTransformAttr, composeAffine, applyAffine, transformCubics, AFFINE_IDENTITY,
} from './math/svg-path';
export type { Affine2D } from './math/svg-path';

// ---- core ----
export { Mobject, AnimationBuilder, buildAnimateProxy } from './core/mobject';
export type { Updater, Snapshot } from './core/mobject';
export { VMobject, VectorizedPoint, CurvesAsSubmobjects } from './core/vmobject';
export { MeshMobject } from './core/mesh-mobject';
export type { MeshStyle } from './core/mesh-mobject';
export { Group, VGroup, VDict } from './core/group';
export { Animation, prepareAnimation, registerTransformFactory } from './core/animation';
export type { AnimOptions } from './core/animation';
export {
  Scene, MovingCameraScene, ThreeDScene, ZoomedScene, VectorScene,
} from './core/scene';
export type { SceneOptions, PlayOptions, ExposedTracker } from './core/scene';
export { Clock } from './core/clock';
export { Timeline } from './core/timeline';
export type { ClipEntry } from './core/timeline';
export { Style, defaultStyle, applyStyleOverrides, lerpStyle, normalizeOptions } from './core/style';
export {
  ValueTracker, ComplexValueTracker, always, fAlways, alwaysRedraw,
} from './core/updater';

// ---- cameras (2D + 3D) ----
export {
  Camera, MovingCamera, FrameMobject, ZoomedCamera, ThreeDCamera, projectPoint3D,
} from './cameras/camera';
export type { Frame } from './cameras/camera';

// ---- renderers ----
export { Canvas2DRenderer } from './renderers/canvas2d';
export type { RenderStats } from './renderers/canvas2d';
export { WebGLRenderer, hasMeshMobjects } from './renderers/webgl';
export type { WebGLRenderStats } from './renderers/webgl';

// ---- geometry (2D) ----
export * from './mobjects/geometry/basic';
export {
  SurroundingRectangle, BackgroundRectangle, Cross, Underline, Checkmark,
} from './mobjects/geometry/shape-matchers';
export {
  Brace, BraceLabel, BraceText, BraceBetweenPoints,
} from './mobjects/geometry/brace';

// ---- 3D: mesh kernel + solids + lighting ----
export {
  sphereMesh, cubeMesh, prismMesh, cylinderMesh, coneMesh, torusMesh,
  parametricSurfaceMesh, tetrahedronMesh, octahedronMesh, icosahedronMesh,
  dodecahedronMesh,
} from './math/mesh';
export type { MeshData } from './math/mesh';
export {
  Sphere, Cube, Prism, Cylinder, Cone, Torus,
  Tetrahedron, Octahedron, Icosahedron, Dodecahedron, polyhedron,
  Dot3D, Line3D, Arrow3D, Surface, functionSurface, SurfaceMesh, TexturedSurface,
} from './mobjects/three-d/solids';
export { Light, defaultLight, AMBIENT_LIGHT_DEFAULT } from './mobjects/three-d/light';
export type { LightKind, LightOptions } from './mobjects/three-d/light';

// ---- graphing ----
export { NumberLine, UnitInterval } from './mobjects/graphing/number-line';
export type { NumberLineOptions } from './mobjects/graphing/number-line';
export {
  CoordinateSystem, Axes, NumberPlane, ComplexPlane, PolarPlane,
} from './mobjects/graphing/coordinate-system';
export type { AxesOptions, NumberPlaneOptions, PolarPlaneOptions } from './mobjects/graphing/coordinate-system';

// ---- text (real vector glyphs) ----
export {
  Text, Paragraph, Title, BulletedList, DecimalNumber, Integer, Variable, Glyph,
} from './mobjects/text/text';
export type { TextOptions } from './mobjects/text/text';
export { loadFont, glyphToCubics, preloadDefaultFonts } from './mobjects/text/font';

// ---- MathTex / Tex (LaTeX -> vector glyphs via mathjax-full SVG output) ----
export { MathTex, Tex, SingleStringMathTex, MathTexPart, preloadMathJax } from './mobjects/text/mathtex';
export type { MathTexOptions } from './mobjects/text/mathtex';

// ---- animations ----
export * from './animations/creation';
export * from './animations/composition';
export * from './animations/transform';
export * from './animations/indication';
export * from './animations/movement';
export * from './animations/changing';

// ---- player + export (doc 08) ----
export { Player } from './player/player';
export type { PlayerOptions, PlayerEvent } from './player/player';
export { LuminaPlayerElement, register as registerScene } from './player/element';
export { exportWebm, downloadWebm } from './export/webm';
export type { WebmExportOptions } from './export/webm';
export { exportGif, downloadGif } from './export/gif';
export type { GifExportOptions } from './export/gif';
export {
  exportPngSequence, downloadPngSequence, screenshot, downloadScreenshot,
} from './export/png';
export type { PngSequenceOptions, PngFrame } from './export/png';

// ---- boolean ops (doc 09 §15 — polygon-clipping based path booleans) ----
export { Union, Intersection, Difference, Exclusion } from './mobjects/boolean/boolean-ops';
export type { BooleanOpOptions } from './mobjects/boolean/boolean-ops';

// ---- graph / digraph (doc 09 §10.2 — core substrate + algorithm layer) ----
export { Graph, DiGraph, registerGraphTextCtor } from './mobjects/graph/graph';
export type {
  VertexId, EdgeKey, LayoutName, GraphOptions, AlgoAnimOptions,
} from './mobjects/graph/graph';
