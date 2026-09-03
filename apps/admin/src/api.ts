import type { GameConfig, Mascot, PublicPlot } from "@farmhand/shared";

export type AdminPlayer = {
  id: string;
  name: string;
  mascot: Mascot;
  seeds: number;
  points: number;
  fertilizer: number;
  ingredients: { moonDew: number; growGoo: number; phoenixAsh: number };
  hasPin: boolean;
  isActive: boolean;
  plots: PublicPlot[];
  activeSessions?: number;
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
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ admin: { username: string } }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ admin: { username: string } }>("/api/admin/me"),
  logout: () => request("/api/admin/logout", { method: "POST" }),
  overview: () =>
    request<{
      activeSessions: number;
      harvestsToday: number;
      wateringsToday: number;
      readyPlants: number;
      playerCount: number;
    }>("/api/admin/overview"),
  players: () => request<{ players: AdminPlayer[] }>("/api/admin/players"),
  player: (id: string) => request<{ player: AdminPlayer }>(`/api/admin/players/${id}`),
  createPlayer: (body: Record<string, unknown>) =>
    request<{ player: AdminPlayer }>("/api/admin/players", { method: "POST", body: JSON.stringify(body) }),
  editPlayer: (id: string, body: Record<string, unknown>) =>
    request<{ player: AdminPlayer }>(`/api/admin/players/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  resetPin: (id: string, pin: string | null) =>
    request(`/api/admin/players/${id}/reset-pin`, { method: "POST", body: JSON.stringify({ pin }) }),
  resources: (id: string, body: Record<string, unknown>) =>
    request<{ player: AdminPlayer }>(`/api/admin/players/${id}/resources`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  endSession: (id: string) => request(`/api/admin/players/${id}/end-session`, { method: "POST" }),
  deactivate: (id: string, active: boolean) =>
    request(`/api/admin/players/${id}/deactivate`, { method: "POST", body: JSON.stringify({ active }) }),
  config: () => request<{ config: GameConfig; defaults: GameConfig }>("/api/admin/config"),
  saveConfig: (config: GameConfig) =>
    request<{ config: GameConfig }>("/api/admin/config", { method: "PUT", body: JSON.stringify({ config }) }),
  resetConfig: () => request<{ config: GameConfig }>("/api/admin/config/reset", { method: "POST" }),
  activity: () =>
    request<{
      timezone: string;
      days: string[];
      activity: Array<{
        playerId: string;
        name: string;
        mascot: string;
        days: Array<{ day: string; logins: number; waterings: number; harvests: number; points: number }>;
        totals: { logins: number; waterings: number; harvests: number; points: number };
      }>;
    }>("/api/admin/activity"),
  audit: () =>
    request<{
      logs: Array<{ id: string; action: string; details: unknown; createdAt: string; admin: string | null; player: string | null }>;
    }>("/api/admin/audit"),
};
