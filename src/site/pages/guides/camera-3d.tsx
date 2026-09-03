import type { FC } from 'hono/jsx';

export const Camera3DPage: FC = () => (
  <>
    <h1>3D, Camera &amp; Lighting</h1>
    <p class="lead">
      An owned WebGL2 renderer, a ManimCE/ManimGL-style spherical <code>ThreeDCamera</code>,
      and lights that are themselves animatable mobjects.
    </p>

    <div class="callout warn">
      <strong>Partial implementation.</strong> The mesh kernel, all 10 solid primitives,
      lighting, camera math, and the renderer are implemented, typechecked, and
      unit/integration-tested at the data level. Texture mapping, shader-based surface
      deformation, and a fully animated <code>moveCamera({'{ runTime }'})</code> tween are not
      yet implemented — see the status grid on the home page.
    </div>

    <h2>ThreeDScene: the entry point</h2>
    <p>
      Use <code>ThreeDScene</code> instead of <code>Scene</code> to get a 3D-capable canvas.
      It mounts <strong>two stacked canvases</strong> in a positioned host div — an owned
      WebGL2 canvas underneath for 3D meshes, and a transparent Canvas2D canvas on top for
      any 2D overlay (HUD text, 2D annotations via <code>addFixedInFrame</code>). Both are
      driven by the same pure <code>renderAt(t)</code>, so 3D scenes are just as seekable as
      2D ones.
    </p>
    <pre>{`import { ThreeDScene, Sphere, Torus, Create, defaultLight } from 'lumina';

class MyScene extends ThreeDScene {
  async construct() {
    this.setCameraOrientation({
      phi: 65 * Math.PI / 180,     // polar angle from +Z
      theta: -45 * Math.PI / 180,  // azimuth
    });
    this.camera.lightSource = defaultLight();

    const sphere = new Sphere({ radius: 1.5, color: '#58C4DD' });
    await this.play(new Create(sphere));

    this.beginAmbientCameraRotation({ rate: 0.15 }); // radians/sec around theta
    await this.wait(4);
    this.stopAmbientCameraRotation();
  }
}

const scene = new MyScene(document.getElementById('stage'), { width: 800, height: 450 });
await scene.construct();`}</pre>

    <h2>ThreeDCamera</h2>
    <p>
      Modeled directly on ManimCE/ManimGL's spherical camera: a perspective camera on a
      "boom" defined by two Euler angles plus a distance, orbiting a <code>frameCenter</code>.
    </p>
    <table>
      <tr><th>Field</th><th>Meaning</th></tr>
      <tr><td><code>phi</code></td><td>Polar angle from +Z (0 = top-down)</td></tr>
      <tr><td><code>theta</code></td><td>Azimuthal angle</td></tr>
      <tr><td><code>gamma</code></td><td>Roll, about the view axis</td></tr>
      <tr><td><code>distance</code> / <code>focalDistance</code></td><td>Eye-to-<code>frameCenter</code> radius / focal length for depth cues</td></tr>
      <tr><td><code>zoom</code></td><td>Divides the effective field of view</td></tr>
      <tr><td><code>frameCenter</code></td><td>The point the camera orbits and looks at</td></tr>
      <tr><td><code>fovDegrees</code></td><td>Base field of view</td></tr>
      <tr><td><code>lightSource</code></td><td>A <code>Light</code> mobject (see below)</td></tr>
      <tr><td><code>ambientRotationRate</code></td><td>Radians/sec auto-orbit around <code>theta</code>, set via <code>beginAmbientCameraRotation()</code></td></tr>
    </table>
    <p>Methods:</p>
    <ul>
      <li><code>getEye()</code> / <code>getUp()</code> — camera world position and up vector, derived from the spherical angles.</li>
      <li><code>viewMatrix()</code> / <code>projectionMatrix(aspect)</code> — the matrices the WebGL renderer feeds to the shader (via <code>mat4.lookAt</code> / <code>mat4.perspective</code>).</li>
      <li><code>setCameraOrientation(opts)</code> — instantaneous setter for any subset of the fields above.</li>
      <li><code>moveCamera(opts)</code> — same setter, intended as the animated-move entry point (currently a synchronous jump; tweened <code>moveCamera({'{ runTime }'})</code> is a tracked gap).</li>
      <li><code>beginAmbientCameraRotation({'{ rate }'})</code> / <code>stopAmbientCameraRotation()</code> — continuous auto-orbit, ticked by <code>tickAmbient(dt)</code> during live playback.</li>
    </ul>
    <p>Standalone helper: <code>projectPoint3D(camera, point, aspect)</code> — projects a world point to NDC via the view × projection matrix with perspective divide (useful for placing 2D HUD labels next to 3D objects).</p>

    <h2>Light — lighting as a mobject</h2>
    <p>
      Following ManimGL's convention (not Three.js's), a <code>Light</code> is itself a
      <code>Mobject</code> — its position <em>is</em> <code>getCenter()</code>. This means you
      animate a light exactly like any other mobject:
    </p>
    <pre>{`import { Light, defaultLight } from 'lumina';

const key = defaultLight();                 // point light at [-3, 3, 5], white, intensity 1
scene.camera.lightSource = key;
await scene.play((key.animate as any).shift([4, -2, 3]));  // move the light — it's just a mobject

const rim = new Light({ kind: 'directional', direction: [1, -1, -1], color: '#88CCFF', intensity: 0.4 });`}</pre>
    <table>
      <tr><th>Kind</th><th>Meaning</th></tr>
      <tr><td><code>'point'</code></td><td>Light radiates from <code>getPosition()</code> — direction to a surface point is computed per-fragment.</td></tr>
      <tr><td><code>'directional'</code></td><td>Parallel rays along <code>direction</code> — position is ignored.</td></tr>
      <tr><td><code>'ambient'</code></td><td>Uniform fill light, no direction/position.</td></tr>
    </table>
    <p>
      The renderer's fragment shader is Lambertian (N·L) plus a fixed ambient term
      (<code>AMBIENT_LIGHT_DEFAULT = 0.35</code>), matching the "flat/Lambert-ish" 3b1b
      explainer look rather than a photoreal PBR pipeline.
    </p>

    <h2>Solid primitives</h2>
    <pre>{`import {
  Sphere, Cube, Prism, Cylinder, Cone, Torus,
  Tetrahedron, Octahedron, Icosahedron, Dodecahedron,
  Dot3D, Line3D, Arrow3D, Surface, functionSurface, SurfaceMesh,
} from 'lumina';

const donut = new Torus({ r1: 2, r2: 0.6, color: '#F5C242' });
const surf = functionSurface(
  (u, v) => [u, v, Math.sin(u) * Math.cos(v)],
  { uRange: [-3, 3], vRange: [-3, 3], resolution: 32 },
);`}</pre>
    <p>
      Every solid is a <code>MeshMobject</code> — it shares the exact same placement API
      (<code>shift</code>/<code>moveTo</code>/<code>scale</code>/<code>rotate</code>) as 2D
      mobjects. <code>Transform</code> between two <code>MeshMobject</code>s CPU-lerps vertex
      positions and normals directly (no Bézier alignment).
    </p>

    <h3>Platonic solids &amp; the dodecahedron construction</h3>
    <p>
      <code>Tetrahedron</code>, <code>Octahedron</code>, <code>Icosahedron</code>, and
      <code>Dodecahedron</code> are all built from a shared mesh kernel
      (<code>math/mesh.ts</code>). The dodecahedron is constructed as the geometric dual of
      the icosahedron: its 20 vertices are the icosahedron's 20 face centroids, and each of
      its 12 pentagonal faces corresponds to one of the icosahedron's 12 original vertices
      (each touching exactly 5 faces, angle-sorted and fan-triangulated). This requires the
      icosahedron's <em>true shared-vertex topology</em> (12 vertices / 20 faces), not the
      flat-shaded, per-face-duplicated vertex buffer used for direct rendering — the mesh
      kernel keeps both representations available internally for exactly this reason.
    </p>

    <h2>ZoomedScene &amp; VectorScene</h2>
    <p>
      <code>ZoomedScene</code> (extends <code>MovingCameraScene</code>) adds the 3b1b
      "magnifying glass" inset — <code>activateZooming(opts)</code> plus
      <code>zoomedDisplayMount(el, width, height)</code> renders a second, zoomed Canvas2D
      view of a sub-region alongside the main frame. <code>VectorScene</code> is a thin base
      for vector/linear-algebra scenes with helpers for tracking a list of vector mobjects.
    </p>

    <div class="callout">
      Next: <a href="/guides/updaters">Updaters &amp; ValueTrackers</a>.
    </div>
  </>
);
