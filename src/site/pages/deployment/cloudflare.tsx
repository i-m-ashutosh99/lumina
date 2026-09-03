import type { FC } from 'hono/jsx';

export const DeployCloudflarePage: FC = () => (
  <>
    <h1>Deployment — Hosting on Cloudflare Pages</h1>
    <p class="lead">This documentation site itself, and the engine's dev-preview, are a Hono app configured to build and deploy to Cloudflare Pages out of the box. This page documents the exact setup already in this repo.</p>

    <h2>1. Project shape</h2>
    <p>The relevant config files already in the repo:</p>
    <ul class="member-list">
      <li><code>wrangler.jsonc</code> — Pages project config: <code>name</code>, <code>pages_build_output_dir: "./dist"</code>, <code>compatibility_date</code>, <code>compatibility_flags: ["nodejs_compat"]</code>.</li>
      <li><code>vite.config.ts</code> — uses <code>@hono/vite-build/cloudflare-pages</code> as the Vite build adapter, so <code>vite build</code> emits a Cloudflare Pages Functions-compatible <code>dist/_worker.js</code> plus static assets.</li>
      <li><code>src/index.tsx</code> — the Hono app entry point (all routes, including this documentation site).</li>
    </ul>

    <h2>2. Local build &amp; preview</h2>
    <pre>{`npm install
npm run build      # vite build -> dist/_worker.js + dist/static/*
npm run preview    # wrangler pages dev  (serves dist/ locally via the Workers runtime)`}</pre>
    <p><code>npm run preview</code> runs the actual Cloudflare Pages Functions runtime locally (via Wrangler), not just a static file server — so routing, headers, and the Hono app behave exactly as they will in production.</p>

    <h2>3. First-time Cloudflare setup</h2>
    <p>Two ways to authenticate Wrangler, depending on whose Cloudflare account is being used:</p>
    <div class="grid-cards">
      <div class="card">
        <h3>Your own Cloudflare account</h3>
        <p>Use <code>wrangler login</code> (OAuth) or set a scoped API token as <code>CLOUDFLARE_API_TOKEN</code>, then:</p>
        <pre>{`wrangler pages project create lumina \\
  --production-branch main
npm run deploy   # build + wrangler pages deploy`}</pre>
      </div>
      <div class="card">
        <h3>Genspark-managed Cloudflare</h3>
        <p>If you don't want to manage a Cloudflare account/API token yourself, Genspark can deploy this
        project's Cloudflare resources (Workers/Pages) on a Genspark-managed account instead — no token
        needed on your side. Ask the agent to run the Hosted Deploy flow.</p>
      </div>
    </div>

    <h2>4. Deploying</h2>
    <pre>{`npm run deploy
# = npm run build && wrangler pages deploy`}</pre>
    <p>Every subsequent <code>npm run deploy</code> pushes a new deployment; Cloudflare Pages keeps deployment
    history and instant-rollback out of the box.</p>

    <h2>5. Custom domains &amp; environment variables</h2>
    <ul class="member-list">
      <li>Custom domains are attached from the Cloudflare Pages dashboard (Pages project → Custom domains), or via <code>wrangler pages deployment</code>/domain APIs if scripting the whole pipeline.</li>
      <li>Runtime bindings (KV/D1/R2/secrets) go in <code>wrangler.jsonc</code> and are regenerated into TypeScript types with <code>npm run cf-typegen</code> (<code>wrangler types --env-interface CloudflareBindings</code>) — Lumina's docs/engine currently declare no bindings, since everything here is static content plus client-side rendering.</li>
    </ul>

    <h2>6. What gets deployed</h2>
    <div class="callout">
      Cloudflare Pages hosts <strong>the documentation website and the engine's browser runtime</strong> (this
      site, the dev-preview smoke test, and any static demo assets). It does not publish the <code>lumina</code>
      npm package — that's a separate, unrelated step. See <a href="/deployment/npm">Publishing to npm</a>.
    </div>
  </>
);
