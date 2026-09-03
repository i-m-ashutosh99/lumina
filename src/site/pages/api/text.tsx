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

    <h2>Math typesetting: MathTex / Tex <span class="badge badge-done">implemented</span></h2>
    <p class="lead">Source: <code>mobjects/text/mathtex.ts</code>, <code>math/svg-path.ts</code>. Real LaTeX, rendered by
    <code>mathjax-full</code>'s TeX→SVG pipeline and converted to cubic-Bézier <code>VMobject</code> glyphs — the same
    "real vector shapes, not bitmaps" approach as <code>Text</code> above, so <code>MathTex</code> is fully
    <code>Transform</code>/<code>TransformMatchingTex</code>-able.</p>

    <ul class="member-list">
      <M sig="new MathTex(...parts: string[], opts?: MathTexOptions)" desc="Display-mode LaTeX (math italics, centered). Variadic: pass multiple strings to get separately-tagged parts." />
      <M sig="new Tex(...parts: string[], opts?: MathTexOptions)" desc="Same pipeline, wraps each part in \\text{...} so it renders upright like prose instead of italic math variables." />
      <M sig="new SingleStringMathTex(tex: string, opts?)" desc="One un-isolated tex string as a single part — explicit building-block class, mirrors real Manim." />
      <M sig="mathTex.ready: Promise&lt;this&gt;" desc="Resolves once MathJax has typeset the expression and glyph geometry is built" />
      <M sig="mathTex.tex: string" desc="Combined source text of every part (no \\cssId wrapping), for reference/debugging" />
      <M sig="mathTex.parts: MathTexPart[]" desc="One VGroup per top-level part, in source order, each tagged .tex with its exact source text" />
      <M sig="mathTex.getPartByTex(tex: string): MathTexPart | undefined" desc="Find a part by exact source-text match, falling back to substring-contains" />
      <M sig="preloadMathJax(): Promise&lt;void&gt;" desc="Force-load the MathJax engine ahead of time (e.g. app bootstrap) to avoid first-MathTex latency" />
    </ul>

    <h3><code>MathTexOptions</code></h3>
    <pre>{`new MathTex('x^2 + y^2 = r^2', {
  color: WHITE,           // stroke/fill color
  fontSize: 48,           // same convention as TextOptions.fontSize
  isolate: ['x^2', 'y^2'],           // tag these substrings as their own TransformMatchingTex-matchable parts
  texToColorMap: { 'x^2': BLUE, 'y^2': YELLOW },  // implies isolating each key too
  argSeparator: ' ',      // inserted between top-level parts before typesetting (default ' ')
});`}</pre>

    <div class="callout warn">
      <strong>Async construction, same as <code>Text</code>.</strong> The MathJax engine module set (~600KB
      gzipped) is loaded lazily via dynamic <code>import()</code> the first time any <code>MathTex</code>/<code>Tex</code>
      is constructed — <code>await mathTex.ready</code> before reading geometry, calling <code>getWidth()</code>,
      or using it in a <code>Transform</code>.
    </div>
    <pre>{`const eq = new MathTex('E = mc^2');
await eq.ready;
await scene.play(new Write(eq));`}</pre>

    <h3>Formula morphing with <code>TransformMatchingTex</code></h3>
    <p>
      Every glyph leaf inside a <code>MathTexPart</code> is tagged <code>.tex</code> with that part's exact source
      text (not just the container — <code>VGroup</code> containers have empty <code>.points</code>, so matching
      must happen at the leaf level). Pass <code>isolate</code> (or <code>texToColorMap</code>, which implies it)
      to control what counts as a matchable "part":
    </p>
    <pre>{`const eq1 = new MathTex('a^2', '+', 'b^2', { isolate: ['a^2', 'b^2'] });
const eq2 = new MathTex('b^2', '+', 'a^2', { isolate: ['a^2', 'b^2'] });
await Promise.all([eq1.ready, eq2.ready]);
await scene.play(new TransformMatchingTex(eq1, eq2)); // a^2 and b^2 glide past each other`}</pre>

    <h3>Isolating and coloring subexpressions</h3>
    <pre>{`const eq = new MathTex('\\\\frac{d}{dx} x^n = n x^{n-1}', {
  texToColorMap: { 'x^n': BLUE, 'n x^{n-1}': YELLOW },
});
await eq.ready;
const part = eq.getPartByTex('x^n');   // MathTexPart — a VGroup, animate it directly
await scene.play(new Indicate(part));`}</pre>

    <div class="callout">
      <strong>How it works under the hood</strong> (see the guide for the full pipeline): MathJax's <code>SVG</code>
      output jax (with <code>fontCache:'none'</code>) emits a tree of <code>&lt;path d="..."&gt;</code> (glyph
      outlines) and <code>&lt;rect&gt;</code> (fraction bars / sqrt bars / rules) wrapped in nested
      <code>&lt;g transform="translate(x,y) scale(s)"&gt;</code> — MathTex walks that tree with a generic SVG
      path parser (<code>math/svg-path.ts</code>, handles <code>M/L/H/V/C/S/Q/T/Z</code> plus nested
      <code>translate/scale/rotate/matrix</code> transform composition), bakes the accumulated transform into
      each leaf's points, and converts to Lumina's cubic-Bézier / y-up world convention with a single final
      y-negation. <code>\\cssId{'{'}p&lt;i&gt;{'}'}{'{'}...{'}'}</code> survives MathJax's rendering as a literal
      <code>id</code> attribute, which is how per-part tagging works without reimplementing any TeX layout.
      <strong>Still missing:</strong> matrix-aware <code>getPartByTex</code> disambiguation for repeated
      substrings, and dedicated per-character color helpers beyond <code>texToColorMap</code>.
    </div>

    <div class="callout">
      See also: <a href="/guides/text">Text &amp; Typography guide</a> (MathTex usage walkthrough) and
      <a href="/api/graphing">API: Graphing</a> for combining <code>MathTex</code> labels with <code>Axes</code>.
    </div>
  </>
);
