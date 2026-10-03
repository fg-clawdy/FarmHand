import { Rectangle, type Application, type Container } from "pixi.js";
import { log } from "../logger";
import { fitEngine, renderNow } from "./engine";
import {
  gardenPresentStatus,
  sampleRgbaGrid,
  type PresentStatus,
} from "./webglBoot";

type RendererFacts = {
  context?: { isLost?: boolean; webGLVersion?: 1 | 2 };
  extract?: {
    pixels: (options: {
      target: Container;
      frame?: Rectangle;
      resolution?: number;
    }) => { pixels: Uint8ClampedArray; width: number; height: number };
  };
};

export class ScenePresentError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super("The garden picture didn't show up. Go back and try again.");
    this.name = "ScenePresentError";
    this.reason = reason;
  }
}

function facts(app: Application): RendererFacts {
  return app.renderer as Application["renderer"] & RendererFacts;
}

/** Sample the middle of the stage. Blank means only the grass clear color was drawn. */
export function confirmScenePresented(app: Application): PresentStatus {
  const renderer = facts(app);
  const screenW = app.screen.width;
  const screenH = app.screen.height;
  const contextLost = !!renderer.context?.isLost;
  const webGLVersion = renderer.context?.webGLVersion ?? 0;
  let samples: ReturnType<typeof sampleRgbaGrid> | null = null;
  if (!contextLost && renderer.extract && screenW >= 2 && screenH >= 2) {
    try {
      renderNow(app);
      const frame = new Rectangle(
        screenW * 0.25,
        screenH * 0.25,
        Math.max(8, screenW * 0.5),
        Math.max(8, screenH * 0.5),
      );
      const resolution = Math.min(1, 48 / frame.width);
      const shot = renderer.extract.pixels({ target: app.stage, frame, resolution });
      samples = sampleRgbaGrid(shot.pixels, shot.width, shot.height);
    } catch (err) {
      log.warn("pixi.present", err instanceof Error ? err.message : String(err));
      samples = null;
    }
  }
  return gardenPresentStatus({
    stageChildren: app.stage.children.length,
    screenW,
    screenH,
    contextLost,
    webGLVersion,
    samples,
  });
}

/** Re-seat the canvas on its own layer and repaint. Helps a dropped compositor frame. */
export function nudgePresentedCanvas(app: Application, host: HTMLElement) {
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.display = "block";
  canvas.style.opacity = "1";
  canvas.style.transform = "translateZ(0)";
  if (host.isConnected) fitEngine(app, host);
  renderNow(app);
}

/**
 * Mark the host with the present status. One compositor nudge if the first
 * read is only the clear color. Returns the status the kid will live with.
 */
export function publishScenePresent(host: HTMLElement, app: Application): PresentStatus {
  let status = confirmScenePresented(app);
  if (!status.ok && status.reason !== "webgl-context-lost") {
    nudgePresentedCanvas(app, host);
    status = confirmScenePresented(app);
  }
  host.dataset.farmhandScene = status.reason;
  host.dataset.farmhandWebgl = String(facts(app).context?.webGLVersion ?? 0);
  host.dataset.farmhandStage = String(app.stage.children.length);
  const detail = {
    reason: status.reason,
    webgl: host.dataset.farmhandWebgl,
    stage: host.dataset.farmhandStage,
    screen: { w: app.screen.width, h: app.screen.height },
    canvas: { w: app.canvas.width, h: app.canvas.height },
    host: { w: host.clientWidth, h: host.clientHeight },
  };
  if (status.ok) {
    log.info("pixi.present", "scene drawn", detail);
  } else if (status.reason === "no-pixels") {
    // Extract failed; the stage may still be on screen. Don't hide a good garden.
    log.warn("pixi.present", "could not read the frame", detail);
  } else {
    log.error("pixi.present", "garden scene did not draw over the grass clear", detail);
  }
  return status;
}

/** Positive evidence the playfield is missing. A failed pixel read is not enough. */
export function presentBlocksPlay(status: PresentStatus): boolean {
  return !status.ok && status.reason !== "no-pixels";
}
