import type { Mascot, PublicPlot } from "@farmhand/shared";

export const ART = {
  backdrop: "/art/farm_backdrop.jpg",
  store: "/art/farm_store.png",
  wateringCan: "/art/watering_can.png",
  beaker: "/art/fertilizer_beaker.png",
  acorn: "/art/acorn.png",
  woodSign: "/art/wood_sign.png",
  sprout: "/art/plant_sprout.png",
  daisy: "/art/plant_daisy_ready.png",
  herbs: "/art/plant_herbs.png",
  sunflower: "/art/plant_sunflower.png",
  oak: "/art/plant_oak.png",
  mascots: {
    cow: "/art/mascot_cow.png",
    chicken: "/art/mascot_chicken.png",
    pig: "/art/mascot_pig.png",
    sheep: "/art/mascot_sheep.png",
    horse: "/art/mascot_horse.png",
  } as Record<Mascot, string>,
};

export const ACCENTS = [
  { border: "#4EA6E6", wash: "#EAF7FF", text: "#1F74B8", glow: "rgba(78,166,230,0.45)" },
  { border: "#5FBE58", wash: "#E9FBE6", text: "#2B8A32", glow: "rgba(95,190,88,0.45)" },
  { border: "#F0A12A", wash: "#FFF4DC", text: "#C56A00", glow: "rgba(240,161,42,0.45)" },
] as const;

export function plantArt(plot: Pick<PublicPlot, "state" | "tier" | "growthStage" | "ready">): string | null {
  if (plot.state === "empty" || !plot.tier) return null;
  const stage = plot.growthStage ?? 1;
  if (plot.ready || stage >= 3) {
    if (plot.tier === 2) return ART.herbs;
    if (plot.tier === 3) return ART.sunflower;
    if (plot.tier === 4) return ART.oak;
    return ART.daisy;
  }
  return ART.sprout;
}

export function FarmTitle() {
  return (
    <svg className="farm-title" viewBox="0 0 900 150" role="img" aria-label="FarmHand">
      <defs>
        <linearGradient id="fhFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE56A" />
          <stop offset="52%" stopColor="#FFB02A" />
          <stop offset="100%" stopColor="#FF7E10" />
        </linearGradient>
      </defs>
      <text
        x="450"
        y="112"
        textAnchor="middle"
        fontFamily='"Luckiest Guy", Fredoka, sans-serif'
        fontSize="112"
        stroke="#ffffff"
        strokeWidth="18"
        fill="url(#fhFill)"
        paintOrder="stroke fill"
      >
        FarmHand
      </text>
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 64 64" className="lock-icon" aria-hidden>
      <defs>
        <linearGradient id="lockG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#c9892a" />
        </linearGradient>
      </defs>
      <rect x="12" y="28" width="40" height="28" rx="8" fill="url(#lockG)" stroke="#6b3f12" strokeWidth="3" />
      <path d="M20 28v-6a12 12 0 0 1 24 0v6" fill="none" stroke="#6b3f12" strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="42" r="4" fill="#6b3f12" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg viewBox="0 0 64 64" className="star-icon" aria-hidden>
      <defs>
        <linearGradient id="starG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3a8" />
          <stop offset="100%" stopColor="#f0b429" />
        </linearGradient>
      </defs>
      <path
        d="M32 6 39 24h19L43 35l6 19-17-12-17 12 6-19L6 24h19z"
        fill="url(#starG)"
        stroke="#c47a10"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
