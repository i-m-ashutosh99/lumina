# 02 — Manim Python Complete API Inventory

**Sources:** Manim Community v0.21.0 (`docs.manim.community`), ManimCE GitHub (`ManimCommunity/manim`), ManimGL docs (`3b1b.github.io/manim`) and official `example_scenes.py`.  
**Date:** 2026-09-02  
**Purpose:** This is the source-of-truth checklist of what “complete Manim” means. Lumina must eventually cover every item here (or document a deliberate omission).

---

## A. Shared conceptual model

### A.1 The triad

| Concept | Role | Key verbs |
|---|---|---|
| **Mobject** | Thing that can be displayed. Has `points`, `submobjects`, color, fill, stroke, updaters. | `add`, `remove`, `shift`, `move_to`, `next_to`, `align_to`, `scale`, `rotate`, `flip`, `stretch`, `set_color`, `set_fill`, `set_stroke`, `set_opacity`, `copy`, `save_state`, `restore` |
| **Animation** | Interpolates a mobject over α ∈ [0,1] through a rate function. | `begin`, `interpolate`, `interpolate_mobject(alpha)`, `finish`, `clean_up_from_scene` |
| **Scene** | Owns mobjects, camera, clock, file writer. User script lives in `construct()`. | `add`, `remove`, `play`, `wait`, `clear`, `add_sound`, `next_section` |

### A.2 VMobject (the heart of morphing)

A **vectorized mobject** stores cubic Bézier curves as a flat point array (Cairo: 4 points per cubic; OpenGL: quadratic). `Transform(mob_a, mob_b)` aligns point counts (padding / resampling) and lerps each point.

Implications for JS:

- Every 2D shape must be a Bézier point buffer, not a Canvas `arc()` call that cannot morph.
- Point **order and winding** must be stable or Transform looks like a scribble.
- `align_points`, `insert_n_curves`, `make_smooth`, `set_points_as_corners`, `pointwise_become_partial` (used by `Create` / `Uncreate` / `ShowPartial`) are required primitives.

ManimCE types module (`manim.mobject.types`):

| Class | Role |
|---|---|
| `VMobject` | Vectorized mobject (Bézier) |
| `VGroup` | Group of VMobjects |
| `VDict` | VGroup with key access |
| `DashedVMobject` | Dashed version of a VMobject |
| `CurvesAsSubmobjects` | Each cubic as its own submobject |
| `VectorizedPoint` | Degenerate VMobject (a point) |
| Image mobjects (`image_mobject.py`) | Raster images (`ImageMobject`, `ImageMobjectFromCamera`) |
| Point cloud (`point_cloud_mobject.py`) | `PMobject`, `Mobject1D`, `Mobject2D`, `PGroup`, `PointCloudDot`, `Point` |

### A.3 Coordinate system and constants

Origin = **center of frame**. ManimCE default frame: 8 units tall (`FRAME_HEIGHT = 8`), width = 8 × aspect (14.22… at 16:9).

**Direction vectors** (3D):

```
ORIGIN = [0, 0, 0]
UP = [0, 1, 0]     DOWN = [0, -1, 0]
RIGHT = [1, 0, 0]  LEFT = [-1, 0, 0]
OUT = [0, 0, 1]    IN = [0, 0, -1]
UL, UR, DL, DR     (diagonals)
```

**Angles:** `PI`, `TAU` (= 2π), `DEGREES` (π/180). ManimGL also uses `DEG`.

**Buff defaults:** `SMALL_BUFF`, `MED_SMALL_BUFF`, `MED_LARGE_BUFF`, `LARGE_BUFF`, `DEFAULT_MOBJECT_TO_MOBJECT_BUFFER`.

**Stroke / fill:** `DEFAULT_STROKE_WIDTH`. Line join / cap. Background stroke (draw a fat dark stroke behind for contrast on busy backgrounds — 3b1b signature).

**Colors (ManimCE palette, must ship as named constants):**

`BLUE`, `BLUE_A`…`BLUE_E`, `TEAL`, `TEAL_A`…`E`, `GREEN`, `GREEN_A`…`E`, `YELLOW`, `YELLOW_A`…`E`, `GOLD`, `GOLD_A`…`E`, `RED`, `RED_A`…`E`, `MAROON`, `MAROON_A`…`E`, `PURPLE`, `PURPLE_A`…`E`, `PINK`, `ORANGE`, `LIGHT_BROWN`, `DARK_BROWN`, `WHITE`, `BLACK`, `GRAY`/`GREY` (+ `GRAY_A`…`E`), `DARKER_GRAY`, `LIGHT_GRAY`, `LOGO_GREEN/BLUE/RED/BLACK`, `PURE_RED/GREEN/BLUE`.

ManimGL adds `BLUE_E` style earth tones used in 3b1b videos (`GREY_A`, etc.). Lumina should ship **both palettes** under `colors.ce` and `colors.gl`, with `BLUE` defaulting to CE.

### A.4 Placement API (must be complete)

On every Mobject:

| Method | Meaning |
|---|---|
| `shift(vec)` | Add vector |
| `move_to(point \| mobject)` | Center onto |
| `next_to(mobject, direction, buff, aligned_edge)` | Park beside |
| `align_to(mobject, direction)` | Align one edge |
| `to_edge(direction, buff)` | Stick to frame edge |
| `to_corner(corner, buff)` | Stick to frame corner |
| `center()` | Move to ORIGIN |
| `scale(factor, about_point)` | Uniform scale |
| `stretch(factor, dim)` | Scale one axis |
| `stretch_to_fit_width/height/depth` | Fit size |
| `rotate(angle, axis, about_point)` | Rotate |
| `flip(axis)` | Mirror |
| `put_start_and_end_on(start, end)` | For lines |
| `set_x / set_y / set_z` | Set one coordinate of center |
| `get_center, get_top, get_bottom, get_left, get_right, get_zenith, get_nadir` | Anchors |
| `get_corner(direction)` | Corner point |
| `get_midpoint`, `get_start`, `get_end` | Path anchors |
| `get_width / height / depth` | Bounding box |
| `set_width / set_height / set_depth` | Resize preserving or stretching |
| `arrange(direction, buff)` | Layout children |
| `arrange_in_grid(rows, cols)` | Grid layout |
| `become(mobject)` | Snap points/style to another |
| `align_points(mobject)` | Match point structure for Transform |
| `save_state()` / `restore()` | Checkpoint |
| `copy()` / `deepcopy` | Duplicate |
| `generate_target()` + `MoveToTarget` | Old-style animation target |
| `.animate` | Proxy that records method calls as an Animation |

### A.5 Updaters and trackers

| API | Edition | Meaning |
|---|---|---|
| `mob.add_updater(fn)` | both | `fn(mob)` or `fn(mob, dt)` every frame |
| `mob.remove_updater(fn)` / `clear_updaters()` | both | |
| `always_redraw(Constructor, *args)` | both (GL emphasized) | Rebuild mobject every frame |
| `always(method, *args)` | **GL** | Call `method(*args)` every frame |
| `f_always(method, *arg_fns)` | **GL** | Args are functions re-evaluated every frame |
| `ValueTracker(x)` | both | Hidden mobject storing a float; `get_value` / `set_value` / `.animate.set_value` |
| `ComplexValueTracker(z)` | CE | Complex analogue |
| `override_animate` | CE | Customize how `.animate` builds the animation |

Lumina must implement GL’s `always` / `f_always` as they are how 3b1b scenes stay “live”.

---

## B. ManimCE animations (complete class list, v0.21.0)

### B.1 `manim.animation.animation`

| Class / fn | Role |
|---|---|
| `Animation` | Base. Params: `mobject`, `run_time=1`, `rate_func=smooth`, `lag_ratio=0`, `remover=False`, `introducer=False`, `name` |
| `Add` | Instantly add (zero-duration introducer) |
| `Wait` | Hold. Params: `run_time`, `stop_condition`, `frozen_frame` |
| `override_animation()` | Decorator: mobject method → default Animation class |
| `prepare_animation()` | Coerce `_AnimationBuilder` (`.animate`) into Animation |

**Animation constructor parameters every subclass inherits (must exist in JS):**

```
run_time: number = 1
rate_func: (t: number) => number = smooth
lag_ratio: number = 0          // stagger submobjects
remover: boolean = false       // remove mobject at end
introducer: boolean = false    // add mobject at start
suspend_mobject_updating: boolean
```

### B.2 `changing`

| Class | Role |
|---|---|
| `AnimatedBoundary` | Cycling stroke around a mobject |
| `TracedPath` | Trail of a point as it moves (`traced_point_func`, `stroke_width`, `stroke_color`, dissipating) |

### B.3 `composition`

| Class | Role | Key params |
|---|---|---|
| `AnimationGroup` | Play many at once | `group`, `lag_ratio`, `run_time` |
| `LaggedStart` | Group with default lag | `lag_ratio=0.05` |
| `LaggedStartMap` | Map an Animation class over submobjects | `AnimationClass`, `mobject`, `arg_creator` |
| `Succession` | Play one after another | each waits for previous |

### B.4 `creation`

| Class | Role |
|---|---|
| `Create` | Draw stroke by `pointwise_become_partial` (GL name: `ShowCreation`) |
| `Uncreate` | Reverse of Create |
| `DrawBorderThenFill` | Stroke then fill |
| `Write` | DrawBorderThenFill specialized for text, with lag on submobjects |
| `Unwrite` | Reverse Write |
| `ShowPartial` | Base for Create-like (show a subpath) |
| `ShowIncreasingSubsets` | Add submobjects one after another (growing subset) |
| `ShowSubmobjectsOneByOne` | Show one child at a time |
| `SpiralIn` | Spiral into place |
| `AddTextLetterByLetter` | Type text per glyph |
| `AddTextWordByWord` | Type text per word |
| `RemoveTextLetterByLetter` | Untype |
| `TypeWithCursor` | Typewriter + cursor mobject |
| `UntypeWithCursor` | Reverse typewriter |

**Create params of note:** `lag_ratio`, `introducer=True`, `use_override`. Reverse via `Uncreate` or `rate_func=lambda t: 1-t`.

### B.5 `fading`

| Class | Role | Extra params |
|---|---|---|
| `FadeIn` | Opacity 0→1, optional shift/scale | `shift`, `scale`, `target_position` |
| `FadeOut` | Opacity 1→0, remover | same |

ManimGL `FadeIn(mob, UP)` uses the second positional as **direction of arrival**. Lumina should accept both `FadeIn(mob, { shift: UP })` and GL-style `FadeIn(mob, UP)`.

### B.6 `growing`

| Class | Role |
|---|---|
| `GrowFromCenter` | Scale 0→1 about center |
| `GrowFromPoint` | Scale about a point |
| `GrowFromEdge` | Scale about an edge |
| `GrowArrow` | Arrow grows from tail |
| `SpinInFromNothing` | GrowFromCenter + rotate |

### B.7 `indication`

| Class | Role |
|---|---|
| `Indicate` | Scale up + color flash, there_and_back |
| `Wiggle` | Rotation wiggle |
| `Circumscribe` | Surrounding rectangle/circle draws around target |
| `Flash` | Radial lines burst |
| `FocusOn` | Dot shrinks onto a point (attention) |
| `ApplyWave` | Spatial wave distortion |
| `Blink` | Opacity flicker |
| `ShowPassingFlash` | A window of the stroke races along the path |
| `ShowPassingFlashWithThinningStrokeWidth` | Same, stroke thins |
| `Broadcast` (also under specialized) | Ripple circles from a point |

### B.8 `movement`

| Class | Role |
|---|---|
| `MoveAlongPath` | Follow a VMobject path |
| `Homotopy` | `(x,y,z,t) → (x',y',z')` time-varying deformation |
| `SmoothedVectorizedHomotopy` | Homotopy respecting Bézier smoothness |
| `ComplexHomotopy` | Homotopy in ℂ |
| `PhaseFlow` | Flow along a vector field function |

### B.9 `numbers`

| Class | Role |
|---|---|
| `ChangingDecimal` | DecimalNumber follows a function of time |
| `ChangeDecimalToValue` | Animate DecimalNumber to a target |

### B.10 `rotation`

| Class | Role |
|---|---|
| `Rotate` | Finite rotation (Animation) |
| `Rotating` | Continuous rotation (often updater-like over run_time) |

### B.11 `specialized`

| Class | Role |
|---|---|
| `Broadcast` | Expanding concentric rings |

### B.12 `speedmodifier`

| Class | Role |
|---|---|
| `ChangeSpeed` | Remap α through a speed curve / piecewise times |

### B.13 `transform` (the 3b1b signature)

| Class | Role |
|---|---|
| `Transform` | Lerp points + style of mob A into mob B. A **becomes** B in-place. |
| `ReplacementTransform` | Transform then replace A with B in the scene |
| `TransformFromCopy` | Transform a copy of A into B (A stays) |
| `ClockwiseTransform` / `CounterclockwiseTransform` | Transform along an arc path |
| `FadeTransform` | Fade A out / B in while moving (when point counts mismatch badly) |
| `FadeTransformPieces` | FadeTransform per matching piece |
| `CyclicReplace` | Cycle positions of several mobjects |
| `Swap` | CyclicReplace of two |
| `MoveToTarget` | Animate toward `mob.target` |
| `ApplyFunction` | Apply `R^3 → R^3` to points |
| `ApplyPointwiseFunction` | Same, pointwise |
| `ApplyPointwiseFunctionToCenter` | Move by function of center only |
| `ApplyMatrix` | 2×2 or 3×3 matrix on points (linear transforms — *the* 3b1b move) |
| `ApplyComplexFunction` | Interpret xy as complex, apply `f: ℂ → ℂ` |
| `ApplyMethod` | Animate a method call |
| `FadeToColor` | Color lerp |
| `ScaleInPlace` | Scale animation |
| `ShrinkToCenter` | Scale to 0 about center |
| `Restore` | Animate back to `save_state()` |
| `TransformAnimations` | (legacy / interpolate between two animations) |

### B.14 `transform_matching_parts`

| Class | Role |
|---|---|
| `TransformMatchingAbstractBase` | Match submobjects by a key function |
| `TransformMatchingShapes` | Match by shape hash |
| `TransformMatchingTex` | Match TeX submobjects by tex string (formula morph!) |

`TransformMatchingTex` is **non-negotiable** for formula-to-formula pedagogy.

### B.15 `updaters` (animation package)

Animations/utilities that install updaters for the duration of the animation (e.g. `UpdateFromFunc`, `UpdateFromAlphaFunc`, `MaintainPositionRelativeTo` — historically in this area; CE also documents updater helpers next to mobject). Lumina should include:

| Name | Role |
|---|---|
| `UpdateFromFunc` | Call `fn(mob)` each frame during the anim |
| `UpdateFromAlphaFunc` | Call `fn(mob, alpha)` |
| `MaintainPositionRelativeTo` | Keep offset to another mobject |

---

## C. ManimCE mobjects (complete module inventory)

### C.1 Frame

| Class | Role |
|---|---|
| `ScreenRectangle` | Rectangle matching the frame aspect |
| `FullScreenRectangle` | Full frame |

### C.2 Geometry — arc

| Class | Role |
|---|---|
| `TipableVMobject` | Shared tip API for Arc/Line |
| `Arc` | Circular arc (`radius`, `start_angle`, `angle`, `arc_center`) |
| `ArcBetweenPoints` | Arc spanning two points |
| `TangentialArc` | Arc tangent to two intersecting lines |
| `Circle` | Full arc. `radius`, `color`. Methods: `surround`, `point_at_angle`, `from_three_points` |
| `Dot` | Tiny filled circle |
| `AnnotationDot` | Larger annotating dot |
| `LabeledDot` | Dot with a label in the center |
| `Ellipse` | `width`, `height` |
| `AnnularSector` | Sector of an annulus |
| `Annulus` | Ring (two radii) |
| `Sector` | Pie slice |
| `CubicBezier` | Explicit cubic |
| `ArcPolygon` / `ArcPolygonFromArcs` | Polygon with arc edges |
| `CurvedArrow` / `CurvedDoubleArrow` | Arc + tip(s) |

### C.3 Geometry — line

| Class | Role |
|---|---|
| `Line` | Segment (`start`, `end`, `buff`, `path_arc`) |
| `DashedLine` | Dashed |
| `Arrow` | Line + tip (`buff`, `max_tip_length_to_length_ratio`, `max_stroke_width_to_length_ratio`) |
| `Vector` | Arrow from ORIGIN (or a point) representing a vector |
| `DoubleArrow` | Tips both ends |
| `Elbow` | Right-angle L |
| `RightAngle` | Elbow marking a right angle between two lines |
| `Angle` | Arc/elbow marking the angle of two lines (`radius`, `quadrant`, `other_angle`, `dot`) |
| `TangentLine` | Tangent to a VMobject at α |

### C.4 Geometry — polygram

| Class | Role |
|---|---|
| `Polygram` | Generalized polygon (possibly disconnected edge sets) |
| `Polygon` | Closed vertex loop |
| `RegularPolygram` | Regular star polygon (e.g. pentagram) |
| `RegularPolygon` | Regular n-gon |
| `Star` | Star without intersecting interior lines |
| `Triangle` | Equilateral |
| `Rectangle` | `width`, `height`, `grid_xstep`, `grid_ystep` |
| `Square` | `side_length` |
| `RoundedRectangle` | `corner_radius` |
| `Cutout` | Shape with holes |
| `ConvexHull` | Convex hull of points |

### C.5 Geometry — boolean ops (from source `__all__`)

| Class | Role |
|---|---|
| `Union` | Region of ≥2 VMobjects |
| `Intersection` | Common region |
| `Difference` | subject minus clip |
| `Exclusion` | XOR |

CE implements these via **skia-pathops**. In the browser: use a JS boolean-path library (e.g. paper.js boolean, or port pathops/WASM, or implement Weiler–Atherton / Greiner–Hormann on Béziers). This is a hard piece — schedule it, do not skip it.

### C.6 Geometry — labeled

Labeled variants of lines (label along length). Include `LabeledLine`, `LabeledArrow` (CE). Lumina: `LabeledLine({ start, end, label })`.

### C.7 Geometry — shape matchers

Standard CE classes (from community knowledge + module purpose “mark and annotate”):

| Class | Role |
|---|---|
| `SurroundingRectangle` | Rectangle around a mobject (`buff`, `color`, `corner_radius`) |
| `BackgroundRectangle` | SurroundingRectangle used as a backdrop (often black, opacity) |
| `Cross` | Cross mark over a mobject |
| `Underline` | Line under a mobject |

### C.8 Geometry — tips

| Class | Role |
|---|---|
| `ArrowTip` | Base |
| `ArrowTriangleTip` / `ArrowTriangleFilledTip` | Default |
| `ArrowCircleTip` / `ArrowCircleFilledTip` | |
| `ArrowSquareTip` / `ArrowSquareFilledTip` | |
| `StealthTip` | Kite / stealth-fighter |

### C.9 Graph theory (`manim.mobject.graph`)

| Class | Role |
|---|---|
| `GenericGraph` | Base |
| `Graph` | Undirected, NetworkX-backed in CE |
| `DiGraph` | Directed |
| `NxGraph` | Type alias / NetworkX interop |
| `LayoutFunction` | Layout strategy type |

Layouts CE supports: `spring`, `circular`, `kamada_kawai`, `planar`, `random`, `shell`, `spiral`, `spectral`, `tree`, plus custom `{ vertex: [x,y,z] }`.

**JS note:** do not take a hard NetworkX dependency. Implement layouts ourselves (or optional plugin). Vertices and edges must be mobjects so they can `Create` / `Indicate` / recolor.

### C.10 Graphing / coordinates (`manim.mobject.graphing`)

**coordinate_systems:**

| Class | Role |
|---|---|
| `CoordinateSystem` | ABC. `c2p` / `p2c`, `get_graph`, `i2gp`, `get_h_line`, `get_v_line`, `get_T_label`, `get_riemann_rectangles`, `plot`, `plot_parametric_curve`, `plot_implicit_curve`, `get_area`, `get_tangent_line`, `get_horizontal_line`, `get_vertical_line` |
| `Axes` | 2D axes. `x_range`, `y_range`, `x_length`, `y_length`, `axis_config`, `tips`, `numbers` |
| `ThreeDAxes` | 3D |
| `NumberPlane` | Cartesian grid + axes |
| `PolarPlane` | Polar grid |
| `ComplexPlane` | NumberPlane for ℂ, `n2p` / `p2n` |

**functions:**

| Class | Role |
|---|---|
| `ParametricFunction` | `function(t) → R^3`, `t_range` |
| `FunctionGraph` | y = f(x) as ParametricFunction |
| `ImplicitFunction` | F(x,y)=0 contour (CE) |

**number_line:**

| Class | Role |
|---|---|
| `NumberLine` | 1D axis. `x_range`, `length`, `include_ticks`, `include_numbers`, `include_tip`, `scaling` |
| `UnitInterval` | NumberLine [0,1] |

**probability:**

| Class | Role |
|---|---|
| `BarChart` | Categorical bars |
| `SampleSpace` | Probability sample-space rectangle |
| Sample-space partitions / braces (CE probability helpers) | |

**scale:**

Linear, Log, custom `LinearBase` / `LogBase` scalings for axes.

ManimGL extras on axes (must support): `add_coordinate_labels`, `get_graph`, `get_graph_label`, `i2gp` (input-to-graph-point), `get_h_line` / `get_v_line`, `coords_to_point` = `c2p`, `point_to_coords` = `p2c`.

### C.11 Logo

`ManimBanner` — CE logo animation. Lumina may ship its own banner, not Manim’s trademarked logo.

### C.12 Matrix

| Class | Role |
|---|---|
| `Matrix` | 2D array of mobjects / TeX |
| `DecimalMatrix` | DecimalNumber entries |
| `IntegerMatrix` | Integer entries (GL `OpeningManimExample` uses this) |
| `MobjectMatrix` | Arbitrary mobject entries |
| `get_det_text()` | “det” annotation |
| `matrix_to_mobject()` / `matrix_to_tex_string()` | Helpers |

Brackets: `LEFT_BRACKET` / `RIGHT_BRACKET` as SVG/TeX. Elisions (`…`) for large matrices.

### C.13 Table

| Class | Role |
|---|---|
| `Table` | Grid of entries + lines |
| `MathTable` | MathTex cells |
| `MobjectTable` | Mobject cells |
| `IntegerTable` / `DecimalTable` | Numeric |

### C.14 SVG / braces

| Class | Role |
|---|---|
| `SVGMobject` | Import SVG as VMobjects |
| `VMobjectFromSVGPath` | Path string |
| `Brace` | Curly brace adjacent to a mobject (`direction`, `buff`) |
| `BraceLabel` | Brace + MathTex/Tex label |
| `BraceText` | Brace + Text label |
| `BraceBetweenPoints` | Brace spanning two points |
| `ArcBrace` | Brace along an Arc |

### C.15 Text

| Module | Classes | Engine in Python | Engine in Lumina |
|---|---|---|---|
| `text_mobject` | `Text`, `Paragraph`, `MarkupText` | Pango | Canvas/SVG text + opentype.js outlines |
| `tex_mobject` | `SingleStringMathTex`, `MathTex`, `MathTexPart`, `Tex`, `BulletedList`, `Title` | Local LaTeX → dvi → SVG | **KaTeX → SVG/HTML**, optional MathJax |
| `numbers` | `DecimalNumber`, `Integer`, `Variable` | Text glyphs | same |
| `code_mobject` | `Code` | Pygments | highlight.js / Prism → Text runs |
| `typst_mobject` | Typst mobjects | Typst CLI | Optional later WASM; **not v1** |

`MathTex` substring coloring (`tex_to_color_map`, `substrings_to_isolate`) is required for TransformMatchingTex.

### C.16 Three-D (`manim.mobject.three_d`)

From `three_dimensions.py` and `polyhedra.py`:

| Class | Role |
|---|---|
| `ThreeDVMobject` | 3D VMobject base |
| `Surface` | Parametric surface `func(u,v)`, checkerboard, resolution |
| `Sphere` | |
| `Torus` | `r1`, `r2` |
| `Cone` | height, base radius |
| `Cylinder` | height, radius, direction |
| `Cube` | |
| `Prism` | Rectangular cuboid |
| `Arrow3D` | Cylinder + cone tip |
| `Line3D` | Cylindrical line |
| `Dot3D` | Spherical dot |
| `Polyhedron` | Vertices + faces |
| `Tetrahedron` `Octahedron` `Icosahedron` `Dodecahedron` | Platonic (Cube is in three_dimensions) |
| `ConvexHull3D` | 3D convex hull |

ManimGL extras (from SurfaceExample): `TexturedSurface` (day/night textures), `SurfaceMesh` (wire overlay), `fix_in_frame()` (HUD that ignores camera), camera `set_euler_angles(theta, phi, gamma)`, `increment_theta/phi`, `light_source` as a mobject.

### C.17 Value trackers

`ValueTracker`, `ComplexValueTracker` — already covered.

### C.18 Vector fields

| Class | Role |
|---|---|
| `VectorField` | Base; color by magnitude, opacity, `func: R^2/R^3 → R^2/R^3` |
| `ArrowVectorField` | Grid of Arrows |
| `StreamLines` | Animated particles along the field |

---

## D. Cameras and scenes (ManimCE)

### D.1 Cameras

| Class | Role |
|---|---|
| `Camera` | Frame, pixel array, background, display of mobjects |
| `BackgroundColoredVMobjectDisplayer` | Helper for bg-colored VMobjects |
| `MovingCamera` | Camera that *is* a mobject (`frame` can pan/zoom) |
| `MultiCamera` | Several cameras / image mobjects |
| `MappingCamera` | Apply a mapping to captured points |
| `OldMultiCamera` | Legacy |
| `SplitScreenCamera` | Side-by-side |
| `ThreeDCamera` | φ, θ, γ, focal distance, light source, 3D projection |

### D.2 Scenes

| Class | Role |
|---|---|
| `Scene` | Base. `construct`, `play`, `wait`, `add`, `remove`, `clear`, `add_sound`, `next_section`, interactive rerun handlers |
| `MovingCameraScene` | Uses MovingCamera |
| `ZoomedScene` | Inset zoom window (3b1b “magnifying glass”) |
| `ThreeDScene` | 3D camera, `set_camera_orientation`, `begin_ambient_camera_rotation`, `move_camera`, `add_fixed_in_frame_mobjects`, `add_fixed_orientation_mobjects` |
| `SpecialThreeDScene` | Defaults for nicer 3D (shading, resolution) |
| `VectorScene` | Number plane + vector helpers (`add_axes`, `add_vector`, `coords_to_vector`) |
| `LinearTransformationScene` | **The 3b1b linear algebra scene.** Number plane, apply matrix, ghost original grid, transposing, `apply_transposed_matrix`, `apply_inverse`, `apply_nonlinear_transformation` |
| `Section` / `DefaultSectionType` | Chapter markers for the presenter / video skip |

`SceneFileWriter` + FFmpeg is Python-only. Lumina replaces this with the browser exporter (doc 08).

---

## E. Rate functions (ManimCE complete)

**Exported / commonly used:**

`linear`, `smooth` (inflection=10), `smoothstep`, `smootherstep`, `smoothererstep`, `there_and_back`, `there_and_back_with_pause`, `rush_from`, `rush_into`, `slow_into`, `lingering`, `running_start`, `wiggle`, `exponential_decay`, `double_smooth`, `not_quite_there(func, proportion)`, `squish_rate_func(func, a, b)`, `unit_interval`, `zero`.

**easing.net family (not all exported at top level in CE — accessed as `rate_functions.ease_in_sine` etc.):**

For each of `{sine, quad, cubic, quart, quint, expo, circ, back, elastic, bounce}`: `ease_in_*`, `ease_out_*`, `ease_in_out_*`.

Lumina: export **all** at top level. Accept string names `"smooth"` as well as functions.

---

## F. ManimGL-only features Lumina must map

| GL API | CE equivalent / notes | Lumina |
|---|---|---|
| `from manimlib import *` | `from manim import *` | `import { ... } from 'lumina'` |
| `ShowCreation` | `Create` | both names |
| `FadeIn(mob, UP)` positional | kwargs `shift=` | both |
| `self.embed()` | (none) | **Live playground REPL** (browser console + in-page) |
| `always` / `f_always` / `always_redraw` | updater APIs | first-class |
| `self.play(mob.method, arg)` old syntax | `.animate` | `.animate` primary; old syntax optional |
| `fix_in_frame()` | `add_fixed_in_frame_mobjects` | `mob.fixInFrame()` |
| `TexturedSurface`, `SurfaceMesh` | weaker | ship |
| `camera.frame.set_euler_angles` | `set_camera_orientation` | both |
| `camera.light_source` as mobject | ThreeDCamera light | ship |
| `NumberPlane.apply_matrix` | `ApplyMatrix` / LinearTransformationScene | ship on CoordinateSystem |
| `ComplexPlane.apply_complex_function` | `ApplyComplexFunction` | ship |
| `prepare_for_nonlinear_transform` | CE has similar internals | ship — subdivides curves before nonlinear maps |
| `IntegerMatrix` | CE has it too | ship |
| `OldTex` / `TexText` | `MathTex` / `Tex` | aliases |
| `touch()` interactive camera | — | orbit controls + keyboard |
| `always(circle.move_to, self.mouse_point)` | — | pointer as a tracker |
| CLI `-n` skip to nth animation | — | player `seekToBeat(n)` |
| `custom_config.yml` | `manim.cfg` | `Lumina.config({...})` |
| Pi creatures | copyrighted | **omit**; optional generic character slot |

3b1b video repo (`3b1b/videos`) is the corpus of *real* explainer patterns: repeating NumberPlane + ApplyMatrix, TransformMatchingTex on equations, always_redraw braces, ValueTracker-driven dots on graphs, voiced wait times. Lumina demos should recreate the **patterns**, never the copyrighted scripts/assets.

---

## G. Scene.play contract (both editions)

```python
self.play(
    Create(square),
    FadeIn(text, shift=UP),
    square.animate.shift(RIGHT),
    run_time=2,          # default for all in this call
    rate_func=smooth,    # default
    lag_ratio=0,         # across the play() args
)
self.wait(1)
```

Semantics:

1. All animations in one `play()` start together (unless Succession).
2. `run_time` on `play()` overrides per-anim unless the anim set its own.
3. Updaters run during play and wait.
4. `wait(n)` is a Wait animation of n seconds (dt still flows → updaters keep living).
5. After play, introducers are in the scene; removers are gone.
6. Transform mutates the first mobject’s data to match the target.

JS equivalent (proposed, see 07):

```js
await scene.play(Create(square), FadeIn(text, { shift: UP }), square.animate.shift(RIGHT), { runTime: 2 });
await scene.wait(1);
```

---

## H. Config / quality (CE)

| Flag / key | Meaning |
|---|---|
| pixel_width / pixel_height | 480p, 720p, 1080p, 4k presets (`-ql -qm -qh -qk`) |
| frame_rate | 15 / 30 / 60 |
| background_color | |
| background_opacity | |
| dry_run | |
| write_to_movie / save_last_frame / save_pngs | |
| transparent | |
| preview | |
| format | mp4, gif, png, webm, mov |

Lumina player/export should expose the same *quality presets* even though the encoder differs.

---

## I. What we will deliberately not port 1:1

| Python | Why omitted or replaced |
|---|---|
| Local LaTeX / dvisvgm / Pango | Replaced by KaTeX + OpenType |
| Typst CLI | Optional later WASM |
| FFmpeg `SceneFileWriter` | MediaRecorder / gifenc / png |
| NetworkX hard dependency | Own graph layouts |
| IPython `self.embed()` | In-page REPL |
| OpenGL / Cairo backends | Canvas2D + custom WebGL |
| `manim` CLI | Playground + `Player` + optional node screenshot later |
| Pi creatures, 3b1b SVGs | Copyright |
| Plugin ecosystem (manim-physics, etc.) | Reimplemented as domain packs (doc 09) |

Everything else in this file is **in scope** of the complete library (phased — doc 10).
