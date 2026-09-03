import type { FC } from 'hono/jsx';

export const InstallationPage: FC = () => (
  <>
    <h1>Installation &amp; Setup</h1>
    <p class="lead">Three ways to get Lumina into a project, from zero-build prototyping to a full bundler setup.</p>

    <h2>Option A — CDN, zero build (fastest way to try it)</h2>
    <p>Good for a single lesson page, a CodePen, or a quick prototype. No npm, no bundler.</p>
    <pre>{`<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
  <div id="stage" style="width:800px;height:450px;"></div>
  <script type="module">
    import { Scene, Circle, Create, YELLOW } from "https://esm.sh/lumina";

    const scene = new Scene(document.getElementById('stage'), { width: 800, height: 450 });
    const c = new Circle({ color: YELLOW, radius: 1.3 });
    await scene.play(new Create(c));
  </script>
</body>
</html>`}</pre>
    <p>
      This works because Lumina is pure browser-native TypeScript/JS with (for the 2D+3D
      core) no runtime dependencies — everything needed to run <code>Scene</code>,
      <code>Mobject</code>, <code>Animation</code>, the Canvas2D renderer, and the WebGL2
      renderer ships in the single ESM bundle.
    </p>

    <h2>Option B — npm + a bundler (recommended for real projects)</h2>
    <pre>{`npm install lumina`}</pre>
    <pre>{`// main.ts
import { Scene, Square, Create, BLUE } from 'lumina';

const scene = new Scene(document.getElementById('stage')!, { width: 800, height: 450 });
await scene.play(new Create(new Square({ color: BLUE })));`}</pre>
    <p>
      Works with Vite, webpack, esbuild, Rollup, Parcel, or any bundler that understands
      ESM + <code>package.json</code> <code>"exports"</code>. TypeScript types are shipped
      alongside the package — no <code>@types/lumina</code> needed.
    </p>

    <h2>Option C — clone/embed the engine source directly</h2>
    <p>
      If you're extending Lumina itself (writing a domain pack, a new animation class, a new
      mobject), clone the repo and import straight from source:
    </p>
    <pre>{`git clone https://github.com/i-m-ashutosh99/lumina.git
cd lumina
npm install
npm run dev        # http://localhost:5173 — dev preview + docs site
npm run typecheck
npm run build`}</pre>
    <p>
      Source layout: the engine lives entirely under <code>src/lumina/</code>
      (<code>core/</code>, <code>mobjects/</code>, <code>animations/</code>,
      <code>cameras/</code>, <code>renderers/</code>, <code>math/</code>) and is re-exported
      through the single barrel <code>src/lumina/index.ts</code>. Import from the barrel in
      app code; import directly from submodules only inside the engine itself (to avoid
      circular imports — see the note in <code>mobjects/geometry/basic.ts</code> about
      <code>registerTextCtor</code>).
    </p>

    <h2>Framework integration notes</h2>
    <h3>React / Vue / Svelte</h3>
    <p>
      Lumina has no first-party React/Vue wrapper yet (tracked as a gap — see the
      <a href="/"> home page status grid</a>). In the meantime, mount it imperatively inside a
      <code>useEffect</code> / <code>onMounted</code> against a ref'd container div, and call
      <code>scene.destroy()</code> (if/when a teardown API exists) or simply drop the
      reference on unmount:
    </p>
    <pre>{`useEffect(() => {
  const scene = new Scene(containerRef.current!, { width: 800, height: 450 });
  let cancelled = false;
  (async () => {
    if (cancelled) return;
    await scene.play(new Create(new Circle()));
  })();
  return () => { cancelled = true; };
}, []);`}</pre>

    <h3>TypeScript strictness</h3>
    <p>
      The engine itself compiles under <code>strict: true</code>. Public constructors accept
      loosely-typed options objects (<code>opts: any = {}</code>) intentionally — mirroring
      Python's permissive kwargs — so application code does not need to fight the type
      checker over optional Manim-style option keys. Prefer named exported types
      (<code>SceneOptions</code>, <code>PlayOptions</code>, <code>MeshStyle</code>, …) where
      precision matters.
    </p>

    <h2>Snake_case vs camelCase</h2>
    <p>
      Every option object passed to a constructor or method is run through
      <code>normalizeOptions()</code>, which converts <code>snake_case</code> keys to
      <code>camelCase</code>. This means Python-muscle-memory options work directly:
    </p>
    <pre>{`new Rectangle({ corner_radius: 0.2 });  // works — normalized to cornerRadius
new Rectangle({ cornerRadius: 0.2 });   // also works, and is the canonical JS form`}</pre>

    <div class="callout">
      Next: <a href="/guides/core-concepts">Core Concepts</a> — understand the
      Mobject/Animation/Scene triad before writing your first real scene.
    </div>
  </>
);
