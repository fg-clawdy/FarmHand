import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { PublicPlot } from "@farmhand/shared";
import { useGardenPixi } from "../pixi/usePixi";

/** Live Pixi garden — no API. Shared-goal jars live on the farm overview, not here. */
export default function GardenQa() {
  const [params] = useSearchParams();
  const pack = params.get("pack") ?? "willow";
  const markers = params.get("markers") === "1";
  const { hostRef, sceneRef, ready } = useGardenPixi(() => undefined);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setName("Willow");
    scene.setPlots(qaPlots(pack));
    scene.setMoundMarkers(markers);
  }, [ready, pack, markers, sceneRef]);

  return (
    <div className="screen garden-hybrid">
      <div className="pixi-host" ref={hostRef} data-qa="garden-pixi" />
    </div>
  );
}

function plot(slot: number, tier: 1 | 2 | 3 | 4 | 5 | 6, stage: 1 | 2 | 3 | 4, ready = false): PublicPlot {
  return {
    slot,
    state: ready ? "mature" : "growing",
    tier,
    plantedAt: "2026-01-01T00:00:00.000Z",
    maturesAt: ready ? "2026-01-01T00:00:00.000Z" : "2026-01-02T00:00:00.000Z",
    remainingMs: ready ? 0 : 3_600_000,
    growthStage: stage,
    emoji: null,
    face: null,
    ready,
  };
}

function qaPlots(pack: string): PublicPlot[] {
  if (pack === "empty") {
    return Array.from({ length: 9 }, (_, slot) => ({
      slot,
      state: "empty" as const,
      tier: null,
      plantedAt: null,
      maturesAt: null,
      remainingMs: 0,
      growthStage: null,
      emoji: null,
      face: null,
      ready: false,
    }));
  }
  if (pack === "berries") {
    return Array.from({ length: 9 }, (_, slot) => plot(slot, 2, 4, true));
  }
  if (pack === "flowers" || pack === "blossom") {
    return Array.from({ length: 9 }, (_, slot) => plot(slot, 2, 3));
  }
  if (pack === "willow-full") {
    return [
      plot(0, 1, 4, true),
      plot(1, 1, 3),
      plot(2, 1, 2),
      plot(3, 3, 2),
      plot(4, 2, 3),
      plot(5, 3, 3),
      plot(6, 1, 2),
      plot(7, 2, 2),
      plot(8, 1, 4, true),
    ];
  }
  if (pack === "seat") {
    return [
      plot(0, 1, 1),
      plot(1, 2, 1),
      plot(2, 6, 1),
      plot(3, 5, 1),
      plot(4, 4, 1),
      plot(5, 5, 2),
      plot(6, 1, 2),
      plot(7, 2, 2),
      plot(8, 6, 2),
    ];
  }
  if (pack === "raise") {
    return [
      plot(0, 1, 4, true),
      plot(1, 2, 4, true),
      plot(2, 6, 4, true),
      plot(3, 4, 4, true),
      plot(4, 5, 4, true),
      plot(5, 3, 4, true),
      plot(6, 4, 4, true),
      plot(7, 5, 4, true),
      plot(8, 2, 4, true),
    ];
  }
  return [
    plot(0, 1, 4, true),
    plot(4, 2, 3),
    plot(6, 1, 2),
    plot(7, 2, 2),
  ];
}
