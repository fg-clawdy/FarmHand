import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { PublicPlot } from "@farmhand/shared";
import { useGardenPixi } from "../pixi/usePixi";

/** Live Pixi garden with planted plots — no API. Used to proof mound alignment. */
export default function GardenQa() {
  const [params] = useSearchParams();
  const pack = params.get("pack") ?? "willow";
  const { hostRef, sceneRef, ready } = useGardenPixi(() => undefined);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setName("Willow's garden");
    scene.setPlots(qaPlots(pack));
  }, [ready, pack, sceneRef]);

  return (
    <div className="screen garden-hybrid">
      <div className="pixi-host" ref={hostRef} data-qa="garden-pixi" />
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

function qaPlots(pack: string): PublicPlot[] {
  if (pack === "berries") {
    return Array.from({ length: 9 }, (_, slot) => plot(slot, 2, 4, true));
  }
  if (pack === "flowers") {
    return Array.from({ length: 9 }, (_, slot) => plot(slot, 2, 3));
  }
  // Matches the annotated Willow screenshot mix: corn, flowering berry, sprouts.
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
