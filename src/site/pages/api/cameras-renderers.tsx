import type { FC } from 'hono/jsx';

const M: FC<{ sig: string; desc: string }> = ({ sig, desc }) => (
  <li><code>{sig}</code><span class="desc">— {desc}</span></li>
);

export const ApiCamerasRenderersPage: FC = () => (
  <>
    <h1>API Reference — Cameras &amp; Renderers</h1>
    <p class="lead">Source: <code>cameras/camera.ts</code>, <code>renderers/canvas2d.ts</code>, <code>renderers/webgl.ts</code>. For the 3D-specific camera, see <a href="/api/three-d">the 3D API page</a>.</p>

    <h2>Camera (2D) <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new Camera({ frameWidth?, frameHeight?, frameCenter? })" desc="Base 2D camera: defines the visible world-space rectangle" />
      <M sig="camera.frameCenter: Vec3" desc="World point at the center of the frame" />
      <M sig="camera.getFrameWidth() / getFrameHeight(): number" desc="Current visible extents" />
    </ul>

    <h2>FrameMobject <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new FrameMobject(opts?)" desc="A Mobject representing the camera's visible frame rectangle itself — animatable like any mobject, which is what makes MovingCamera work" />
    </ul>

    <h2>MovingCamera <span class="badge badge-done">implemented</span></h2>
    <p>A <code>Camera</code> whose frame is driven by a <code>FrameMobject</code> — animate the frame with normal animations (<code>Transform</code>, <code>.animate.scale(...)</code>, etc.) to pan/zoom.</p>
    <ul class="member-list">
      <M sig="new MovingCamera(opts?)" desc="Camera + an internal FrameMobject the scene can animate" />
      <M sig="movingCamera.frame: FrameMobject" desc="Animate this to pan/zoom the visible viewport" />
    </ul>

    <h2>ZoomedCamera <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new ZoomedCamera(opts?)" desc="MovingCamera subclass adding a second inset zoomed-in viewport, mirroring ManimCE's ZoomedScene" />
    </ul>

    <h2>ThreeDCamera <span class="badge badge-done">implemented</span></h2>
    <p>Full member list on the <a href="/api/three-d">3D API page</a>.</p>

    <h2><code>projectPoint3D(camera, point, aspect)</code> <span class="badge badge-done">implemented</span></h2>
    <p>Free function projecting a world Vec3 through a ThreeDCamera to 2D screen space.</p>

    <h2>Canvas2DRenderer <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>renderers/canvas2d.ts</code>. Draws <code>VMobject</code>s (and VGroup/Group trees of them) to a 2D canvas context by walking each cubic Bézier segment with native <code>ctx.bezierCurveTo</code>.</p>
    <ul class="member-list">
      <M sig="new Canvas2DRenderer(canvas: HTMLCanvasElement)" desc="Binds to a canvas element's 2D context" />
      <M sig="renderer.render(mobjects: Mobject[], camera: Camera): void" desc="Full-frame redraw: clears, then paints every visible mobject in z-order" />
    </ul>

    <h2>WebGLRenderer <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>renderers/webgl.ts</code>. An owned WebGL2 renderer — Lumina does not wrap Three.js; it builds its own minimal shader pipeline for <code>MeshMobject</code> geometry (positions/normals/uvs/indices buffers), matrices, and basic Lambertian shading against a <code>Light</code>.</p>
    <ul class="member-list">
      <M sig="new WebGLRenderer(canvas: HTMLCanvasElement)" desc="Binds to a canvas element's WebGL2 context" />
      <M sig="renderer.render(meshMobjects: MeshMobject[], camera: ThreeDCamera): void" desc="Full-frame redraw of 3D mesh geometry" />
      <M sig="hasMeshMobjects(roots: Mobject[]): boolean" desc="Free function: recursively checks whether a mobject tree contains any MeshMobject, used by Scene to decide whether to mount the WebGL canvas at all" />
    </ul>

    <h2>Hybrid compositing (ThreeDScene) <span class="badge badge-done">implemented</span></h2>
    <p>Source: <code>core/scene.ts</code> — <code>ThreeDScene</code>. Two stacked, transparent canvases: a <code>WebGLRenderer</code> canvas behind for 3D <code>MeshMobject</code>s, and a <code>Canvas2DRenderer</code> canvas on top (transparent background) for any 2D <code>VMobject</code> overlays (titles, labels, HUD text) — enabling mixed 2D/3D scenes without either renderer needing to know about the other.</p>
    <div class="callout warn">
      <code>fixInFrame</code> exists on <code>Mobject</code> (flags a mobject to ignore camera rotation) but there is
      no dedicated helper yet for compositing a "HUD" overlay layer that stays perfectly axis-aligned regardless
      of <code>ThreeDCamera</code> orientation beyond that flag — treat this as a partial implementation.
    </div>
  </>
);
