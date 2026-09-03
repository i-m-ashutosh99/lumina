import { Hono } from 'hono'
import { renderer } from './renderer'
import { Layout } from './site/layout'
import { HomePage } from './site/pages/home'
import { QuickstartPage } from './site/pages/quickstart'
import { InstallationPage } from './site/pages/guides/installation'
import { CoreConceptsPage } from './site/pages/guides/core-concepts'
import { AnimationsPage } from './site/pages/guides/animations'
import { TimelineSeekPage } from './site/pages/guides/timeline-seek'
import { TextPage } from './site/pages/guides/text'
import { GraphingPage } from './site/pages/guides/graphing'
import { Camera3DPage } from './site/pages/guides/camera-3d'
import { UpdatersPage } from './site/pages/guides/updaters'
import { ApiCorePage } from './site/pages/api/core'
import { ApiGeometryPage } from './site/pages/api/geometry'
import { ApiThreeDPage } from './site/pages/api/three-d'
import { ApiAnimationsPage } from './site/pages/api/animations'
import { ApiTextPage } from './site/pages/api/text'
import { ApiGraphingPage } from './site/pages/api/graphing'
import { ApiCamerasRenderersPage } from './site/pages/api/cameras-renderers'
import { GalleryPage } from './site/pages/gallery'
import { DeployNpmPage } from './site/pages/deployment/npm'
import { DeployCloudflarePage } from './site/pages/deployment/cloudflare'

const app = new Hono()

// Docs site routes — self-contained <html> shell via Layout, rendered
// directly (not through the `renderer` jsxRenderer middleware, which wraps
// its own <html>/<head> for the engine dev-preview page below).
const docsPage = (path: string, title: string, Page: any) => {
  app.get(path, (c) => c.html(<Layout title={title} active={path}><Page /></Layout>))
}

docsPage('/', 'Overview', HomePage)
docsPage('/quickstart', 'Quickstart', QuickstartPage)
docsPage('/guides/installation', 'Installation & Setup', InstallationPage)
docsPage('/guides/core-concepts', 'Core Concepts', CoreConceptsPage)
docsPage('/guides/animations', 'Animation Catalogue', AnimationsPage)
docsPage('/guides/timeline-seek', 'Timeline, Seeking & Playback', TimelineSeekPage)
docsPage('/guides/text', 'Text & Typography', TextPage)
docsPage('/guides/graphing', 'Graphing & Coordinate Systems', GraphingPage)
docsPage('/guides/camera-3d', '3D, Camera & Lighting', Camera3DPage)
docsPage('/guides/updaters', 'Updaters & ValueTrackers', UpdatersPage)
docsPage('/api/core', 'API: Core', ApiCorePage)
docsPage('/api/geometry', 'API: Geometry', ApiGeometryPage)
docsPage('/api/three-d', 'API: 3D', ApiThreeDPage)
docsPage('/api/animations', 'API: Animations', ApiAnimationsPage)
docsPage('/api/text', 'API: Text', ApiTextPage)
docsPage('/api/graphing', 'API: Graphing', ApiGraphingPage)
docsPage('/api/cameras-renderers', 'API: Cameras & Renderers', ApiCamerasRenderersPage)
docsPage('/gallery', 'Demo Gallery', GalleryPage)
docsPage('/deployment/npm', 'Publishing to npm', DeployNpmPage)
docsPage('/deployment/cloudflare', 'Hosting on Cloudflare', DeployCloudflarePage)

// Engine dev-preview smoke test (Canvas2D), kept at a separate path so it
// doesn't collide with the docs home page above. Uses its own minimal
// jsxRenderer middleware (style.css), scoped to just this route.
app.use('/dev-preview', renderer)
app.get('/dev-preview', (c) => {
  return c.render(
    <div class="wrap">
      <h1>Lumina — engine dev preview</h1>
      <p class="sub">
        Manim-familiar Mobject → Animation → Scene engine, running live in
        Canvas2D. This page is a minimal smoke test, not the final
        playground/player UI (not built yet — see README "Implementation
        status").
      </p>
      <div id="stage"></div>
      <div id="log">loading…</div>
      <script type="module" src="/src/demo.ts"></script>
    </div>
  )
})

export default app
