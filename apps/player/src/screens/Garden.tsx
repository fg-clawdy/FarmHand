import { PLOTS_PER_GARDEN, type GameConfig, type PublicPlot } from "@farmhand/shared";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type AccoladeUnlock, type GardenPlayer, type HarvestReward, type PublicChore } from "../api";
import { AcornArt, BackArrow, FertilizerBeaker, MascotArt, SceneShell, StarIcon } from "../art";
import HarvestCelebration from "../components/HarvestCelebration";
import AccoladeCelebration from "../components/AccoladeCelebration";
import AccoladePanel from "../components/AccoladePanel";
import IngredientsSheet from "../components/IngredientsSheet";
import JobBoard, { NeedJobsNudge } from "../components/JobBoard";
import PinPad from "../components/PinPad";
import PlantPicker from "../components/PlantPicker";
import PlotSheet from "../components/PlotSheet";
import ProfileSheet from "../components/ProfileSheet";
import SelfieCapture from "../components/SelfieCapture";
import {
  cheapestSeedCost,
  cropNameForPlot,
  gardenTapAction,
  GARDEN_TOOL_ART,
  GARDEN_TOOL_LABEL,
  GARDEN_TOOLS,
  glowingSlots,
  outOfPouchSeeds,
  type GardenTool,
} from "../pixi/gardenLayout";
import { useGardenPixi } from "../pixi/usePixi";

type Overlay =
  | { type: "picker"; slot: number }
  | { type: "plot"; slot: number }
  | { type: "ingredients" }
  | { type: "selfie" }
  | { type: "chores" }
  | { type: "need-jobs" }
  | { type: "chore-photo"; chore: PublicChore; slot: number; tier: number }
  | { type: "badges" }
  | { type: "profile" }
  | null;

export default function Garden() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<GardenPlayer | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [needsPin, setNeedsPin] = useState(false);
  const [playerName, setPlayerName] = useState("Friend");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tool, setTool] = useState<GardenTool | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  function applyGarden(next: GardenPlayer, nextConfig?: GameConfig) {
    setPlayer(next);
    if (nextConfig) setConfig(nextConfig);
    setFetchedAt(Date.now());
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function enter(pin?: string) {
    if (!playerId) return;
    const data = await api.enter(playerId, pin);
    applyGarden(data.player, data.config);
    setNeedsPin(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!playerId) return;
      try {
        const session = await api.session();
        if (cancelled) return;
        if (session.player?.id === playerId) {
          const garden = await api.garden();
          if (cancelled) return;
          applyGarden(garden.player, garden.config);
          setNeedsPin(false);
          return;
        }
        const farm = await api.farm();
        const card = farm.players.find((p) => p.id === playerId);
        setPlayerName(card?.name ?? "Friend");
        if (card && !card.hasPin) {
          await enter();
          return;
        }
        setNeedsPin(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open garden.");
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  useEffect(() => {
    if (!player || needsPin) return;
    const t = setInterval(() => {
      void api
        .garden()
        .then((data) => applyGarden(data.player, data.config))
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [player, needsPin]);

  const plots = useMemo(() => {
    if (!player) return [];
    const count = config?.plotCount ?? PLOTS_PER_GARDEN;
    return Array.from({ length: count }, (_, slot) => {
      const plot = player.plots.find((p) => p.slot === slot);
      return livePlot(plot ?? emptyPlot(slot), now);
    });
  }, [player, config, now]);

  async function run(action: () => Promise<GardenPlayer>) {
    setBusy(true);
    setError("");
    try {
      applyGarden(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  if (needsPin) {
    return (
      <PinPad
        name={playerName}
        onCancel={() => navigate("/")}
        onSubmit={async (pin) => enter(pin)}
      />
    );
  }

  if (!player || !config) {
    return (
      <SceneShell dim className="screen">
        <div className="topbar">
          <button className="back" type="button" onClick={() => navigate("/")}>
            <BackArrow />
          </button>
          <div className="who">Opening the garden…</div>
        </div>
        {error && <div className="toast">{error}</div>}
      </SceneShell>
    );
  }

  return (
    <GardenPlay
      player={player}
      config={config}
      plots={plots}
      fetchedAt={fetchedAt}
      now={now}
      overlay={overlay}
      setOverlay={setOverlay}
      tool={tool}
      setTool={setTool}
      busy={busy}
      error={error}
      run={run}
      applyGarden={applyGarden}
      onBack={() => navigate("/")}
    />
  );
}

function GardenPlay({
  player,
  config,
  plots,
  fetchedAt,
  now,
  overlay,
  setOverlay,
  tool,
  setTool,
  busy,
  error,
  run,
  applyGarden,
  onBack,
}: {
  player: GardenPlayer;
  config: GameConfig;
  plots: PublicPlot[];
  fetchedAt: number;
  now: number;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  tool: GardenTool | null;
  setTool: (t: GardenTool | null) => void;
  busy: boolean;
  error: string;
  run: (action: () => Promise<GardenPlayer>) => Promise<void>;
  applyGarden: (next: GardenPlayer, nextConfig?: GameConfig) => void;
  onBack: () => void;
}) {
  const cheapestSeed = cheapestSeedCost(config.tiers);
  const elapsed = now - fetchedAt;
  const selfieUnlocked = player.selfie?.unlocked ?? player.water.unlocked ?? false;
  const cooldownRemainingMs = Math.max(0, player.water.cooldownRemainingMs - elapsed);
  const canWater = selfieUnlocked && player.water.canWater && cooldownRemainingMs === 0;
  const toolCtx = { seeds: player.seeds, fertilizer: player.fertilizer, canWater, cheapestSeed };
  const [gain, setGain] = useState<HarvestReward | null>(null);
  const [badgeQueue, setBadgeQueue] = useState<AccoladeUnlock[]>([]);
  const [jobToast, setJobToast] = useState(false);
  const [chores, setChores] = useState<PublicChore[]>([]);
  const gardenEmptySlots = useMemo(
    () => plots.filter((plot) => plot.state === "empty").map((plot) => plot.slot),
    [plots],
  );

  function celebrateWaitingSeed() {
    setJobToast(true);
    window.setTimeout(() => setJobToast(false), 3200);
  }

  function noteUnlocks(unlocks?: AccoladeUnlock[]) {
    if (unlocks?.length) setBadgeQueue((q) => [...q, ...unlocks]);
  }

  useEffect(() => {
    if (!badgeQueue.length) return;
    const t = window.setTimeout(() => setBadgeQueue((q) => q.slice(1)), 4200);
    return () => window.clearTimeout(t);
  }, [badgeQueue]);

  useEffect(() => {
    if (overlay?.type !== "chores") return;
    void api
      .chores()
      .then((data) => {
        setChores(data.chores);
        applyGarden(data.player);
      })
      .catch(() => undefined);
  }, [overlay?.type]);
  const glow = useMemo(
    () => glowingSlots(tool, plots, toolCtx),
    [tool, plots, player.seeds, player.fertilizer, canWater, cheapestSeed, selfieUnlocked],
  );

  const { hostRef, sceneRef, ready } = useGardenPixi((slot) => {
    const plot = plots.find((p) => p.slot === slot);
    if (!plot || busy) return;
    const action = gardenTapAction(plot, tool, toolCtx);
    if (action === "harvest") {
      void run(async () => {
        const data = await api.harvest(slot);
        sceneRef.current?.fxHarvest(slot, data.reward);
        setGain(data.reward);
        noteUnlocks(data.unlocks);
        setOverlay(null);
        window.setTimeout(() => setGain((cur) => (cur === data.reward ? null : cur)), 4200);
        return data.player;
      });
      return;
    }
    if (action === "prune") {
      void run(async () => {
        const data = await api.prune(slot);
        setOverlay(null);
        return data.player;
      });
      return;
    }
    if (action === "jobs") {
      setOverlay({ type: "need-jobs" });
      return;
    }
    if (action === "picker") {
      setOverlay({ type: "picker", slot });
      return;
    }
    if (action === "water") {
      void run(async () => {
        const data = await api.water(slot);
        sceneRef.current?.fxWater(slot);
        noteUnlocks(data.unlocks);
        return data.player;
      });
      return;
    }
    if (action === "fert") {
      void run(async () => {
        const data = await api.fertilize(slot);
        sceneRef.current?.fxFertilizer(slot);
        return data.player;
      });
      return;
    }
    if (action === "sheet") setOverlay({ type: "plot", slot });
  });

  useEffect(() => {
    sceneRef.current?.setPlots(plots);
    sceneRef.current?.setName(`${player.name}'s garden`);
  }, [plots, player.name, ready, sceneRef]);

  useEffect(() => {
    sceneRef.current?.setGlow(glow);
  }, [glow, ready, sceneRef]);

  const selected = overlay && "slot" in overlay ? plots.find((p) => p.slot === overlay.slot) : null;
  const livePlayer: GardenPlayer = {
    ...player,
    water: {
      ...player.water,
      cooldownRemainingMs,
      canWater,
    },
  };

  return (
    <div className="screen garden-hybrid">
      <div className="pixi-host" ref={hostRef} />
      <div className="topbar">
        <button className="back" type="button" onClick={onBack} aria-label="Back to farm">
          <BackArrow />
        </button>
        <button
          className="who profile-entry"
          type="button"
          aria-label={`${player.name}'s profile`}
          onClick={() => setOverlay({ type: "profile" })}
        >
          <MascotArt className="mascot-img" mascot={player.mascot} />
          <span>{player.name}'s garden</span>
        </button>
        <div className="meters">
          <div className={`meter ${gain && gain.points > 0 ? "bump" : ""}`}>
            <StarIcon /> {player.points}
            {gain && gain.points > 0 && <span className="meter-delta">+{gain.points}</span>}
          </div>
          <div className={`meter ${gain && gain.seedsReturned > 0 ? "bump" : ""}`}>
            <AcornArt /> {player.seeds}
            {gain && gain.seedsReturned > 0 && <span className="meter-delta">+{gain.seedsReturned}</span>}
          </div>
          <div className="meter">
            <FertilizerBeaker /> {player.fertilizer}
          </div>
          <button className="icon-btn" type="button" onClick={() => setOverlay({ type: "ingredients" })}>
            <FertilizerBeaker />
            <span>+</span>
          </button>
          <button
            className="icon-btn profile-btn"
            type="button"
            aria-label="Profile"
            onClick={() => setOverlay({ type: "profile" })}
          >
            Profile
          </button>
          <button
            className="icon-btn trophies"
            type="button"
            aria-label="Badges"
            onClick={() => setOverlay({ type: "badges" })}
          >
            🏅
          </button>
        </div>
      </div>
      <div className="garden-tools" role="toolbar" aria-label="Garden tools">
        <button
          type="button"
          className={`garden-tool selfie-tool ${selfieUnlocked ? "done" : ""}`}
          aria-label={selfieUnlocked ? "Today's selfie is done" : "Take today's selfie"}
          onClick={() => setOverlay({ type: "selfie" })}
        >
          <span className="selfie-tool-icon" aria-hidden="true">
            {selfieUnlocked ? "✓" : "📸"}
          </span>
          <span>Selfie</span>
        </button>
        <button
          type="button"
          className="garden-tool selfie-tool"
          aria-label="Job Board"
          onClick={() => setOverlay({ type: "chores" })}
        >
          <span className="selfie-tool-icon" aria-hidden="true">
            ✅
          </span>
          <span>Chores</span>
        </button>
        {GARDEN_TOOLS.map((id) => {
          const remaining =
            id === "water" ? (selfieUnlocked ? player.water.wateringsLeft : 0) : id === "fert" ? player.fertilizer : null;
          const label = GARDEN_TOOL_LABEL[id];
          return (
            <button
              key={id}
              type="button"
              className={`garden-tool ${tool === id ? "selected" : ""} ${id === "water" && !selfieUnlocked ? "locked" : ""}`}
              aria-pressed={tool === id}
              aria-label={
                id === "water" && !selfieUnlocked
                  ? "Water locked. Take today's selfie."
                  : remaining == null
                    ? label
                    : `${label}, ${remaining} remaining`
              }
              onClick={() => {
                if (id === "water" && !selfieUnlocked) {
                  setOverlay({ type: "selfie" });
                  return;
                }
                if (id === "seed" && outOfPouchSeeds(toolCtx)) {
                  setTool(null);
                  setOverlay({ type: "need-jobs" });
                  return;
                }
                setTool(tool === id ? null : id);
              }}
            >
              <img src={GARDEN_TOOL_ART[id]} alt="" draggable={false} />
              <span>{label}</span>
              {remaining != null && <span className="tool-count">{remaining}</span>}
            </button>
          );
        })}
      </div>
      {overlay?.type === "picker" && (
        <PlantPicker
          config={config}
          seeds={player.seeds}
          onClose={() => setOverlay(null)}
          onNeedJobs={() => setOverlay({ type: "chores" })}
          onPick={(tier) => {
            const slot = overlay.slot;
            void run(async () => {
              const data = await api.plant(slot, tier);
              noteUnlocks(data.unlocks);
              setOverlay(null);
              return data.player;
            });
          }}
        />
      )}
      {overlay?.type === "need-jobs" && (
        <NeedJobsNudge onClose={() => setOverlay(null)} onOpenJobs={() => setOverlay({ type: "chores" })} />
      )}
      {overlay?.type === "chores" && (
        <JobBoard
          chores={chores}
          emptySlots={gardenEmptySlots}
          config={config}
          busy={busy}
          onClose={() => setOverlay(null)}
          onClaim={async (chore, slot, tier) => {
            const data = await api.claimChore(chore.id, { slot, tier });
            setOverlay(null);
            applyGarden(data.player);
            noteUnlocks(data.unlocks);
            celebrateWaitingSeed();
            return data.player;
          }}
          onNeedPhoto={(chore, slot, tier) => setOverlay({ type: "chore-photo", chore, slot, tier })}
        />
      )}
      {overlay?.type === "chore-photo" && (
        <SelfieCapture
          title="Chore photo"
          copy="Take a photo so a grown-up can check this chore. This is not today's watering selfie."
          buttonLabel="Send photo"
          onClose={() => setOverlay({ type: "chores" })}
          submit={async (image) => {
            const data = await api.claimChore(overlay.chore.id, {
              slot: overlay.slot,
              tier: overlay.tier,
              image,
            });
            return { player: data.player, unlocks: data.unlocks };
          }}
          onSuccess={(next, _reward, unlocks) => {
            applyGarden(next);
            noteUnlocks(unlocks);
            setOverlay(null);
            celebrateWaitingSeed();
          }}
        />
      )}
      {overlay?.type === "selfie" && (
        <SelfieCapture
          onClose={() => setOverlay(null)}
          onSuccess={(next, reward, unlocks) => {
            applyGarden(next);
            noteUnlocks(unlocks);
            setOverlay(null);
            if (reward) {
              setGain(reward);
              window.setTimeout(() => setGain((cur) => (cur === reward ? null : cur)), 4200);
            }
          }}
        />
      )}
      {overlay?.type === "plot" && selected && selected.state !== "empty" && !selected.ready && (
        <PlotSheet
          plot={selected}
          cropName={cropNameForPlot(selected, config.tiers)}
          player={livePlayer}
          selfieUnlocked={selfieUnlocked}
          onNeedSelfie={() => setOverlay({ type: "selfie" })}
          busy={busy}
          onClose={() => setOverlay(null)}
          onPrune={() =>
            void run(async () => {
              const data = await api.prune(overlay.slot);
              setOverlay(null);
              return data.player;
            })
          }
          onWater={() =>
            void run(async () => {
              const data = await api.water(overlay.slot);
              sceneRef.current?.fxWater(overlay.slot);
              noteUnlocks(data.unlocks);
              return data.player;
            })
          }
          onFertilize={() =>
            void run(async () => {
              const data = await api.fertilize(overlay.slot);
              sceneRef.current?.fxFertilizer(overlay.slot);
              return data.player;
            })
          }
        />
      )}
      {gain && <HarvestCelebration reward={gain} />}
      {badgeQueue[0] && <AccoladeCelebration unlock={badgeQueue[0]} />}
      {overlay?.type === "badges" && <AccoladePanel onClose={() => setOverlay(null)} />}
      {overlay?.type === "profile" && <ProfileSheet onClose={() => setOverlay(null)} />}
      {jobToast && (
        <div className="harvest-banner" role="status" aria-live="polite">
          <div className="harvest-banner-title">🌱 Waiting seed planted!</div>
          <p className="harvest-note">A grown-up will check it</p>
        </div>
      )}
      {overlay?.type === "ingredients" && (
        <IngredientsSheet
          player={player}
          config={config}
          busy={busy}
          onClose={() => setOverlay(null)}
          onClaim={() =>
            void run(async () => {
              const data = await api.claimIngredient();
              return data.player;
            })
          }
          onMix={() =>
            void run(async () => {
              const data = await api.mix();
              return data.player;
            })
          }
        />
      )}
      {error && <div className="toast">{error}</div>}
      {tool === "water" && !selfieUnlocked && (
        <div className="toast">Take today's selfie to water.</div>
      )}
    </div>
  );
}

function emptyPlot(slot: number): PublicPlot {
  return {
    slot,
    state: "empty",
    tier: null,
    plantedAt: null,
    maturesAt: null,
    remainingMs: 0,
    growthStage: null,
    emoji: null,
    face: null,
    ready: false,
    canWater: false,
    watersLeftToday: 0,
    waterCooldownRemainingMs: 0,
    greyed: false,
  };
}

function livePlot(plot: PublicPlot, now: number): PublicPlot {
  if (plot.state === "purgatory" || plot.state === "wilted" || plot.state === "empty" || !plot.maturesAt) {
    return plot;
  }
  const remainingMs = Math.max(0, new Date(plot.maturesAt).getTime() - now);
  const ready = remainingMs === 0;
  return {
    ...plot,
    remainingMs,
    ready,
    state: ready ? "mature" : "growing",
  };
}
