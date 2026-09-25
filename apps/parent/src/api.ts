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

export type ParentRedemption = {
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
  player: { id: string; name: string; mascot: string };
};

export type ParentWallet = {
  currentStars: number;
  points: number;
  heldStars: number;
  starsHeld: number;
  availableStars: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
};

export type ParentKid = {
  id: string;
  name: string;
  mascot: string;
  wallet?: ParentWallet;
  rewards?: {
    pending: ParentRedemption[];
    owned: ParentRedemption[];
    redeemed: ParentRedemption[];
    denied: ParentRedemption[];
  };
};

export type ParentStoreSku = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  starCost: number;
  isActive: boolean;
  sortOrder: number;
};

export type SkuWrite = {
  title?: string;
  emoji?: string;
  description?: string;
  starCost?: number;
  isActive?: boolean;
  sortOrder?: number;
};

export type InboxClaim = {
  id: string;
  status: string;
  slot: number;
  plantTier: number;
  periodKey: string;
  claimedAt: string;
  hasPhoto: boolean;
  priority: string;
  chore: {
    id: string;
    slug: string;
    title: string;
    emoji: string;
    description: string;
    priority: string;
    requiresSelfie: boolean;
  };
  player: { id: string; name: string; mascot: string };
};

export type ParentChore = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  recurrence: string;
  timeOfDay: string;
  priority: string;
  estimatedMinutes: number | null;
  requiresApproval: boolean;
  requiresSelfie: boolean;
  allowsSkip: boolean;
  isGlobal: boolean;
  includeInPath: boolean;
  isActive: boolean;
  assignmentMode: "ALL" | "SPECIFIC" | "RACE" | string;
  sortOrder: number;
  seedGrant: number;
  assignments: { playerId: string; name: string }[];
  assignedPlayerIds: string[];
};

export type ChoreWrite = {
  title?: string;
  emoji?: string;
  description?: string;
  recurrence?: string;
  timeOfDay?: string;
  priority?: string;
  estimatedMinutes?: number | null;
  requiresApproval?: boolean;
  requiresSelfie?: boolean;
  allowsSkip?: boolean;
  includeInPath?: boolean;
  isActive?: boolean;
  assignmentMode?: string;
  assignedPlayerIds?: string[];
};

export type KidActivity = {
  id: string;
  name: string;
  mascot: string;
  claims: number;
  approvals: number;
  denials: number;
  streak: number;
  series: { day: string; claims: number; approvals: number; denials: number }[];
  chores: { choreId: string; title: string; emoji: string; claims: number; approvals: number; denials: number }[];
};

export type ParentStats = {
  range: "week" | "month";
  timezone: string;
  days: string[];
  kids: KidActivity[];
};

export type AccoladeTrack = {
  slug: string;
  title: string;
  emoji: string;
  blurb: string;
  count: number;
  next: { medal: string | null; at: number; remaining: number; done: boolean };
  medals: Array<string | null>;
};

export type AccoladeLegend = {
  slug: string;
  title: string;
  emoji: string;
  blurb: string;
  count: number;
  at: number;
  earned: boolean;
  remaining: number;
};

export type KidAccolades = {
  id: string;
  name: string;
  mascot: string;
  seasonKey: string;
  seasonLabel: string;
  seasonal: { tracks: AccoladeTrack[] };
  lifetime: { legends: AccoladeLegend[] };
};

export type FarmAccolades = {
  timezone: string;
  seasonKey: string;
  seasonLabel: string;
  kids: KidAccolades[];
};

export const api = {
  login: (username: string, password: string) =>
    request<{ admin: { username: string } }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ admin: { username: string } }>("/api/parent/me"),
  logout: () => request("/api/admin/logout", { method: "POST" }),
  inbox: () => request<{ claims: InboxClaim[]; redemptions: ParentRedemption[] }>("/api/parent/inbox"),
  approve: (id: string) =>
    request<{ ok: boolean; claims: InboxClaim[]; redemptions: ParentRedemption[] }>(
      `/api/parent/claims/${id}/approve`,
      { method: "POST" },
    ),
  deny: (id: string) =>
    request<{ ok: boolean; claims: InboxClaim[]; redemptions: ParentRedemption[] }>(
      `/api/parent/claims/${id}/deny`,
      { method: "POST" },
    ),
  store: () =>
    request<{
      redemptions: ParentRedemption[];
      pending: ParentRedemption[];
      owned: ParentRedemption[];
      history: ParentRedemption[];
      skus: ParentStoreSku[];
      kids: ParentKid[];
    }>("/api/parent/store"),
  createSku: (body: SkuWrite) =>
    request<{ sku: ParentStoreSku }>("/api/parent/store/skus", { method: "POST", body: JSON.stringify(body) }),
  updateSku: (id: string, body: SkuWrite) =>
    request<{ sku: ParentStoreSku }>(`/api/parent/store/skus/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  approveRedemption: (id: string) =>
    request<{ ok: boolean; claims: InboxClaim[]; redemptions: ParentRedemption[] }>(
      `/api/parent/redemptions/${id}/approve`,
      { method: "POST" },
    ),
  fulfillRedemption: (id: string) =>
    request<{ ok: boolean; claims: InboxClaim[]; redemptions: ParentRedemption[] }>(
      `/api/parent/redemptions/${id}/fulfill`,
      { method: "POST" },
    ),
  denyRedemption: (id: string) =>
    request<{ ok: boolean; claims: InboxClaim[]; redemptions: ParentRedemption[] }>(
      `/api/parent/redemptions/${id}/deny`,
      { method: "POST" },
    ),
  redeemRedemption: (id: string) =>
    request<{ ok: boolean; claims: InboxClaim[]; redemptions: ParentRedemption[] }>(
      `/api/parent/redemptions/${id}/redeem`,
      { method: "POST" },
    ),
  pushConfig: () =>
    request<{ enabled: boolean; publicKey: string | null; subscribed: boolean }>("/api/parent/push/config"),
  pushSubscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<{ ok: boolean; subscribed: boolean }>("/api/parent/push/subscribe", {
      method: "POST",
      body: JSON.stringify(sub),
    }),
  pushUnsubscribe: (endpoint: string) =>
    request<{ ok: boolean; subscribed: boolean }>("/api/parent/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    }),
  chores: () => request<{ chores: ParentChore[] }>("/api/parent/chores"),
  chore: (id: string) => request<{ chore: ParentChore }>(`/api/parent/chores/${id}`),
  createChore: (body: ChoreWrite) =>
    request<{ chore: ParentChore }>("/api/parent/chores", { method: "POST", body: JSON.stringify(body) }),
  updateChore: (id: string, body: ChoreWrite) =>
    request<{ chore: ParentChore }>(`/api/parent/chores/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  kids: () => request<{ kids: ParentKid[] }>("/api/parent/kids"),
  stats: (range: "week" | "month") => request<ParentStats>(`/api/parent/stats?range=${range}`),
  accolades: () => request<FarmAccolades>("/api/parent/accolades"),
};
