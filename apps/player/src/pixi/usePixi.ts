import { useEffect, useRef, useState } from "react";
import { Texture } from "pixi.js";
import { log } from "../logger";
import { buildAtlas } from "./atlas";
import { createEngine, fitEngine, waitForHostSize, type PixiEngine } from "./engine";
import { FarmScene } from "./FarmScene";
import { GardenScene } from "./GardenScene";
import { loadPaintedArt, type PaintedArt } from "./paintedAssets";

let atlasPromise: ReturnType<typeof buildAtlas> | null = null;
let paintedLoadGen = 0;

function loadAtlas() {
  atlasPromise ??= buildAtlas();
  return atlasPromise;
}

/** Fresh GPU textures per mount — shared Texture cache goes blank after scene destroy/reparent on some mobile browsers. */
function loadPainted() {
  const gen = ++paintedLoadGen;
  return loadPaintedArt().then((art) => {
    // A newer remount won the race — discard stale result (Assets.unload may have invalidated it).
    if (gen !== paintedLoadGen) {
      throw new Error("Painted art load superseded by a newer mount");
    }
    return art;
  });
}

function afterLayout(eng: PixiEngine, layout: () => void) {
  fitEngine(eng.app, eng.host);
  layout();
  requestAnimationFrame(() => {
    fitEngine(eng.app, eng.host);
    layout();
    requestAnimationFrame(() => {
      fitEngine(eng.app, eng.host);
      layout();
    });
  });
}

function textureOk(tex: Texture | undefined | null, label: string, misses: string[]) {
  if (!tex || tex === Texture.EMPTY || !tex.source) {
    misses.push(label);
    return false;
  }
  return true;
}

/** Detect Assets-cache / GPU-source gaps before the render loop touches them. */
export function auditPaintedArt(painted: PaintedArt): string[] {
  const misses: string[] = [];
  textureOk(painted.playfield, "playfield", misses);
  textureOk(painted.gardenZoom, "gardenZoom", misses);
  textureOk(painted.corkboard, "corkboard", misses);
  painted.smokeFrames.forEach((t, i) => textureOk(t, `smoke[${i}]`, misses));
  painted.cowWalk.forEach((t, i) => textureOk(t, `cowWalk[${i}]`, misses));
  painted.cowEat.forEach((t, i) => textureOk(t, `cowEat[${i}]`, misses));
  painted.wantedPosterFrames.forEach((t, i) => textureOk(t, `wanted[${i}]`, misses));
  for (const [kind, frames] of Object.entries(painted.crops)) {
    frames.forEach((t, i) => textureOk(t, `crop:${kind}[${i}]`, misses));
  }
  return misses;
}

/**
 * Boot order matters on Samsung tablet PWAs:
 * 1) create shared WebGL app + attach canvas
 * 2) wait until .pixi-host has a real client box (avoid 1x1 green stretch)
 * 3) load textures against the live renderer
 * 4) build scene + multi-rAF relayout (ResizeObserver in engine keeps fitting)
 */
async function bootPixi(host: HTMLElement, dead: () => boolean) {
  const eng = await createEngine(host);
  if (dead()) {
    eng.destroy();
    return null;
  }
  const size = await waitForHostSize(host);
  log.info("pixi.host", "host sized", size);
  if (dead()) {
    eng.destroy();
    return null;
  }
  fitEngine(eng.app, host);
  const [{ atlas }, painted] = await Promise.all([loadAtlas(), loadPainted()]);
  if (dead()) {
    eng.destroy();
    return null;
  }
  return { eng, atlas, painted };
}

export function useFarmPixi(handlers: {
  onPlayer: (id: string) => void;
  onStore: () => void;
  onJobBoard: () => void;
  onAvatar?: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FarmScene | null>(null);
  const [ready, setReady] = useState(0);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let engine: PixiEngine | undefined;
    void (async () => {
      try {
        log.info("farm.mount", "create app + load assets");
        const boot = await bootPixi(host, () => dead);
        if (!boot) return;
        const { eng, atlas, painted } = boot;
        const misses = auditPaintedArt(painted);
        if (misses.length) log.warn("farm.mount", "painted texture misses", { misses: misses.slice(0, 20) });
        engine = eng;
        const scene = new FarmScene(eng, atlas, painted, {
          onPlayer: (id) => handlersRef.current.onPlayer(id),
          onStore: () => handlersRef.current.onStore(),
          onJobBoard: () => handlersRef.current.onJobBoard(),
          onAvatar: (id) => handlersRef.current.onAvatar?.(id),
        });
        if (dead) {
          scene.destroy();
          eng.destroy();
          return;
        }
        sceneRef.current = scene;
        afterLayout(eng, () => scene.relayout());
        setReady((n) => n + 1);
        log.info("farm.mount", "ready", {
          host: { w: host.clientWidth, h: host.clientHeight },
          screen: { w: eng.app.screen.width, h: eng.app.screen.height },
        });
      } catch (err) {
        if (dead) return;
        const message = err instanceof Error ? err.message : String(err);
        log.error("farm.mount", message, { stack: err instanceof Error ? err.stack : undefined });
      }
    })();
    return () => {
      dead = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      engine?.destroy();
    };
  }, []);

  return { hostRef, sceneRef, ready };
}

export type GardenPixiError = { message: string; phase: string };

export function useGardenPixi(onPlot: (slot: number) => void, onAvatar?: () => void, onBasket?: () => void) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GardenScene | null>(null);
  const [ready, setReady] = useState(0);
  const [mountError, setMountError] = useState<GardenPixiError | null>(null);
  const onPlotRef = useRef(onPlot);
  onPlotRef.current = onPlot;
  const onAvatarRef = useRef(onAvatar);
  onAvatarRef.current = onAvatar;
  const onBasketRef = useRef(onBasket);
  onBasketRef.current = onBasket;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let engine: PixiEngine | undefined;
    let phase = "boot";
    void (async () => {
      try {
        setMountError(null);
        phase = "create-app+wait-host";
        log.info("garden.mount", "create app + wait host + load assets");
        const boot = await bootPixi(host, () => dead);
        if (!boot) return;
        const { eng, atlas, painted } = boot;
        phase = "audit-textures";
        const misses = auditPaintedArt(painted);
        if (misses.length) {
          log.warn("garden.mount", "painted texture misses before GardenScene", {
            misses: misses.slice(0, 20),
            count: misses.length,
          });
        }
        if (!painted.gardenZoom?.source) {
          throw new Error("Garden zoom texture missing from cache");
        }
        engine = eng;
        phase = "create-GardenScene";
        log.info("garden.mount", "create GardenScene");
        const scene = new GardenScene(
          eng,
          atlas,
          painted,
          (slot) => onPlotRef.current(slot),
          () => onAvatarRef.current?.(),
          () => onBasketRef.current?.(),
        );
        if (dead) {
          scene.destroy();
          eng.destroy();
          return;
        }
        phase = "layout";
        sceneRef.current = scene;
        afterLayout(eng, () => scene.relayout());
        setReady((n) => n + 1);
        log.info("garden.mount", "ready", {
          host: { w: host.clientWidth, h: host.clientHeight },
          screen: { w: eng.app.screen.width, h: eng.app.screen.height },
        });
      } catch (err) {
        if (dead) return;
        const message = err instanceof Error ? err.message : String(err);
        log.error("garden.mount", message, {
          phase,
          stack: err instanceof Error ? err.stack : undefined,
        });
        setMountError({ message, phase });
        try {
          engine?.destroy();
        } catch {
          /* ignore cleanup errors */
        }
      }
    })();
    return () => {
      dead = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      engine?.destroy();
    };
  }, []);

  return { hostRef, sceneRef, ready, mountError };
}
