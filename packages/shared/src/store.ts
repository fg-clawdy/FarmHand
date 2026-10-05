export type StarterStoreSku = {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  starCost: number;
  sortOrder: number;
};

/** Mid–Phase 2 catalog. 1★ = 1¢. Parent approve → owned; later mark redeemed. */
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

export type StarLedgerKind =
  | "EARN_HARVEST"
  | "EARN_GRANT"
  | "HOLD_REWARD"
  | "RELEASE_REWARD"
  | "SPEND_REWARD"
  | "ADJUST_ADMIN"
  | "OPENING_BALANCE"
  | "GIVE_SHARED"
  | "RETURN_SHARED";

export type StarLedgerLine = { kind: StarLedgerKind; amount: number };

export type StarWallet = {
  currentStars: number;
  heldStars: number;
  availableStars: number;
  lifetimeEarned: number;
  lifetimeEarnedHarvest: number;
  lifetimeEarnedGrant: number;
  lifetimeEarnedLegacy: number;
  lifetimeSpent: number;
  /** Net stars moved into family jars. Not store spend, not earned. */
  lifetimeGiven: number;
  adjustNet: number;
};

/** Available to spend = unspent current minus pending holds. */
export function availableStars(currentStars: number, heldStars: number): number {
  return Math.max(0, currentStars - heldStars);
}

export function canAfford(currentStars: number, heldStars: number, starCost: number): boolean {
  return starCost > 0 && availableStars(currentStars, heldStars) >= starCost;
}

/** Commit a hold into spend. Never go below zero. */
export function spendHeldStars(currentStars: number, heldStars: number): number {
  return Math.max(0, currentStars - heldStars);
}

/**
 * Wallet from an append-only ledger plus live pending holds.
 * HOLD / RELEASE lines are audit only — heldStars comes from PENDING rows.
 * ADJUST_ADMIN amount is signed. Other kinds use a positive amount.
 */
export function walletFromLedger(lines: StarLedgerLine[], heldStars: number): StarWallet {
  let lifetimeEarnedHarvest = 0;
  let lifetimeEarnedGrant = 0;
  let lifetimeEarnedLegacy = 0;
  let lifetimeSpent = 0;
  let lifetimeGiven = 0;
  let adjustNet = 0;
  for (const line of lines) {
    if (line.kind === "EARN_HARVEST") lifetimeEarnedHarvest += line.amount;
    else if (line.kind === "EARN_GRANT") lifetimeEarnedGrant += line.amount;
    else if (line.kind === "OPENING_BALANCE") lifetimeEarnedLegacy += line.amount;
    else if (line.kind === "SPEND_REWARD") lifetimeSpent += line.amount;
    else if (line.kind === "ADJUST_ADMIN") adjustNet += line.amount;
    else if (line.kind === "GIVE_SHARED") lifetimeGiven += line.amount;
    else if (line.kind === "RETURN_SHARED") lifetimeGiven -= line.amount;
  }
  const lifetimeEarned = lifetimeEarnedHarvest + lifetimeEarnedGrant + lifetimeEarnedLegacy;
  const given = Math.max(0, lifetimeGiven);
  const currentStars = Math.max(0, lifetimeEarned + adjustNet - lifetimeSpent - given);
  return {
    currentStars,
    heldStars: Math.max(0, heldStars),
    availableStars: availableStars(currentStars, heldStars),
    lifetimeEarned,
    lifetimeEarnedHarvest,
    lifetimeEarnedGrant,
    lifetimeEarnedLegacy,
    lifetimeSpent,
    lifetimeGiven: given,
    adjustNet,
  };
}

// ---- Amazon Wishlist pricing ----

export type WishlistItemStatus = "PENDING" | "CONFIRMED" | "HIDDEN" | "PURCHASED";

/** Round a cents amount up to the nearest $0.50 (50¢). */
export function roundUpTo50(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.ceil(Math.ceil(cents) / 50) * 50;
}

/**
 * Item price + 10% tax, rounded up to the nearest 50¢, as stars (1★ = 1¢).
 * $22.99 (2299¢) -> 2299 + 230 tax = 2529 -> 2550★.
 */
export function starCostForPriceCents(priceCents: number): number {
  const subtotal = Math.ceil(priceCents);
  const taxCents = Math.ceil(subtotal * 0.1);
  return roundUpTo50(subtotal + taxCents);
}

export type WishlistPriceBreakdown = {
  priceCents: number;
  taxCents: number;
  totalCents: number;
  starCost: number;
};

export function priceBreakdown(priceCents: number): WishlistPriceBreakdown {
  const priceCentsCeil = Math.ceil(priceCents);
  const taxCents = Math.ceil(priceCentsCeil * 0.1);
  const totalCents = priceCentsCeil + taxCents;
  return { priceCents: priceCentsCeil, taxCents, totalCents, starCost: roundUpTo50(totalCents) };
}
