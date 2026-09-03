import type { FC } from 'hono/jsx';

const M: FC<{ sig: string; desc: string }> = ({ sig, desc }) => (
  <li><code>{sig}</code><span class="desc">— {desc}</span></li>
);

export const ApiGeometryPage: FC = () => (
  <>
    <h1>API Reference — Geometry (2D)</h1>
    <p class="lead">All 2D shape mobjects. Source: <code>mobjects/geometry/*.ts</code>. Every class here extends <code>VMobject</code> (or <code>VGroup</code> for composites), so the full <a href="/api/core">Mobject/VMobject placement &amp; style API</a> applies uniformly.</p>

    <h2>Arcs &amp; circles <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new Arc({ radius?, startAngle?, angle? })" desc="Circular arc" />
      <M sig="new Circle({ radius? })" desc="Extends Arc with angle=TAU" />
      <M sig="new Dot({ point?, radius? })" desc="Small filled circle, default radius 0.08" />
      <M sig="new AnnotationDot()" desc="Larger Dot variant used for labeling" />
      <M sig="new LabeledDot(label, opts?)" desc="Dot with a Text/Integer label centered on top (VGroup)" />
      <M sig="new Ellipse({ width?, height? })" desc="Circle stretched to width/height" />
      <M sig="new ArcBetweenPoints(start, end, angle?)" desc="Arc connecting two explicit points" />
      <M sig="new Sector({ radius?, startAngle?, angle? })" desc="Pie-slice (filled wedge)" />
      <M sig="new AnnularSector({ innerRadius?, outerRadius?, ... })" desc="Ring-slice" />
      <M sig="new Annulus({ innerRadius?, outerRadius? })" desc="Full ring (donut)" />
      <M sig="new TangentLine(vmobject, alpha, { length? })" desc="Line tangent to a VMobject at parameter alpha" />
    </ul>

    <h2>Curves &amp; lines <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new CubicBezier(p0, p1, p2, p3)" desc="A single explicit cubic Bézier segment" />
      <M sig="new Line(start, end, opts?)" desc="Straight segment; supports { buff } to shorten at both ends" />
      <M sig="new DashedLine(start, end, { dashLength?, dashedRatio? })" desc="VGroup of short Line segments" />
      <M sig="new Elbow({ width?, angle? })" desc="Right-angle bracket shape" />
      <M sig="new RightAngle(line1, line2, { length? })" desc="Right-angle marker between two Lines" />
      <M sig="new Angle(line1, line2, { radius?, otherAngle? })" desc="Arc marking the angle between two Lines" />
    </ul>

    <h2>Arrows &amp; vectors <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new ArrowTip({ angle?, length? })" desc="Standalone triangular tip mobject" />
      <M sig="new Arrow(start, end, opts?)" desc="Line + ArrowTip composite (VGroup); { buff, maxTipLengthToLengthRatio }" />
      <M sig="new Vector(direction, opts?)" desc="Arrow from ORIGIN to direction" />
      <M sig="new DoubleArrow(start, end, opts?)" desc="Arrow with tips on both ends" />
      <M sig="new CurvedArrow(start, end, { angle? })" desc="ArcBetweenPoints + tip" />
      <M sig="new CurvedDoubleArrow(start, end, opts?)" desc="Curved arrow with both tips" />
    </ul>

    <h2>Polygons &amp; polygrams <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new Polygram(...vertexGroups: Vec3[][])" desc="One or more closed vertex loops sharing one VMobject (supports holes)" />
      <M sig="new Polygon(...vertices: Vec3[])" desc="Single closed loop" />
      <M sig="new RegularPolygon(n, opts?)" desc="Regular n-gon inscribed in a circle" />
      <M sig="new Triangle(opts?)" desc="RegularPolygon(3)" />
      <M sig="new Square({ sideLength? })" desc="Polygon with 4 equal sides" />
      <M sig="new Rectangle({ width?, height? })" desc="Axis-aligned rectangle" />
      <M sig="new RoundedRectangle({ width?, height?, cornerRadius? })" desc="Rectangle with arc corners" />
      <M sig="new RegularPolygram(n, { density? })" desc="Star-polygon path, e.g. pentagram via density=2" />
      <M sig="new Star(n, { innerRadius?, outerRadius? })" desc="n-pointed star" />
      <M sig="new ConvexHull(...points: Vec3[])" desc="Computes and draws the convex hull of a point set" />
      <M sig="new Cutout(outer: VMobject, ...holes: VMobject[])" desc="Outer shape with inner shapes subtracted as even-odd holes" />
    </ul>

    <h2>Braces <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>mobjects/geometry/brace.ts</code>. Curly-brace outline built from 4 cubic Bézier segments per half, rotated to point along an arbitrary direction and offset just outside the target's bounding box.</p>
    <ul class="member-list">
      <M sig="new Brace(mobject, { direction?, buff? })" desc="Curly brace hugging a mobject's bounding box edge along direction (default DOWN)" />
      <M sig="brace.getTip(): Vec3" desc="Point at the brace's tip, for label placement" />
      <M sig="brace.putAtTip(mobject, buff?): Mobject" desc="Positions another mobject just past the tip" />
      <M sig="new BraceLabel(mobject, label, opts?)" desc="VGroup: Brace + a label positioned at its tip" />
      <M sig="new BraceText(mobject, text: string, opts?)" desc="BraceLabel convenience with a Text label" />
      <M sig="new BraceBetweenPoints(p1, p2, opts?)" desc="Brace spanning two explicit points instead of a mobject's bbox" />
    </ul>

    <h2>Shape matchers <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>mobjects/geometry/shape-matchers.ts</code>. Fit themselves to another mobject's bounding box at construction time (not reactive — call the manual re-fit method if the target later moves).</p>
    <ul class="member-list">
      <M sig="new SurroundingRectangle(mobject, { buff?, cornerRadius?, color? })" desc="RoundedRectangle sized to mobject's bbox + buff, e.g. for Circumscribe-style highlighting" />
      <M sig="new BackgroundRectangle(mobject, { buff?, opacity?, color? })" desc="Opaque/semi-opaque backing rectangle, typically added before the mobject" />
      <M sig="backgroundRect.updateForNewMobject(): this" desc="Manually re-fit to the target's current bounding box" />
      <M sig="new Cross(mobject?, { stroke_color?, scaleFactor? })" desc="✗ mark sized to a mobject, or standalone if mobject is null" />
      <M sig="new Underline(mobject, { buff?, stretch_factor? })" desc="Line placed just below a mobject's bottom edge" />
      <M sig="new Checkmark(opts?)" desc="✓ mark built from two Line segments" />
    </ul>

    <div class="callout warn">
      <strong>Not yet implemented:</strong> boolean path operations (<code>Union</code>, <code>Intersection</code>,
      <code>Difference</code>, <code>Exclusion</code> from ManimCE's <code>boolean_ops.py</code>) — <code>Cutout</code> covers
      the even-odd hole case but general polygon boolean algebra on arbitrary Bézier paths is not implemented.
    </div>
  </>
);
