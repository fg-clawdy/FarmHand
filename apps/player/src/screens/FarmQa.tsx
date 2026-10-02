import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FarmPlayerCard, PublicPlot, PublicSharedGoal } from "@farmhand/shared";
import FamilyJarSheet from "../components/FamilyJarSheet";
import { PLACEHOLDER_WANTED_JOBS } from "../pixi/jobBoard";
import { useFarmPixi } from "../pixi/usePixi";

/** Live Pixi farm with planted plots — no API. Used to proof playfield mound UVs. */
export default function FarmQa() {
  const [params] = useSearchParams();
  const pack = params.get("pack") ?? "mix";
  const markers = params.get("markers") === "1";
  const jarMode = params.get("jars");
  const jars = qaJars(jarMode);
  const sheet = params.get("sheet");
  const celebrate = Number(params.get("celebrate") || 0);
  const [openId, setOpenId] = useState<string | null>(sheet && jars.some((jar) => jar.id === sheet) ? sheet : null);
  const selected = jars.find((jar) => jar.id === openId) ?? null;
  const { hostRef, sceneRef, ready } = useFarmPixi({
    onPlayer: () => undefined,
    onStore: () => undefined,
    onJobBoard: () => undefined,
    onFamilyJar: (id) => setOpenId(id),
    onFamilyJarOverflow: () => setOpenId(jars[3]?.id ?? null),
  });

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setPlayers(qaPlayers(pack));
    scene.setWantedJobs(PLACEHOLDER_WANTED_JOBS);
    scene.setMoundMarkers(markers);
    scene.setFamilyJars(qaJars(jarMode));
  }, [ready, pack, markers, jarMode, sceneRef]);

  return (
    <div className="scene farm-hybrid">
      <div className="pixi-host" ref={hostRef} data-qa="farm-pixi" />
      {selected && (
        <FamilyJarSheet
          jar={selected}
          players={qaPlayers(pack)}
          preview={{ availableStars: 24, celebrate: celebrate > 0 ? celebrate : undefined }}
          onClose={() => setOpenId(null)}
          onUpdated={() => undefined}
        />
      )}
    </div>
  );
}

function qaJars(mode: string | null): PublicSharedGoal[] {
  const demo: PublicSharedGoal[] = [
    { id: "qa-movie", title: "Movie", emoji: "🎬", targetStars: 10, filledStars: 3, status: "OPEN", tintIndex: 0, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-ice", title: "Ice cream", emoji: "🍦", targetStars: 10, filledStars: 7, status: "OPEN", tintIndex: 1, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-game", title: "Game night", emoji: "🎮", targetStars: 10, filledStars: 9, status: "OPEN", tintIndex: 2, artUrl: null, artStatus: "DEFAULT" },
  ];
  if (!mode || mode === "0" || mode === "empty") return [];
  if (mode === "5" || mode === "overflow") {
    return [
      ...demo,
      { id: "qa-netflix", title: "Netflix", emoji: "📺", targetStars: 10, filledStars: 10, status: "READY", tintIndex: 3, artUrl: null, artStatus: "DEFAULT" },
      { id: "qa-park", title: "Park day", emoji: "🌳", targetStars: 8, filledStars: 1, status: "OPEN", tintIndex: 4, artUrl: null, artStatus: "DEFAULT" },
    ];
  }
  if (mode === "1") return demo.slice(0, 1);
  return demo;
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
    avatarKind: "mascot",
    avatarPreset: null,
    avatarUrl: null,
    seeds: 8,
    provisionalSeeds: 0,
    points: 12,
    fertilizer: 1,
    seedShards: 0,
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
