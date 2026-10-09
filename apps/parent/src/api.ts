import type { ParentGoalContribution, ParentSharedGoal, PublicSharedGoal } from "@farmhand/shared";

let authExpiredHandler: (() => void) | null = null;

/** Register a callback fired when any API call returns 401 (session expired). */
export function onAuthExpired(handler: () => void): () => void {
  authExpiredHandler = handler;
  return () => {
    if (authExpiredHandler === handler) authExpiredHandler = null;
  };
}

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
    if (res.status === 401) authExpiredHandler?.();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export type ParentRedemption = {
  id: string;
  skuId: string | null;
  slug: string;
  source?: string;
  productUrl?: string | null;
  status: "pending" | "owned" | "redeemed" | "denied" | "fulfilled";
  title: string;
  emoji: string;
  description?: string;
  pointCost: number;
  pointsHeld: number;
  requestedAt: string;
  resolvedAt: string | null;
  approvedAt?: string | null;
  deniedAt?: string | null;
  redeemedAt?: string | null;
  player: { id: string; name: string; mascot: string };
};

export type ParentWallet = {
  points: number;
  heldPoints: number;
  availablePoints: number;
  lifetimeEarned: number;
  lifetimeEarnedHarvest: number;
  lifetimeEarnedGrant: number;
  lifetimeEarnedLegacy: number;
  lifetimeSpent: number;
  lifetimeGiven: number;
  adjustNet: number;
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
  pointCost: number;
  isActive: boolean;
  sortOrder: number;
};

export type SkuWrite = {
  title?: string;
  emoji?: string;
  description?: string;
  pointCost?: number;
  isActive?: boolean;
  sortOrder?: number;
};

export type InboxClaim = {
  id: string;
  status: string;
  slot: number | null;
  plantTier: number | null;
  periodKey: string;
  claimedAt: string;
  /** Local date and time (in the family timezone) the claim was made. */
  claimedWhen?: string;
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
  /** Plots this claim's provisional seeds were planted into. */
  plots?: InboxPlot[];
};

/** A single plot funded by a claim's provisional seeds, with server-computed maturity. */
export type InboxPlot = {
  slot: number;
  cropTier: number | null;
  seedsUsed: number;
  playerName: string;
  state: string;
  ready: boolean;
  maturesAt: string | null;
  remainingMs: number;
  otherProvisionalSeeds: Array<{ claimId: string; title: string; emoji: string }>;
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
  claimWindowStart: number | null;
  claimWindowEnd: number | null;
  activeDays: number[];
  assignments: { playerId: string; name: string }[];
  assignedPlayerIds: string[];
  playbookIds: string[];
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
  claimWindowStart?: number | null;
  claimWindowEnd?: number | null;
  activeDays?: number[];
  playbookIds?: string[];
};

export type ParentPlaybook = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  windowStart: number | null;
  windowEnd: number | null;
  windowLabel: string | null;
  isActive: boolean;
  sortOrder: number;
  choreIds: string[];
  chores: Array<{ choreId: string; title: string; emoji: string; sortOrder: number }>;
};

export type PlaybookWrite = {
  title?: string;
  emoji?: string;
  description?: string;
  windowStart?: number | null;
  windowEnd?: number | null;
  isActive?: boolean;
  choreIds?: string[];
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

export type ParentSharedGoals = {
  active: ParentSharedGoal | null;
  activeGoals?: ParentSharedGoal[];
  waiting: ParentSharedGoal[];
  history: ParentSharedGoal[];
  players: ParentGoalContribution[];
};

export type FarmAccolades = {
  timezone: string;
  seasonKey: string;
  seasonLabel: string;
  kids: KidAccolades[];
};

export type ParentWishlistItem = {
  id: string;
  playerId: string;
  retailer: string;
  asin: string | null;
  title: string;
  productUrl: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  pointCost: number | null;
  status: "PENDING" | "CONFIRMED" | "HIDDEN" | "PURCHASED";
  needsAttention: boolean;
  lastSeenAt: string | null;
};

export type ParentWishlistKid = {
  id: string;
  name: string;
  mascot: string;
  wishlistUrl: string | null;
  syncedAt: string | null;
  items: ParentWishlistItem[];
};

export type ParentWishlistPayload = {
  kids: ParentWishlistKid[];
  urlsConfigured: boolean;
};

export type WishlistSyncResult = {
  results: Array<{ playerId: string; ok: boolean; skipped?: string; items?: number; error?: string }>;
};

export type WishlistLinkResult = {
  playerId: string;
  linked: boolean;
  ok: boolean;
  items?: number;
  error?: string;
};

export type RecommendationSummary = {
  id: string;
  status: "OPEN" | "RESOLVED" | "SUPERSEDED";
  summary: string;
  createdAt: string;
  notifiedAt: string | null;
  changeCount: number;
};

export type RecommendationChange = {
  id: string;
  path: string;
  label: string;
  unit: string;
  baseline: unknown;
  proposed: unknown;
  applied: unknown;
  current: unknown;
  rationale: string;
  status: string;
  sortOrder: number;
  createdAt: string;
};

export type RecommendationSet = {
  id: string;
  status: string;
  summary: string;
  snapshot: unknown;
  modelIds: unknown;
  createdAt: string;
  notifiedAt: string | null;
};

export type RecommendationList = { sets: RecommendationSummary[]; pendingChanges: number };
export type RecommendationDetail = { set: RecommendationSet; changes: RecommendationChange[] };
export type RecommendationApplyResult = {
  outcome: { ok: boolean; applied?: number; skipped?: Array<{ id: string; reason: string }>; reason?: string };
  set: { id: string; status: string } | null;
  changes: RecommendationChange[];
};
export type RecommendationDiscussResult = {
  reply: string;
  revised: Array<{ changeId: string; path: string; proposedValue: number; rationale: string; label: string; unit: string }>;
  changes: RecommendationChange[];
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
  wishlist: () => request<ParentWishlistPayload>("/api/parent/wishlist"),
  syncWishlist: () =>
    request<WishlistSyncResult>("/api/parent/wishlist/sync", { method: "POST" }),
  linkWishlist: (body: {
    playerId: string;
    url: string;
    mode: "review" | "over" | "accept";
    thresholdCents?: number | null;
  }) =>
    request<WishlistLinkResult>("/api/parent/wishlist/link", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  unlinkWishlist: (playerId: string) =>
    request<{ ok: boolean }>(`/api/parent/wishlist/${playerId}/unlink`, { method: "POST" }),
  createWishlistItem: (body: {
    playerId: string;
    title: string;
    priceCents?: number | null;
    productUrl?: string | null;
  }) =>
    request<{ item: ParentWishlistItem }>("/api/parent/wishlist", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  confirmWishlistItem: (id: string, priceCents: number) =>
    request<{ item: ParentWishlistItem }>(`/api/parent/wishlist/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ priceCents }),
    }),
  hideWishlistItem: (id: string) =>
    request<{ item: ParentWishlistItem }>(`/api/parent/wishlist/${id}/hide`, { method: "POST" }),
  unhideWishlistItem: (id: string) =>
    request<{ item: ParentWishlistItem }>(`/api/parent/wishlist/${id}/unhide`, { method: "POST" }),
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
  playbooks: () => request<{ playbooks: ParentPlaybook[] }>("/api/parent/playbooks"),
  playbook: (id: string) => request<{ playbook: ParentPlaybook }>(`/api/parent/playbooks/${id}`),
  createPlaybook: (body: PlaybookWrite) =>
    request<{ playbook: ParentPlaybook }>("/api/parent/playbooks", { method: "POST", body: JSON.stringify(body) }),
  updatePlaybook: (id: string, body: PlaybookWrite) =>
    request<{ playbook: ParentPlaybook }>(`/api/parent/playbooks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePlaybook: (id: string) => request<{ ok: boolean }>(`/api/parent/playbooks/${id}`, { method: "DELETE" }),
  kids: () => request<{ kids: ParentKid[] }>("/api/parent/kids"),
  stats: (range: "week" | "month") => request<ParentStats>(`/api/parent/stats?range=${range}`),
  accolades: () => request<FarmAccolades>("/api/parent/accolades"),
  sharedGoals: () => request<ParentSharedGoals>("/api/parent/shared-goal"),
  createSharedGoal: (body: {
    title: string;
    emoji: string;
    targetPoints: number;
    artNotes?: string;
    generateArt?: boolean;
    queue?: boolean;
  }) => request<{ goal: PublicSharedGoal }>("/api/parent/shared-goal", { method: "POST", body: JSON.stringify(body) }),
  openSharedGoal: (id: string) => request(`/api/parent/shared-goal/${id}/open`, { method: "POST", body: "{}" }),
  removeSharedGoal: (id: string) => request<{ ok: boolean }>(`/api/parent/shared-goal/${id}`, { method: "DELETE" }),
  patchSharedGoal: (
    id: string,
    body: { title?: string; emoji?: string; targetPoints?: number; sortOrder?: number },
  ) => request(`/api/parent/shared-goal/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  happenSharedGoal: (id: string) => request(`/api/parent/shared-goal/${id}/happen`, { method: "POST", body: "{}" }),
  cancelSharedGoal: (id: string) => request(`/api/parent/shared-goal/${id}/cancel`, { method: "POST", body: "{}" }),
  updateSharedGoalArt: (id: string, body: { artPrompt?: string; artNotes?: string; regenerate?: boolean }) =>
    request<{ ok: boolean }>(`/api/parent/shared-goal/${id}/art`, { method: "PATCH", body: JSON.stringify(body) }),
  regenerateSharedGoalArt: (id: string) =>
    request<{ ok: boolean }>(`/api/parent/shared-goal/${id}/art/regenerate`, { method: "POST", body: "{}" }),
  patchGiving: (playerId: string, body: { givingEnabled?: boolean; giveCeiling?: number }) =>
    request<{ player: { id: string; name: string; givingEnabled: boolean; giveCeiling: number } }>(
      `/api/parent/players/${playerId}/giving`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  recommendations: () => request<RecommendationList>("/api/parent/recommendations"),
  recommendation: (id: string) => request<RecommendationDetail>(`/api/parent/recommendations/${id}`),
  applyRecommendations: (id: string, force?: boolean) =>
    request<RecommendationApplyResult>(`/api/parent/recommendations/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ force: Boolean(force) }),
    }),
  applyRecommendationChange: (id: string, changeId: string, body?: { force?: boolean; override?: number }) =>
    request<RecommendationApplyResult>(`/api/parent/recommendations/${id}/changes/${changeId}/apply`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  discussRecommendation: (id: string, message: string) =>
    request<RecommendationDiscussResult>(`/api/parent/recommendations/${id}/discuss`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
