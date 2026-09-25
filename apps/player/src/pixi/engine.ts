import { Application, Ticker } from "pixi.js";

export type PixiEngine = {
  app: Application;
  host: HTMLElement;
  destroy: () => void;
};

/**
 * One WebGL context for the whole player PWA.
 * Route changes reparent the canvas instead of destroying the renderer -
 * creating a second Application on /garden was exhausting the browser context
 * and crashing with "Cannot create WebGL context".
 */
let shared: Application | null = null;
let boot: Promise<Application> | null = null;
let visBound = false;
/** Keep the canvas in the document when unmounted so mobile WebGL contexts survive reparent. */
let canvasPool: HTMLDivElement | null = null;

function pool(): HTMLDivElement {
  if (canvasPool && canvasPool.isConnected) return canvasPool;
  const el = document.createElement("div");
  el.setAttribute("data-farmhand-pixi-pool", "1");
  el.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(el);
  canvasPool = el;
  return el;
}

async function sharedApp(): Promise<Application> {
  if (shared) return shared;
  boot ??= (async () => {
    const app = new Application();
    // Avoid high-performance on mobile Firefox PWAs (clear-color / no textures).
    await app.init({
      background: 0x3d8a32,
      backgroundAlpha: 1,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: "low-power",
      preference: "webgl",
      preferWebGLVersion: 1,
      width: 800,
      height: 600,
    });
    app.canvas.style.display = "block";
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    app.canvas.style.touchAction = "none";
    Ticker.shared.maxFPS = 60;
    if (!visBound) {
      visBound = true;
      document.addEventListener("visibilitychange", () => {
        if (!shared) return;
        if (document.hidden) shared.ticker.stop();
        else shared.ticker.start();
      });
    }
    shared = app;
    return app;
  })();
  return boot;
}

export function fitEngine(app: Application, host: HTMLElement) {
  const w = Math.max(1, host.clientWidth);
  const h = Math.max(1, host.clientHeight);
  // Always resize: with autoDensity, renderer.width is device pixels and must not
  // be compared to CSS clientWidth (or we skip the real layout pass).
  app.renderer.resize(w, h);
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  return { w, h };
}

/** True when the host has a real laid-out box (not the pre-layout 0x0 -> 1x1 trap). */
export function hostHasSize(host: HTMLElement, min = 2): boolean {
  return host.clientWidth >= min && host.clientHeight >= min;
}

/**
 * Wait until the pixi-host has a non-trivial client box.
 * First route paint on Samsung PWAs often mounts with 0x0; fitting then locks the
 * shared renderer at 1x1 while CSS stretches it - solid green clear/fill, hits still work.
 */
export function waitForHostSize(host: HTMLElement, timeoutMs = 3000): Promise<{ w: number; h: number }> {
  if (hostHasSize(host)) {
    return Promise.resolve({ w: host.clientWidth, h: host.clientHeight });
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ro.disconnect();
      window.clearTimeout(timer);
      resolve({
        w: Math.max(1, host.clientWidth),
        h: Math.max(1, host.clientHeight),
      });
    };
    const ro = new ResizeObserver(() => {
      if (hostHasSize(host)) finish();
    });
    ro.observe(host);
    const timer = window.setTimeout(finish, timeoutMs);
    requestAnimationFrame(() => {
      if (hostHasSize(host)) finish();
    });
  });
}

export async function createEngine(host: HTMLElement): Promise<PixiEngine> {
  const app = await sharedApp();
  // Reparent without leaving the document (detach -> WebGL context loss on some tablets).
  if (app.canvas.parentElement !== host) {
    host.appendChild(app.canvas);
  }
  fitEngine(app, host);
  if (!app.ticker.started) app.ticker.start();

  const onResize = () => fitEngine(app, host);
  window.addEventListener("resize", onResize);
  const ro = new ResizeObserver(() => fitEngine(app, host));
  ro.observe(host);
  requestAnimationFrame(() => fitEngine(app, host));

  return {
    app,
    host,
    destroy() {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      if (app.canvas.parentElement === host) {
        pool().appendChild(app.canvas);
      }
    },
  };
}
