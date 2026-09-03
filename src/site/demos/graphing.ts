/**
 * Gallery demo: Axes + plot() + Riemann rectangles.
 * Mounted into #demo-graphing by the gallery page.
 */
import { Scene } from '../../lumina/core/scene';
import { Axes } from '../../lumina/mobjects/graphing/coordinate-system';
import { Create } from '../../lumina/animations/creation';
import { FadeIn } from '../../lumina/animations/indication';
import { BLUE, YELLOW, GREEN } from '../../lumina/math/color';

export async function runGraphingDemo(mountId: string) {
  const stage = document.getElementById(mountId);
  if (!stage) return;
  const scene = new Scene(stage, { width: 480, height: 320, background: '#111219' });

  const axes = new Axes({
    xRange: [0, 4, 1],
    yRange: [0, 5, 1],
    xLength: 6,
    yLength: 4,
    tips: true,
  });
  await axes.ready;
  await scene.play(new Create(axes));

  const curve = axes.plot((x) => x * x * 0.3, { xRange: [0, 4], color: YELLOW, strokeWidth: 3 });
  await scene.play(new Create(curve));
  await scene.wait(0.2);

  const rects = axes.getRiemannRectangles(
    (x) => x * x * 0.3,
    { xRange: [0, 4], dx: 0.3, mode: 'left', color: [BLUE, GREEN], fillOpacity: 0.7 },
  );
  await scene.play(new FadeIn(rects));

  scene.startPlayback(0);
}
