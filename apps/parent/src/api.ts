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
};
