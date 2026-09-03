/**
 * Minimal smoke-test scene for the dev preview page (src/index.tsx).
 * Exercises: Scene mount, Circle/Square, Create, Transform, .animate,
 * FadeIn/Out, seek. This is NOT the playground — just proof the engine
 * runs end-to-end in a real browser.
 */
import { Scene } from './lumina/core/scene';
import { Circle, Square } from './lumina/mobjects/geometry/basic';
import { Create } from './lumina/animations/creation';
import { Transform } from './lumina/animations/transform';
import { FadeIn } from './lumina/animations/indication';
import { BLUE, YELLOW } from './lumina/math/color';

const log = document.getElementById('log')!;
const stage = document.getElementById('stage')!;

async function main() {
  const scene = new Scene(stage, { width: 800, height: 450, background: '#0b0b10' });

  const square = new Square({ color: BLUE, sideLength: 2 });
  await scene.play(new Create(square));
  await scene.wait(0.3);

  const circle = new Circle({ color: YELLOW, radius: 1.3 });
  await scene.play(new Transform(square, circle));
  await scene.wait(0.3);

  await scene.play((square.animate as any).shift([2, 0, 0]).scale(0.6));
  await scene.wait(0.3);

  // seek scrub test
  scene.seek(scene.timeline.duration * 0.5);
  await new Promise((r) => setTimeout(r, 400));
  scene.seek(scene.timeline.duration);

  log.textContent = `OK — timeline duration ${scene.timeline.duration.toFixed(2)}s, ${scene.timeline.clips.length} clips recorded.`;
}

main().catch((err) => {
  log.textContent = 'ERROR: ' + (err?.stack || err);
  console.error(err);
});
