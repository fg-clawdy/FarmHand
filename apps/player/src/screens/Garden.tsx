import { type GameConfig, type PublicPlot } from "@farmhand/shared";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type GardenPlayer, type HarvestReward } from "../api";
import { AcornArt, BackArrow, FertilizerBeaker, MascotArt, SceneShell, StarIcon } from "../art";
import HarvestCelebration from "../components/HarvestCelebration";
import IngredientsSheet from "../components/IngredientsSheet";
import PinPad from "../components/PinPad";
import PlantPicker from "../components/PlantPicker";
import PlotSheet from "../components/PlotSheet";
import { useGardenPixi } from "../pixi/usePixi";

type Overlay =
  | { type: "picker"; slot: number }
  | { type: "plot"; slot: number }
  | { type: "harvest"; reward: HarvestReward }
  | { type: "ingredients" }
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
    return player.plots.map((plot) => livePlot(plot, now));
  }, [player, now]);

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
      busy={busy}
      error={error}
      run={run}
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
  busy,
  error,
  run,
  onBack,
}: {
  player: GardenPlayer;
  config: GameConfig;
  plots: PublicPlot[];
  fetchedAt: number;
  now: number;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  busy: boolean;
  error: string;
  run: (action: () => Promise<GardenPlayer>) => Promise<void>;
  onBack: () => void;
}) {
  const { hostRef, sceneRef, ready } = useGardenPixi((slot, empty) => {
    setOverlay(empty ? { type: "picker", slot } : { type: "plot", slot });
  });

  useEffect(() => {
    sceneRef.current?.setPlots(plots);
  }, [plots, ready, sceneRef]);

  const selected = overlay && "slot" in overlay ? plots.find((p) => p.slot === overlay.slot) : null;
  const elapsed = now - fetchedAt;
  const cooldownRemainingMs = Math.max(0, player.water.cooldownRemainingMs - elapsed);
  const livePlayer: GardenPlayer = {
    ...player,
    water: {
      ...player.water,
      cooldownRemainingMs,
      canWater: player.water.wateringsLeft > 0 && cooldownRemainingMs === 0,
    },
  };

  return (
    <div className="screen garden-hybrid">
      <div className="pixi-host" ref={hostRef} />
      <div className="topbar">
        <button className="back" type="button" onClick={onBack} aria-label="Back to farm">
          <BackArrow />
        </button>
        <div className="who">
          <MascotArt className="mascot-img" mascot={player.mascot} />
          <span>{player.name}</span>
        </div>
        <div className="meters">
          <div className="meter">
            <StarIcon /> {player.points}
          </div>
          <div className="meter">
            <AcornArt /> {player.seeds}
          </div>
          <div className="meter">
            <FertilizerBeaker /> {player.fertilizer}
          </div>
          <button className="icon-btn" type="button" onClick={() => setOverlay({ type: "ingredients" })}>
            <FertilizerBeaker />
            <span>+</span>
          </button>
        </div>
      </div>
      {overlay?.type === "picker" && (
        <PlantPicker
          config={config}
          seeds={player.seeds}
          onClose={() => setOverlay(null)}
          onPick={(tier) => {
            const slot = overlay.slot;
            void run(async () => {
              const data = await api.plant(slot, tier);
              setOverlay(null);
              return data.player;
            });
          }}
        />
      )}
      {overlay?.type === "plot" && selected && selected.state !== "empty" && (
        <PlotSheet
          plot={selected}
          player={livePlayer}
          busy={busy}
          onClose={() => setOverlay(null)}
          onWater={() =>
            void run(async () => {
              const data = await api.water(overlay.slot);
              sceneRef.current?.fxWater(overlay.slot);
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
          onHarvest={() =>
            void run(async () => {
              const data = await api.harvest(overlay.slot);
              sceneRef.current?.fxHarvest(overlay.slot);
              setOverlay({ type: "harvest", reward: data.reward });
              return data.player;
            })
          }
        />
      )}
      {overlay?.type === "harvest" && (
        <HarvestCelebration reward={overlay.reward} onClose={() => setOverlay(null)} />
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
    </div>
  );
}

function livePlot(plot: PublicPlot, now: number): PublicPlot {
  if (!plot.maturesAt || plot.state === "empty") return plot;
  const remainingMs = Math.max(0, new Date(plot.maturesAt).getTime() - now);
  const ready = remainingMs === 0;
  return {
    ...plot,
    remainingMs,
    ready,
    state: ready ? "mature" : "growing",
  };
}
