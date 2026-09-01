#!/usr/bin/env node
/**
 * End-to-end smoke against a running FarmHand stack (nginx or API).
 * Usage: BASE_URL=http://localhost node scripts/smoke.mjs
 */
const base = process.env.BASE_URL || "http://localhost";

async function req(path, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${data.error || JSON.stringify(data)}`);
  }
  return { data, cookie: setCookie.map((c) => c.split(";")[0]).join("; ") };
}

function jar(prev, next) {
  return [prev, next].filter(Boolean).join("; ");
}

const health = await req("/api/health");
if (health.data.status !== "ok") throw new Error("health failed");
console.log("health ok");

const login = await req("/api/admin/login", {
  method: "POST",
  body: { username: "admin", password: "farmhand-dev" },
});
let adminCookie = login.cookie;
console.log("admin login ok");

const players = await req("/api/admin/players", { cookie: adminCookie });
const willow = players.data.players.find((p) => p.name === "Willow");
if (!willow) throw new Error("Willow missing from seed");
console.log("seeded kids ok", players.data.players.map((p) => p.name).join(", "));

const configRes = await req("/api/admin/config", { cookie: adminCookie });
const fast = structuredClone(configRes.data.config);
fast.tiers = fast.tiers.map((t) => (t.tier === 1 ? { ...t, durationMinutes: 0 } : t));
fast.wateringCooldownMinutes = 0;
await req("/api/admin/config", { method: "PUT", body: { config: fast }, cookie: adminCookie });
console.log("set T1 duration to 0 minutes");

const enter = await req(`/api/players/${willow.id}/enter`, { method: "POST", body: { pin: "1111" } });
const kidCookie = enter.cookie;
console.log("willow PIN session ok");

const empty = enter.data.player.plots.find((p) => p.state === "empty");
if (!empty) throw new Error("no empty plot");
const planted = await req(`/api/plots/${empty.slot}/plant`, {
  method: "POST",
  body: { tier: 1 },
  cookie: kidCookie,
});
const growing = planted.data.player.plots.find((p) => p.slot === empty.slot);
if (!growing?.ready) throw new Error(`expected immediate READY, got ${JSON.stringify(growing)}`);
console.log("plant matured immediately after tunable change");

const harvest = await req(`/api/plots/${empty.slot}/harvest`, { method: "POST", cookie: kidCookie });
if (harvest.data.reward.points < 1) throw new Error("harvest reward missing");
if (harvest.data.player.plots.find((p) => p.slot === empty.slot).state !== "empty") {
  throw new Error("plot did not clear");
}
console.log("harvest + seed return ok", harvest.data.reward);

await req(`/api/admin/players/${willow.id}/reset-pin`, {
  method: "POST",
  body: { pin: "1111" },
  cookie: adminCookie,
});
console.log("admin reset PIN ok");

const overview = await req("/api/admin/overview", { cookie: adminCookie });
console.log("overview", overview.data);

await req("/api/admin/config/reset", { method: "POST", cookie: adminCookie });
console.log("restored default tunables");
console.log("SMOKE OK");
