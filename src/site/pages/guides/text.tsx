import type { FC } from 'hono/jsx';

export const TextPage: FC = () => (
  <>
    <h1>Text &amp; Typography</h1>
    <p class="lead">Real vector glyph outlines — not rasterized bitmaps, not DOM text overlays — so text is fully <code>Transform</code>-able like any other VMobject.</p>

    <h2>Why glyph outlines instead of Canvas <code>fillText()</code></h2>
    <p>
      A <code>fillText()</code> call draws pixels; it gives you nothing to interpolate. To
      support <code>Write</code> (progressive stroke reveal per letter) and
      <code>TransformMatchingShapes</code> (morph one word into another, letter by letter),
      every glyph must itself be a cubic-Bézier <code>VMobject</code>. Lumina extracts real
      outline data from TrueType/OpenType font files via <code>opentype.js</code>
      (fonts are fetched from a CDN and parsed once, cached), converts each contour's
      quadratic/cubic segments into Lumina's cubic-only point format, and builds one
      <code>Glyph</code> (a <code>VMobject</code> leaf) per character.
    </p>

    <div class="callout warn">
      <strong>Async construction.</strong> Font files are fetched over the network, so glyph
      geometry cannot be ready synchronously in the constructor (unlike every other Lumina
      mobject). <code>Text</code> constructs as an empty <code>VGroup</code> immediately —
      safe to <code>add</code>/<code>animate</code>/<code>moveTo</code> right away, it just
      has no points until the font resolves — and exposes <code>text.ready: Promise&lt;this&gt;</code>
      for callers who need to measure it or <code>Write</code> it before it's populated.
    </div>
    <pre>{`const title = new Text('Hello, Lumina');
await title.ready;                 // glyph geometry is now populated
await scene.play(new Write(title));`}</pre>

    <h2>Classes</h2>
    <table>
      <tr><th>Class</th><th>Role</th></tr>
      <tr><td><code>Text</code></td><td>Plain multi-line text, one <code>Glyph</code> VMobject per character.</td></tr>
      <tr><td><code>Paragraph</code></td><td>Alias of <code>Text</code> that preserves explicit line breaks as separate rows.</td></tr>
      <tr><td><code>Title</code></td><td>A larger heading-style text block, typically pinned to the top of the frame.</td></tr>
      <tr><td><code>BulletedList</code></td><td>A vertical list of <code>Text</code> items with bullet markers.</td></tr>
      <tr><td><code>DecimalNumber</code></td><td>A live-updating numeric display — pair with a <code>ValueTracker</code> and <code>ChangingDecimal</code>.</td></tr>
      <tr><td><code>Integer</code></td><td><code>DecimalNumber</code> with 0 decimal places.</td></tr>
      <tr><td><code>Variable</code></td><td>A "label = value" pair that updates live, mirroring ManimCE's <code>Variable</code>.</td></tr>
    </table>

    <h2>Styling options (<code>TextOptions</code>)</h2>
    <pre>{`new Text('E = mc²', {
  font: 'sans',        // 'sans' | 'mono'
  fontSize: 48,        // Manim-style point size
  color: BLUE,
  weight: 'bold',      // 'normal' | 'bold'
  slant: 'italic',     // 'normal' | 'italic'
  lineSpacing: 1.2,
  t2c: { 'mc²': YELLOW },   // substring → color map (like Manim's t2c)
});`}</pre>

    <h2>Per-glyph access for animation</h2>
    <p>
      Because <code>Text</code> is a <code>VGroup</code> of <code>Glyph</code> leaves, you can
      reach into <code>text.children</code> to animate individual characters — e.g. a
      per-letter <code>Indicate</code> or color highlight:
    </p>
    <pre>{`await scene.play(new Indicate(title.children[0]));  // highlight just the first glyph`}</pre>

    <h2>MathTex / Tex — real LaTeX typesetting</h2>
    <p>
      For actual TeX layout — fractions, matrices, radicals, sub/superscripts positioned correctly — use
      <code>MathTex</code> instead of <code>Text</code>. It renders via <code>mathjax-full</code>'s TeX-input →
      SVG-output pipeline (the same box-layout math real Manim's LaTeX+dvisvgm pipeline does, just with a
      browser-native TeX engine instead of shelling out to a LaTeX binary) and converts the resulting
      <code>&lt;path&gt;</code>/<code>&lt;rect&gt;</code> tree into cubic-Bézier <code>VMobject</code> glyphs —
      so, exactly like glyph-outline <code>Text</code> above, a <code>MathTex</code> formula is a real vector
      shape you can <code>Transform</code>, <code>Write</code>, or morph with <code>TransformMatchingTex</code>.
    </p>
    <pre>{`import { MathTex, Write } from 'lumina';

const eq = new MathTex('E = mc^2');
await eq.ready;                     // MathJax typesetting is async, same pattern as Text.ready
await scene.play(new Write(eq));`}</pre>

    <h3>Isolating subexpressions for formula morphs</h3>
    <p>
      Pass multiple strings (or the <code>isolate</code> option) to tag individual subexpressions as their own
      matchable parts — <code>TransformMatchingTex</code> then pairs up parts that share the same source text
      across two formulas, gliding matching pieces into their new positions instead of cross-fading the whole
      expression:
    </p>
    <pre>{`import { MathTex, TransformMatchingTex } from 'lumina';

const eq1 = new MathTex('a^2', '+', 'b^2', { isolate: ['a^2', 'b^2'] });
const eq2 = new MathTex('b^2', '+', 'a^2', { isolate: ['a^2', 'b^2'] });
await Promise.all([eq1.ready, eq2.ready]);
await scene.play(new TransformMatchingTex(eq1, eq2));`}</pre>

    <h3>Coloring subexpressions</h3>
    <pre>{`const eq = new MathTex('\\\\frac{d}{dx} x^n = n x^{n-1}', {
  texToColorMap: { 'x^n': BLUE, 'n x^{n-1}': YELLOW },
});`}</pre>

    <div class="callout">
      Full API (options, <code>Tex</code>, <code>getPartByTex</code>, the MathJax→VMobject pipeline in detail):
      see <a href="/api/text">API: Text</a>.
    </div>

    <div class="callout">
      Next: <a href="/guides/graphing">Graphing &amp; Coordinate Systems</a> (plot <code>MathTex</code> labels
      on an <code>Axes</code>), or <a href="/guides/camera-3d">3D, Camera &amp; Lighting</a>.
    </div>
  </>
);
