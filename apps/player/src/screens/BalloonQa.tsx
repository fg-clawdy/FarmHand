import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { FarmPlayerCard, PublicPlot } from "@farmhand/shared";
import {
  BALLOON_GOAL_COSTS,
  BALLOON_PRESETS,
  GIVE_AMOUNTS,
  START_WALLET,
  chromeExtent,
  formatStarCount,
  planDonation,
} from "../balloons/balloonMath";
import {
  sceneDim,
  cardReveal,
  bunchPose,
  motionDurations,
  restAnim,
  beginDonation,
  stepAnim,
  type AnimState,
} from "../balloons/balloonMotion";
import StarBalloonBunch from "../balloons/StarBalloonBunch";
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

function useViewSize() {
  const [view, setView] = useState(() => ({
    w: typeof window === "undefined" ? 1280 : window.innerWidth,
    h: typeof window === "undefined" ? 800 : window.innerHeight,
  }));
  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return view;
}

type Ui = {
  cost: number;
  filled: number;
  wallet: number;
  released: boolean;
};

export default function BalloonQa() {
  const view = useViewSize();
  const prefersReduced = usePrefersReducedMotion();
  const [ui, setUi] = useState<Ui>({
    cost: 1100,
    filled: 0,
    wallet: START_WALLET,
    released: false,
  });
  const [motionChoice, setMotionChoice] = useState<"auto" | "full" | "reduced">("auto");
  const [dockCollapsed, setDockCollapsed] = useState(false);
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
  const nowSec = performance.now() / 1000;
  const pose = bunchPose(view.w, view.h, count, state, nowSec, reduced);
  const opacity = pose.opacity * reveal.current;
  const dim = sceneDim(state);
  const hideBunch = state.phase === "reward" || ui.released;
  const showConfetti =
    motionDurations(reduced).confetti &&
    !ui.released &&
    (state.phase === "reward" || state.phase === "away");
  const sparkle = motionDurations(reduced).sparkle;
  const bounce = motionDurations(reduced).bounce;
  const card = ui.released ? 0 : cardReveal(state, reduced);
  const autoHideDock = state.phase !== "rest" && state.phase !== "reward";
  const dockHidden = autoHideDock || dockCollapsed;

  return (
    <div className="balloon-fit-root">
      <div
        className={reduced ? "balloon-stage is-reduced" : "balloon-stage"}
        data-qa="balloon-stage"
        data-phase={state.phase}
        data-shown={Math.round(state.shown)}
        data-filled={ui.filled}
        data-zoom={state.zoomU.toFixed(3)}
        data-scale={pose.scale.toFixed(2)}
        data-rev={rev}
        style={{ width: "100%", height: "100%" }}
      >
        <div className="pixi-host" ref={hostRef} data-qa="farm-pixi" />
        <div className="balloon-dim" data-qa="farm-dim" style={{ opacity: dim }} />

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
                timeSec={nowSec}
                labelPx={chromeExtent(view.h)}
              />
            </div>
          )}

          {showConfetti && <Confetti width={view.w} height={view.h} />}
          {card > 0 && <Reward reveal={card} onClose={closeReward} />}

          {dockHidden && !autoHideDock && (
            <button type="button" className="balloon-dock-tab" data-qa="dock-show" onClick={() => setDockCollapsed(false)}>
              Controls
            </button>
          )}
          <Dock
            hidden={dockHidden}
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
            onCollapse={() => setDockCollapsed(true)}
          />
      </div>
    </div>
  );
}

function Reward({ reveal, onClose }: { reveal: number; onClose: () => void }) {
  return (
    <div
      className="balloon-reward"
      data-qa="reward"
      data-reveal={reveal.toFixed(2)}
      role="dialog"
      aria-label="Movie night is ready"
      style={{ pointerEvents: reveal > 0.92 ? "auto" : "none" }}
    >
      <div
        className="balloon-reward-card"
        style={{ opacity: reveal, transform: `scale(${0.9 + 0.1 * reveal})` }}
      >
        <div className="balloon-reward-motif" aria-hidden="true">
          <MotifBalloon fill="#ff5f93" deep="#c4285c" />
          <MotifBalloon fill="#ffc233" deep="#d48400" tall />
          <MotifBalloon fill="#4eb6ff" deep="#1d74c9" />
        </div>
        <p className="balloon-reward-kicker">Every balloon is full</p>
        <h2>You did it!</h2>
        <p className="balloon-reward-copy">{GOAL_TITLE} is ready.</p>
        <button type="button" className="btn gold" data-qa="reward-close" onClick={onClose}>
          Back to the farm
        </button>
      </div>
    </div>
  );
}

function MotifBalloon({ fill, deep, tall }: { fill: string; deep: string; tall?: boolean }) {
  const h = tall ? 78 : 64;
  return (
    <svg width="54" height={h} viewBox="0 0 54 86">
      <path
        d="M 27 70 C 18 66 14 58 14 50 C 6 46 2 34 2 26 C 2 12 13 2 27 2 C 41 2 52 12 52 26 C 52 34 48 46 40 50 C 40 58 36 66 27 70 Z"
        fill={fill}
        stroke="#5c3a22"
        strokeWidth="3"
      />
      <ellipse cx="18" cy="16" rx="8" ry="4" fill="#fff" opacity="0.8" transform="rotate(-28 18 16)" />
      <path d="M 22 70 C 20 76 24 80 27 76 C 30 80 34 76 32 70" fill={deep} stroke="#5c3a22" strokeWidth="2" />
      <path d="M 27 76 C 20 82 14 80 12 86 M 27 76 C 34 82 40 80 42 86" fill="none" stroke="#5c3a22" strokeWidth="2" />
    </svg>
  );
}

function Confetti({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
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
  }, [width, height]);
  return <canvas ref={ref} className="balloon-confetti" data-qa="confetti" />;
}

const Dock = memo(function Dock({
  hidden,
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
  onCollapse,
}: {
  hidden: boolean;
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
  onCollapse: () => void;
}) {
  const busy = phase !== "rest" && phase !== "reward";
  const done = ui.filled >= ui.cost || ui.released;
  const noStars = ui.wallet <= 0;
  return (
    <div className={hidden ? "balloon-dock is-hidden" : "balloon-dock"} data-qa="balloon-dock" data-hidden={hidden ? "1" : "0"}>
      <div className="balloon-dock-row">
        <button type="button" className="btn ghost balloon-dock-hide" data-qa="dock-hide" onClick={onCollapse}>
          Hide
        </button>
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
