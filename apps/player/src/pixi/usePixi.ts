import { useEffect, useRef, useState } from "react";
import { buildAtlas } from "./atlas";
import { createEngine, type PixiEngine } from "./engine";
import { FarmScene } from "./FarmScene";
import { GardenScene } from "./GardenScene";
import { loadPaintedArt } from "./paintedAssets";

let atlasPromise: ReturnType<typeof buildAtlas> | null = null;
let paintedPromise: ReturnType<typeof loadPaintedArt> | null = null;

function loadAtlas() {
  atlasPromise ??= buildAtlas();
  return atlasPromise;
}

function loadPainted() {
  paintedPromise ??= loadPaintedArt();
  return paintedPromise;
}

export function useFarmPixi(handlers: { onPlayer: (id: string) => void; onStore: () => void }) {
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
      if (dead) {
        eng.destroy();
        return;
      }
      const scene = new FarmScene(eng, atlas, painted, {
        onPlayer: (id) => handlersRef.current.onPlayer(id),
        onStore: () => handlersRef.current.onStore(),
      });
      if (dead) {
        scene.destroy();
        eng.destroy();
        return;
      }
      sceneRef.current = scene;
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

export function useGardenPixi(onPlot: (slot: number) => void) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GardenScene | null>(null);
  const [ready, setReady] = useState(0);
  const onPlotRef = useRef(onPlot);
  onPlotRef.current = onPlot;

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
      if (dead) {
        eng.destroy();
        return;
      }
      const scene = new GardenScene(eng, atlas, painted, (slot) => onPlotRef.current(slot));
      if (dead) {
        scene.destroy();
        eng.destroy();
        return;
      }
      sceneRef.current = scene;
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
