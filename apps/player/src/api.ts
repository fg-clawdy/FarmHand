import type { CropKind, FarmPlayerCard, GameConfig, PublicPlot } from "@farmhand/shared";

export type WaterState = {
  today: string;
  unlocked?: boolean;
  seedGrantedToday?: boolean;
  wateringsUsed: number;
  wateringsLeft: number;
  cooldownRemainingMs: number;
  canWater: boolean;
};

export type SelfieState = {
  today: string;
  unlocked: boolean;
  seedGrantedToday: boolean;
};

export type GardenPlayer = {
  id: string;
  name: string;
  mascot: FarmPlayerCard["mascot"];
  avatarKind?: string;
  avatarPreset?: string | null;
  avatarUrl?: string | null;
  seeds: number;
  provisionalSeeds: number;
  notifyParent?: { allowed: boolean; retryAt: string | null; retryInMs: number };
  points: number;
  /** Shard fragments accumulated toward the next seed. */
  seedShards: number;
  /** @deprecated Fertilizer is disabled — incomplete, future phase. */
  fertilizer: number;
  /** @deprecated Ingredients are disabled — incomplete, future phase. */
  ingredients: { moonDew: number; growGoo: number; phoenixAsh: number };
  /** @deprecated Ingredients are disabled — incomplete, future phase. */
  claimedIngredientToday: boolean;
  /** @deprecated Ingredients are disabled — incomplete, future phase. */
  nextIngredient: { id: string; name: string; emoji: string };
  /** @deprecated Ingredients are disabled — incomplete, future phase. */
  canMix: boolean;
  hasPin: boolean;
  isActive: boolean;
  unlocked: boolean;
  selfie?: SelfieState;
  water: WaterState;
  plots: PublicPlot[];
  /** Produce picked but not yet sold. Absent only on stale responses. */
  basket?: HarvestBasket;
};

export type BasketItem = {
  id: string;
  kind: CropKind | string;
  name: string;
  emoji: string;
  points: number;
};

export type HarvestBasket = {
  items: BasketItem[];
  totalPoints: number;
};

export type PublicChore = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  rewardSeedCount?: number;
  rewardSeedKind?: "seed" | "super_seed";
  recurrence: string;
  timeOfDay: string;
  priority: string;
  requiresApproval: boolean;
  requiresSelfie: boolean;
  allowsSkip?: boolean;
  includeInPath: boolean;
  assignmentMode: string;
  periodKey: string;
  eligible: boolean;
  reason: string | null;
  claimed: boolean;
  claimedByOther: boolean;
  flyerUrl?: string;
  /** Farm-wide HEAT 0–100 from ChoreHeat (optional). */
  heatScore?: number;
};

export type FamilyJob = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  priority: string;
  assignmentMode: string;
  requiresSelfie: boolean;
  allowsSkip?: boolean;
  rewardSeedCount?: number;
  rewardSeedKind?: "seed" | "super_seed";
  rewardLabel?: string;
  flyerUrl?: string;
};


export type ReviewPeriodKey = "day" | "week" | "season" | "all";

export type ReviewKpis = {
  label: string;
  rangeLabel: string;
  starsEarned: number;
  harvests: number;
  freeSeeds: number;
  plantings: number;
  waterings: number;
  choresDone: number;
  selfies: number;
  badges: number;
  daysPlayed: number;
};

export type PlayerReview = {
  timezone: string;
  seasonKey: string;
  periods: Record<ReviewPeriodKey, ReviewKpis>;
};

export type HarvestReward = {
  points: number;
  /** Whole seeds converted from accumulated shards (the new shard-based reward). */
  seedsFromShards: number;
  /** Shards earned from this harvest (before shard-to-seed conversion). */
  shardsEarned: number;
  /** Shards remaining after conversion. */
  remainingShards: number;
  emoji: string;
  name: string;
  kind?: CropKind;
  /** Saved basket row. The animation is a receipt for this id, not the wallet. */
  basketItemId?: string;
};

export type AccoladeUnlock = {
  slug: string;
  kind: "seasonal" | "lifetime";
  seasonKey: string | null;
  medal: "bronze" | "silver" | "gold" | null;
  title: string;
  emoji: string;
  blurb: string;
  unlockedAt: string;
};

export type AccoladeLedger = {
  timezone: string;
  seasonKey: string;
  seasonLabel: string;
  seasonal: {
    counters: Record<string, number>;
    tracks: Array<{
      slug: string;
      title: string;
      emoji: string;
      blurb: string;
      count: number;
      next: { medal: string | null; at: number; remaining: number; done: boolean };
      medals: Array<string | null>;
    }>;
    unlocks: AccoladeUnlock[];
  };
  lifetime: {
    counters: Record<string, number>;
    legends: Array<{
      slug: string;
      title: string;
      emoji: string;
      blurb: string;
      count: number;
      at: number;
      earned: boolean;
      remaining: number;
    }>;
    unlocks: AccoladeUnlock[];
  };
};

export type StoreSku = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  starCost: number;
  isActive: boolean;
  affordable?: boolean;
};

export type StoreRedemption = {
  id: string;
  skuId: string;
  slug: string;
  status: "pending" | "owned" | "redeemed" | "denied" | "fulfilled";
  title: string;
  emoji: string;
  description?: string;
  starCost: number;
  starsHeld: number;
  requestedAt: string;
  resolvedAt: string | null;
  approvedAt?: string | null;
  deniedAt?: string | null;
  redeemedAt?: string | null;
};

export type StarWallet = {
  currentStars: number;
  points: number;
  heldStars: number;
  starsHeld: number;
  availableStars: number;
  lifetimeEarned: number;
  lifetimeEarnedHarvest: number;
  lifetimeEarnedGrant: number;
  lifetimeEarnedLegacy: number;
  lifetimeSpent: number;
  adjustNet: number;
};

export type PlayerStore = StarWallet & {
  catalog: StoreSku[];
  pending: StoreRedemption[];
  owned: StoreRedemption[];
};

export type KidProfile = {
  player: { id: string; name: string; mascot: GardenPlayer["mascot"]; garden: string; avatarKind?: string; avatarPreset?: string | null; avatarUrl?: string | null };
  wallet: StarWallet;
  pouch: { seeds: number; provisionalSeeds: number; fertilizer: number };
  selfies: Array<{ file: string; url: string }>;
  rewards: {
    pending: StoreRedemption[];
    owned: StoreRedemption[];
    redeemed: StoreRedemption[];
    denied: StoreRedemption[];
  };
  accolades: AccoladeLedger;
  activity: Array<{ id: string; action: string; label: string; at: string }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/** Fire-and-forget client error report (logger also POSTs directly). */
export function reportClientError(body: {
  level?: "error" | "warn";
  tag: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}) {
  return fetch("/api/client-errors", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, href: location.href, userAgent: navigator.userAgent, ts: Date.now() }),
    keepalive: true,
  }).catch(() => undefined);
}

export const api = {
  farm: () =>
    request<{ players: FarmPlayerCard[]; timezone: string; storeStatus: string; config: GameConfig }>("/api/farm"),
  farmJobs: () => request<{ jobs: FamilyJob[]; timezone: string }>("/api/farm/jobs"),
  session: () => request<{ player: GardenPlayer | null; config?: GameConfig }>("/api/session"),
  enter: (id: string, pin?: string) =>
    request<{ player: GardenPlayer; config: GameConfig; skippedPin: boolean }>(`/api/players/${id}/enter`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  logout: () => request<{ ok: boolean }>("/api/session/logout", { method: "POST" }),
  garden: () => request<{ player: GardenPlayer; config: GameConfig }>("/api/garden"),
  gardenReview: () => request<PlayerReview>("/api/garden/review"),
  plant: (slot: number, tier: number) =>
    request<{ player: GardenPlayer; unlocks?: AccoladeUnlock[] }>(`/api/plots/${slot}/plant`, {
      method: "POST",
      body: JSON.stringify({ tier }),
    }),
  water: (slot: number) =>
    request<{ player: GardenPlayer; unlocks?: AccoladeUnlock[] }>(`/api/plots/${slot}/water`, { method: "POST" }),
  fertilize: (slot: number) => request<{ player: GardenPlayer }>(`/api/plots/${slot}/fertilize`, { method: "POST" }),
  harvest: (slot: number) =>
    request<{ player: GardenPlayer; reward: HarvestReward; unlocks?: AccoladeUnlock[] }>(
      `/api/plots/${slot}/harvest`,
      { method: "POST" },
    ),
  sellBasket: () =>
    request<{
      player: GardenPlayer;
      soldPoints: number;
      previousPoints: number;
      items: BasketItem[];
    }>("/api/basket/sell", { method: "POST", body: "{}" }),
  claimIngredient: () =>
    request<{ player: GardenPlayer; claimed: { id: string; name: string; emoji: string } }>("/api/ingredients/claim", {
      method: "POST",
    }),
  mix: () => request<{ player: GardenPlayer }>("/api/ingredients/mix", { method: "POST" }),
  selfieStatus: () =>
    request<{ today: string; unlocked: boolean; seedGrantedToday: boolean }>("/api/selfie"),
  submitSelfie: (image: string) =>
    request<{
      player: GardenPlayer;
      today: string;
      unlocked: boolean;
      seedGranted: boolean;
      alreadyUnlocked: boolean;
      reward: { seedsReturned: number; points: number };
      unlocks?: AccoladeUnlock[];
    }>("/api/selfie", { method: "POST", body: JSON.stringify({ image }) }),
  accolades: () => request<AccoladeLedger>("/api/accolades"),
  chores: () =>
    request<{ chores: PublicChore[]; timezone: string; player: GardenPlayer }>("/api/chores"),
  claimChore: (id: string, body?: { image?: string }) =>
    request<{ player: GardenPlayer; claim: { id: string; status: string; slot: number | null }; unlocks?: AccoladeUnlock[]; seedsGranted?: number }>(
      `/api/chores/${id}/claim`,
      {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      },
    ),
  skipChore: (id: string) =>
    request<{
      player: GardenPlayer;
      claim: { id: string; status: string; slot: number | null };
      shardsGranted: number;
      chores?: PublicChore[];
      toast?: string;
    }>(`/api/chores/${id}/skip`, { method: "POST", body: "{}" }),
  notifyParent: () =>
    request<{ ok?: boolean; player?: GardenPlayer; notifyParent?: GardenPlayer["notifyParent"]; error?: string }>(
      "/api/player/notify-parent",
      { method: "POST" },
    ),
  prune: (slot: number) => request<{ player: GardenPlayer }>(`/api/plots/${slot}/prune`, { method: "POST" }),
  store: () => request<PlayerStore>("/api/store"),
  storeCatalog: () => request<{ catalog: StoreSku[] }>("/api/store/catalog"),
  requestStore: (skuId: string) =>
    request<PlayerStore & { ok: boolean; redemption: { id: string; title: string; emoji: string; starCost: number } }>(
      "/api/store/request",
      { method: "POST", body: JSON.stringify({ skuId }) },
    ),
  profile: () => request<KidProfile>("/api/profile"),
  setAvatar: (
    body:
      | { kind: "mascot" }
      | { kind: "preset"; presetId: string }
      | { kind: "selfie"; image: string },
  ) =>
    request<{ player: GardenPlayer }>("/api/avatar", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  avatarPresets: () =>
    request<{ presets: Array<{ id: string; emoji: string; label: string }> }>("/api/avatar/presets"),
};

