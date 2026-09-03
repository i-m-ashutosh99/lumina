import { Hono } from 'hono'
import { renderer } from './renderer'

const app = new Hono()

app.use(renderer)

app.get('/', (c) => {
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
