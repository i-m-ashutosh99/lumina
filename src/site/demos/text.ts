/**
 * Gallery demo: Text + Write animation.
 * Mounted into #demo-text by the gallery page.
 */
import { Scene } from '../../lumina/core/scene';
import { Text } from '../../lumina/mobjects/text/text';
import { Write } from '../../lumina/animations/creation';
import { FadeIn } from '../../lumina/animations/indication';
import { WHITE, TEAL } from '../../lumina/math/color';

export async function runTextDemo(mountId: string) {
  const stage = document.getElementById(mountId);
  if (!stage) return;
  const scene = new Scene(stage, { width: 480, height: 320, background: '#111219' });

  const title = new Text('Lumina', { fontSize: 96, color: TEAL });
  await title.ready;
  await scene.play(new Write(title));
  await scene.wait(0.3);

  const sub = new Text('Manim-familiar. Browser-native.', { fontSize: 32, color: WHITE });
  await sub.ready;
  sub.nextTo(title, [0, -1, 0], { buff: 0.4 });
  await scene.play(new FadeIn(sub));

  scene.startPlayback(0);
}
