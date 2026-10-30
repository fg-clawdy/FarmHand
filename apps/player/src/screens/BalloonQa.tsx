import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { FarmPlayerCard, PublicPlot } from "@farmhand/shared";
import {
  BALLOON_GOAL_COSTS,
  BALLOON_PRESETS,
  BUNCH_SHOW_MAX,
  GIVE_AMOUNTS,
  START_WALLET,
  balloonCount,
  chromeExtent,
  formatStarCount,
  goalOverflow,
  goalSeats,
  planDonation,
  type QaGoal,
} from "../balloons/balloonMath";
import {
  sceneDim,
  cardReveal,
  idleBob,
  motionDurations,
  poseFromRest,
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
  goals: QaGoal[];
  focus: number;
  wallet: number;
  released: boolean;
};

const START_GOALS: QaGoal[] = [{ id: "movie", title: "Movie night", cost: 1100, filled: 0 }];

function focusedGoal(ui: Ui): QaGoal | null {
  return ui.goals[ui.focus] ?? ui.goals[0] ?? null;
}

export default function BalloonQa() {
  const view = useViewSize();
  const prefersReduced = usePrefersReducedMotion();
  const [ui, setUi] = useState<Ui>({
    goals: START_GOALS,
    focus: 0,
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
    scene.setLibraryHouse(false);
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
    const goal = focusedGoal(current);
    if (!goal || anim.current.phase !== "rest" || current.released) return;
    const spend = Math.min(amount, current.wallet);
    const plan = planDonation(goal.cost, goal.filled, spend);
    if (plan.accepted <= 0) return;
    anim.current = beginDonation(anim.current.shown, plan, reducedRef.current, performance.now());
    setUi((prev) => ({
      ...prev,
      wallet: prev.wallet - plan.accepted,
      goals: prev.goals.map((item, index) =>
        index === (prev.goals[prev.focus] ? prev.focus : 0) ? { ...item, filled: plan.to } : item,
      ),
    }));
  }, []);

  const applyPreset = useCallback((goals: readonly QaGoal[]) => {
    const phase = anim.current.phase;
    if (phase !== "rest" && phase !== "reward") return;
    const comingBack = uiRef.current.released || anim.current.phase === "reward";
    const next = goals.map((goal) => ({ ...goal }));
    anim.current = restAnim(next[0]?.filled ?? 0);
    reveal.current = comingBack ? 0 : 1;
    setUi((prev) => ({ ...prev, goals: next, focus: 0, released: false }));
  }, []);

  const setCost = useCallback((cost: number) => {
    if (anim.current.phase !== "rest" || uiRef.current.released) return;
    const goal = focusedGoal(uiRef.current);
    if (!goal) return;
    const filled = Math.min(goal.filled, cost);
    anim.current = restAnim(filled);
    setUi((prev) => ({
      ...prev,
      goals: prev.goals.map((item, index) => (index === prev.focus ? { ...item, cost, filled } : item)),
    }));
  }, []);

  const setProgress = useCallback((filled: number) => {
    if (anim.current.phase !== "rest" || uiRef.current.released) return;
    const goal = focusedGoal(uiRef.current);
    if (!goal) return;
    const next = Math.max(0, Math.min(Math.round(filled), goal.cost));
    anim.current = restAnim(next);
    setUi((prev) => ({
      ...prev,
      goals: prev.goals.map((item, index) => (index === prev.focus ? { ...item, filled: next } : item)),
    }));
  }, []);

  const finish = useCallback(() => {
    const goal = focusedGoal(uiRef.current);
    if (!goal) return;
    give(Math.max(0, goal.cost - goal.filled));
  }, [give]);

  const reset = useCallback(() => {
    anim.current = restAnim(0);
    reveal.current = uiRef.current.released ? 0 : 1;
    setUi((prev) => ({
      ...prev,
      wallet: START_WALLET,
      released: false,
      goals: prev.goals.map((item, index) => (index === prev.focus ? { ...item, filled: 0 } : item)),
    }));
  }, []);

  const closeReward = useCallback(() => {
    const goal = focusedGoal(uiRef.current);
    anim.current = restAnim(goal?.filled ?? 0);
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
  const focus = ui.goals[ui.focus] ? ui.focus : 0;
  const focusGoal = ui.goals[focus] ?? null;
  const shownGoals = ui.goals.slice(0, BUNCH_SHOW_MAX);
  const overflow = goalOverflow(ui.goals.length);
  const seats = goalSeats(
    view.w,
    view.h,
    shownGoals.map((goal) => Math.max(1, balloonCount(goal.cost))),
  );
  const nowSec = performance.now() / 1000;
  const bob = idleBob(nowSec, state.zoomU, reduced);
  const dim = sceneDim(state);
  const hideFocus = state.phase === "reward" || ui.released;
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
        data-filled={focusGoal?.filled ?? 0}
        data-goals={ui.goals.length}
        data-handoff={state.handoff ? state.handoff.t.toFixed(3) : ""}
        data-zoom={state.zoomU.toFixed(3)}
        data-rev={rev}
        style={{ width: "100%", height: "100%" }}
      >
        <div className="pixi-host" ref={hostRef} data-qa="farm-pixi" />
        <div className="balloon-dim" data-qa="farm-dim" style={{ opacity: dim }} />

          {shownGoals.map((goal, index) => {
            const seat = seats[index];
            if (!seat) return null;
            const isFocus = index === focus;
            if (isFocus && hideFocus) return null;
            const pose = isFocus
              ? poseFromRest(
                  { x: seat.x, y: seat.y, scale: seat.scale, opacity: 1 },
                  view.w,
                  view.h,
                  Math.max(1, balloonCount(goal.cost)),
                  state,
                  nowSec,
                  reduced,
                )
              : { x: seat.x, y: seat.y + bob, scale: seat.scale, opacity: state.phase === "rest" ? 1 : 0.55 };
            const shown = isFocus ? state.shown : goal.filled;
            return (
              <div
                key={goal.id}
                className="balloon-flight"
                data-qa="balloon-flight"
                data-goal={index}
                style={{
                  transform: `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.scale})`,
                  opacity: pose.opacity * (isFocus ? reveal.current : 1),
                  zIndex: isFocus ? 6 : 4,
                }}
              >
                <StarBalloonBunch
                  cost={goal.cost}
                  shown={shown}
                  title={goal.title}
                  locking={isFocus ? state.locking : null}
                  handoff={isFocus ? state.handoff : null}
                  sparkle={sparkle && isFocus}
                  bounce={bounce && isFocus}
                  layoutScale={pose.scale}
                  timeSec={nowSec}
                  labelPx={chromeExtent(view.h)}
                  labelBudget={shownGoals.length > 1 ? 60 : undefined}
                />
              </div>
            );
          })}
          {overflow > 0 && seats[seats.length - 1] && (
            <div
              className="balloon-more"
              data-qa="balloon-more"
              style={{
                left: seats[seats.length - 1]!.x + 36,
                top: seats[seats.length - 1]!.y - 8,
              }}
            >
              +{overflow}
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
            onPreset={(goals) => applyPreset(goals)}
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
  onPreset: (goals: readonly QaGoal[]) => void;
  onCost: (cost: number) => void;
  onProgress: (filled: number) => void;
  onGive: (amount: number) => void;
  onFinish: () => void;
  onReset: () => void;
  onToggleReduced: () => void;
  onCollapse: () => void;
}) {
  const goal = ui.goals[ui.focus] ?? ui.goals[0] ?? null;
  const busy = phase !== "rest" && phase !== "reward";
  const done = !goal || goal.filled >= goal.cost || ui.released;
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
            onClick={() => onPreset(preset.goals)}
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
            className={cost === goal?.cost ? "btn gold" : "btn ghost"}
            data-qa={`cost-${cost}`}
            disabled={busy || ui.released || !goal}
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
            max={goal?.cost ?? 0}
            value={goal?.filled ?? 0}
            disabled={busy || ui.released || !goal}
            onChange={(event) => onProgress(Number(event.target.value))}
          />
          <input
            data-qa="progress-slider"
            type="range"
            min={0}
            max={goal?.cost ?? 0}
            value={goal?.filled ?? 0}
            disabled={busy || ui.released || !goal}
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
