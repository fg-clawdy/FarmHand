import { useEffect, useRef, useState } from "react";
import { buildAtlas } from "./atlas";
import { createEngine, fitEngine, type PixiEngine } from "./engine";
import { FarmScene } from "./FarmScene";
import { GardenScene } from "./GardenScene";
import { loadPaintedArt } from "./paintedAssets";

let atlasPromise: ReturnType<typeof buildAtlas> | null = null;
let paintedPromise: ReturnType<typeof loadPaintedArt> | null = null;

function loadAtlas() {
  atlasPromise ??= buildAtlas();
  return atlasPromise;
}

/** Fresh GPU textures per mount — shared Texture cache goes blank after scene destroy/reparent on some mobile browsers. */
function loadPainted() {
  paintedPromise = loadPaintedArt();
  return paintedPromise;
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
      const [{ atlas }, painted, eng] = await Promise.all([loadAtlas(), loadPainted(), createEngine(host)]);
      if (dead) {
        eng.destroy();
        return;
      }
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

export function useGardenPixi(onPlot: (slot: number) => void, onAvatar?: () => void) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GardenScene | null>(null);
  const [ready, setReady] = useState(0);
  const onPlotRef = useRef(onPlot);
  onPlotRef.current = onPlot;
  const onAvatarRef = useRef(onAvatar);
  onAvatarRef.current = onAvatar;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let engine: PixiEngine | undefined;
    void (async () => {
      const [{ atlas }, painted, eng] = await Promise.all([loadAtlas(), loadPainted(), createEngine(host)]);
      if (dead) {
        eng.destroy();
        return;
      }
      engine = eng;
      const scene = new GardenScene(eng, atlas, painted, (slot) => onPlotRef.current(slot), () => onAvatarRef.current?.());
      if (dead) {
        scene.destroy();
        eng.destroy();
        return;
      }
      sceneRef.current = scene;
      afterLayout(eng, () => scene.relayout());
      setReady((n) => n + 1);
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
