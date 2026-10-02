import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { PublicPlot } from "@farmhand/shared";
import { useGardenPixi } from "../pixi/usePixi";

/** Live Pixi garden with planted plots — no API. Used to proof mound alignment. */
export default function GardenQa() {
  const [params] = useSearchParams();
  const pack = params.get("pack") ?? "willow";
  const markers = params.get("markers") === "1";
  const { hostRef, sceneRef, ready } = useGardenPixi(() => undefined);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setName("Willow's garden");
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
  // Stage 3 = 3-flower / green-berry flowering (the annotated Willow plant).
  if (pack === "flowers" || pack === "blossom") {
    return Array.from({ length: 9 }, (_, slot) => plot(slot, 2, 3));
  }
  // Annotated Willow mix: ripe corn, flowering center strawberry, two sprouts.
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
  // Seed + first-grow seating proof: tall seeds, pumpkin stage 2, cotton sprout.
  if (pack === "seat") {
    return [
      plot(0, 1, 1), // corn seed
      plot(1, 2, 1), // cotton seed
      plot(2, 6, 1), // sunflower seed
      plot(3, 5, 1), // pumpkin seed
      plot(4, 4, 1), // strawberry seed
      plot(5, 5, 2), // pumpkin grow (stage 2)
      plot(6, 1, 2), // corn grow
      plot(7, 2, 2), // cotton grow
      plot(8, 6, 2), // sunflower grow
    ];
  }
  // Ripe height proof: corn/cotton/strawberry/pumpkin/sunflower + tomato mid.
  if (pack === "raise") {
    return [
      plot(0, 1, 4, true), // corn
      plot(1, 2, 4, true), // cotton
      plot(2, 6, 4, true), // sunflower
      plot(3, 4, 4, true), // strawberry
      plot(4, 5, 4, true), // pumpkin
      plot(5, 3, 4, true), // tomato
      plot(6, 4, 4, true), // strawberry
      plot(7, 5, 4, true), // pumpkin
      plot(8, 2, 4, true), // cotton
    ];
  }
  return [
    plot(0, 1, 4, true),
    plot(4, 2, 3),
    plot(6, 1, 2),
    plot(7, 2, 2),
  ];
}
