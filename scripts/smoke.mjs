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
    body: body ? JSON.stringify(body) : method === "POST" || method === "PUT" ? "{}" : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${data.error || JSON.stringify(data)}`);
  }
  return { data, cookie: setCookie.map((c) => c.split(";")[0]).join("; ") };
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

async function harvestOccupied(plots, cookie) {
  for (const plot of plots) {
    if (plot.state === "empty") continue;
    try {
      await req(`/api/plots/${plot.slot}/harvest`, { method: "POST", cookie });
    } catch {
      /* not ready yet — skip */
    }
  }
}

let plots = enter.data.player.plots;
let empty = plots.find((p) => p.state === "empty");
if (!empty) {
  await harvestOccupied(plots, kidCookie);
  const garden = await req("/api/garden", { cookie: kidCookie });
  plots = garden.data.player.plots;
  empty = plots.find((p) => p.state === "empty");
}
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

const enter2 = await req(`/api/players/${willow.id}/enter`, { method: "POST", body: { pin: "1111" } });
const kidCookie2 = enter2.cookie;
console.log("re-entered after PIN reset");

const long = structuredClone((await req("/api/admin/config", { cookie: adminCookie })).data.config);
long.tiers = long.tiers.map((t) => (t.tier === 1 ? { ...t, durationMinutes: 120 } : t));
long.wateringCooldownMinutes = 0;
await req("/api/admin/config", { method: "PUT", body: { config: long }, cookie: adminCookie });

const garden = await req("/api/garden", { cookie: kidCookie2 });
const empty2 = garden.data.player.plots.find((p) => p.state === "empty");
if (!empty2) throw new Error("need a second empty plot for watering");
const planted2 = await req(`/api/plots/${empty2.slot}/plant`, {
  method: "POST",
  body: { tier: 1 },
  cookie: kidCookie2,
});
const before = planted2.data.player.plots.find((p) => p.slot === empty2.slot).remainingMs;
const watered = await req(`/api/plots/${empty2.slot}/water`, { method: "POST", cookie: kidCookie2 });
const after = watered.data.player.plots.find((p) => p.slot === empty2.slot).remainingMs;
if (after >= before) throw new Error(`watering did not reduce time (${before} -> ${after})`);
console.log("watering reduced remaining ms", before, "->", after);

await req(`/api/admin/players/${willow.id}/resources`, {
  method: "POST",
  body: { fertilizer: 1, moonDew: 1, growGoo: 1, phoenixAsh: 1, reason: "smoke mix" },
  cookie: adminCookie,
});
const fertilized = await req(`/api/plots/${empty2.slot}/fertilize`, { method: "POST", cookie: kidCookie2 });
const afterFert = fertilized.data.player.plots.find((p) => p.slot === empty2.slot).remainingMs;
if (afterFert >= after) throw new Error("fertilizer did not reduce time");
console.log("fertilizer reduced remaining ms", after, "->", afterFert);

try {
  const claimed = await req("/api/ingredients/claim", { method: "POST", cookie: kidCookie2 });
  console.log("claimed", claimed.data.claimed.name);
} catch (err) {
  console.log("claim skipped:", err.message);
}

const mixed = await req("/api/ingredients/mix", { method: "POST", cookie: kidCookie2 });
if (mixed.data.player.fertilizer < 1) throw new Error("mix did not produce fertilizer");
console.log("mixed fertilizer, pouch now", mixed.data.player.fertilizer);

await req("/api/admin/config/reset", { method: "POST", cookie: adminCookie });
console.log("restored default tunables");
console.log("SMOKE OK");
