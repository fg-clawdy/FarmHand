import { useEffect, useRef, useState } from "react";
import {
  activeBalloonIndex,
  arrangementBounds,
  balloonCount,
  chromeExtent,
  goalOverflow,
  goalSeats,
} from "./balloonMath";
import { planDonation } from "./balloonMath";
import {
  beginDonation,
  cardReveal,
  idleBob,
  motionDurations,
  poseFromRest,
  restAnim,
  sceneDim,
  stepAnim,
  type AnimState,
} from "./balloonMotion";
import { meadowDuringPlayback, type BalloonJob, type MeadowGoal } from "./balloonQueue";
import StarBalloonBunch from "./StarBalloonBunch";

export default function FarmBalloonLayer({
  goals,
  starsPer,
  job,
  onOpen,
  onOverflow,
  onFinished,
}: {
  goals: MeadowGoal[];
  starsPer: number;
  job: BalloonJob | null;
  onOpen: (goalId: string) => void;
  onOverflow?: () => void;
  onFinished: () => void;
}) {
  const [view, setView] = useState(() => ({
    w: typeof window === "undefined" ? 1280 : window.innerWidth,
    h: typeof window === "undefined" ? 800 : window.innerHeight,
  }));
  const anim = useRef<AnimState>(restAnim(0));
  const jobKey = useRef("");
  const [rev, setRev] = useState(0);
  const reduced = false;
  const previousGoals = useRef<MeadowGoal[]>([]);

  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      void dt;
      last = now;
      const prev = anim.current.phase;
      anim.current = stepAnim(anim.current, now, reduced);
      if (anim.current.phase === "rest" && prev === "zoom-out") onFinished();
      setRev((n) => (n + 1) % 1_000_000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [onFinished]);

  useEffect(() => {
    if (!job) {
      jobKey.current = "";
      if (anim.current.phase === "reward") anim.current = restAnim(0);
      return;
    }
    const key = `${job.goalId}:${job.from}:${job.to}`;
    if (jobKey.current === key) return;
    if (anim.current.phase !== "rest" && anim.current.phase !== "reward") return;
    jobKey.current = key;
    const plan = planDonation(job.cost, job.from, Math.max(0, job.to - job.from), starsPer);
    anim.current = beginDonation(job.from, plan, reduced, performance.now());
  }, [job, starsPer]);

  const state = anim.current;
  const playingId = job && state.phase !== "rest" ? job.goalId : null;
  const visible = meadowDuringPlayback(goals, job, playingId != null, previousGoals.current);
  previousGoals.current = visible;
  const seats = goalSeats(
    view.w,
    view.h,
    visible.map((goal) => Math.max(1, balloonCount(goal.cost, starsPer))),
    visible.map((goal) => activeBalloonIndex(goal.cost, goal.id === playingId ? state.shown : goal.filled, starsPer)),
  );
  const overflow = goalOverflow(goals.length);
  const nowSec = performance.now() / 1000;
  const bob = idleBob(nowSec, state.zoomU, reduced);
  const dim = sceneDim(state);
  const card = state.phase === "reward" || state.phase === "away" ? cardReveal(state, reduced) : 0;
  const sparkle = motionDurations(reduced).sparkle;
  const showConfetti = motionDurations(reduced).confetti && (state.phase === "away" || state.phase === "reward");

  return (
    <div className="farm-balloons" data-qa="farm-balloons" data-goals={goals.length} data-rev={rev}>
      <div className="balloon-dim" data-qa="farm-dim" style={{ opacity: dim }} />
      {visible.slice(0, 3).map((goal, index) => {
        const seat = seats[index];
        if (!seat) return null;
        const playing = goal.id === playingId;
        const count = Math.max(1, balloonCount(goal.cost, starsPer));
        const pose = playing
          ? poseFromRest({ x: seat.x, y: seat.y, scale: seat.scale, opacity: 1 }, view.w, view.h, count, state, nowSec, reduced)
          : { x: seat.x, y: seat.y + bob, scale: seat.scale, opacity: state.phase === "rest" ? 1 : 0.55 };
        if (playing && (state.phase === "reward" || pose.opacity <= 0.02)) return null;
        const shown = playing ? state.shown : goal.filled;
        const active = activeBalloonIndex(goal.cost, shown, starsPer);
        const bounds = arrangementBounds(count, active);
        return (
          <div
            key={goal.id}
            className="balloon-flight"
            data-qa="balloon-flight"
            data-goal={goal.id}
            data-filled={Math.round(goal.filled)}
            style={{
              transform: `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.scale})`,
              opacity: pose.opacity,
              zIndex: playing ? 6 : 4,
            }}
          >
            <StarBalloonBunch
              cost={goal.cost}
              shown={shown}
              title={goal.title}
              starsPer={starsPer}
              locking={playing ? state.locking : null}
              handoff={playing ? state.handoff : null}
              sparkle={sparkle && playing}
              bounce={playing}
              layoutScale={pose.scale}
              timeSec={nowSec}
              labelPx={chromeExtent(view.h)}
              labelBudget={Math.max(96, 300 / Math.max(1, Math.min(3, goals.length)))}
            />
            {state.phase === "rest" && (
              <button
                type="button"
                className="balloon-hit"
                data-qa={`open-goal-${goal.id}`}
                aria-label={`Add stars to ${goal.title}`}
                style={{
                  left: bounds.minX - 16,
                  top: bounds.minY - 16,
                  width: bounds.width + 32,
                  height: bounds.maxY - bounds.minY + 72,
                }}
                onClick={() => onOpen(goal.id)}
              />
            )}
          </div>
        );
      })}
      {overflow > 0 && seats[Math.min(2, seats.length - 1)] && (
        <button
          type="button"
          className="balloon-more"
          data-qa="balloon-more"
          style={{ left: seats[Math.min(2, seats.length - 1)]!.x + 46, top: seats[Math.min(2, seats.length - 1)]!.y - 8 }}
          onClick={onOverflow}
        >
          +{overflow}
        </button>
      )}
      {showConfetti && <Confetti width={view.w} height={view.h} />}
      {card > 0 && job && (
        <div className="balloon-reward" data-qa="reward" data-reveal={card.toFixed(2)} role="dialog" aria-label={`${job.title} is ready`}>
          <div className="balloon-reward-card" style={{ opacity: card, transform: `scale(${0.9 + 0.1 * card})` }}>
            <p className="balloon-reward-kicker">Every balloon is full</p>
            <h2>You did it!</h2>
            <p className="balloon-reward-copy">{job.title} is ready.</p>
            <button type="button" className="btn gold" data-qa="reward-close" onClick={onFinished}>
              Back to the farm
            </button>
          </div>
        </div>
      )}
    </div>
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
    const colors = ["#f0b429", "#d6453d", "#7dbe4a", "#f4b7c4", "#b9ddf5", "#fff6e4"];
    const bits = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      w: 12 + Math.random() * 12,
      h: 8 + Math.random() * 10,
      vy: 220 + Math.random() * 280,
      vx: -40 + Math.random() * 80,
      rot: Math.random() * Math.PI,
      vr: -2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)] ?? "#f0b429",
    }));
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const bit of bits) {
        bit.y += bit.vy * dt;
        bit.x += bit.vx * dt;
        bit.rot += bit.vr * dt;
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
