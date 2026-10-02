import { Application, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { log } from "../logger";

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
let healthBound = false;
/** Host the shared canvas currently lives in (null while parked in the pool). */
let activeHost: HTMLElement | null = null;
let framesDrawn = 0;
let lastFrameAt = 0;
let stallReports = 0;

/** No ticker frame for this long while the page is visible = the rAF loop is dead. */
export const STALL_MS = 750;

/**
 * Pure stall check. Pixi's Ticker.start() is a no-op while `started` is true, so a
 * dropped requestAnimationFrame (PWA launch / route change on some tablets) leaves a
 * "started" ticker that never draws - solid clear-colour green until a background and
 * foreground cycle runs stop() then start().
 */
export function tickerStalled(input: {
  visible: boolean;
  now: number;
  lastFrameAt: number;
  stallMs?: number;
}): boolean {
  if (!input.visible) return false;
  return input.now - input.lastFrameAt > (input.stallMs ?? STALL_MS);
}

function contextLost(app: Application): boolean {
  const ctx = (app.renderer as unknown as { context?: { isLost?: boolean } }).context;
  return !!ctx?.isLost;
}

/** Draw one frame right now, independent of requestAnimationFrame. */
export function renderNow(app: Application) {
  if (contextLost(app)) return;
  try {
    app.render();
  } catch (err) {
    log.warn("pixi.render", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Re-measure, optionally bounce the ticker (stop cancels a dead rAF id, start requests
 * a fresh one), and paint immediately.
 */
function wake(app: Application, reason: string, restartTicker: boolean) {
  const host = activeHost;
  if (host && host.isConnected && hostHasSize(host)) fitEngine(app, host);
  if (restartTicker) {
    app.ticker.stop();
    app.ticker.start();
  } else if (!app.ticker.started) {
    app.ticker.start();
  }
  renderNow(app);
  lastFrameAt = performance.now();
  void reason;
}

function bindHealth(app: Application) {
  if (healthBound) return;
  healthBound = true;
  lastFrameAt = performance.now();
  // Runs after Application's own render listener (LOW) so it only counts real frames.
  app.ticker.add(
    () => {
      framesDrawn++;
      lastFrameAt = performance.now();
    },
    undefined,
    UPDATE_PRIORITY.UTILITY,
  );

  document.addEventListener("visibilitychange", () => {
    if (!shared) return;
    if (document.hidden) shared.ticker.stop();
    else wake(shared, "visible", true);
  });
  window.addEventListener("pageshow", () => {
    if (shared) wake(shared, "pageshow", true);
  });
  window.addEventListener("focus", () => {
    if (shared && !document.hidden) wake(shared, "focus", false);
  });
  window.addEventListener("orientationchange", () => {
    if (!shared) return;
    wake(shared, "orientation", false);
    // Standalone viewports settle a beat after the event fires.
    window.setTimeout(() => shared && wake(shared, "orientation+300", false), 300);
  });
  window.visualViewport?.addEventListener("resize", () => {
    if (shared) wake(shared, "visualViewport", false);
  });

  // setInterval is not gated on rAF, so it can still rescue a dead rAF loop.
  window.setInterval(() => {
    if (!shared) return;
    const now = performance.now();
    if (!tickerStalled({ visible: !document.hidden, now, lastFrameAt })) return;
    const sinceFrame = Math.round(now - lastFrameAt);
    wake(shared, "stall", true);
    if (stallReports < 3) {
      stallReports++;
      const host = activeHost;
      log.error("pixi.stall", "render loop stalled while visible; restarted", {
        sinceFrameMs: sinceFrame,
        framesDrawn,
        started: shared.ticker.started,
        contextLost: contextLost(shared),
        visibility: document.visibilityState,
        standalone:
          typeof matchMedia === "function" ? matchMedia("(display-mode: standalone)").matches : null,
        host: host ? { w: host.clientWidth, h: host.clientHeight, connected: host.isConnected } : null,
        canvas: { w: shared.canvas.width, h: shared.canvas.height },
        screen: { w: shared.screen.width, h: shared.screen.height },
      });
    }
  }, 500);
}
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
    shared = app;
    bindHealth(app);
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
  activeHost = host;
  fitEngine(app, host);
  // A route change can leave a "started" ticker whose rAF was dropped: bounce it.
  if (!app.ticker.started) app.ticker.start();
  else wake(app, "mount", true);

  // Resizing clears the drawing buffer; always repaint in the same task so the
  // compositor never presents an empty (clear-colour) frame while waiting for rAF.
  const refit = () => {
    fitEngine(app, host);
    renderNow(app);
  };
  window.addEventListener("resize", refit);
  const ro = new ResizeObserver(refit);
  ro.observe(host);
  requestAnimationFrame(refit);

  return {
    app,
    host,
    destroy() {
      window.removeEventListener("resize", refit);
      ro.disconnect();
      if (activeHost === host) activeHost = null;
      if (app.canvas.parentElement === host) {
        pool().appendChild(app.canvas);
      }
    },
  };
}
