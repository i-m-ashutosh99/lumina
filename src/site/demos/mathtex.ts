/**
 * Gallery demo: MathTex + TransformMatchingTex formula morph.
 * Mounted into #demo-mathtex by the gallery page.
 */
import { Scene } from '../../lumina/core/scene';
import { MathTex } from '../../lumina/mobjects/text/mathtex';
import { Write } from '../../lumina/animations/creation';
import { TransformMatchingTex } from '../../lumina/animations/transform';
import { FadeOut } from '../../lumina/animations/indication';
import { WHITE, BLUE, YELLOW } from '../../lumina/math/color';

export async function runMathTexDemo(mountId: string) {
  const stage = document.getElementById(mountId);
  if (!stage) return;
  const scene = new Scene(stage, { width: 480, height: 320, background: '#111219' });

  const eq1 = new MathTex('a^2', '+', 'b^2', {
    isolate: ['a^2', 'b^2'],
    texToColorMap: { 'a^2': BLUE, 'b^2': YELLOW },
    fontSize: 72,
  });
  await eq1.ready;
  await scene.play(new Write(eq1));
  await scene.wait(0.4);

  const eq2 = new MathTex('b^2', '+', 'a^2', {
    isolate: ['a^2', 'b^2'],
    texToColorMap: { 'a^2': BLUE, 'b^2': YELLOW },
    fontSize: 72,
  });
  await eq2.ready;
  await scene.play(new TransformMatchingTex(eq1, eq2));
  await scene.wait(0.4);

  const eq3 = new MathTex('E = mc^2', { color: WHITE, fontSize: 60 });
  await eq3.ready;
  await scene.play(new FadeOut(eq2), new Write(eq3));

  scene.startPlayback(0);
}
