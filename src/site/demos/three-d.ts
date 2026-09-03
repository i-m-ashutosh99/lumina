/**
 * Gallery demo: 3D solid + ThreeDScene + orbiting camera.
 * Mounted into #demo-3d by the gallery page.
 */
import { ThreeDScene } from '../../lumina/core/scene';
import { Dodecahedron } from '../../lumina/mobjects/three-d/solids';
import { defaultLight } from '../../lumina/mobjects/three-d/light';
import { PI } from '../../lumina/math/constants';
import { BLUE } from '../../lumina/math/color';

export async function runThreeDDemo(mountId: string) {
  const stage = document.getElementById(mountId);
  if (!stage) return;
  const scene = new ThreeDScene(stage, { width: 480, height: 320, background: '#0b0b10' });

  const light = defaultLight();
  scene.add(light);
  scene.camera.setCameraOrientation({ phi: PI / 3, theta: -PI / 4 });

  const solid = new Dodecahedron({ color: BLUE });
  scene.add(solid);
  await scene.play((solid.animate as any).scale(1.4));
  await scene.play((solid.animate as any).rotate(PI, { axis: [0, 1, 0] }));

  scene.startPlayback(0);
}
