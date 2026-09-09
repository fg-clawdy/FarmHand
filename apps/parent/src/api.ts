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

export type ParentKid = { id: string; name: string; mascot: string };

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

export const api = {
  login: (username: string, password: string) =>
    request<{ admin: { username: string } }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ admin: { username: string } }>("/api/parent/me"),
  logout: () => request("/api/admin/logout", { method: "POST" }),
  inbox: () => request<{ claims: InboxClaim[] }>("/api/parent/inbox"),
  approve: (id: string) =>
    request<{ ok: boolean; claims: InboxClaim[] }>(`/api/parent/claims/${id}/approve`, { method: "POST" }),
  deny: (id: string) =>
    request<{ ok: boolean; claims: InboxClaim[] }>(`/api/parent/claims/${id}/deny`, { method: "POST" }),
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
};
