import type { FC } from 'hono/jsx';

const M: FC<{ sig: string; desc: string }> = ({ sig, desc }) => (
  <li><code>{sig}</code><span class="desc">— {desc}</span></li>
);

export const ApiThreeDPage: FC = () => (
  <>
    <h1>API Reference — 3D</h1>
    <p class="lead">Mesh kernel, solid primitives, lighting and the 3D camera. Source: <code>core/mesh-mobject.ts</code>, <code>mobjects/three-d/*.ts</code>, <code>cameras/camera.ts</code>. See the <a href="/guides/camera-3d">3D, Camera &amp; Lighting guide</a> for a narrative walkthrough.</p>

    <h2>MeshMobject <span class="badge badge-done">implemented</span></h2>
    <p>The 3D counterpart of <code>VMobject</code> — see full member list on the <a href="/api/core">Core API page</a>. Every solid below extends it.</p>

    <h2>Solid primitives <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>mobjects/three-d/solids.ts</code>.</p>
    <ul class="member-list">
      <M sig="new Sphere({ radius?, resolution? })" desc="UV sphere" />
      <M sig="new Cube({ sideLength? })" desc="Axis-aligned cube" />
      <M sig="new Prism({ width?, height?, depth? })" desc="Rectangular box (general cuboid)" />
      <M sig="new Cylinder({ radius?, height?, resolution? })" desc="Capped cylinder" />
      <M sig="new Cone({ radius?, height?, resolution? })" desc="Capped cone" />
      <M sig="new Torus({ radius?, tubeRadius?, color? })" desc="Donut (resolution fixed at 32×16 segments)" />
      <M sig="new Tetrahedron() / Octahedron() / Icosahedron() / Dodecahedron()" desc="Platonic solids" />
      <M sig="polyhedron(kind, opts?): MeshMobject" desc="Factory function for the four Platonic solids above by name" />
      <M sig="new Dot3D(point?: Vec3, { radius?, color? })" desc="Small Sphere, the 3D analogue of Dot (point is positional, not in the options object)" />
      <M sig="new Line3D(start, end, { thickness? })" desc="Thin cylinder standing in for a 3D line segment" />
      <M sig="new Arrow3D(start, end, opts?)" desc="Group: Line3D + Cone tip" />
    </ul>

    <h2>Surfaces <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new Surface(uFunc, { uRange?, vRange?, resolution? })" desc="Parametric surface (u,v) → Vec3" />
      <M sig="functionSurface(f: (x,y) => number, opts?): MeshMobject" desc="Height-field surface z = f(x, y)" />
      <M sig="new SurfaceMesh(...)" desc="Surface rendered with visible wireframe grid lines" />
    </ul>
    <div class="callout warn">
      <code>TexturedSurface</code> exists as a class stub but does not yet map an image/texture onto the
      surface UVs — texture and image-mapping support is a tracked gap.
    </div>

    <h2>Light <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>mobjects/three-d/light.ts</code>. A Light <em>is</em> a Mobject (ManimGL heritage) — its position is <code>getCenter()</code>, so it is fully animatable via <code>.animate</code>/<code>shift</code>/<code>moveTo</code> like any other mobject.</p>
    <ul class="member-list">
      <M sig="new Light({ point?, color?, intensity? })" desc="Point light source used by the WebGL2 renderer's shading" />
      <M sig="defaultLight(): Light" desc="Convenience factory for a standard key light" />
    </ul>

    <h2>ThreeDCamera <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>cameras/camera.ts</code>. Euler-angle camera matching ManimGL's <code>set_camera_orientation</code> convention.</p>
    <ul class="member-list">
      <M sig="phi: number" desc="Polar angle from the +z axis (radians)" />
      <M sig="theta: number" desc="Azimuthal angle around z (radians)" />
      <M sig="gamma: number" desc="Camera roll (radians)" />
      <M sig="distance / focalDistance: number" desc="Camera-to-target distance / perspective focal length" />
      <M sig="zoom: number" desc="Uniform zoom multiplier" />
      <M sig="frameCenter: Vec3" desc="World point the camera orbits/looks at" />
      <M sig="fovDegrees: number" desc="Field of view" />
      <M sig="lightSource: Light | null" desc="Light used for shading calculations" />
      <M sig="ambientRotationRate: number" desc="Automatic theta drift per second, for begin_ambient_camera_rotation-style effects" />
      <M sig="setCameraOrientation({ phi?, theta?, gamma?, distance?, zoom?, frameCenter? })" desc="Bulk orientation setter" />
      <M sig="moveCamera(opts): void" desc="Alias of setCameraOrientation, matching ManimGL's move_camera name" />
      <M sig="beginAmbientCameraRotation(rate?) / stopAmbientCameraRotation()" desc="Starts/stops automatic theta drift (ambientRotationRate)" />
      <M sig="getEye(): Vec3 / getUp(): Vec3" desc="Derived eye position and up vector from phi/theta/gamma/distance" />
      <M sig="viewMatrix() / projectionMatrix(aspect): Mat4" desc="Camera matrices used by the WebGL2 renderer" />
    </ul>
    <div class="callout warn">
      Animated camera moves (ManimGL's <code>self.camera.animate</code> / <code>moveCamera({'{'} runTime {'}'})</code>
      tweening) are not yet wired into <code>Scene.play()</code> — camera fields can be set directly between
      <code>play()</code> calls, but a smooth interpolated camera move animation is a tracked gap.
    </div>

    <h2><code>projectPoint3D(camera, point, aspect)</code> <span class="badge badge-done">implemented</span></h2>
    <p>Free function: projects a world-space <code>Vec3</code> through a <code>ThreeDCamera</code>'s view/projection to 2D screen space — the core of the WebGL2 renderer's vertex pipeline.</p>
  </>
);
