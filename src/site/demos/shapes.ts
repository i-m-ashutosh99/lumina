/**
 * Gallery demo: basic 2D shapes, Create, Transform, .animate, FadeIn/Out.
 * Mounted into #demo-shapes by the gallery page.
 */
import { Scene } from '../../lumina/core/scene';
import { Circle, Square, Star } from '../../lumina/mobjects/geometry/basic';
import { Create } from '../../lumina/animations/creation';
import { Transform } from '../../lumina/animations/transform';
import { FadeIn, FadeOut } from '../../lumina/animations/indication';
import { BLUE, YELLOW, PINK } from '../../lumina/math/color';

export async function runShapesDemo(mountId: string) {
  const stage = document.getElementById(mountId);
  if (!stage) return;
  const scene = new Scene(stage, { width: 480, height: 320, background: '#111219' });

  const square = new Square({ color: BLUE, sideLength: 2 });
  await scene.play(new Create(square));
  await scene.wait(0.2);

  const circle = new Circle({ color: YELLOW, radius: 1.3 });
  await scene.play(new Transform(square, circle));
  await scene.wait(0.2);

  const star = new Star({ n: 5, color: PINK, outerRadius: 1.4, innerRadius: 0.6 });
  await scene.play(new Transform(circle, star));
  await scene.wait(0.2);

  await scene.play((star.animate as any).rotate(Math.PI / 3).shift([1, 0, 0]));
  await scene.play(new FadeOut(star));
  await scene.wait(0.2);
  await scene.play(new FadeIn(star));

  scene.startPlayback(0);
}
