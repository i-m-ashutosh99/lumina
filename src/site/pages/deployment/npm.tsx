import type { FC } from 'hono/jsx';

export const DeployNpmPage: FC = () => (
  <>
    <h1>Deployment — Publishing to npm</h1>
    <p class="lead">The engine's public API (<code>src/lumina/index.ts</code>) is already a clean barrel export designed to become an installable package. This page documents what publishing requires — some of it is <strong>not yet configured</strong> in this repo, flagged explicitly below.</p>

    <div class="callout warn">
      <strong>Status: not yet published.</strong> <code>package.json</code> currently has no <code>main</code> /
      <code>module</code> / <code>types</code> / <code>exports</code> / <code>files</code> fields, and there is no
      library-mode build step (the existing <code>vite build</code> targets the Cloudflare Pages <em>site</em>,
      producing a Workers bundle — not a distributable npm package). The steps below are the recipe to get there.
    </div>

    <h2>1. Add a library build target</h2>
    <p>Vite supports a second, separate "library mode" build alongside the existing site build. Add a
    dedicated config (e.g. <code>vite.lib.config.ts</code>) that builds only <code>src/lumina/index.ts</code>:</p>
    <pre>{`// vite.lib.config.ts
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'; // generates .d.ts from the TS source

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    outDir: 'dist-lib',
    lib: {
      entry: 'src/lumina/index.ts',
      name: 'Lumina',
      formats: ['es', 'cjs'],
      fileName: (format) => \`lumina.\${format === 'es' ? 'mjs' : 'cjs'}\`,
    },
    rollupOptions: {
      // keep opentype.js / mathjax-full / katex as real npm deps, not bundled,
      // so consumers control their own versions and bundle size
      external: ['opentype.js', 'mathjax-full', 'katex'],
    },
  },
});`}</pre>

    <h2>2. Add package.json publish fields</h2>
    <pre>{`{
  "name": "lumina-animate",          // "lumina" is very likely already taken on npm — verify first
  "version": "0.1.0",
  "type": "module",
  "main": "./dist-lib/lumina.cjs",
  "module": "./dist-lib/lumina.mjs",
  "types": "./dist-lib/lumina.d.ts",
  "exports": {
    ".": {
      "types": "./dist-lib/lumina.d.ts",
      "import": "./dist-lib/lumina.mjs",
      "require": "./dist-lib/lumina.cjs"
    }
  },
  "files": ["dist-lib"],
  "sideEffects": false,
  "scripts": {
    "build:lib": "vite build -c vite.lib.config.ts"
  }
}`}</pre>
    <p>Verify name availability first: <code>npm view lumina-animate</code> should 404. Manim-flavored names
    already in the JS ecosystem (<code>manim</code>-anything on npm) should be avoided to prevent confusion with
    this project's own prior-art research (see the project's internal research docs on Manim.js / manim-web).</p>

    <h2>3. Build, inspect, and dry-run</h2>
    <pre>{`npm run build:lib
npm pack --dry-run     # lists exactly which files would be published
node -e "require('./dist-lib/lumina.cjs')"   # sanity-check the CJS build loads`}</pre>

    <h2>4. Publish</h2>
    <pre>{`npm login
npm publish --access public`}</pre>
    <p>For pre-release testing before a real <code>1.0.0</code>, tag it: <code>npm version 0.1.0-beta.0 --no-git-tag-version && npm publish --tag next --access public</code>.</p>

    <h2>5. Consuming the published package</h2>
    <pre>{`npm install lumina-animate

import { Scene, Circle, Create, FadeIn } from 'lumina-animate';

class MyScene extends Scene {
  async construct() {
    const c = new Circle();
    this.add(c);
    await this.play(new Create(c));
  }
}
new MyScene(document.getElementById('stage')).run();`}</pre>

    <h2>6. Ongoing releases</h2>
    <ul class="member-list">
      <li>Bump version with <code>npm version patch|minor|major</code> (writes <code>package.json</code> + a git tag).</li>
      <li>Follow semver strictly once past <code>1.0.0</code> — the <code>Mobject</code>/<code>Animation</code>/<code>Scene</code> base classes are the widest-blast-radius surface; changes there are breaking changes.</li>
      <li>Keep <code>opentype.js</code>, <code>mathjax-full</code>, and <code>katex</code> as <code>peerDependencies</code> or regular <code>dependencies</code> (not bundled) so consumers aren't forced to double-ship large font/math libraries if their app already uses them.</li>
    </ul>
  </>
);
