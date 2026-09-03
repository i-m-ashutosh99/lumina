import type { FC } from 'hono/jsx';

const M: FC<{ sig: string; desc: string }> = ({ sig, desc }) => (
  <li><code>{sig}</code><span class="desc">— {desc}</span></li>
);

export const ApiTextPage: FC = () => (
  <>
    <h1>API Reference — Text</h1>
    <p class="lead">Source: <code>mobjects/text/text.ts</code>, <code>mobjects/text/font.ts</code>. See the <a href="/guides/text">Text &amp; Typography guide</a> for the glyph-outline rendering approach.</p>

    <h2>Glyph &amp; Text <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new Glyph(cubics: Vec3[], opts?)" desc="A single character's outline as a VMobject (built from opentype.js glyph paths)" />
      <M sig="new Text(content: string, opts?: TextOptions)" desc="VGroup of Glyphs; async — await text.ready before reading geometry" />
      <M sig="text.ready: Promise&lt;this&gt;" desc="Resolves once the font has loaded and glyph outlines are built" />
      <M sig="TextOptions: { font?, size?, color?, weight?, slant?, lineSpacing?, ... }" desc="Constructor options" />
    </ul>
    <div class="callout warn">
      Because glyph outlines are loaded asynchronously via <code>opentype.js</code>, always
      <code>await new Text(...).ready</code> (or the returned promise) before calling geometry queries
      like <code>getWidth()</code> immediately after construction.
    </div>

    <h2>Composite text mobjects <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="new Paragraph(...lines: string[], opts?)" desc="Extends Text: multiple lines laid out with lineSpacing" />
      <M sig="new Title(text: string, opts?)" desc="Larger Text placed at the top of the frame with an underline" />
      <M sig="new BulletedList(...items: string[], opts?)" desc="VGroup of bullet + Text pairs, arranged vertically" />
      <M sig="new DecimalNumber(value: number, opts?)" desc="VGroup rendering a formatted numeric string; opts: { numDecimalPlaces?, includeSign? }" />
      <M sig="decimalNumber.setValue(v): this" desc="Rebuild glyphs for a new numeric value (used by ChangingDecimal)" />
      <M sig="new Integer(value: number, opts?)" desc="DecimalNumber with numDecimalPlaces=0" />
      <M sig="new Variable(valueTracker, label: string, opts?)" desc="Live-updating 'label = value' display bound to a ValueTracker" />
    </ul>

    <h2>Font loading <span class="badge badge-done">implemented</span></h2>
    <ul class="member-list">
      <M sig="loadFont(face: string): Promise&lt;LoadedFont&gt;" desc="Loads and caches an opentype.js font by name/URL" />
      <M sig="glyphToCubics(font, glyphName, size): { cubics: Vec3[]; advance: number }" desc="Converts one glyph's outline to cubic Bézier point arrays" />
    </ul>

    <h2>Math typesetting <span class="badge badge-missing">not yet implemented</span></h2>
    <div class="callout warn">
      <strong><code>MathTex</code> / <code>Tex</code> (LaTeX-rendered math mobjects) do not exist yet.</strong>
      <code>mathjax-full</code> and <code>katex</code> are already project dependencies and research into the
      implementation path (MathJax SVG output → path-to-cubics conversion, analogous to the glyph pipeline
      above) has been done, but the actual <code>MathTex</code> mobject class, its per-submobject-by-TeX-token
      indexing (needed for <code>TransformMatchingTex</code> to be useful), and color/highlight-by-index support
      are all still to be built. This is one of the largest remaining gaps versus Python Manim.
    </div>
  </>
);
