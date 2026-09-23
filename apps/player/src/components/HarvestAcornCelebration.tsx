import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { GameConfig } from "@farmhand/shared";
import type { HarvestReward } from "../api";

/** White coloring-book page (empty meter). */
const PAGE = "/art/ui/acorn_page.png";
/** Flat green fill — clip rises 1/10 per shard (not realistic acorn paint). */
const FILL = "/art/ui/acorn_fill_green.png";
/** 9 equidistant horizontal lines → 10 shard bands (drawn over green too). */
const TICKS = "/art/ui/acorn_ticks.png";
/** Dark outline stamped above the fill so the stroke stays crisp. */
const OUTLINE = "/art/ui/acorn_outline_only.png";
/** Must match tick art + CSS fill band in acorn assets. */
const FILL_TOP_PCT = 6;
const FILL_BOT_PCT = 3;
/** Slow enough for young players to read each shard band. */
const STEP_MS = 1100;
/** Extra beat after the last anim so kids can read the meter before it leaves. */
const POST_ANIM_HOLD_MS = 1000;
const HOLD_AFTER_FILL_MS = 2200 + POST_ANIM_HOLD_MS;
const FULL_CELEBRATE_MS = 2600 + POST_ANIM_HOLD_MS;
const SAIL_MS = 900;
const COUNT_SWAP_MS = 280;
const GOLD_HOLD_MS = 700;

function clipTopForLevel(level: number, per: number) {
  const fillable = 100 - FILL_TOP_PCT - FILL_BOT_PCT;
  const pct = Math.max(0, Math.min(per, level)) / Math.max(1, per);
  // inset from top: empty = top+fillable, full = top
  return FILL_TOP_PCT + fillable * (1 - pct);
}

export type HarvestAcornProps = {
  reward: HarvestReward;
  config: GameConfig;
  shardsBefore: number;
  seedsBefore: number;
  seedMeterEl: HTMLElement | null;
  onFinished: () => void;
};

type Phase =
  | { kind: "fill"; level: number; target: number; seedsLeft: number }
  | { kind: "celebrate"; seedsLeft: number }
  | { kind: "sail"; seedsLeft: number }
  | { kind: "count"; from: number; to: number; seedsLeft: number; afterRemaining: boolean }
  | { kind: "done" };

function clampLevel(n: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(n)));
}

/**
 * Coloring-book acorn meter: white empty page, flat green liquid rises
 * from the bottom 1/10 per shard, then celebrate/sail into the seed pouch.
 */
export default function HarvestAcornCelebration({
  reward,
  config,
  shardsBefore,
  seedsBefore,
  seedMeterEl,
  onFinished,
}: HarvestAcornProps) {
  const per = Math.max(1, config.shardsPerSeed || 10);
  const earned = Math.max(0, reward.shardsEarned ?? 0);
  const minted = Math.max(0, reward.seedsFromShards ?? 0);
  const remaining = Math.max(0, reward.remainingShards ?? 0);

  const acornRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>(() => {
    const start = clampLevel(shardsBefore % per, per);
    const firstTarget = minted > 0 ? per : clampLevel(start + earned, per);
    return { kind: "fill", level: start, target: firstTarget, seedsLeft: minted };
  });
  const [displaySeeds, setDisplaySeeds] = useState(seedsBefore);
  const [seedFlash, setSeedFlash] = useState<"idle" | "out" | "gold">("idle");
  const [sailStyle, setSailStyle] = useState<CSSProperties | undefined>();
  const [hideAcorn, setHideAcorn] = useState(false);
  const [fillLevel, setFillLevel] = useState(() => clampLevel(shardsBefore % per, per));

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase({ kind: "done" });
    onFinished();
  }

  useEffect(() => {
    if (earned <= 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer = 0;
    if (phase.kind === "fill") {
      setFillLevel(phase.level);
      if (phase.level < phase.target) {
        timer = window.setTimeout(() => {
          setPhase({ ...phase, level: phase.level + 1 });
        }, STEP_MS);
      } else if (phase.level >= per && phase.seedsLeft > 0) {
        timer = window.setTimeout(() => setPhase({ kind: "celebrate", seedsLeft: phase.seedsLeft }), 80);
      } else {
        timer = window.setTimeout(() => finish(), HOLD_AFTER_FILL_MS);
      }
    } else if (phase.kind === "celebrate") {
      setFillLevel(per);
      timer = window.setTimeout(() => setPhase({ kind: "sail", seedsLeft: phase.seedsLeft }), FULL_CELEBRATE_MS);
    } else if (phase.kind === "count") {
      timer = window.setTimeout(() => {
        setSeedFlash("out");
        window.setTimeout(() => {
          setDisplaySeeds(phase.to);
          setSeedFlash("gold");
          window.setTimeout(() => {
            setSeedFlash("idle");
            const left = phase.seedsLeft - 1;
            if (left > 0) {
              setHideAcorn(false);
              setSailStyle(undefined);
              setFillLevel(0);
              setPhase({ kind: "fill", level: 0, target: per, seedsLeft: left });
            } else if (phase.afterRemaining && remaining > 0) {
              setHideAcorn(false);
              setSailStyle(undefined);
              setFillLevel(0);
              setPhase({ kind: "fill", level: 0, target: remaining, seedsLeft: 0 });
            } else {
              window.setTimeout(() => finish(), POST_ANIM_HOLD_MS);
            }
          }, GOLD_HOLD_MS);
        }, COUNT_SWAP_MS);
      }, 30);
    }
    return () => window.clearTimeout(timer);
  }, [phase, per, remaining]);

  useLayoutEffect(() => {
    if (phase.kind !== "sail") return;
    const from = acornRef.current?.getBoundingClientRect();
    const to = seedMeterEl?.getBoundingClientRect();
    if (!from) {
      setPhase({
        kind: "count",
        from: displaySeeds,
        to: displaySeeds + 1,
        seedsLeft: phase.seedsLeft,
        afterRemaining: phase.seedsLeft <= 1,
      });
      return;
    }
    const targetX = to ? to.left + to.width / 2 : from.left + from.width / 2;
    const targetY = to ? to.top + to.height / 2 : 28;
    const dx = targetX - (from.left + from.width / 2);
    const dy = targetY - (from.top + from.height / 2);
    setSailStyle({ transform: "translate(0px, 0px) scale(1)", opacity: 1 });
    const raf = requestAnimationFrame(() => {
      setSailStyle({
        transform: `translate(${dx}px, ${dy}px) scale(0.16)`,
        opacity: 0.2,
        transition: `transform ${SAIL_MS}ms cubic-bezier(.22,.82,.2,1), opacity ${SAIL_MS}ms ease`,
      });
    });
    const t = window.setTimeout(() => {
      setHideAcorn(true);
      setPhase({
        kind: "count",
        from: displaySeeds,
        to: displaySeeds + 1,
        seedsLeft: phase.seedsLeft,
        afterRemaining: phase.seedsLeft <= 1,
      });
    }, SAIL_MS + 30);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [phase.kind]);

  useEffect(() => {
    if (!seedMeterEl) return;
    seedMeterEl.dataset.acornFlash = seedFlash;
    const count = seedMeterEl.querySelector(".seed-count");
    if (count) count.textContent = String(displaySeeds);
  }, [seedMeterEl, displaySeeds, seedFlash]);

  if (phase.kind === "done" || earned <= 0) return null;

  const level =
    phase.kind === "fill"
      ? fillLevel
      : phase.kind === "celebrate" || phase.kind === "sail"
        ? per
        : fillLevel;
  const clipTop = clipTopForLevel(clampLevel(level, per), per);
  const showAcorn = !hideAcorn && phase.kind !== "count";

  const headline =
    phase.kind === "celebrate" || (phase.kind === "fill" && phase.target >= per && phase.seedsLeft > 0 && phase.level >= per)
      ? "You earned a FREE seed!"
      : "Earn a FREE seed!";
  const sub =
    phase.kind === "celebrate"
      ? "Full acorn — watch it fly to your pouch!"
      : `Fill the acorn: ${clampLevel(level, per)} of ${per} harvest bits`;

  return (
    <div className="harvest-acorn-stage" aria-live="polite">
      {showAcorn && (
        <div
          ref={acornRef}
          className={`harvest-acorn ${phase.kind === "celebrate" ? "celebrate" : ""} ${phase.kind === "sail" ? "sailing" : ""}`}
          style={phase.kind === "sail" ? sailStyle : undefined}
        >
          <div className="harvest-acorn-headline">{headline}</div>
          <div className="harvest-acorn-meter" role="img" aria-label={`Acorn ${level} of ${per} shards`}>
            <img className="harvest-acorn-page" src={PAGE} alt="" draggable={false} />
            <img
              className="harvest-acorn-fill"
              src={FILL}
              alt=""
              draggable={false}
              style={{ clipPath: `inset(${clipTop}% 0 0 0)` }}
            />
            <img className="harvest-acorn-ticks" src={TICKS} alt="" draggable={false} />
            <img className="harvest-acorn-outline" src={OUTLINE} alt="" draggable={false} />
          </div>
          <div className="harvest-acorn-label">
            {clampLevel(level, per)}/{per}
          </div>
          <div className="harvest-acorn-sub">{sub}</div>
        </div>
      )}
    </div>
  );
}
