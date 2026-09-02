import { Application, Ticker } from "pixi.js";

export type PixiEngine = {
  app: Application;
  host: HTMLElement;
  destroy: () => void;
};

export async function createEngine(host: HTMLElement): Promise<PixiEngine> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    powerPreference: "high-performance",
    preference: "webgl",
  });
  app.canvas.style.display = "block";
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  app.canvas.style.touchAction = "none";
  host.appendChild(app.canvas);

  const onVis = () => {
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  };
  document.addEventListener("visibilitychange", onVis);
  Ticker.shared.maxFPS = 60;

  return {
    app,
    host,
    destroy() {
      document.removeEventListener("visibilitychange", onVis);
      app.destroy(true, { children: true, texture: false });
      if (app.canvas.parentElement === host) host.removeChild(app.canvas);
    },
  };
}
