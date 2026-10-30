import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FarmPlayerCard, PublicPlot, PublicSharedGoal } from "@farmhand/shared";
import FamilyJarSheet, { jarDonorFromCard } from "../components/FamilyJarSheet";
import { useFarmPixi } from "../pixi/usePixi";

/**
 * Live Pixi farm — no API.
 * `?jars=0|1|2|3|8|overflow` previews little-library shelves on the farm overview.
 * `?sheet=<jar id>` opens the donate sheet over that preview.
 * `?who=<name or id>` preselects that kid, the way a garden session would.
 */
export default function FarmQa() {
  const [params] = useSearchParams();
  const pack = params.get("pack") ?? "mix";
  const markers = params.get("markers") === "1";
  const jarMode = params.get("jars");
  const jars = useMemo(() => qaJars(jarMode), [jarMode]);
  const sheet = params.get("sheet");
  const who = params.get("who");
  const players = useMemo(() => qaPlayers(pack), [pack]);
  const sessionPlayer = useMemo(() => {
    if (!who) return null;
    const card = players.find((player) => player.id === who || player.name.toLowerCase() === who.toLowerCase());
    return card ? jarDonorFromCard(card) : null;
  }, [players, who]);
  const celebrate = Number(params.get("celebrate") || 0);
  const [openId, setOpenId] = useState<string | null>(sheet && jars.some((jar) => jar.id === sheet) ? sheet : null);
  const selected = jars.find((jar) => jar.id === openId) ?? null;
  const { hostRef, sceneRef, ready } = useFarmPixi({
    onPlayer: () => undefined,
    onStore: () => undefined,
    onLibrary: {
      onJar: (id) => setOpenId(id),
      onOverflow: () => setOpenId(jars.find((jar) => !["qa-movie", "qa-ice"].includes(jar.id))?.id ?? jars[0]?.id ?? null),
    },
  });

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setPlayers(players);
    scene.setMoundMarkers(markers);
    scene.setFamilyJars(jars);
  }, [ready, pack, markers, sceneRef, jars, players]);

  return (
    <div className="scene farm-hybrid">
      <div className="pixi-host" ref={hostRef} data-qa="farm-pixi" />
      {selected && (
        <FamilyJarSheet
          jar={selected}
          players={players}
          sessionPlayer={sessionPlayer}
          preview={{ availablePoints: 570, celebrate: celebrate > 0 ? celebrate : undefined }}
          onClose={() => setOpenId(null)}
          onUpdated={() => undefined}
        />
      )}
    </div>
  );
}

function qaJars(mode: string | null): PublicSharedGoal[] {
  const demo: PublicSharedGoal[] = [
    { id: "qa-movie", title: "Movie", emoji: "🎬", targetPoints: 10, filledPoints: 3, status: "OPEN", tintIndex: 0, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-ice", title: "Ice cream", emoji: "🍦", targetPoints: 10, filledPoints: 7, status: "OPEN", tintIndex: 1, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-game", title: "Game night", emoji: "🎮", targetPoints: 10, filledPoints: 9, status: "OPEN", tintIndex: 2, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-netflix", title: "Netflix", emoji: "📺", targetPoints: 10, filledPoints: 10, status: "READY", tintIndex: 3, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-park", title: "Park day", emoji: "🌳", targetPoints: 8, filledPoints: 1, status: "OPEN", tintIndex: 4, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-books", title: "Books", emoji: "📚", targetPoints: 12, filledPoints: 4, status: "OPEN", tintIndex: 0, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-picnic", title: "Picnic", emoji: "🧺", targetPoints: 9, filledPoints: 2, status: "OPEN", tintIndex: 1, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-zoo", title: "Zoo", emoji: "🦁", targetPoints: 20, filledPoints: 6, status: "OPEN", tintIndex: 2, artUrl: null, artStatus: "DEFAULT" },
    { id: "qa-camp", title: "Camp", emoji: "⛺️", targetPoints: 15, filledPoints: 5, status: "OPEN", tintIndex: 3, artUrl: null, artStatus: "DEFAULT" },
  ];
  if (!mode || mode === "0" || mode === "empty") return [];
  if (mode === "1") return demo.slice(0, 1);
  if (mode === "2") return demo.slice(0, 2);
  if (mode === "3" || mode === "few") return demo.slice(0, 3);
  if (mode === "8" || mode === "many") return demo.slice(0, 8);
  if (mode === "5" || mode === "overflow") return demo;
  return [];
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
    hasPin: id === "l",
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
