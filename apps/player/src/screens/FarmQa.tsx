import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { FarmPlayerCard, PublicPlot } from "@farmhand/shared";
import { useFarmPixi } from "../pixi/usePixi";

/** Live Pixi farm with planted plots — no API. Used to proof playfield mound UVs. */
export default function FarmQa() {
  const [params] = useSearchParams();
  const pack = params.get("pack") ?? "mix";
  const markers = params.get("markers") === "1";
  const { hostRef, sceneRef, ready } = useFarmPixi({
    onPlayer: () => undefined,
    onStore: () => undefined,
  });

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setPlayers(qaPlayers(pack));
    scene.setMoundMarkers(markers);
  }, [ready, pack, markers, sceneRef]);

  return (
    <div className="scene farm-hybrid">
      <div className="pixi-host" ref={hostRef} data-qa="farm-pixi" />
    </div>
  );
}

function plot(slot: number, tier: 1 | 2 | 3, stage: 1 | 2 | 3 | 4, ready = false): PublicPlot {
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

function emptyPlots(): PublicPlot[] {
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

function card(id: string, name: string, plots: PublicPlot[]): FarmPlayerCard {
  return {
    id,
    name,
    mascot: "cow",
    seeds: 8,
    points: 12,
    fertilizer: 1,
    canWater: true,
    plots,
    hasPin: false,
    unlocked: true,
    isActive: true,
  };
}

function qaPlayers(pack: string): FarmPlayerCard[] {
  if (pack === "empty") {
    return [card("l", "Willow", emptyPlots()), card("c", "Finn", emptyPlots()), card("r", "Sage", emptyPlots())];
  }
  return [
    card("l", "Willow", [plot(0, 1, 4, true), plot(4, 2, 3), plot(6, 1, 2), plot(7, 2, 2)]),
    card("c", "Finn", [plot(1, 2, 4, true), plot(4, 2, 3), plot(8, 1, 4, true)]),
    card("r", "Sage", [plot(0, 3, 3), plot(4, 3, 2), plot(8, 3, 4, true)]),
  ];
}
