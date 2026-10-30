import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { FarmPlayerCard, PublicPlot } from "@farmhand/shared";
import {
  BALLOON_GOAL_COSTS,
  BALLOON_PRESETS,
  BALLOON_STAGE,
  GIVE_AMOUNTS,
  START_WALLET,
  boardRect,
  formatStarCount,
  planDonation,
} from "../balloons/balloonMath";
import {
  boardOpacity,
  bunchPose,
  motionDurations,
  restAnim,
  beginDonation,
  stepAnim,
  type AnimState,
} from "../balloons/balloonMotion";
import StarBalloonBunch, { TvGlyph } from "../balloons/StarBalloonBunch";
import { useFarmPixi } from "../pixi/usePixi";
import "../styles.balloons.css";

const GOAL_TITLE = "Movie night";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useStageScale() {
  const [scale, setScale] = useState(() => fitStage());
  useEffect(() => {
    const onResize = () => setScale(fitStage());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

function fitStage() {
  if (typeof window === "undefined") return 1;
  return Math.min(window.innerWidth / BALLOON_STAGE.width, window.innerHeight / BALLOON_STAGE.height);
}

type Ui = {
  cost: number;
  filled: number;
  wallet: number;
  released: boolean;
};

export default function BalloonQa() {
  const scale = useStageScale();
  const prefersReduced = usePrefersReducedMotion();
  const [ui, setUi] = useState<Ui>({
    cost: 1100,
    filled: 0,
    wallet: START_WALLET,
    released: false,
  });
  const [motionChoice, setMotionChoice] = useState<"auto" | "full" | "reduced">("auto");
  const reduced = motionChoice === "auto" ? prefersReduced : motionChoice === "reduced";
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const anim = useRef<AnimState>(restAnim(0));
  const reveal = useRef(1);
  const [rev, setRev] = useState(0);

  const { hostRef, sceneRef, ready } = useFarmPixi({
    onPlayer: () => undefined,
    onStore: () => undefined,
  });

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setPlayers(qaPlayers());
    scene.setFamilyJars([]);
  }, [ready, sceneRef]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      anim.current = stepAnim(anim.current, now, reducedRef.current);
      if (reveal.current < 1) {
        reveal.current = reducedRef.current ? 1 : Math.min(1, reveal.current + dt / 0.45);
      }
      setRev((n) => (n + 1) % 1_000_000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const give = useCallback((amount: number) => {
    const current = uiRef.current;
    if (anim.current.phase !== "rest" || current.released) return;
    const spend = Math.min(amount, current.wallet);
    const plan = planDonation(current.cost, current.filled, spend);
    if (plan.accepted <= 0) return;
    anim.current = beginDonation(anim.current.shown, plan, reducedRef.current, performance.now());
    setUi((prev) => ({ ...prev, wallet: prev.wallet - plan.accepted, filled: plan.to }));
  }, []);

  const applyPreset = useCallback((cost: number, filled: number) => {
    const phase = anim.current.phase;
    if (phase !== "rest" && phase !== "reward") return;
    const comingBack = uiRef.current.released || anim.current.phase === "reward";
    anim.current = restAnim(filled);
    reveal.current = comingBack ? 0 : 1;
    setUi((prev) => ({ ...prev, cost, filled, released: false }));
  }, []);

  const setCost = useCallback((cost: number) => {
    if (anim.current.phase !== "rest" || uiRef.current.released) return;
    const filled = Math.min(uiRef.current.filled, cost);
    anim.current = restAnim(filled);
    setUi((prev) => ({ ...prev, cost, filled }));
  }, []);

  const setProgress = useCallback((filled: number) => {
    if (anim.current.phase !== "rest" || uiRef.current.released) return;
    const next = Math.max(0, Math.min(Math.round(filled), uiRef.current.cost));
    anim.current = restAnim(next);
    setUi((prev) => ({ ...prev, filled: next }));
  }, []);

  const finish = useCallback(() => {
    const current = uiRef.current;
    give(Math.max(0, current.cost - current.filled));
  }, [give]);

  const reset = useCallback(() => {
    anim.current = restAnim(0);
    reveal.current = uiRef.current.released ? 0 : 1;
    setUi((prev) => ({ ...prev, filled: 0, wallet: START_WALLET, released: false }));
  }, []);

  const closeReward = useCallback(() => {
    anim.current = restAnim(uiRef.current.filled);
    setUi((prev) => ({ ...prev, released: true }));
  }, []);

  const prefersRef = useRef(prefersReduced);
  prefersRef.current = prefersReduced;
  const toggleReduced = useCallback(() => {
    setMotionChoice((current) => {
      const effective = current === "auto" ? prefersRef.current : current === "reduced";
      return effective ? "full" : "reduced";
    });
  }, []);

  const state = anim.current;
  const count = Math.max(1, Math.ceil(ui.cost / 200));
  const pose = bunchPose(BALLOON_STAGE.width, BALLOON_STAGE.height, count, state, performance.now() / 1000, reduced);
  const opacity = pose.opacity * reveal.current;
  const wood = boardOpacity(state);
  const board = boardRect(BALLOON_STAGE.width, BALLOON_STAGE.height);
  const hideBunch = state.phase === "reward" || ui.released;
  const sparkle = motionDurations(reduced).sparkle;
  const bounce = motionDurations(reduced).bounce;
  const reward = state.phase === "reward" && !ui.released;

  return (
    <div className="balloon-fit-root">
      <div className="balloon-fit" style={{ width: BALLOON_STAGE.width * scale, height: BALLOON_STAGE.height * scale }}>
        <div
          className={reduced ? "balloon-stage is-reduced" : "balloon-stage"}
          data-qa="balloon-stage"
          data-phase={state.phase}
          data-shown={Math.round(state.shown)}
          data-filled={ui.filled}
          data-rev={rev}
          style={{ width: BALLOON_STAGE.width, height: BALLOON_STAGE.height, transform: `scale(${scale})` }}
        >
          <div className="pixi-host" ref={hostRef} data-qa="farm-pixi" />
          <div
            className="balloon-board"
            data-qa="wood-board"
            style={{
              left: board.left,
              top: board.top,
              width: board.width,
              height: board.height,
              opacity: wood,
            }}
          >
            <div className="balloon-board-copy">
              <div className="balloon-goal-chip">
                <TvGlyph size={72} />
                <span>{GOAL_TITLE}</span>
              </div>
              <div className="balloon-board-wallet" data-qa="board-wallet">
                <span className="balloon-wallet-k">Wallet</span>
                <span className="balloon-wallet-n">{formatStarCount(ui.wallet)}</span>
                <span className="balloon-wallet-star">★</span>
              </div>
            </div>
          </div>

          {!hideBunch && (
            <div
              className="balloon-flight"
              data-qa="balloon-flight"
              style={{
                transform: `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.scale})`,
                opacity,
              }}
            >
              <StarBalloonBunch
                cost={ui.cost}
                shown={state.shown}
                locking={state.locking}
                sparkle={sparkle}
                bounce={bounce}
                layoutScale={pose.scale}
              />
            </div>
          )}

          {reward && <Reward reduced={reduced} onClose={closeReward} />}

          <Dock
            ui={ui}
            phase={state.phase}
            reduced={reduced}
            onPreset={applyPreset}
            onCost={setCost}
            onProgress={setProgress}
            onGive={give}
            onFinish={finish}
            onReset={reset}
            onToggleReduced={toggleReduced}
          />
        </div>
      </div>
    </div>
  );
}

function Reward({ reduced, onClose }: { reduced: boolean; onClose: () => void }) {
  return (
    <div className="balloon-reward" data-qa="reward" role="dialog" aria-label="Movie night is ready">
      {!reduced && <Confetti />}
      <div className="balloon-reward-card">
        <div className="balloon-reward-star" aria-hidden="true">
          ★
        </div>
        <p className="balloon-reward-kicker">Every balloon is full</p>
        <h2>You did it!</h2>
        <p className="balloon-reward-copy">Movie night is ready.</p>
        <button type="button" className="btn gold" data-qa="reward-close" onClick={onClose}>
          Back to the farm
        </button>
      </div>
    </div>
  );
}

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = BALLOON_STAGE.width;
    canvas.height = BALLOON_STAGE.height;
    const colors = ["#f0b429", "#d6453d", "#7dbe4a", "#f4b7c4", "#b9ddf5", "#fff6e4", "#e6c07a", "#8fd0c6"];
    const bits = Array.from({ length: 86 }, () => ({
      x: Math.random() * canvas.width,
      y: -40 - Math.random() * canvas.height * 0.55,
      w: 14 + Math.random() * 16,
      h: 10 + Math.random() * 12,
      vy: 260 + Math.random() * 340,
      vx: -60 + Math.random() * 120,
      rot: Math.random() * Math.PI,
      vr: -2.4 + Math.random() * 4.8,
      color: colors[Math.floor(Math.random() * colors.length)] ?? "#f0b429",
      sway: Math.random() * Math.PI * 2,
    }));
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const bit of bits) {
        bit.y += bit.vy * dt;
        bit.x += bit.vx * dt + Math.sin(now / 380 + bit.sway) * 30 * dt;
        bit.rot += bit.vr * dt;
        if (bit.y > canvas.height + 30) {
          bit.y = -20;
          bit.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(bit.x, bit.y);
        ctx.rotate(bit.rot);
        ctx.fillStyle = bit.color;
        ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
        ctx.restore();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="balloon-confetti" data-qa="confetti" />;
}

const Dock = memo(function Dock({
  ui,
  phase,
  reduced,
  onPreset,
  onCost,
  onProgress,
  onGive,
  onFinish,
  onReset,
  onToggleReduced,
}: {
  ui: Ui;
  phase: AnimState["phase"];
  reduced: boolean;
  onPreset: (cost: number, filled: number) => void;
  onCost: (cost: number) => void;
  onProgress: (filled: number) => void;
  onGive: (amount: number) => void;
  onFinish: () => void;
  onReset: () => void;
  onToggleReduced: () => void;
}) {
  const busy = phase !== "rest" && phase !== "reward";
  const done = ui.filled >= ui.cost || ui.released;
  const noStars = ui.wallet <= 0;
  return (
    <div className="balloon-dock" data-qa="balloon-dock">
      <div className="balloon-dock-row">
        <span className="balloon-dock-label">Presets</span>
        {BALLOON_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="btn ghost"
            data-qa={`preset-${preset.id}`}
            disabled={busy}
            onClick={() => onPreset(preset.cost, preset.filled)}
          >
            {preset.label}
          </button>
        ))}
        <span className="balloon-wallet" data-qa="wallet-points">
          <span className="balloon-wallet-k">Wallet</span>
          <span className="balloon-wallet-n">{formatStarCount(ui.wallet)}</span>
          <span>★</span>
        </span>
      </div>
      <div className="balloon-dock-row">
        <span className="balloon-dock-label">Goal</span>
        {BALLOON_GOAL_COSTS.map((cost) => (
          <button
            key={cost}
            type="button"
            className={cost === ui.cost ? "btn gold" : "btn ghost"}
            data-qa={`cost-${cost}`}
            disabled={busy || ui.released}
            onClick={() => onCost(cost)}
          >
            {formatStarCount(cost)}
          </button>
        ))}
        <label className="balloon-progress-field">
          Progress
          <input
            data-qa="progress-input"
            type="number"
            min={0}
            max={ui.cost}
            value={ui.filled}
            disabled={busy || ui.released}
            onChange={(event) => onProgress(Number(event.target.value))}
          />
          <input
            data-qa="progress-slider"
            type="range"
            min={0}
            max={ui.cost}
            value={ui.filled}
            disabled={busy || ui.released}
            onChange={(event) => onProgress(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="balloon-dock-row">
        {GIVE_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            className="btn primary"
            data-qa={`give-${amount}`}
            disabled={busy || done || noStars}
            onClick={() => onGive(amount)}
          >
            Give +{amount}
          </button>
        ))}
        <button
          type="button"
          className="btn gold"
          data-qa="give-finish"
          disabled={busy || done || noStars}
          onClick={onFinish}
        >
          Finish goal
        </button>
        <button type="button" className="btn ghost" data-qa="reset" onClick={onReset}>
          Reset
        </button>
        <label className="balloon-reduced">
          <input
            data-qa="reduced-motion"
            type="checkbox"
            checked={reduced}
            onChange={onToggleReduced}
          />
          Reduced motion
        </label>
      </div>
    </div>
  );
});

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

function qaPlayers(): FarmPlayerCard[] {
  return [
    card("l", "Willow", [plot(0, 1, 4, true), plot(4, 2, 3), plot(6, 1, 2)]),
    card("c", "Finn", [plot(1, 2, 4, true), plot(4, 2, 3), plot(8, 1, 4, true)]),
    card("r", "Sage", [plot(0, 3, 3), plot(4, 3, 2), plot(8, 3, 4, true)]),
  ];
}
