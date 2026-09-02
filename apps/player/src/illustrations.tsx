import type { Mascot, PublicPlot } from "@farmhand/shared";
import { useId, type ReactNode, type SVGProps } from "react";

type ArtProps = SVGProps<SVGSVGElement> & { title?: string };

function useUid(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}

export function FarmArtDefs() {
  return (
    <svg className="art-defs" width="0" height="0" aria-hidden>
      <defs>
        <filter id="fhSoftShadow" x="-40%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#1a2410" floodOpacity="0.38" />
        </filter>
        <filter id="fhReadyGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.2  0 0.9 0 0 0.15  0 0 0.2 0 0  0 0 0 0.7 0"
            result="gold"
          />
          <feMerge>
            <feMergeNode in="gold" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="fhTitleFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF18A" />
          <stop offset="38%" stopColor="#FFD24A" />
          <stop offset="72%" stopColor="#FF9A1A" />
          <stop offset="100%" stopColor="#F06A00" />
        </linearGradient>
        <linearGradient id="fhLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B6F06A" />
          <stop offset="55%" stopColor="#4DB83A" />
          <stop offset="100%" stopColor="#1F7A28" />
        </linearGradient>
        <radialGradient id="fhSoil" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#C4844A" />
          <stop offset="55%" stopColor="#7A4320" />
          <stop offset="100%" stopColor="#3D2110" />
        </radialGradient>
        <radialGradient id="fhGlass" cx="30%" cy="20%" r="80%">
          <stop offset="0%" stopColor="#F4FFFC" />
          <stop offset="40%" stopColor="#B7E8EA" />
          <stop offset="100%" stopColor="#6AA8B4" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function FarmTitle({ className = "farm-title" }: { className?: string }) {
  const textProps = {
    x: 450,
    y: 118,
    textAnchor: "middle" as const,
    fontFamily: '"Luckiest Guy", Fredoka, sans-serif',
    fontSize: 118,
  };
  return (
    <svg className={className} viewBox="0 0 900 168" role="img" aria-label="FarmHand">
      <text {...textProps} fill="#9A3E08" transform="translate(0 10)">
        FarmHand
      </text>
      <text
        {...textProps}
        stroke="#FFFFFF"
        strokeWidth="18"
        fill="url(#fhTitleFill)"
        paintOrder="stroke fill"
        strokeLinejoin="round"
      >
        FarmHand
      </text>
    </svg>
  );
}

export function WoodSign({ label, className }: { label: string; className?: string }) {
  const p = useUid("sign");
  return (
    <svg className={`wood-sign ${className ?? ""}`} viewBox="0 0 340 78" role="img" aria-label={label}>
      <defs>
        <pattern id={`${p}-g`} patternUnits="userSpaceOnUse" width="160" height="78">
          <image href="/art/wood_grain.jpg" width="160" height="160" preserveAspectRatio="xMidYMid slice" />
        </pattern>
        <linearGradient id={`${p}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6d8" stopOpacity="0.42" />
          <stop offset="38%" stopColor="#d08a3a" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#4a220c" stopOpacity="0.45" />
        </linearGradient>
        <filter id={`${p}-s`} x="-8%" y="-20%" width="116%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#3a2010" floodOpacity="0.4" />
        </filter>
      </defs>
      <rect x="6" y="8" width="328" height="60" rx="18" fill={`url(#${p}-g)`} filter={`url(#${p}-s)`} />
      <rect x="6" y="8" width="328" height="60" rx="18" fill={`url(#${p}-b)`} />
      <rect x="12" y="13" width="316" height="50" rx="14" fill="none" stroke="#5C3218" strokeWidth="3" opacity="0.45" />
      <rect x="16" y="16" width="308" height="14" rx="8" fill="#fff6d8" opacity="0.22" />
      <text
        x="170"
        y="49"
        textAnchor="middle"
        fontFamily="Fredoka, sans-serif"
        fontWeight={700}
        fontSize="26"
        letterSpacing="5"
        fill="#FFF8EC"
        stroke="#4A2410"
        strokeWidth="5"
        paintOrder="stroke fill"
      >
        {label}
      </text>
    </svg>
  );
}

export function WateringCan({ className, title = "Watering can" }: ArtProps) {
  const p = useUid("can");
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${p}-m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4F7FB" />
          <stop offset="45%" stopColor="#C5D0DC" />
          <stop offset="100%" stopColor="#6E7E90" />
        </linearGradient>
        <radialGradient id={`${p}-h`} cx="30%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C9D4E0" />
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="58" rx="16" ry="4" fill="#1a2410" opacity="0.22" />
      <path d="M14 22c0-7 8-12 16-12" fill="none" stroke={`url(#${p}-m)`} strokeWidth="5" strokeLinecap="round" />
      <path d="M42 28c10 2 16 8 18 16" fill="none" stroke={`url(#${p}-m)`} strokeWidth="5" strokeLinecap="round" />
      <circle cx="61" cy="46" r="5" fill={`url(#${p}-h)`} stroke="#5d6b7a" strokeWidth="1.4" />
      <circle cx="61" cy="46" r="2.2" fill="#4a5866" />
      <rect x="16" y="22" width="28" height="28" rx="8" fill={`url(#${p}-m)`} stroke="#5d6b7a" strokeWidth="1.6" />
      <rect x="19" y="28" width="22" height="4" rx="2" fill="#fff" opacity="0.35" />
      <rect x="19" y="36" width="22" height="3" rx="1.5" fill="#5d6b7a" opacity="0.2" />
      <ellipse cx="30" cy="26" rx="8" ry="3" fill="#fff" opacity="0.5" />
    </svg>
  );
}

export function FertilizerBeaker({ className, title = "Fertilizer" }: ArtProps) {
  const p = useUid("bek");
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${p}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8FF8A" />
          <stop offset="50%" stopColor="#7BE03A" />
          <stop offset="100%" stopColor="#2F9A28" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="14" ry="4" fill="#1a2410" opacity="0.2" />
      <path
        d="M22 10h20l-2 8 8 34c1 6-3 10-10 10h-12c-7 0-11-4-10-10l8-34z"
        fill="url(#fhGlass)"
        stroke="#4d7a82"
        strokeWidth="1.8"
      />
      <path d="M24 28c0 0 4 22 8 22s8-22 8-22" fill={`url(#${p}-g)`} opacity="0.95" />
      <ellipse cx="32" cy="28" rx="9" ry="3" fill="#B6F06A" />
      <circle cx="28" cy="38" r="1.6" fill="#fff" opacity="0.7" />
      <circle cx="35" cy="42" r="2.1" fill="#fff" opacity="0.55" />
      <circle cx="30" cy="46" r="1.2" fill="#fff" opacity="0.65" />
      <path d="M26 14h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function AcornArt({ className, title = "Seeds" }: ArtProps) {
  const p = useUid("ac");
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs>
        <radialGradient id={`${p}-n`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#E8A45A" />
          <stop offset="55%" stopColor="#A85A22" />
          <stop offset="100%" stopColor="#5C2E10" />
        </radialGradient>
        <linearGradient id={`${p}-c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0C878" />
          <stop offset="100%" stopColor="#A06A28" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="12" ry="3.5" fill="#1a2410" opacity="0.2" />
      <path d="M20 28c2-10 22-10 24 0-1 6-5 8-12 8s-11-2-12-8z" fill={`url(#${p}-c)`} stroke="#6B3F12" strokeWidth="1.4" />
      <path d="M22 36c2 16 18 16 20 0" fill={`url(#${p}-n)`} stroke="#5C3218" strokeWidth="1.4" />
      <path d="M31 16c0-5 2-8 4-8" fill="none" stroke="#6B3F12" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 28h20" stroke="#6B3F12" strokeWidth="1.2" opacity="0.45" />
      <ellipse cx="27" cy="42" rx="4" ry="6" fill="#fff" opacity="0.28" />
    </svg>
  );
}

export function StarIcon({ className = "star-icon" }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <path
        d="M32 6 39 24h19L43 35l6 19-17-12-17 12 6-19L6 24h19z"
        fill="#FFE56A"
        stroke="#C47A10"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M32 14 35 24H26z" fill="#fff" opacity="0.45" />
    </svg>
  );
}

export function LockIcon({ className = "lock-icon" }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <rect x="12" y="28" width="40" height="28" rx="8" fill="#FFE08A" stroke="#6B3F12" strokeWidth="3" />
      <path d="M20 28v-6a12 12 0 0 1 24 0v6" fill="none" stroke="#6B3F12" strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="42" r="4" fill="#6B3F12" />
      <rect x="16" y="30" width="22" height="8" rx="4" fill="#fff" opacity="0.35" />
    </svg>
  );
}

export function ClockIcon({ className }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="22" fill="#FFF6D8" stroke="#8A4F2A" strokeWidth="4" />
      <circle cx="32" cy="32" r="3" fill="#8A4F2A" />
      <path d="M32 18v15l10 6" fill="none" stroke="#C47A10" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function SoilMound() {
  return (
    <>
      <ellipse cx="48" cy="104" rx="30" ry="8" fill="#1a2410" opacity="0.2" />
      <ellipse cx="48" cy="100" rx="28" ry="10" fill="url(#fhSoil)" />
      <ellipse cx="40" cy="97" rx="8" ry="4" fill="#D4A06A" opacity="0.35" />
    </>
  );
}

export type PlantKind = "sprout" | "daisy" | "herbs" | "sunflower" | "oak";

export function plantKind(plot: Pick<PublicPlot, "state" | "tier" | "growthStage" | "ready">): PlantKind | null {
  if (plot.state === "empty" || !plot.tier) return null;
  const stage = plot.growthStage ?? 1;
  if (plot.ready || stage >= 3) {
    if (plot.tier === 2) return "herbs";
    if (plot.tier === 3) return "sunflower";
    if (plot.tier === 4) return "oak";
    return "daisy";
  }
  return "sprout";
}

function PlantGlyph({ kind, ready }: { kind: PlantKind; ready?: boolean }) {
  return (
    <g filter={ready ? "url(#fhReadyGlow)" : "url(#fhSoftShadow)"}>
      <SoilMound />
      {kind === "sprout" && <SproutBody />}
      {kind === "daisy" && <DaisyBody />}
      {kind === "herbs" && <HerbBody />}
      {kind === "sunflower" && <SunflowerBody />}
      {kind === "oak" && <OakBody />}
    </g>
  );
}

export function PlantFigure({
  kind,
  ready,
  className,
}: {
  kind: PlantKind;
  ready?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`${className ?? ""} ${ready ? "is-ready" : ""}`}
      viewBox="0 0 96 112"
      role="img"
      aria-label={kind}
    >
      <PlantGlyph kind={kind} ready={ready} />
    </svg>
  );
}

function SproutBody() {
  return (
    <g>
      <path d="M48 98v-28" stroke="#2F8A34" strokeWidth="5" strokeLinecap="round" />
      <path d="M48 78c-16-2-22-16-18-28 8 6 16 14 18 28z" fill="url(#fhLeaf)" />
      <path d="M48 76c16-2 22-16 18-28-8 6-16 14-18 28z" fill="url(#fhLeaf)" />
      <ellipse cx="34" cy="62" rx="5" ry="3" fill="#fff" opacity="0.35" transform="rotate(-30 34 62)" />
    </g>
  );
}

function DaisyBody() {
  const petals = Array.from({ length: 10 }, (_, i) => i * 36);
  return (
    <g>
      <path d="M48 98v-34" stroke="#2F8A34" strokeWidth="5" strokeLinecap="round" />
      <path d="M48 82c-18 2-22-12-16-24 10 6 14 14 16 24z" fill="url(#fhLeaf)" />
      <path d="M48 84c16 4 24-8 18-22-8 6-14 14-18 22z" fill="url(#fhLeaf)" />
      <g transform="translate(48 46)">
        {petals.map((deg) => (
          <ellipse
            key={deg}
            cx="0"
            cy="-16"
            rx="6.5"
            ry="13"
            fill="#FFFDF6"
            stroke="#F0D8A8"
            strokeWidth="0.8"
            transform={`rotate(${deg})`}
          />
        ))}
        <circle r="10" fill="#FFC84A" />
        <circle r="6.5" fill="#F0A12A" />
        <circle cx="-3" cy="-3" r="2" fill="#fff" opacity="0.5" />
      </g>
    </g>
  );
}

function HerbBody() {
  return (
    <g>
      {[
        ["M36 98c-2-22 2-36 0-48", "M36 70c-12-2-14-16-8-24", "M36 64c10-2 12-14 8-22"],
        ["M48 98c0-26 0-40 0-54", "M48 66c-14-4-16-18-10-28", "M48 62c14-2 16-16 10-26"],
        ["M60 98c2-20 0-34 2-46", "M60 72c-10 0-14-14-8-22", "M60 66c12-2 12-14 6-22"],
      ].map((paths, i) => (
        <g key={i}>
          <path d={paths[0]} fill="none" stroke="#2F8A34" strokeWidth="3.4" strokeLinecap="round" />
          <path d={paths[1]} fill="url(#fhLeaf)" />
          <path d={paths[2]} fill="url(#fhLeaf)" />
        </g>
      ))}
    </g>
  );
}

function SunflowerBody() {
  const petals = Array.from({ length: 14 }, (_, i) => i * (360 / 14));
  return (
    <g>
      <path d="M48 98v-28" stroke="#2F8A34" strokeWidth="6" strokeLinecap="round" />
      <path d="M48 84c-20 4-24-10-16-24 12 6 16 16 16 24z" fill="url(#fhLeaf)" />
      <path d="M48 86c20 2 24-12 16-24-10 8-14 16-16 24z" fill="url(#fhLeaf)" />
      <g transform="translate(48 44)">
        {petals.map((deg) => (
          <ellipse
            key={deg}
            cx="0"
            cy="-18"
            rx="6"
            ry="15"
            fill="#FFD24A"
            stroke="#E08A10"
            strokeWidth="0.8"
            transform={`rotate(${deg})`}
          />
        ))}
        <circle r="13" fill="#8A4F2A" />
        <circle r="9" fill="#5C3218" />
        {[-5, 0, 5, -3, 3].map((x, i) => (
          <circle key={i} cx={x} cy={i % 2 ? 3 : -2} r="1.3" fill="#C9892A" />
        ))}
        <circle cx="-4" cy="-4" r="2.2" fill="#fff" opacity="0.25" />
      </g>
    </g>
  );
}

function OakBody() {
  return (
    <g>
      <path d="M48 100v-28" stroke="#8A4F2A" strokeWidth="8" strokeLinecap="round" />
      <path d="M48 78c-10-8-16-4-18 4" fill="none" stroke="#8A4F2A" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 74c10-8 16-2 18 6" fill="none" stroke="#8A4F2A" strokeWidth="4" strokeLinecap="round" />
      <circle cx="36" cy="50" r="16" fill="#3F8A3A" />
      <circle cx="60" cy="52" r="15" fill="#2F7A32" />
      <circle cx="48" cy="40" r="17" fill="#5FBE58" />
      <circle cx="42" cy="46" r="10" fill="#7ED957" opacity="0.85" />
      <circle cx="38" cy="42" r="4" fill="#fff" opacity="0.22" />
    </g>
  );
}

export function MiniGarden({
  plots,
  wash,
}: {
  plots: Array<PublicPlot | undefined>;
  wash: string;
}) {
  const p = useUid("mini");
  return (
    <svg className="mini-garden-art" viewBox="0 0 240 210" aria-hidden>
      <defs>
        <linearGradient id={`${p}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E7F6FF" />
          <stop offset="42%" stopColor={wash} />
          <stop offset="100%" stopColor="#B5E07A" />
        </linearGradient>
        <linearGradient id={`${p}-hill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8E05A" />
          <stop offset="100%" stopColor="#5FA83A" />
        </linearGradient>
      </defs>
      <rect width="240" height="210" rx="20" fill={`url(#${p}-sky)`} />
      <ellipse cx="200" cy="28" rx="22" ry="22" fill="#FFE56A" opacity="0.55" />
      <path d={`M0 92 Q 70 68 140 90 T 240 80 L 240 210 L 0 210 Z`} fill={`url(#${p}-hill)`} />
      <path d="M0 128 Q 90 108 160 130 T 240 120 L 240 210 L 0 210 Z" fill="#4F9A32" opacity="0.55" />
      {Array.from({ length: 6 }, (_, slot) => {
        const plot = plots[slot];
        const kind = plot ? plantKind(plot) : null;
        const col = slot % 3;
        const row = Math.floor(slot / 3);
        const x = 18 + col * 74;
        const y = 86 + row * 58;
        return (
          <g key={slot} transform={`translate(${x} ${y})`}>
            <ellipse cx="32" cy="48" rx="28" ry="11" fill="#1a2410" opacity="0.18" />
            <ellipse cx="32" cy="44" rx="26" ry="12" fill="url(#fhSoil)" />
            {kind ? (
              <g transform="translate(8 -8) scale(0.48)">
                <PlantGlyph kind={kind} ready={plot?.ready} />
              </g>
            ) : (
              <ellipse cx="32" cy="42" rx="5" ry="3" fill="#5C3218" opacity="0.35" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function MascotArt({ mascot, className }: { mascot: Mascot; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" role="img" aria-label={mascot}>
      {mascot === "cow" && <CowFace />}
      {mascot === "chicken" && <ChickenFace />}
      {mascot === "pig" && <PigFace />}
      {mascot === "sheep" && <SheepFace />}
      {mascot === "horse" && <HorseFace />}
    </svg>
  );
}

function Eye({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="5.2" ry="6.2" fill="#fff" />
      <circle cx={x} cy={y + 1} r="3.1" fill="#2A1A0D" />
      <circle cx={x - 1.3} cy={y - 1.2} r="1.3" fill="#fff" />
    </g>
  );
}

function CowFace() {
  return (
    <g filter="url(#fhSoftShadow)">
      <ellipse cx="40" cy="46" rx="26" ry="24" fill="#FFFDF6" />
      <circle cx="26" cy="34" r="8" fill="#2A1A0D" />
      <circle cx="54" cy="50" r="7" fill="#2A1A0D" />
      <ellipse cx="22" cy="22" rx="7" ry="10" fill="#FFFDF6" />
      <ellipse cx="58" cy="22" rx="7" ry="10" fill="#FFFDF6" />
      <ellipse cx="22" cy="22" rx="4" ry="6" fill="#F4B4C8" />
      <ellipse cx="58" cy="22" rx="4" ry="6" fill="#F4B4C8" />
      <path d="M30 16c2-8 8-8 10-2 2-6 8-6 10 2" fill="#FFFDF6" />
      <path d="M28 14c-2-6 2-10 6-6" fill="#E8C898" />
      <path d="M52 14c2-6-2-10-6-6" fill="#E8C898" />
      <Eye x={30} y={40} />
      <Eye x={50} y={40} />
      <ellipse cx="40" cy="56" rx="12" ry="8" fill="#F4B4C8" />
      <ellipse cx="36" cy="56" rx="1.6" ry="2.2" fill="#C46A80" />
      <ellipse cx="44" cy="56" rx="1.6" ry="2.2" fill="#C46A80" />
      <path d="M36 62c3 3 5 3 8 0" fill="none" stroke="#C46A80" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function ChickenFace() {
  return (
    <g filter="url(#fhSoftShadow)">
      <ellipse cx="40" cy="46" rx="24" ry="22" fill="#FFF1C4" />
      <ellipse cx="18" cy="48" rx="8" ry="6" fill="#F0C84A" />
      <path d="M28 20c2-10 10-12 14-4 4-10 14-8 14 2-6-2-10 2-14 6-6-4-10-4-14-4z" fill="#E23A2A" />
      <path d="M40 50l12 4-12 6z" fill="#F0A12A" />
      <Eye x={34} y={42} />
      <circle cx="50" cy="42" r="2.4" fill="#2A1A0D" />
    </g>
  );
}

function PigFace() {
  return (
    <g filter="url(#fhSoftShadow)">
      <ellipse cx="40" cy="46" rx="26" ry="23" fill="#F7B4C4" />
      <ellipse cx="20" cy="24" rx="8" ry="10" fill="#F7B4C4" />
      <ellipse cx="60" cy="24" rx="8" ry="10" fill="#F7B4C4" />
      <ellipse cx="20" cy="24" rx="4.5" ry="6" fill="#E87898" />
      <ellipse cx="60" cy="24" rx="4.5" ry="6" fill="#E87898" />
      <Eye x={30} y={40} />
      <Eye x={50} y={40} />
      <ellipse cx="40" cy="56" rx="13" ry="9" fill="#E87898" />
      <ellipse cx="35" cy="56" rx="2" ry="3" fill="#C45678" />
      <ellipse cx="45" cy="56" rx="2" ry="3" fill="#C45678" />
    </g>
  );
}

function SheepFace() {
  return (
    <g filter="url(#fhSoftShadow)">
      <circle cx="24" cy="30" r="10" fill="#FFFDF6" />
      <circle cx="56" cy="30" r="10" fill="#FFFDF6" />
      <circle cx="22" cy="50" r="10" fill="#FFFDF6" />
      <circle cx="58" cy="50" r="10" fill="#FFFDF6" />
      <circle cx="40" cy="24" r="12" fill="#FFFDF6" />
      <circle cx="40" cy="46" r="18" fill="#FFFDF6" />
      <ellipse cx="40" cy="52" rx="10" ry="8" fill="#F0D2B0" />
      <Eye x={32} y={44} />
      <Eye x={48} y={44} />
    </g>
  );
}

function HorseFace() {
  return (
    <g filter="url(#fhSoftShadow)">
      <ellipse cx="40" cy="44" rx="22" ry="24" fill="#C9892A" />
      <ellipse cx="18" cy="28" rx="6" ry="12" fill="#C9892A" />
      <ellipse cx="62" cy="28" rx="6" ry="12" fill="#C9892A" />
      <ellipse cx="18" cy="28" rx="3" ry="7" fill="#F4B4C8" />
      <ellipse cx="62" cy="28" rx="3" ry="7" fill="#F4B4C8" />
      <path d="M30 16c4-12 16-12 20 0" fill="#5C3218" />
      <Eye x={32} y={40} />
      <Eye x={48} y={40} />
      <ellipse cx="40" cy="58" rx="9" ry="7" fill="#F0D2B0" />
    </g>
  );
}

export function FarmStoreArt({ className }: { className?: string }) {
  const p = useUid("store");
  return (
    <svg className={className} viewBox="0 0 280 250" role="img" aria-label="Farm Store">
      <defs>
        <pattern id={`${p}-w`} patternUnits="userSpaceOnUse" width="90" height="90">
          <image href="/art/wood_grain.jpg" width="90" height="90" />
        </pattern>
        <linearGradient id={`${p}-roof`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E85A48" />
          <stop offset="100%" stopColor="#A31E18" />
        </linearGradient>
        <linearGradient id={`${p}-win`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3B0" />
          <stop offset="100%" stopColor="#F0A12A" />
        </linearGradient>
      </defs>
      <ellipse cx="140" cy="232" rx="108" ry="14" fill="#2a4a14" opacity="0.28" />
      <ellipse cx="140" cy="230" rx="104" ry="12" fill="#5FA83A" />
      <rect x="58" y="108" width="164" height="110" rx="10" fill={`url(#${p}-w)`} />
      <rect x="58" y="108" width="164" height="110" rx="10" fill="#c9892a" opacity="0.28" />
      <path d="M40 120 L140 42 L240 120 Z" fill={`url(#${p}-roof)`} stroke="#7A1A14" strokeWidth="3" />
      <path d="M70 96 L140 52 L210 96" fill="none" stroke="#F4B4A0" strokeWidth="4" opacity="0.45" />
      <rect x="78" y="118" width="124" height="22" rx="4" fill="#E23A2A" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={80 + i * 13.4} y="118" width="7" height="22" fill={i % 2 ? "#FFFDF6" : "#E23A2A"} />
      ))}
      <rect x="118" y="168" width="44" height="50" rx="6" fill="#8A4F2A" />
      <circle cx="154" cy="194" r="4" fill="#FFD24A" />
      <rect x="78" y="150" width="28" height="28" rx="6" fill={`url(#${p}-win)`} stroke="#6B3F12" strokeWidth="3" />
      <rect x="174" y="150" width="28" height="28" rx="6" fill={`url(#${p}-win)`} stroke="#6B3F12" strokeWidth="3" />
      <rect x="98" y="78" width="84" height="26" rx="8" fill="#5C3218" />
      <text
        x="140"
        y="96"
        textAnchor="middle"
        fontFamily="Fredoka, sans-serif"
        fontWeight={700}
        fontSize="13"
        fill="#FFF6D8"
        letterSpacing="1"
      >
        Farm Store
      </text>
      <rect x="48" y="196" width="22" height="26" rx="4" fill="#8A4F2A" />
      <circle cx="59" cy="204" r="5" fill="#E23A2A" />
      <circle cx="59" cy="214" r="5" fill="#5FBE58" />
      <rect x="210" y="196" width="24" height="20" rx="3" fill="#C9892A" />
      <path d="M214 196c4-10 12-10 16 0" fill="#F0B429" />
    </svg>
  );
}

export function IngredientOrb({ kind }: { kind: "dew" | "goo" | "ash" }) {
  const fill = kind === "dew" ? ["#E8F8FF", "#5AB0E0", "#1F5A98"] : kind === "goo" ? ["#E8FFB0", "#7ED957", "#2F8A34"] : ["#FFE0A0", "#FF7A2A", "#B32600"];
  const p = useUid(kind);
  return (
    <svg className="ing-orb-art" viewBox="0 0 72 72" aria-hidden>
      <defs>
        <radialGradient id={p} cx="32%" cy="28%" r="72%">
          <stop offset="0%" stopColor={fill[0]} />
          <stop offset="45%" stopColor={fill[1]} />
          <stop offset="100%" stopColor={fill[2]} />
        </radialGradient>
      </defs>
      <ellipse cx="36" cy="64" rx="16" ry="5" fill="#1a2410" opacity="0.2" />
      <circle cx="36" cy="34" r="24" fill={`url(#${p})`} />
      <ellipse cx="28" cy="24" rx="8" ry="5" fill="#fff" opacity="0.45" />
    </svg>
  );
}

export function BackArrow({ className }: ArtProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <path d="M40 12 16 32l24 20" fill="none" stroke="#FFF6E4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SceneShell({
  children,
  dim,
  className = "scene",
}: {
  children: ReactNode;
  dim?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className}${dim ? " dimmed" : ""}`}>
      <div className="scene-light" />
      <div className="scene-vignette" />
      {children}
    </div>
  );
}
