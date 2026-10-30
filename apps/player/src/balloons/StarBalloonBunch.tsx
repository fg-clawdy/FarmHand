import { useId } from "react";
import {
  balloonsFor,
  bunchPoints,
  clamp01,
  formatStarCount,
  nubOpacity,
  type BalloonSlot,
} from "./balloonMath";
import { bodyDrawScale, bowOpacity, ghostOpacity } from "./balloonMotion";

/**
 * Painted balloon bunch.
 * Light matches the playfield: highlights on the upper left, shadows toward the lower right.
 * The camera is the farm's 3/4 view — basket rim seen from above, balloons facing us.
 */

const INK = "#5c3d28";

const PASTELS = [
  { base: "#f3b4c4", deep: "#d8889e", light: "#fff1f4" },
  { base: "#d4c2f2", deep: "#b196d6", light: "#f7f2ff" },
  { base: "#b5e2c4", deep: "#79c498", light: "#f2fff6" },
  { base: "#f6d78a", deep: "#e0ae45", light: "#fff8e6" },
  { base: "#b7daf4", deep: "#7eb4de", light: "#f3fbff" },
  { base: "#f6c6a6", deep: "#e39a72", light: "#fff3ea" },
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
  const reach = (78 + t * 54) * targetScale;
  return (
    <g opacity={fade} data-qa="balloon-sparkle">
      {Array.from({ length: 7 }, (_, i) => {
        const angle = (i / 7) * Math.PI * 2 - 0.5;
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
  sparkle,
  bounce,
  layoutScale,
}: {
  cost: number;
  shown: number;
  locking: LockVisual;
  sparkle: boolean;
  bounce: boolean;
  /** Outer flight scale. Pips and the star count stay a readable size instead of blowing up with a hero balloon. */
  layoutScale: number;
}) {
  const raw = useId();
  const uid = `b${raw.replace(/:/g, "")}`;
  const slots = balloonsFor(cost, shown);
  const points = bunchPoints(slots.length);
  const draw = [...points].sort((a, b) => a.y - b.y || a.index - b.index);
  const pipSize = slots.length > 10 ? 28 : slots.length > 6 ? 36 : 44;
  const lift = Math.max(layoutScale, 0.35);
  const chrome = slots.length > 10 ? 0.82 : 0.92;
  const pipTop = -58 / lift;
  const countTop = (-58 + pipSize * chrome + 2) / lift;

  return (
    <div
      className="star-bunch"
      data-qa="balloon-bunch"
      data-count={slots.length}
      role="img"
      aria-label={`Movie night, ${formatStarCount(shown)} of ${formatStarCount(cost)} stars`}
    >
      <svg className="star-bunch-svg" width={1600} height={1200} viewBox="-800 -900 1600 1200" overflow="visible">
        <defs>
          {PASTELS.map((pastel, index) => (
            <radialGradient key={pastel.base} id={`${uid}-light-${index}`} cx="30%" cy="26%" r="72%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
              <stop offset="24%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="58%" stopColor={pastel.base} stopOpacity="0" />
              <stop offset="100%" stopColor={pastel.deep} stopOpacity="0.72" />
            </radialGradient>
          ))}
        </defs>

        <ellipse cx="14" cy="22" rx="78" ry="18" fill="rgba(32, 58, 16, 0.28)" />

        {draw.map((point) => (
          <g key={`string-${point.index}`}>
            <path
              d={`M ${point.x} ${point.y} Q ${point.x * 0.22} ${point.y * 0.55} 0 2`}
              fill="none"
              stroke="#6b4428"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d={`M ${point.x} ${point.y} Q ${point.x * 0.22} ${point.y * 0.55} 0 2`}
              fill="none"
              stroke="#f0d7a6"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        ))}

        {draw.map((point) => {
          const slot = slots[point.index];
          const pastel = PASTELS[slot.index % PASTELS.length];
          const ghost = ghostOpacity(slot.full, locking, slot.index);
          const bow = bowOpacity(slot.full, locking, slot.index);
          const scale = bodyDrawScale(slot.bodyScale, locking, slot.index, bounce);
          const nub = nubOpacity(slot.bodyScale, slot.targetScale);
          const showSpark = sparkle && locking?.index === slot.index;
          const iconOpacity = clamp01((slot.fill - 0.28) / 0.22);
          return (
            <g
              key={slot.index}
              data-qa="balloon"
              data-index={slot.index}
              data-stars={slot.stars}
              data-capacity={slot.capacity}
              data-full={slot.full ? "1" : "0"}
              data-body-scale={slot.bodyScale}
              data-target-scale={slot.targetScale}
            >
              <g
                transform={`translate(${point.x} ${point.y}) scale(${slot.targetScale})`}
                opacity={ghost}
                data-qa="balloon-ghost"
                data-ghost={ghost}
              >
                <path d={BALLOON_PATH} fill={pastel.light} fillOpacity="0.94" />
                <path
                  d={BALLOON_PATH}
                  fill="none"
                  stroke={pastel.deep}
                  strokeWidth="6"
                  strokeDasharray="11 9"
                  strokeLinecap="round"
                />
                <path
                  d={BALLOON_PATH}
                  fill="none"
                  stroke="#fffaf0"
                  strokeWidth="2.4"
                  strokeDasharray="11 9"
                  strokeLinecap="round"
                />
              </g>

              <g
                transform={`translate(${point.x} ${point.y}) scale(${Math.max(scale, 0.0001)})`}
                opacity={scale <= 0 ? 0 : Math.min(1, scale / 0.04)}
              >
                <path d={BALLOON_PATH} transform="translate(8 12)" fill="rgba(70, 42, 24, 0.16)" />
                <path d={BALLOON_PATH} fill={pastel.base} />
                <path d={BALLOON_PATH} fill={`url(#${uid}-light-${slot.index % PASTELS.length})`} />
                <path d={BALLOON_PATH} fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
                <ellipse cx="-40" cy="-176" rx="30" ry="16" fill="#ffffff" opacity="0.72" transform="rotate(-28 -40 -176)" />
                <ellipse cx="-52" cy="-150" rx="10" ry="6" fill="#ffffff" opacity="0.45" />
                <svg x="-28" y="-168" width="56" height="50" viewBox="0 0 64 56" opacity={iconOpacity}>
                  <TvInner />
                </svg>
              </g>

              <g transform={`translate(${point.x} ${point.y})`} opacity={nub} data-qa="balloon-nub">
                <ellipse cx="0" cy="-1" rx="16" ry="11" fill={pastel.light} stroke={INK} strokeWidth="3" />
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
          <ellipse cx="7" cy="14" rx="34" ry="10" fill="rgba(32, 58, 16, 0.26)" />
          <path d="M -32 1 C -36 26 36 26 32 1" fill="#c9843c" stroke={INK} strokeWidth="3.5" />
          <path d="M -28 6 C -30 22 30 22 28 6" fill="#e8b86a" />
          <path d="M -18 7 V 20 M -6 9 V 22 M 6 9 V 22 M 18 7 V 20" stroke="#8d5a2e" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="0" cy="1" rx="32" ry="11" fill="#f2d09a" stroke={INK} strokeWidth="3.5" />
          <ellipse cx="-9" cy="-2" rx="12" ry="4" fill="rgba(255, 248, 230, 0.75)" />
        </g>
      </svg>

      <div
        className="star-pips"
        data-qa="pips"
        style={{ top: pipTop, transform: `translateX(-50%) scale(${chrome / lift})` }}
      >
        {slots.map((slot) => (
          <Pip key={slot.index} slot={slot} pastel={PASTELS[slot.index % PASTELS.length]} size={pipSize} />
        ))}
      </div>
      <div
        className="star-count"
        data-qa="balloon-progress"
        style={{ top: countTop, transform: `translateX(-50%) scale(${chrome / lift})` }}
      >
        <span className="star-count-now">{formatStarCount(shown)}</span>
        <span className="star-count-of"> ★ / {formatStarCount(cost)}</span>
      </div>
    </div>
  );
}
