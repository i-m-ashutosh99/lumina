/**
 * Lumina — player/element.ts
 * `<lumina-player>` custom Web Component (doc 08 §5.1/§4.2/§4.3). Consumption
 * mode 1 from doc 08 §1: "embed in educational websites". Wraps a `Player`
 * (player.ts) and paints default HTML/CSS chrome — semantic DOM structure
 * matches doc 08 §4.2 exactly so `chrome.css` selectors line up.
 *
 * Usage (external module, doc 08 §5.1):
 * ```html
 * <script type="module" src="/lumina/player.js"></script>
 * <lumina-player src="./scenes/fourier.js" width="960" height="540" controls></lumina-player>
 * ```
 * `src` must export `construct(scene)` (an async function that calls
 * `scene.play(...)`/`scene.wait(...)`) — see doc 08 §5.1/§10 (security:
 * `src` must be trusted, same-origin or a reviewed CDN; no `eval`).
 *
 * Usage (inline construct, doc 08 §5.1 "Property: el.construct = fn" and
 * `register(name, fn)` + `scene="name"`):
 * ```js
 * import { register } from 'lumina/player';
 * register('fourier', async (scene) => { ... });
 * ```
 * ```html
 * <lumina-player scene="fourier" width="960" height="540" controls></lumina-player>
 * ```
 *
 * Authors who want their OWN chrome set `controls="false"` and drive the
 * scene via `element.player` (a `Player` instance) directly — this is
 * consumption mode 2 (doc 08 §4).
 */
import { Scene } from '../core/scene';
import { Player } from './player';

type ConstructFn = (scene: Scene) => Promise<void> | void;

const registry = new Map<string, ConstructFn>();

/** Register a named scene constructor for `<lumina-player scene="name">`
 *  (doc 08 §5.1). */
export function register(name: string, fn: ConstructFn): void {
  registry.set(name, fn);
}

const CHROME_CSS = `
:host {
  --lumina-accent: #58C4DD;
  --lumina-chrome-bg: rgba(0,0,0,.72);
  --lumina-chrome-fg: #fff;
  --lumina-radius: 8px;
  display: inline-block;
  position: relative;
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1;
}
.lumina-player { position: relative; width: 100%; height: 100%; background: #000; border-radius: var(--lumina-radius); overflow: hidden; }
.lumina-viewport { position: relative; width: 100%; height: 100%; }
.lumina-viewport canvas { display: block; width: 100%; height: 100%; }
.lumina-error-overlay {
  position: absolute; inset: 0; display: none; flex-direction: column; gap: 8px;
  align-items: center; justify-content: center; background: rgba(20,0,0,.85);
  color: #ff8080; padding: 16px; font-size: 13px; text-align: center; z-index: 5;
  overflow: auto; white-space: pre-wrap;
}
.lumina-error-overlay.visible { display: flex; }
.lumina-chrome {
  position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center;
  gap: 8px; padding: 8px 12px; background: var(--lumina-chrome-bg); color: var(--lumina-chrome-fg);
  transition: opacity .2s; z-index: 4;
}
.lumina-player.controls-hidden .lumina-chrome { display: none; }
.lumina-chrome button {
  background: transparent; border: none; color: var(--lumina-chrome-fg); cursor: pointer;
  font-size: 15px; padding: 4px 6px; border-radius: 4px; display: flex; align-items: center;
}
.lumina-chrome button:hover { background: rgba(255,255,255,.15); }
.lumina-chrome input[type="range"] {
  flex: 1; accent-color: var(--lumina-accent); cursor: pointer;
}
.lumina-chrome time { font-size: 12px; min-width: 84px; text-align: center; font-variant-numeric: tabular-nums; }
.lumina-chrome .lumina-speed-btn { font-size: 12px; min-width: 34px; justify-content: center; }
`;

/**
 * `<lumina-player>` — see file header for attributes/properties.
 * Attributes: `src`, `scene`, `width`, `height`, `controls`, `loop`, `autoplay`.
 * Properties: `element.construct = fn` (bypasses `src`/`scene`).
 */
export class LuminaPlayerElement extends HTMLElement {
  player: Player | null = null;
  scene: Scene | null = null;
  construct: ConstructFn | null = null;

  private root: ShadowRoot;
  private viewport: HTMLDivElement;
  private errorOverlay: HTMLDivElement;
  private chrome: HTMLDivElement;
  private btnPlay: HTMLButtonElement;
  private seekInput: HTMLInputElement;
  private timeDisplay: HTMLElement;
  private btnSpeed: HTMLButtonElement;
  private btnFs: HTMLButtonElement;
  private seeking = false;

  static get observedAttributes(): string[] {
    return ['src', 'scene', 'width', 'height', 'controls', 'loop', 'autoplay'];
  }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CHROME_CSS;
    this.root.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.className = 'lumina-player';

    this.viewport = document.createElement('div');
    this.viewport.className = 'lumina-viewport';

    this.errorOverlay = document.createElement('div');
    this.errorOverlay.className = 'lumina-error-overlay';

    this.chrome = document.createElement('div');
    this.chrome.className = 'lumina-chrome';

    this.btnPlay = document.createElement('button');
    this.btnPlay.setAttribute('aria-label', 'Play');
    this.btnPlay.textContent = '▶';
    this.btnPlay.addEventListener('click', () => this.player?.toggle());

    this.seekInput = document.createElement('input');
    this.seekInput.type = 'range';
    this.seekInput.min = '0';
    this.seekInput.max = '1000';
    this.seekInput.value = '0';
    this.seekInput.setAttribute('aria-label', 'Seek');
    this.seekInput.addEventListener('input', () => {
      this.seeking = true;
      const frac = Number(this.seekInput.value) / 1000;
      this.player?.seek(frac * (this.player?.duration ?? 0));
    });
    this.seekInput.addEventListener('change', () => { this.seeking = false; });

    this.timeDisplay = document.createElement('time');
    this.timeDisplay.textContent = '0:00 / 0:00';

    this.btnSpeed = document.createElement('button');
    this.btnSpeed.className = 'lumina-speed-btn';
    this.btnSpeed.textContent = '1×';
    this.btnSpeed.addEventListener('click', () => {
      const speeds = [0.25, 0.5, 1, 1.5, 2];
      const cur = this.player?.speed ?? 1;
      const idx = speeds.indexOf(cur);
      const next = speeds[(idx + 1 + speeds.length) % speeds.length] ?? 1;
      this.player?.setSpeed(next);
      this.btnSpeed.textContent = `${next}×`;
    });

    this.btnFs = document.createElement('button');
    this.btnFs.setAttribute('aria-label', 'Fullscreen');
    this.btnFs.textContent = '⛶';
    this.btnFs.addEventListener('click', () => this.player?.toggleFullscreen(wrapper));

    this.chrome.append(this.btnPlay, this.seekInput, this.timeDisplay, this.btnSpeed, this.btnFs);
    wrapper.append(this.viewport, this.errorOverlay, this.chrome);
    this.root.appendChild(wrapper);
    this._wrapper = wrapper;
  }

  private _wrapper: HTMLDivElement;

  connectedCallback(): void {
    const width = Number(this.getAttribute('width') ?? 960);
    const height = Number(this.getAttribute('height') ?? 540);
    this._wrapper.style.width = `${width}px`;
    this._wrapper.style.height = `${height}px`;
    if (this.getAttribute('controls') === 'false') {
      this._wrapper.classList.add('controls-hidden');
    }
    this._boot(width, height).catch((err) => this._showError(err));
  }

  disconnectedCallback(): void {
    this.player?.destroy();
    this.scene?.destroy();
  }

  private showControls(v: boolean): void {
    this._wrapper.classList.toggle('controls-hidden', !v);
  }

  private _showError(err: any): void {
    this.errorOverlay.textContent = `Lumina scene error:\n${err?.stack ?? err}`;
    this.errorOverlay.classList.add('visible');
  }

  private async _resolveConstruct(): Promise<ConstructFn> {
    if (this.construct) return this.construct;
    const sceneName = this.getAttribute('scene');
    if (sceneName && registry.has(sceneName)) return registry.get(sceneName)!;
    const src = this.getAttribute('src');
    if (src) {
      const mod = await import(/* @vite-ignore */ src);
      if (typeof mod.construct === 'function') return mod.construct;
      throw new Error(`Module "${src}" does not export a construct(scene) function.`);
    }
    throw new Error('<lumina-player> needs one of: construct property, scene="name" (with register()), or src="module.js".');
  }

  private async _boot(width: number, height: number): Promise<void> {
    const fn = await this._resolveConstruct();
    this.scene = new Scene(this.viewport, { width, height });
    await this.scene.construct(fn);

    this.player = new Player({ scene: this.scene, loop: this.getAttribute('loop') === 'true' });
    this.player.on('time', ({ t, duration }) => {
      if (!this.seeking) this.seekInput.value = String(Math.round((duration > 0 ? t / duration : 0) * 1000));
      this.timeDisplay.textContent = `${fmtTime(t)} / ${fmtTime(duration)}`;
    });
    this.player.on('play', () => { this.btnPlay.textContent = '⏸'; this.btnPlay.setAttribute('aria-label', 'Pause'); });
    this.player.on('pause', () => { this.btnPlay.textContent = '▶'; this.btnPlay.setAttribute('aria-label', 'Play'); });
    this.player.on('ended', () => { this.btnPlay.textContent = '▶'; });

    this.scene.renderAt(0);
    this.timeDisplay.textContent = `0:00 / ${fmtTime(this.player.duration)}`;

    if (this.getAttribute('autoplay') === 'true') this.player.play();
  }
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

if (typeof customElements !== 'undefined' && !customElements.get('lumina-player')) {
  customElements.define('lumina-player', LuminaPlayerElement);
}
