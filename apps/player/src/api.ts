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
  seeds: number;
  points: number;
  fertilizer: number;
  ingredients: { moonDew: number; growGoo: number; phoenixAsh: number };
  claimedIngredientToday: boolean;
  nextIngredient: { id: string; name: string; emoji: string };
  canMix: boolean;
  hasPin: boolean;
  isActive: boolean;
  unlocked: boolean;
  selfie?: SelfieState;
  water: WaterState;
  plots: PublicPlot[];
};

export type PublicChore = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  recurrence: string;
  timeOfDay: string;
  priority: string;
  requiresApproval: boolean;
  requiresSelfie: boolean;
  includeInPath: boolean;
  assignmentMode: string;
  periodKey: string;
  eligible: boolean;
  reason: string | null;
  claimed: boolean;
  claimedByOther: boolean;
};

export type HarvestReward = {
  points: number;
  seedsReturned: number;
  emoji: string;
  name: string;
  kind?: CropKind;
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
  affordable: boolean;
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
  player: { id: string; name: string; mascot: GardenPlayer["mascot"]; garden: string };
  wallet: StarWallet;
  pouch: { seeds: number; fertilizer: number };
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

export const api = {
  farm: () =>
    request<{ players: FarmPlayerCard[]; timezone: string; storeStatus: string; config: GameConfig }>("/api/farm"),
  session: () => request<{ player: GardenPlayer | null; config?: GameConfig }>("/api/session"),
  enter: (id: string, pin?: string) =>
    request<{ player: GardenPlayer; config: GameConfig; skippedPin: boolean }>(`/api/players/${id}/enter`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  logout: () => request<{ ok: boolean }>("/api/session/logout", { method: "POST" }),
  garden: () => request<{ player: GardenPlayer; config: GameConfig }>("/api/garden"),
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
    request<{ chores: PublicChore[]; emptySlots: number[]; timezone: string; player: GardenPlayer }>("/api/chores"),
  claimChore: (id: string, body: { slot: number; tier: number; image?: string }) =>
    request<{ player: GardenPlayer; claim: { id: string; status: string; slot: number }; unlocks?: AccoladeUnlock[] }>(
      `/api/chores/${id}/claim`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  prune: (slot: number) => request<{ player: GardenPlayer }>(`/api/plots/${slot}/prune`, { method: "POST" }),
  store: () => request<PlayerStore>("/api/store"),
  requestStore: (skuId: string) =>
    request<PlayerStore & { ok: boolean; redemption: { id: string; title: string; emoji: string; starCost: number } }>(
      "/api/store/request",
      { method: "POST", body: JSON.stringify({ skuId }) },
    ),
  profile: () => request<KidProfile>("/api/profile"),
};
