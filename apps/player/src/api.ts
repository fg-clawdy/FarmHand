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

export type HarvestReward = {
  points: number;
  seedsReturned: number;
  emoji: string;
  name: string;
  kind?: CropKind;
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
    request<{ player: GardenPlayer }>(`/api/plots/${slot}/plant`, { method: "POST", body: JSON.stringify({ tier }) }),
  water: (slot: number) => request<{ player: GardenPlayer }>(`/api/plots/${slot}/water`, { method: "POST" }),
  fertilize: (slot: number) => request<{ player: GardenPlayer }>(`/api/plots/${slot}/fertilize`, { method: "POST" }),
  harvest: (slot: number) =>
    request<{ player: GardenPlayer; reward: HarvestReward }>(`/api/plots/${slot}/harvest`, { method: "POST" }),
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
    }>("/api/selfie", { method: "POST", body: JSON.stringify({ image }) }),
};
