# 07 — Proposed JavaScript Public API

**Status:** Design. Not implemented. Names can change on user confirmation.  
**Date:** 2026-09-02

Working name: **Lumina**. Import: `import { Scene, Circle, Create } from 'lumina'`.

Design principles:

1. A Manim author should feel at home.
2. JS idioms: `await`, options objects, no `self`.
3. CE and GL names both work (`Create` ≡ `ShowCreation`).
4. Everything that mutates can be animated via `.animate`.
5. Player/embed are first-class, not afterthoughts.

---

## 1. Boot

```js
import {
  Scene, Square, Circle, Create, Transform, FadeOut,
  LEFT, RIGHT, BLUE, YELLOW, smooth,
} from 'lumina';

const scene = new Scene('#stage', {
  width: 1280,
  height: 720,
  background: '#111111',
  frameHeight: 8,          // Manim default
  fps: 60,
  renderer: 'canvas2d',    // 'canvas2d' | 'webgl' | 'auto'
});

await scene.construct(async (s) => {
  const square = new Square({ side: 2, color: BLUE }).shift(LEFT);
  const circle = new Circle({ radius: 1.5, color: YELLOW });
  await s.play(Create(square));
  await s.play(Transform(square, circle), { runTime: 1.5, rateFunc: smooth });
  await s.play(circle.animate.shift(RIGHT).scale(0.5));
  await s.wait(1);
  await s.play(FadeOut(circle));
});
```

`construct(fn)` is optional sugar: you can also `await scene.play(...)` at top level after `new Scene`.

Mount targets: CSS selector, `HTMLElement`, or `{ canvas, overlay }`.

---

## 2. Constants

```js
ORIGIN, UP, DOWN, LEFT, RIGHT, IN, OUT, UL, UR, DL, DR
PI, TAU, DEGREES, DEG
SMALL_BUFF, MED_SMALL_BUFF, MED_LARGE_BUFF, LARGE_BUFF
DEFAULT_STROKE_WIDTH
```

Colors: CE palette as `BLUE, BLUE_A … BLUE_E, TEAL, GREEN, YELLOW, GOLD, RED, MAROON, PURPLE, PINK, ORANGE, WHITE, BLACK, GREY/GRAY, …` plus `colors.gl` for ManimGL names.

Vectors are `[x, y, z]` **or** `vec3(x,y,z)`. All APIs accept both. Arithmetic: `scale(LEFT, 3)` or `LEFT.mul(3)` if we ship a Vector class that is still iterable. **Proposal:** a `Vec3` class with `toArray()`, plus helpers `add, sub, mul, dot, cross, normalize`. Python `3 * LEFT` becomes `LEFT.times(3)` or `mul(LEFT, 3)`.

---

## 3. Scene

```ts
class Scene {
  constructor(mount: string | HTMLElement | Mount, options?: SceneOptions);

  add(...mobs: Mobject[]): this;
  remove(...mobs: Mobject[]): this;
  clear(): this;
  bringToFront(mob): this;
  sendToBack(mob): this;

  play(...anims: Animation | AnimationBuilder | PlayOptions): Promise<void>;
  wait(seconds?: number, opts?: { stopCondition?: () => boolean }): Promise<void>;

  construct(fn: (scene: this) => Promise<void>): Promise<void>;
  section(name: string, type?: string): void;

  camera: Camera;
  time: number;
  pointer: Vec3;          // world coords
  rng: () => number;      // seeded

  expose(name: string, tracker: ValueTracker, ui?: SliderOpts): this;

  addSound(url: string, timeOffset?: number): void;  // phase 3
  destroy(): void;
}
```

**PlayOptions** (last argument if plain object): `{ runTime, rateFunc, lagRatio }`.

**Aliases:** `Scene.prototype.showCreation` not needed; `ShowCreation = Create`.

Subclasses (or factories):

```js
new MovingCameraScene(mount, opts)
new ThreeDScene(mount, opts)
new ZoomedScene(mount, opts)
new VectorScene(mount, opts)
new LinearTransformationScene(mount, opts)
```

Alternatively: `new Scene(mount, { type: 'threeD' | 'movingCamera' | ... })`. **Proposal:** subclasses, like Manim, plus `Scene.threeD(mount, opts)` factories.

### LinearTransformationScene (must-have 3b1b)

```js
const s = new LinearTransformationScene('#c', {
  includeBackgroundPlane: true,
  includeForegroundPlane: true,
  showBasisVectors: true,
});
await s.construct(async (s) => {
  await s.applyMatrix([[1, 1], [0, 1]], { runTime: 3 });
  await s.applyInverse();
  await s.applyComplexFunction(z => z * z);
});
```

Methods: `addVector`, `addUnitSquare`, `applyMatrix`, `applyTransposedMatrix`, `applyInverse`, `applyNonlinearTransformation`, `getGhostPlane`.

---

## 4. Mobject

```ts
class Mobject {
  shift(v): this;
  moveTo(point | Mobject): this;
  nextTo(m, direction, opts?: { buff, alignedEdge }): this;
  alignTo(m, direction): this;
  toEdge(direction, buff?): this;
  toCorner(corner, buff?): this;
  center(): this;

  scale(f, opts?: { aboutPoint, aboutEdge }): this;
  stretch(f, dim): this;
  stretchToFitWidth(w): this;
  stretchToFitHeight(h): this;
  rotate(angle, opts?: { axis, aboutPoint }): this;
  flip(axis?): this;

  setColor(c): this;
  setFill(c, opacity?): this;
  setStroke(c, width?, opacity?): this;
  setOpacity(o): this;
  setShade(opts): this;          // 3D

  getCenter(): Vec3;
  getTop(): Vec3; getBottom(): Vec3; getLeft(): Vec3; getRight(): Vec3;
  getCorner(dir): Vec3;
  getWidth(): number; getHeight(): number; getDepth(): number;
  setWidth(w, stretch?): this; setHeight(h, stretch?): this;
  setX(x): this; setY(y): this; setZ(z): this;

  add(...children): this;
  remove(...children): this;
  arrange(dir, opts?: { buff }): this;
  arrangeInGrid(rows, cols, opts?): this;

  copy(): this;
  saveState(): this;
  restore(): this;
  become(other): this;

  addUpdater(fn: (m, dt?) => void): this;
  removeUpdater(fn): this;
  clearUpdaters(): this;
  alwaysRedraw(factory): this;
  fixInFrame(flag = true): this;

  readonly animate: AnimationBuilder<this>;
}

function always(method, ...args);
function fAlways(method, ...argFns);
function alwaysRedraw(Ctor, ...args);
```

`AnimationBuilder` chains method calls and produces an Animation when passed to `play()`.

```js
await scene.play(
  square.animate.shift(RIGHT).scale(0.5).setColor(RED),
  { runTime: 2, rateFunc: thereAndBack }
);
```

---

## 5. VMobject and groups

```ts
class VMobject extends Mobject { /* points API */ }
class VGroup extends VMobject {
  constructor(...mobs);
}
class VDict extends VGroup {
  constructor(map: Record<string, VMobject>);
  get(key): VMobject;
  addKey(key, mob): this;
}
```

---

## 6. Geometry constructors (options objects + positional sugar)

```js
new Circle({ radius = 1, color, fillOpacity, strokeWidth, arcCenter })
new Circle(1.5)                          // sugar: radius

new Square({ side = 2, color })
new Square(2)

new Rectangle({ width = 4, height = 2, gridXstep, gridYstep, cornerRadius })
new RoundedRectangle({ width, height, cornerRadius })
new Triangle({ radius | side })
new RegularPolygon({ n = 6, radius })
new Star({ n = 5, outerRadius, innerRadius, density })
new Polygon({ vertices: Vec3[] })
new Polygram({ vertexGroups })
new ConvexHull({ points })
new Cutout(main, ...holes)

new Dot({ point = ORIGIN, radius, color })
new LabeledDot({ point, label, radius })
new AnnotationDot({ point })
new Ellipse({ width, height })
new Arc({ radius, startAngle = 0, angle = PI/2, arcCenter })
new ArcBetweenPoints({ start, end, angle | radius })
new Sector({ radius, angle, startAngle })
new Annulus({ innerRadius, outerRadius })
new AnnularSector({ innerRadius, outerRadius, angle, startAngle })
new CubicBezier({ a0, h1, h2, a3 })
new CurvedArrow({ start, end, radius, tip })
new CurvedDoubleArrow({ start, end })

new Line({ start, end, buff = 0, pathArc = 0 })
new Line(start, end)                     // positional
new DashedLine({ start, end, dashLength, dashedRatio })
new Arrow({ start, end, buff, tipLength, strokeWidth, maxTipLengthToLengthRatio })
new Vector({ coords, color })            // from ORIGIN
new DoubleArrow({ start, end })
new Elbow({ angle, width })
new RightAngle(line1, line2, { length, quadrant })
new Angle(line1, line2, { radius, otherAngle, dot, quadrant })
new TangentLine(vmob, alpha, { length })

new SurroundingRectangle(mob, { buff, color, cornerRadius })
new BackgroundRectangle(mob, { color, fillOpacity, buff })
new Cross(mob, { strokeWidth, scale })
new Underline(mob)

new Brace(mob, direction = DOWN, { buff, sharpness })
new BraceLabel(mob, text, direction, { fontSize, color })
new BraceBetweenPoints(a, b, { direction })
new ArcBrace(arc)

// Boolean
Union(a, b, ...more)
Intersection(a, b, ...more)
Difference(subject, clip)
Exclusion(a, b)

// Tips (usually via Arrow options)
tip: 'triangle' | 'triangleFilled' | 'circle' | 'circleFilled'
   | 'square' | 'squareFilled' | 'stealth' | ArrowTip
```

All accept shared style: `color, fillColor, fillOpacity, strokeColor, strokeWidth, strokeOpacity, backgroundStrokeWidth, backgroundStrokeColor, sheen, zIndex, name`.

---

## 7. Text and math

```js
new Text(string, { font, fontSize, color, weight, slant, t2c, t2f, t2w, t2s, lineSpacing })
new Paragraph(string, { ... })
new MarkupText(string)

new MathTex(tex, {
  fontSize, color,
  texToColorMap: { "x": BLUE, "y": YELLOW },
  substringsToIsolate: ["\\theta"],
  template: 'katex' | 'mathjax',
})
new Tex(tex, opts)                 // text mode
new Title(tex, { includeUnderline })
new BulletedList(...items)

new DecimalNumber(value, {
  numDecimalPlaces = 2, includeSign, unit, showEllipsis, fontSize, color,
})
new Integer(value, opts)
new Variable(label, tracker)       // "a = 1.00" bound to tracker

new Code(code, { language, theme, fontSize, lineNumbers })

new SVGMobject(svg, { width, height, color })  // string | url
```

GL aliases: `TexText = Tex`, `OldTex = MathTex`.

---

## 8. Graphing

```js
new NumberLine({ xRange: [min, max, step], length, includeTicks, includeNumbers, includeTip, rotation, color, scaling: 'linear' | 'log' })
new UnitInterval(opts)

new Axes({
  xRange: [-1, 10, 1],
  yRange: [-2, 2, 0.5],
  xLength, yLength,          // or width, height
  axisConfig, xAxisConfig, yAxisConfig,
  tips: true,
})
axes.addCoordinateLabels({ fontSize, numDecimalPlaces })
axes.c2p(x, y) / axes.p2c(point)
axes.plot(f, { xRange, color, useSmoothing, discontinuities, strokeWidth })
axes.plotParametric(fn, tRange, opts)
axes.getGraph(f, opts)            // GL alias of plot
axes.getGraphLabel(graph, tex | Mobject, opts)
axes.i2gp(x, graph)               // input to graph point
axes.getHLine(point) / axes.getVLine(point)
axes.getArea(graph, xRange, { opacity, color, boundedBy })
axes.getRiemannRectangles(graph, xRange, { dx, inputSampleType: 'left'|'right'|'center' })
axes.getTangentLine(x, graph, { length })

new NumberPlane({ xRange, yRange, backgroundLineStyle, fadedLineStyle, xLength, yLength })
plane.applyMatrix(M)              // GL
plane.prepareForNonlinearTransform()
plane.applyComplexFunction(f)
plane.applyFunction(p => [x', y', z'])

new ComplexPlane(opts)
plane.n2p(z) / plane.p2n(point)

new PolarPlane({ radiusMax, size })
new ThreeDAxes({ xRange, yRange, zRange, ... })

new ParametricFunction(fn, { tRange: [0, TAU, 0.01], color, useSmoothing })
new FunctionGraph(f, { xRange, color })
new ImplicitFunction(F, { xRange, yRange })

new ArrowVectorField(fn, { xRange, yRange, deltaX, deltaY, lengthFunc, colorScheme })
new StreamLines(fn, { ... , dt, virtualTime, maxAnchors })
new BarChart({ values, barNames, yRange, barColors })
```

---

## 9. 3D

```js
new Sphere({ radius, resolution: [u, v], color })
new Torus({ r1, r2, resolution })
new Cone({ baseRadius, height, direction })
new Cylinder({ radius, height, direction })
new Cube({ side })
new Prism({ dimensions: [x, y, z] })
new Dot3D({ point, radius })
new Line3D({ start, end, radius })
new Arrow3D({ start, end })
new Surface(func, { uRange, vRange, resolution, checkerboardColors, fillOpacity })
new TexturedSurface(surface, dayUrl, nightUrl?)
new SurfaceMesh(surface, { strokeColor, strokeWidth, opacity })

new Tetrahedron({ edgeLength })
new Octahedron({ edgeLength })
new Icosahedron({ edgeLength })
new Dodecahedron({ edgeLength })
new Polyhedron({ vertexCoords, facesIdx })
new ConvexHull3D({ points })

new Light({ type: 'point'|'directional'|'ambient', color, intensity, position })
```

ThreeDScene:

```js
await scene.setCameraOrientation({ phi, theta, gamma, zoom, frameCenter })
await scene.moveCamera({ phi, theta, runTime })
scene.beginAmbientCameraRotation({ rate, axis: 'theta' })
scene.stopAmbientCameraRotation()
scene.addFixedInFrame(mob)
mob.fixInFrame()
scene.camera.orbit({ enabled: true })
scene.camera.lightSource  // mobject
```

---

## 10. Animations

Factories return `Animation`. `new Create(mob)` also works.

```js
// creation
Create(mob, { lagRatio, runTime })
ShowCreation(mob)                  // alias
Uncreate(mob)
DrawBorderThenFill(mob)
Write(mob, { lagRatio, runTime })
Unwrite(mob)
ShowPartial(mob)
ShowIncreasingSubsets(group)
ShowSubmobjectsOneByOne(group)
SpiralIn(mob)
AddTextLetterByLetter(text)
AddTextWordByWord(text)
TypeWithCursor(text, { cursor })
UntypeWithCursor(text)

// fade / grow
FadeIn(mob, { shift, scale, runTime })
FadeIn(mob, UP)                    // GL positional
FadeOut(mob, { shift, scale })
GrowFromCenter(mob)
GrowFromPoint(mob, point)
GrowFromEdge(mob, edge)
GrowArrow(arrow)
SpinInFromNothing(mob)

// indicate
Indicate(mob, { scaleFactor, color, rateFunc: thereAndBack })
Wiggle(mob)
Circumscribe(mob, { shape: 'rectangle'|'circle', fadeOut, timeWidth, color })
Flash(point, { lineLength, numLines, color, timeWidth })
FocusOn(point)
ApplyWave(mob, { direction, amplitude, timeWidth })
Blink(mob, { blinks })
ShowPassingFlash(mob, { timeWidth })
Broadcast(point, { nRings, focalDistance })

// move / rotate / numbers
MoveAlongPath(mob, path)
Homotopy(fn /* (x,y,z,t) */, mob)
ComplexHomotopy(fn, mob)
PhaseFlow(fn, mob, { runTime })
Rotate(mob, angle, { axis, aboutPoint })
Rotating(mob, { axis, radians })
ChangingDecimal(decimal, fn)
ChangeDecimalToValue(decimal, value)

// transform
Transform(a, b, { pathArc, replaceMobjectWithTargetInScene })
ReplacementTransform(a, b)
TransformFromCopy(a, b)
ClockwiseTransform(a, b)
CounterclockwiseTransform(a, b)
FadeTransform(a, b)
FadeTransformPieces(a, b)
CyclicReplace(...mobs)
Swap(a, b)
MoveToTarget(mob)
ApplyFunction(fn, mob)
ApplyPointwiseFunction(fn, mob)
ApplyMatrix(matrix, mob)
ApplyComplexFunction(fn, mob)
ApplyMethod(mob.shift, RIGHT)      // rarely needed; prefer .animate
FadeToColor(mob, color)
ScaleInPlace(mob, factor)
ShrinkToCenter(mob)
Restore(mob)
TransformMatchingShapes(a, b, { transformMismatches, fadeTransformMismatches })
TransformMatchingTex(a, b, { keyMap, transformMismatches })

// composition
AnimationGroup(...anims, { lagRatio, runTime })
LaggedStart(...anims, { lagRatio = 0.05 })
LaggedStartMap(AnimClass, group, { lagRatio })
Succession(...anims)

// misc
Add(mob)
Wait(runTime)
TracedPath(() => mob.getCenter(), { strokeColor, dissipatingTime })
AnimatedBoundary(mob)
ChangeSpeed(anim, { speedinfo })
UpdateFromFunc(mob, fn)
UpdateFromAlphaFunc(mob, fn)
MaintainPositionRelativeTo(mob, target)
```

---

## 11. Rate functions

Exported names (camelCase JS, plus original snake_case aliases):

```
linear, smooth, smoothstep, smootherstep, smoothererstep,
thereAndBack, thereAndBackWithPause, rushFrom, rushInto,
slowInto, lingering, runningStart, wiggle, exponentialDecay,
doubleSmooth, notQuiteThere, squishRateFunc
easeInSine, easeOutSine, easeInOutSine,  // + quad cubic quart quint expo circ back elastic bounce
```

`rateFunc` accepts a function or a string `"smooth"`.

---

## 12. ValueTracker and live UI

```js
const a = new ValueTracker(1);
const z = new ComplexValueTracker({ re: 1, im: 0 });

await scene.play(a.animate.setValue(3), { runTime: 2 });
a.getValue(); a.setValue(2);

fAlways(label.setValue, () => a.getValue());
// or
label.addUpdater(m => m.setValue(a.getValue()));

scene.expose('amplitude', a, { min: 0, max: 5, step: 0.01, label: 'A' });
```

Exposed trackers become sliders on the player. Dragging a slider seeks *or* (in simulation mode) updates live without moving the timeline — configurable per tracker: `{ bind: 'timeline' | 'live' }`.

---

## 13. Player

```js
import { Player } from 'lumina';

const player = new Player({
  mount: '#lesson',
  scene: constructFn,          // async (scene) => {}
  width: 1280, height: 720,
  controls: true,
  loop: false,
  autoplay: false,
  speed: 1,
  sections: true,
  sliders: true,
});

player.play(); player.pause(); player.seek(12.3); player.setSpeed(0.5);
player.on('ended', () => {});
player.destroy();
```

Web component:

```html
<script type="module" src="https://cdn.example/lumina/player.js"></script>
<lumina-player src="./binomial.js" width="960" height="540" controls></lumina-player>
```

`src` module must `export async function construct(scene)` or `export default construct`.

---

## 14. Config

```js
Lumina.config({
  background: '#000',
  frameHeight: 8,
  fps: 60,
  seed: 1,
  katex: { throwOnError: false, trust: false },
  quality: '1080p',          // 480p 720p 1080p 4k
});
```

---

## 15. Serialization (phase 3)

```js
const json = scene.toJSON();     // mobjects + timeline clips
Scene.fromJSON(json, mount);
```

Not a substitute for `construct()` (functions cannot round-trip). Used for recorded parameter sliders and simple declarative scenes.

---

## 16. Naming policy

| Python | JavaScript |
|---|---|
| `run_time` | `runTime` (also accept `run_time`) |
| `rate_func` | `rateFunc` |
| `lag_ratio` | `lagRatio` |
| `fill_opacity` | `fillOpacity` |
| `x_range` | `xRange` |
| `set_fill` | `setFill` |
| `next_to` | `nextTo` |
| `always_redraw` | `alwaysRedraw` |
| `ShowCreation` | `ShowCreation` and `Create` |

Accept snake_case in options objects for Python muscle memory: `new Circle({ fill_opacity: 0.5 })` normalizes to `fillOpacity`.

---

## 17. Minimal complete example (the acceptance scene)

This scene, once implementation exists, is the v1 gate:

```js
import {
  Scene, Square, Circle, MathTex, Create, Transform, Write,
  FadeIn, BLUE, YELLOW, UP, smooth,
} from 'lumina';

export async function construct(scene) {
  const sq = new Square({ side: 2, color: BLUE });
  const circ = new Circle({ radius: 1.2, color: YELLOW });
  const eq = new MathTex('a^2 + b^2 = c^2');
  eq.nextTo(circ, UP);
  await scene.play(Create(sq));
  await scene.play(Transform(sq, circ), { runTime: 1.5, rateFunc: smooth });
  await scene.play(Write(eq));
  await scene.play(FadeIn(eq.copy().scale(1.2), { shift: UP }));
  await scene.wait(1);
}
```

If that plays in the browser, seeks, embeds, and exports WebM, v1 is real.
