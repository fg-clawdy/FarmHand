import { useId } from "react";
import {
  activeBalloonIndex,
  balloonsFor,
  clamp01,
  formatStarCount,
  nubOpacity,
  type BalloonSlot,
} from "./balloonMath";
import {
  bodyDrawScale,
  bowOpacity,
  ghostOpacity,
  lockSquash,
  neckPoints,
  type Handoff,
} from "./balloonMotion";

/**
 * Painted balloon bunch.
 * Light matches the playfield: highlights on the upper left, shadows toward the lower right.
 * The camera is the farm's 3/4 view — basket rim seen from above, balloons facing us.
 */

const INK = "#8a5630";

/** Saturated-but-soft pastels. They stay readable on the green grass. */
const PASTELS = [
  { base: "#ff5f93", deep: "#c4285c", light: "#ffd0e0" },
  { base: "#b07cff", deep: "#6d3ec4", light: "#ead4ff" },
  { base: "#3dce8a", deep: "#148a52", light: "#c8f6df" },
  { base: "#ffc233", deep: "#d48400", light: "#ffe7a8" },
  { base: "#4eb6ff", deep: "#1d74c9", light: "#cce9ff" },
  { base: "#ff8a45", deep: "#d45a12", light: "#ffd2b8" },
] as const;

/** Neck at (0,0), body above. Shared by the ghost and the colored balloon so they meet exactly. */
const BALLOON_PATH =
  "M 0 0 C -16 -6 -20 -22 -20 -34 C -78 -22 -108 -72 -108 -124 C -108 -198 -64 -248 0 -248 C 64 -248 108 -198 108 -124 C 108 -72 78 -22 20 -34 C 20 -22 16 -6 0 0 Z";

export type LockVisual = { index: number; t: number } | null;

export function TvGlyph({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.88} viewBox="0 0 64 56" aria-hidden="true">
      <TvInner />
    </svg>
  );
}

function TvInner() {
  return (
    <g>
      <rect x="6" y="8" width="52" height="36" rx="8" fill="#f6e6c8" stroke={INK} strokeWidth="3" />
      <rect x="12" y="14" width="40" height="24" rx="4" fill="#8ec8ea" />
      <ellipse cx="22" cy="20" rx="8" ry="4" fill="#ffffff" opacity="0.45" />
      <path d="M 28 19 L 40 26 L 28 33 Z" fill="#fffaf0" />
      <rect x="22" y="44" width="6" height="7" rx="1.5" fill="#d7a04a" stroke={INK} strokeWidth="2" />
      <rect x="36" y="44" width="6" height="7" rx="1.5" fill="#d7a04a" stroke={INK} strokeWidth="2" />
    </g>
  );
}

function StarBurst({ t, targetScale }: { t: number; targetScale: number }) {
  const fade = Math.sin(Math.PI * clamp01(t));
  const reach = (110 + t * 70) * targetScale;
  return (
    <g opacity={fade} data-qa="balloon-sparkle">
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2 - 0.4;
        const x = Math.cos(angle) * reach;
        const y = -124 * targetScale + Math.sin(angle) * reach * 0.86;
        const s = (0.55 + (i % 3) * 0.22) * (0.85 + t * 0.35);
        return <Spark key={i} x={x} y={y} s={s} />;
      })}
    </g>
  );
}

function Spark({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M 0 -14 L 2.4 -2.4 L 14 0 L 2.4 2.4 L 0 14 L -2.4 2.4 L -14 0 L -2.4 -2.4 Z"
      fill="#ffe56a"
      stroke="#f0b429"
      strokeWidth="1.5"
    />
  );
}

function Pip({ slot, pastel, size }: { slot: BalloonSlot; pastel: (typeof PASTELS)[number]; size: number }) {
  const raw = useId();
  const id = `pip${raw.replace(/:/g, "")}`;
  const top = 28 - slot.fill * 24;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      data-qa="pip"
      data-index={slot.index}
      data-fill={slot.fill}
      data-full={slot.full ? "1" : "0"}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="11.5" fill="#fffaf0" stroke={INK} strokeWidth="2.4" />
      <clipPath id={id}>
        <rect x="0" y={top} width="32" height={32 - top} />
      </clipPath>
      <circle cx="16" cy="16" r="11.5" fill={pastel.base} clipPath={`url(#${id})`} />
      {slot.full && <ellipse cx="12" cy="12" rx="3.2" ry="2" fill="#ffffff" opacity="0.7" />}
    </svg>
  );
}

export default function StarBalloonBunch({
  cost,
  shown,
  locking,
  handoff = null,
  sparkle,
  bounce,
  layoutScale,
  timeSec = 0,
  labelPx = 56,
  labelBudget,
  title = "Movie night",
}: {
  cost: number;
  shown: number;
  locking: LockVisual;
  /** Full balloon sliding back while the next ghost slides forward. */
  handoff?: Handoff | null;
  sparkle: boolean;
  bounce: boolean;
  /** Outer flight scale. The tally stays a readable size instead of covering a sign. */
  layoutScale: number;
  timeSec?: number;
  /** Screen pixels reserved under the basket for pips or the tally. */
  labelPx?: number;
  /** When several goals share the grass, the label stays inside this many screen pixels. */
  labelBudget?: number;
  title?: string;
}) {
  const raw = useId();
  const uid = `b${raw.replace(/:/g, "")}`;
  const slots = balloonsFor(cost, shown);
  const settledActive = locking?.index ?? activeBalloonIndex(cost, shown);
  const active = handoff ? (handoff.t < 0.5 ? handoff.fromActive : handoff.toActive) : settledActive;
  const points = neckPoints(slots.length, settledActive, locking ? null : handoff);
  const backToFront = [...points].sort((a, b) => a.y - b.y || a.index - b.index);
  const big = slots.length > 8;
  const pipSize = labelBudget ? 14 : 18;
  const countCss = labelBudget ? 16 : 20;
  const minCountPx = labelBudget ? 11 : Math.min(18, Math.max(14, labelPx * 0.38));
  const pipWidth = big ? 150 : slots.length * (pipSize + 4) + 24;
  const cssWidth = Math.max(pipWidth, 168);
  const counter = labelBudget
    ? labelBudget / (cssWidth * Math.max(layoutScale, 0.04))
    : minCountPx / (countCss * Math.max(layoutScale, 0.04));
  const fullCount = slots.filter((slot) => slot.full).length;
  const shadowRx = Math.min(150, 64 + slots.length * 7);

  return (
    <div
      className="star-bunch"
      data-qa="balloon-bunch"
      data-count={slots.length}
      role="img"
      aria-label={`${title}, ${formatStarCount(shown)} of ${formatStarCount(cost)} stars`}
      data-front={active}
      data-handoff={handoff ? handoff.t.toFixed(3) : ""}
    >
      <svg className="star-bunch-svg" width={1600} height={1200} viewBox="-800 -900 1600 1200" overflow="visible">
        <defs>
          {PASTELS.map((pastel, index) => (
            <radialGradient key={pastel.base} id={`${uid}-light-${index}`} cx="28%" cy="24%" r="78%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="16%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="38%" stopColor={pastel.light} stopOpacity="0.28" />
              <stop offset="62%" stopColor={pastel.base} stopOpacity="0" />
              <stop offset="100%" stopColor={pastel.deep} stopOpacity="0.82" />
            </radialGradient>
          ))}
        </defs>

        <ellipse cx="22" cy="30" rx={shadowRx} ry="16" fill="rgba(20, 36, 10, 0.38)" />

        {backToFront.map((point) => {
          const sway = Math.sin(timeSec * 1.35 + point.index * 0.85) * (handoff ? 2 : 12);
          const cpx = point.x * 0.28 + sway;
          const cpy = point.y * 0.48;
          const d = `M ${point.x} ${point.y} Q ${cpx} ${cpy} 0 4`;
          return (
            <g key={`string-${point.index}`}>
              <path d={d} fill="none" stroke="#6b4428" strokeWidth="5.5" strokeLinecap="round" />
              <path d={d} fill="none" stroke="#f0d7a6" strokeWidth="1.7" strokeLinecap="round" />
            </g>
          );
        })}

        {backToFront.map((point) => {
          const slot = slots[point.index];
          if (!slot) return null;
          const pastel = PASTELS[slot.index % PASTELS.length];
          const ghost = ghostOpacity(slot.full, locking, slot.index);
          const bow = bowOpacity(slot.full, locking, slot.index);
          const scale = bodyDrawScale(slot.bodyScale, locking, slot.index, bounce);
          const squash = bounce && locking?.index === slot.index ? lockSquash(locking.t) : { sx: 1, sy: 1 };
          const nub = nubOpacity(slot.bodyScale, slot.targetScale);
          const showSpark = sparkle && locking?.index === slot.index;
          const hue = (slot.index % 5) * 6 - 12;
          return (
            <g
              key={slot.index}
              data-qa="balloon"
              data-index={slot.index}
              data-neck-x={point.x.toFixed(1)}
              data-neck-y={point.y.toFixed(1)}
              data-stars={slot.stars}
              data-capacity={slot.capacity}
              data-full={slot.full ? "1" : "0"}
              data-active={slot.index === active ? "1" : "0"}
              data-body-scale={slot.bodyScale}
              data-target-scale={slot.targetScale}
              style={{ filter: hue === 0 ? undefined : `hue-rotate(${hue}deg)` }}
            >
              <g
                transform={`translate(${point.x} ${point.y}) scale(${slot.targetScale})`}
                opacity={ghost}
                data-qa="balloon-ghost"
                data-index={slot.index}
                data-ghost={ghost}
              >
                <path d={BALLOON_PATH} fill="#fffdf8" stroke="#fffdf8" strokeWidth="12" />
                <path d={BALLOON_PATH} fill={pastel.light} fillOpacity="0.2" />
                <path
                  d={BALLOON_PATH}
                  fill="none"
                  stroke="#5c3a22"
                  strokeWidth="4.5"
                  strokeDasharray="11 9"
                  strokeLinecap="round"
                />
              </g>
              <g
                transform={`translate(${point.x} ${point.y}) scale(${Math.max(scale, 0.0001) * squash.sx}, ${Math.max(scale, 0.0001) * squash.sy})`}
                opacity={scale <= 0 ? 0 : Math.min(1, scale / 0.04)}
                data-qa="balloon-body"
                data-squash-x={squash.sx}
                data-squash-y={squash.sy}
              >
                <path d={BALLOON_PATH} fill={pastel.base} />
                <path d={BALLOON_PATH} fill={`url(#${uid}-light-${slot.index % PASTELS.length})`} />
                <path d={BALLOON_PATH} fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
                <path
                  d="M -78 -210 C -108 -168 -112 -128 -96 -88"
                  fill="none"
                  stroke="#fffaf4"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.72"
                />
                <ellipse cx="-46" cy="-186" rx="34" ry="16" fill="#ffffff" opacity="0.88" transform="rotate(-32 -46 -186)" />
                <ellipse cx="-58" cy="-158" rx="9" ry="5" fill="#ffffff" opacity="0.55" />
                <path
                  d="M -8 -2 C -11 8 -4 14 0 9 C 4 14 11 8 8 -2 C 4 2 -4 2 -8 -2 Z"
                  fill={pastel.deep}
                  stroke={INK}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
              </g>
              <g transform={`translate(${point.x} ${point.y})`} opacity={nub} data-qa="balloon-nub">
                <ellipse cx="0" cy="-1" rx="16" ry="11" fill="#fffaf4" stroke={INK} strokeWidth="3" />
                <path d="M -8 -1 Q 0 4 8 -1" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
              </g>
              <g transform={`translate(${point.x} ${point.y})`} opacity={bow} data-qa="balloon-bow">
                <path
                  d="M 0 2 C -18 -12 -28 -2 -14 6 C -26 14 -12 20 0 8 C 12 20 26 14 14 6 C 28 -2 18 -12 0 2 Z"
                  fill="#f6e2bc"
                  stroke={INK}
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <circle cx="0" cy="6" r="3.2" fill="#e7c48a" stroke={INK} strokeWidth="2" />
              </g>
              {showSpark && locking && (
                <g transform={`translate(${point.x} ${point.y})`}>
                  <StarBurst t={locking.t} targetScale={slot.targetScale} />
                </g>
              )}
            </g>
          );
        })}

        <g data-qa="balloon-basket">
          <path d="M -34 2 C -40 30 40 30 34 2" fill="#c9843c" stroke={INK} strokeWidth="4" />
          <path d="M -28 8 C -32 24 32 24 28 8" fill="#e7b56a" />
          <path d="M -20 8 V 22 M -7 10 V 24 M 7 10 V 24 M 20 8 V 22" stroke="#8a5428" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M -16 6 C -8 16 8 16 16 6" fill="none" stroke="#f6e2bc" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="0" cy="2" rx="34" ry="12" fill="#f2d09a" stroke={INK} strokeWidth="4" />
          <ellipse cx="-10" cy="-1" rx="12" ry="4" fill="rgba(255, 248, 230, 0.8)" />
          <path d="M -6 8 V 16 M 6 8 V 16" stroke="#6b4428" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>

      <div className="star-chrome" style={{ transform: `translateX(-50%) scale(${counter})` }}>
        {big ? (
          <div className="star-tally" data-qa="balloon-tally">
            filled {fullCount} of {slots.length}
          </div>
        ) : (
          <div className="star-pips" data-qa="pips">
            {slots.map((slot) => (
              <Pip key={slot.index} slot={slot} pastel={PASTELS[slot.index % PASTELS.length]} size={pipSize} />
            ))}
          </div>
        )}
        <div className="star-count" data-qa="balloon-progress">
          <span className="star-count-now">{formatStarCount(shown)}</span>
          <span className="star-count-of"> ★ / {formatStarCount(cost)}</span>
        </div>
      </div>
    </div>
  );
}
