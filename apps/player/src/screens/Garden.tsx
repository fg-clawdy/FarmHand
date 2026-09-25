import { PLOTS_PER_GARDEN, type GameConfig, type PublicPlot } from "@farmhand/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type AccoladeUnlock, type BasketItem, type GardenPlayer, type HarvestReward, type PublicChore } from "../api";
import { AcornArt, BackArrow, SceneShell, StarIcon } from "../art";
import HarvestCelebration from "../components/HarvestCelebration";
import HarvestBasketSheet, { MARKET_TRUCK_DRIVE_MS } from "../components/HarvestBasketSheet";
import StarPour from "../components/StarPour";
import AcornPour from "../components/AcornPour";
import { kidSeedRewardCount } from "../kidSeedReward";
import AccoladeCelebration from "../components/AccoladeCelebration";
import AccoladePanel from "../components/AccoladePanel";
import AvatarPicker from "../components/AvatarPicker";
import KidAvatar from "../components/KidAvatar";
import JobBoard, { NeedJobsNudge } from "../components/JobBoard";
import PinPad from "../components/PinPad";
import PlantPicker from "../components/PlantPicker";
import PlotSheet from "../components/PlotSheet";
import ProfileSheet from "../components/ProfileSheet";
import SelfieCapture from "../components/SelfieCapture";
import {
  cheapestSeedCost,
  cropNameForPlot,
  gardenPlayfieldFit,
  gardenTapAction,
  GARDEN_TOOL_ART,
  GARDEN_TOOL_ART_LOCKED,
  GARDEN_TOOL_LABEL,
  GARDEN_TOOLS,
  glowingSlots,
  outOfPouchSeeds,
  type GardenTool,
} from "../pixi/gardenLayout";
import { log } from "../logger";
import { useGardenPixi } from "../pixi/usePixi";
import { useGardenIdleLock } from "../hooks/useGardenIdleLock";

type Overlay =
  | { type: "picker"; slot: number }
  | { type: "plot"; slot: number }
  | { type: "selfie" }
  | { type: "chores" }
  | { type: "need-jobs" }
  | { type: "chore-photo"; chore: PublicChore }
  | { type: "badges" }
  | { type: "profile" }
  | { type: "avatar-picker" }
  | { type: "basket" }
  | null;

export default function Garden() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  useGardenIdleLock(90_000);
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
      <>
        <SceneShell dim className="screen">
          <div className="topbar">
            <button className="back" type="button" onClick={() => navigate("/")}>
              <BackArrow />
            </button>
            <div className="who">Opening the garden…</div>
          </div>
        </SceneShell>
        <PinPad
          name={playerName}
          onCancel={() => navigate("/")}
          onSubmit={async (pin) => enter(pin)}
        />
      </>
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

type PourState = {
  items: BasketItem[];
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromPoints: number;
  toPoints: number;
};

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
  const toolCtx = { seeds: player.seeds + player.provisionalSeeds, canWater, cheapestSeed };
  const [gain, setGain] = useState<HarvestReward | null>(null);
  const [pour, setPour] = useState<PourState | null>(null);
  const [shownPoints, setShownPoints] = useState(player.points);
  const pointsMeterRef = useRef<HTMLDivElement>(null);
  const [pointsShine, setPointsShine] = useState(false);
  const [badgeQueue, setBadgeQueue] = useState<AccoladeUnlock[]>([]);
  const [acornPour, setAcornPour] = useState<null | {
    seeds: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
    fromTotal: number;
  }>(null);
  const seedMeterRef = useRef<HTMLDivElement>(null);
  const [shownSeeds, setShownSeeds] = useState(player.seeds + player.provisionalSeeds);
  const [chores, setChores] = useState<PublicChore[]>([]);
  const [choreTimezone, setChoreTimezone] = useState("America/Chicago");

  function celebrateClaimSeeds(seedsGranted: number, originEl?: Element | null) {
    const count = kidSeedRewardCount(seedsGranted);
    const fromTotal = Math.max(0, (player.seeds + player.provisionalSeeds) - count);
    setShownSeeds(fromTotal);
    const fromRect = (originEl as HTMLElement | null)?.getBoundingClientRect?.();
    const toRect = seedMeterRef.current?.getBoundingClientRect();
    const from = fromRect
      ? { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
    const to = toRect
      ? { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 }
      : { x: window.innerWidth - 72, y: 36 };
    setAcornPour({ seeds: count, from, to, fromTotal });
  }

  function onAcornArrive(arrived: number, total: number) {
    if (!acornPour) return;
    setShownSeeds(acornPour.fromTotal + arrived);
    if (arrived >= total) {
      seedMeterRef.current?.classList.add("bump");
      window.setTimeout(() => seedMeterRef.current?.classList.remove("bump"), 420);
    }
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
        if (data.timezone) setChoreTimezone(data.timezone);
        applyGarden(data.player);
      })
      .catch(() => undefined);
  }, [overlay?.type]);
  const glow = useMemo(
    () => glowingSlots(tool, plots, toolCtx),
    [tool, plots, player.seeds, player.provisionalSeeds, canWater, cheapestSeed, selfieUnlocked],
  );

  const { hostRef, sceneRef, ready, mountError } = useGardenPixi((slot) => {
    const plot = plots.find((p) => p.slot === slot);
    if (!plot || busy || pour) return;
    const action = gardenTapAction(plot, tool, toolCtx);
    if (action === "harvest") {
      void run(async () => {
        const data = await api.harvest(slot);
        sceneRef.current?.fxHarvest(slot, data.reward);
        setGain(data.reward);
        noteUnlocks(data.unlocks);
        setOverlay(null);
        window.setTimeout(() => setGain((cur) => (cur === data.reward ? null : cur)), 1600);
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
    if (action === "sheet") setOverlay({ type: "plot", slot });
  },
    () => setOverlay({ type: "avatar-picker" }),
    () => {
      if (!pour) setOverlay({ type: "basket" });
    },
  );

  useEffect(() => {
    if (pour) return;
    setShownPoints(player.points);
  }, [player.points, pour]);

  useEffect(() => {
    if (acornPour) return;
    setShownSeeds(player.seeds + player.provisionalSeeds);
  }, [player.seeds, player.provisionalSeeds, acornPour]);

  function onStarArrive(arrived: number, total: number) {
    if (!pour) return;
    const gained = pour.toPoints - pour.fromPoints;
    const credited = total > 0 ? Math.round((gained * arrived) / total) : gained;
    setShownPoints(pour.fromPoints + credited);
    if (arrived >= total) setPointsShine(true);
  }

  useEffect(() => {
    if (!pointsShine) return;
    const t = window.setTimeout(() => setPointsShine(false), 2000);
    return () => window.clearTimeout(t);
  }, [pointsShine]);

  function sellBasket() {
    if (busy || pour) return;
    const items = player.basket?.items ?? [];
    if (!items.length) return;
    const meter = pointsMeterRef.current?.getBoundingClientRect();
    const basket = sceneRef.current?.basketLaunchLocal();
    const host = hostRef.current?.getBoundingClientRect();
    const fit = host ? gardenPlayfieldFit(host.width, host.height) : null;
    // Origin is the painted tray interior (mouth), mapped through the garden camera.
    const from = basket && host && fit
      ? { x: host.left + fit.x + basket.x * fit.scale, y: host.top + fit.y + basket.y * fit.scale }
      : { x: window.innerWidth * 0.72, y: window.innerHeight * 0.78 };
    const to = meter
      ? { x: meter.left + meter.width / 2, y: meter.top + meter.height / 2 }
      : { x: window.innerWidth - 80, y: 36 };
    const driveStarted = Date.now();
    void run(async () => {
      const data = await api.sellBasket();
      // Sell pressed → truck drives off → THEN close sheet → THEN StarPour.
      // If the API is slower than the drive, keep the sheet open until it returns.
      const remain = Math.max(0, MARKET_TRUCK_DRIVE_MS - (Date.now() - driveStarted));
      if (remain > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, remain));
      setOverlay(null);
      // Let the sheet unmount a frame before stars spawn from the world basket.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setPour({
        items: data.items.length ? data.items : items,
        from,
        to,
        fromPoints: data.previousPoints,
        toPoints: data.player.points,
      });
      return data.player;
    });
  }

  useEffect(() => {
    if (!sceneRef.current) return;
    try {
      sceneRef.current.setPlots(plots);
      sceneRef.current.setName(`${player.name}'s garden`);
      sceneRef.current.setAvatar(player);
      sceneRef.current.setBasket(player.basket?.items ?? []);
      log.debug("garden.sync", "plots/avatar/basket synced", {
        plots: plots.length,
        basket: player.basket?.items?.length ?? 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("garden.sync", message, {
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  }, [plots, player, ready, sceneRef]);

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
      {mountError && (
        <div className="garden-load-error" role="alert">
          <p className="garden-load-error-title">Garden failed to load</p>
          <p className="garden-load-error-reason">{mountError.message}</p>
          <p className="garden-load-error-hint">Try going back to the farm, then open the garden again.</p>
          <button type="button" className="garden-load-error-back" onClick={onBack}>
            Back to farm
          </button>
        </div>
      )}
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
          <KidAvatar
            size="sm"
            name={player.name}
            mascot={player.mascot}
            avatarKind={player.avatarKind}
            avatarPreset={player.avatarPreset}
            avatarUrl={player.avatarUrl}
            decorative
          />
          <span>{player.name}'s garden</span>
        </button>
        <div className="meters">
          <div
            className={`meter points-meter ${pointsShine ? "shine" : ""} ${pour ? "pouring" : ""}`}
            ref={pointsMeterRef}
          >
            <StarIcon /> {shownPoints}
          </div>
          <div
            className={`meter seed-meter ${gain && gain.seedsFromShards > 0 ? "bump" : ""}`}
            ref={seedMeterRef}
          >
            <AcornArt /> {acornPour ? shownSeeds : player.seeds + player.provisionalSeeds}
            {gain && gain.seedsFromShards > 0 && <span className="meter-delta">+{gain.seedsFromShards}</span>}
          </div>
          {/* Shard meter: fills toward 1 seed. Fertilizer removed -- incomplete, future phase. */}
          <div className={`meter shard-meter ${gain && gain.shardsEarned > 0 ? "bump" : ""}`}>
            <span className="shard-icon" aria-hidden="true">💎</span>
            <span className="shard-count">{player.seedShards}/{config.shardsPerSeed}</span>
            {gain && gain.shardsEarned > 0 && <span className="meter-delta">+{gain.shardsEarned}</span>}
          </div>
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
            id === "water" ? (selfieUnlocked ? player.water.wateringsLeft : 0) : null;
          const label = GARDEN_TOOL_LABEL[id];
          const locked = id === "water" && !selfieUnlocked;
          const artSrc = locked ? (GARDEN_TOOL_ART_LOCKED[id] ?? GARDEN_TOOL_ART[id]) : GARDEN_TOOL_ART[id];
          return (
            <button
              key={id}
              type="button"
              className={`garden-tool ${tool === id ? "selected" : ""} ${locked ? "locked" : ""}`}
              aria-pressed={tool === id}
              aria-label={
                locked
                  ? "Water locked. Take today's selfie."
                  : remaining == null
                    ? label
                    : `${label}, ${remaining} remaining`
              }
              onClick={() => {
                if (locked) {
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
              <img src={artSrc} alt="" draggable={false} />
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
          provisionalSeeds={player.provisionalSeeds}
          onClose={() => setOverlay(null)}
          onNeedJobs={() => setOverlay({ type: "need-jobs" })}
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
          busy={busy}
          onClose={() => setOverlay(null)}
          timezone={choreTimezone}
          onClaim={async (chore) => {
            const data = await api.claimChore(chore.id);
            const granted = data.seedsGranted ?? chore.rewardSeedCount ?? 1;
            setOverlay(null);
            applyGarden(data.player);
            noteUnlocks(data.unlocks);
            celebrateClaimSeeds(granted);
            return data.player;
          }}
          onSkip={async (chore) => {
            const data = await api.skipChore(chore.id);
            if (data.chores) setChores(data.chores);
            applyGarden(data.player);
            return data.player;
          }}
          onNeedPhoto={(chore) => setOverlay({ type: "chore-photo", chore })}
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
              image,
            });
            return { player: data.player, unlocks: data.unlocks };
          }}
          onSuccess={(next, _reward, unlocks) => {
            applyGarden(next);
            noteUnlocks(unlocks);
            setOverlay(null);
            const granted = overlay.chore.rewardSeedCount ?? 1;
            celebrateClaimSeeds(granted);
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
      {overlay?.type === "plot" && selected && selected.state !== "empty" && (!selected.ready || selected.awaitingApproval) && (
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
          onNotifyParent={() =>
            void run(async () => {
              const data = await api.notifyParent();
              if (data.player) return data.player;
              // rate-limited responses still return notifyParent on current player snapshot
              return {
                ...livePlayer!,
                notifyParent: data.notifyParent ?? livePlayer!.notifyParent,
              };
            })
          }
          notifyBusy={busy}
        />
      )}
      {gain && gain.points <= 0 && (gain.seedsFromShards > 0 || gain.shardsEarned > 0) && (
        <HarvestCelebration reward={gain} config={config} />
      )}
      {overlay?.type === "basket" && !pour && (
        <HarvestBasketSheet
          items={player.basket?.items ?? []}
          totalPoints={player.basket?.totalPoints ?? 0}
          busy={busy}
          error={error}
          onClose={() => setOverlay(null)}
          onSell={sellBasket}
        />
      )}
      {acornPour && (
        <AcornPour
          seeds={acornPour.seeds}
          from={acornPour.from}
          to={acornPour.to}
          onArrive={onAcornArrive}
          onDone={() => {
            setShownSeeds(player.seeds + player.provisionalSeeds);
            setAcornPour(null);
          }}
        />
      )}
      {pour && (
        <StarPour
          points={Math.max(0, pour.toPoints - pour.fromPoints)}
          items={pour.items}
          from={pour.from}
          to={pour.to}
          onArrive={onStarArrive}
          onDone={() => setPour(null)}
        />
      )}
      {badgeQueue[0] && <AccoladeCelebration unlock={badgeQueue[0]} />}
      {overlay?.type === "badges" && <AccoladePanel onClose={() => setOverlay(null)} />}
      {overlay?.type === "profile" && (
        <ProfileSheet
          onClose={() => setOverlay(null)}
          onPlayerUpdate={(next) => applyGarden(next)}
        />
      )}
      {overlay?.type === "avatar-picker" && (
        <AvatarPicker
          player={player}
          onClose={() => setOverlay(null)}
          onDone={(next) => {
            applyGarden(next);
            setOverlay(null);
          }}
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
