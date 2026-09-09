export type StarterStoreSku = {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  starCost: number;
  sortOrder: number;
};

/** Mid–Phase 2 catalog. 1★ = 1¢. Parent fulfill, not auto-buy. */
export const STARTER_STORE_CATALOG: StarterStoreSku[] = [
  {
    slug: "movie-night",
    title: "Movie night",
    emoji: "🎬",
    description: "Pick a movie and watch it together.",
    starCost: 200,
    sortOrder: 1,
  },
  {
    slug: "ice-cream",
    title: "Ice cream",
    emoji: "🍦",
    description: "A real ice cream treat.",
    starCost: 500,
    sortOrder: 2,
  },
  {
    slug: "netflix-month",
    title: "Netflix month",
    emoji: "📺",
    description: "One month of Netflix, paid by a grown-up.",
    starCost: 1000,
    sortOrder: 3,
  },
  {
    slug: "amazon-gift-card",
    title: "Amazon gift card",
    emoji: "📦",
    description: "A $10 Amazon gift card.",
    starCost: 1000,
    sortOrder: 4,
  },
  {
    slug: "date-night",
    title: "Date night",
    emoji: "💕",
    description: "A special night out with a grown-up.",
    starCost: 2000,
    sortOrder: 5,
  },
];

export function availableStars(points: number, starsHeld: number): number {
  return Math.max(0, points - starsHeld);
}

export function canAfford(points: number, starsHeld: number, starCost: number): boolean {
  return starCost > 0 && availableStars(points, starsHeld) >= starCost;
}

/** Spend held stars on fulfill. Never go below zero. */
export function spendHeldStars(points: number, starsHeld: number): number {
  return Math.max(0, points - starsHeld);
}
