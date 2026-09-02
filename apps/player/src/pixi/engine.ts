import { Application, Ticker } from "pixi.js";

export type PixiEngine = {
  app: Application;
  host: HTMLElement;
  destroy: () => void;
};

/**
 * One WebGL context for the whole player PWA.
 * Route changes reparent the canvas instead of destroying the renderer —
 * creating a second Application on /garden was exhausting the browser context
 * and crashing with "Cannot create WebGL context".
 */
let shared: Application | null = null;
let boot: Promise<Application> | null = null;
let visBound = false;

async function sharedApp(): Promise<Application> {
  if (shared) return shared;
  boot ??= (async () => {
    const app = new Application();
    await app.init({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: "high-performance",
      preference: "webgl",
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

function fit(app: Application, host: HTMLElement) {
  const w = Math.max(1, host.clientWidth);
  const h = Math.max(1, host.clientHeight);
  app.renderer.resize(w, h);
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
}

export async function createEngine(host: HTMLElement): Promise<PixiEngine> {
  const app = await sharedApp();
  if (app.canvas.parentElement && app.canvas.parentElement !== host) {
    app.canvas.parentElement.removeChild(app.canvas);
  }
  if (app.canvas.parentElement !== host) host.appendChild(app.canvas);
  fit(app, host);
  const onResize = () => fit(app, host);
  window.addEventListener("resize", onResize);
  requestAnimationFrame(() => fit(app, host));

  return {
    app,
    host,
    destroy() {
      window.removeEventListener("resize", onResize);
      if (app.canvas.parentElement === host) host.removeChild(app.canvas);
    },
  };
}
