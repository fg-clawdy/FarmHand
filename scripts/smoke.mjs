#!/usr/bin/env node
/**
 * End-to-end smoke against a running FarmHand stack (nginx or API).
 * Usage:
 *   BASE_URL=http://localhost node scripts/smoke.mjs
 *   BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs   # Compose with HTTP_PORT=8080
 */
const base = process.env.BASE_URL || "http://localhost";
const CROP_KINDS = ["corn", "strawberry", "cotton"];
const SERIES_KEYS = ["harvests", "waterings", "logins", "plants"];
const ECONOMY_KEYS = [
  "plants",
  "harvests",
  "waterings",
  "logins",
  "fertilizerUses",
  "pointsAwarded",
  "seedsSpent",
  "seedsReturned",
  "netSeeds",
];

function assertCropMix(mix, label) {
  if (!mix || typeof mix.total !== "number") {
    throw new Error(`${label} missing total`);
  }
  for (const kind of CROP_KINDS) {
    if (typeof mix.counts?.[kind] !== "number") {
      throw new Error(`${label} missing counts.${kind}`);
    }
    if (typeof mix.pct?.[kind] !== "number") {
      throw new Error(`${label} missing pct.${kind}`);
    }
  }
}

function assertEconomy(economy, label) {
  for (const key of ECONOMY_KEYS) {
    if (typeof economy?.[key] !== "number") {
      throw new Error(`${label} missing economy.${key}`);
    }
  }
}

function assertWindow(window, label) {
  assertCropMix(window?.cropMixPlanted, `${label}.cropMixPlanted`);
  assertCropMix(window?.cropMixHarvested, `${label}.cropMixHarvested`);
  assertEconomy(window?.economy, label);
}

function assertFlatEconomy(config, label) {
  if (!config?.tiers?.length) throw new Error(`${label} missing tiers`);
  if (config.harvestSeedReturn !== 1) {
    throw new Error(`${label} harvestSeedReturn expected 1, got ${config.harvestSeedReturn}`);
  }
  for (const tier of config.tiers) {
    if (tier.seedCost !== 1 || tier.durationMinutes !== 24 * 60 || tier.points !== 25) {
      throw new Error(
        `${label} tier ${tier.tier} expected 1 seed / 1440 min / 25★, got ${tier.seedCost}/${tier.durationMinutes}/${tier.points}`,
      );
    }
  }
}

function assertSeries(series, days) {
  if (!Array.isArray(series) || series.length !== days) {
    throw new Error(`stats series expected ${days} days, got ${series?.length}`);
  }
  for (const [index, row] of series.entries()) {
    if (typeof row?.day !== "string" || !row.day) {
      throw new Error(`stats series[${index}] missing day`);
    }
    for (const key of SERIES_KEYS) {
      if (typeof row[key] !== "number") {
        throw new Error(`stats series[${index}] missing ${key}`);
      }
    }
  }
}

function stubJpeg(width = 320, height = 240) {
  const sof = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
  ]);
  return Buffer.concat([sof, Buffer.alloc(Math.max(0, 800 - sof.length), 0)]);
}

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

await req("/api/admin/config/reset", { method: "POST", cookie: adminCookie });

const players = await req("/api/admin/players", { cookie: adminCookie });
const willow = players.data.players.find((p) => p.name === "Willow");
if (!willow) throw new Error("Willow missing from seed");
console.log("seeded kids ok", players.data.players.map((p) => p.name).join(", "));

const configRes = await req("/api/admin/config", { cookie: adminCookie });
assertFlatEconomy(configRes.data.defaults, "admin config defaults");
assertFlatEconomy(configRes.data.config, "live config");
const fast = structuredClone(configRes.data.config);
fast.tiers = fast.tiers.map((t) => (t.tier === 1 ? { ...t, durationMinutes: 0 } : t));
fast.wateringCooldownMinutes = 0;
fast.wateringMaxPerDay = 99;
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

async function ensureEmptySlots(cookie, adminCookie, needed) {
  let garden = (await req("/api/garden", { cookie })).data.player;
  let empties = garden.plots.filter((p) => p.state === "empty");
  if (empties.length >= needed) return garden;
  await harvestOccupied(garden.plots, cookie);
  garden = (await req("/api/garden", { cookie })).data.player;
  empties = garden.plots.filter((p) => p.state === "empty");
  if (empties.length >= needed) return garden;
  const cfgRes = await req("/api/admin/config", { cookie: adminCookie });
  const saved = structuredClone(cfgRes.data.config);
  const fast = structuredClone(saved);
  fast.tiers = fast.tiers.map((t) => ({ ...t, durationMinutes: 0 }));
  await req("/api/admin/config", { method: "PUT", body: { config: fast }, cookie: adminCookie });
  garden = (await req("/api/garden", { cookie })).data.player;
  await harvestOccupied(garden.plots, cookie);
  await req("/api/admin/config", { method: "PUT", body: { config: saved }, cookie: adminCookie });
  return (await req("/api/garden", { cookie })).data.player;
}

let plots = enter.data.player.plots;
if (plots.length !== 9) throw new Error(`expected 9 garden plots, got ${plots.length}`);
const backRow = plots.find((p) => p.slot === 8 && p.state === "empty") ?? plots.find((p) => p.state === "empty");
let empty = backRow;
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
const reward = harvest.data.reward;
if (typeof reward?.points !== "number" || reward.points !== 25) {
  throw new Error(`harvest reward.points expected 25, got ${JSON.stringify(reward)}`);
}
if (typeof reward?.seedsReturned !== "number" || reward.seedsReturned !== 1) {
  throw new Error(`harvest reward.seedsReturned expected 1, got ${JSON.stringify(reward)}`);
}
if (harvest.data.player.points !== planted.data.player.points + 25) {
  throw new Error(
    `harvest should grant 25★ only (no badge payout), ${planted.data.player.points} -> ${harvest.data.player.points}`,
  );
}
if (harvest.data.player.seeds !== planted.data.player.seeds + 1) {
  throw new Error(
    `harvest should grant 1 seed only (no badge payout), ${planted.data.player.seeds} -> ${harvest.data.player.seeds}`,
  );
}
if (harvest.data.player.plots.find((p) => p.slot === empty.slot).state !== "empty") {
  throw new Error("plot did not clear");
}
console.log("harvest +stars/+seeds ok", reward);

function legend(ledger, slug) {
  return ledger.lifetime.legends.find((row) => row.slug === slug);
}
function track(ledger, slug) {
  return ledger.seasonal.tracks.find((row) => row.slug === slug);
}

async function readAccolades(cookie) {
  return (await req("/api/accolades", { cookie })).data;
}

let badges = await readAccolades(kidCookie);
if (!legend(badges, "first-harvest")?.earned) {
  throw new Error("First Harvest should be earned after one harvest");
}
if (
  !badges.lifetime.unlocks.some((u) => u.slug === "first-harvest") &&
  !(harvest.data.unlocks ?? []).some((u) => u.slug === "first-harvest")
) {
  throw new Error("First Harvest unlock row missing from ledger");
}
if (legend(badges, "homestead-helper")?.earned && legend(badges, "homestead-helper").count < 500) {
  throw new Error("Homestead Helper awarded before 500 waters");
}

let harvestMedalGuard = 0;
while ((track(badges, "harvests")?.count ?? 0) < 10) {
  if (++harvestMedalGuard > 16) throw new Error("could not reach Harvester bronze in 16 harvests");
  const gardenNow = (await req("/api/garden", { cookie: kidCookie })).data.player;
  if (gardenNow.seeds < 1) {
    await req(`/api/admin/players/${willow.id}/resources`, {
      method: "POST",
      body: { seeds: 8, reason: "smoke harvester bronze" },
      cookie: adminCookie,
    });
  }
  let slot = gardenNow.plots.find((p) => p.state === "empty")?.slot;
  if (slot == null) {
    await harvestOccupied(gardenNow.plots, kidCookie);
    slot = (await req("/api/garden", { cookie: kidCookie })).data.player.plots.find((p) => p.state === "empty")?.slot;
  }
  if (slot == null) throw new Error("no empty plot to reach Harvester bronze");
  const morePlant = await req(`/api/plots/${slot}/plant`, { method: "POST", body: { tier: 1 }, cookie: kidCookie });
  const moreHarvest = await req(`/api/plots/${slot}/harvest`, { method: "POST", cookie: kidCookie });
  if (moreHarvest.data.reward?.points !== 25 || moreHarvest.data.reward?.seedsReturned !== 1) {
    throw new Error(`badge harvest still must pay 25★/1 seed, got ${JSON.stringify(moreHarvest.data.reward)}`);
  }
  if (moreHarvest.data.player.points !== morePlant.data.player.points + 25) {
    throw new Error("Harvester bronze path granted extra stars");
  }
  badges = await readAccolades(kidCookie);
}
if (!track(badges, "harvests")?.medals.includes("bronze")) {
  throw new Error(`expected Harvester bronze at 10 harvests, got ${JSON.stringify(track(badges, "harvests"))}`);
}
const parentBadges = await req("/api/parent/accolades", { cookie: adminCookie });
const willowParent = parentBadges.data.kids.find((k) => k.name === "Willow");
if (!willowParent?.lifetime.legends.find((row) => row.slug === "first-harvest")?.earned) {
  throw new Error("parent accolades missing Willow First Harvest");
}
const adminBadges = await req("/api/admin/accolades", { cookie: adminCookie });
const willowAdmin = adminBadges.data.kids.find((k) => k.name === "Willow");
if (!willowAdmin?.seasonal.tracks.find((row) => row.slug === "harvests")?.medals.includes("bronze")) {
  throw new Error("admin accolades missing Willow Harvester bronze");
}
console.log("accolades First Harvest + Harvester bronze, no payout ok");

await req(`/api/admin/players/${willow.id}/reset-pin`, {
  method: "POST",
  body: { pin: "1111" },
  cookie: adminCookie,
});
console.log("admin reset PIN ok");

const overview = await req("/api/admin/overview", { cookie: adminCookie });
console.log("overview", overview.data);

const stats = await req("/api/admin/stats?days=14", { cookie: adminCookie });
assertSeries(stats.data.series, 14);
assertCropMix(stats.data.cropMixPlanted, "stats.cropMixPlanted");
assertCropMix(stats.data.cropMixHarvested, "stats.cropMixHarvested");
assertCropMix(stats.data.cropMixInGround, "stats.cropMixInGround");
console.log("stats crop mix planted", stats.data.cropMixPlanted);

const goalsGet = await req("/api/admin/balance-goals", { cookie: adminCookie });
const seededGoals = String(goalsGet.data.goals ?? "").trim();
if (!seededGoals) {
  throw new Error(`expected non-empty balance goals, got ${JSON.stringify(goalsGet.data.goals)}`);
}
if (!seededGoals.includes("short daily sessions")) {
  throw new Error(`expected seeded north-star goals, got ${JSON.stringify(goalsGet.data.goals)}`);
}
const edited = "Kids should try all three crops.";
await req("/api/admin/balance-goals", { method: "PUT", body: { goals: edited }, cookie: adminCookie });
const goalsPut = await req("/api/admin/balance-goals", { cookie: adminCookie });
if (goalsPut.data.goals !== edited) throw new Error("balance goals did not persist");
const snap = await req("/api/admin/balance-snapshot", { cookie: adminCookie });
if (snap.data.goals !== edited) throw new Error("snapshot goals stale");
if (!Array.isArray(snap.data.knobs?.tiers) || snap.data.knobs.tiers.length < 1) {
  throw new Error("snapshot missing knobs.tiers");
}
if (typeof snap.data.knobs.harvestSeedReturn !== "number" || typeof snap.data.knobs.plotCount !== "number") {
  throw new Error("snapshot knobs missing harvestSeedReturn or plotCount");
}
assertWindow(snap.data.windows?.["7d"], "snapshot.windows.7d");
assertWindow(snap.data.windows?.["30d"], "snapshot.windows.30d");
await req("/api/admin/balance-goals", {
  method: "PUT",
  body: { goals: goalsGet.data.goals },
  cookie: adminCookie,
});
console.log("balance goals + snapshot ok");

const enter2 = await req(`/api/players/${willow.id}/enter`, { method: "POST", body: { pin: "1111" } });
const kidCookie2 = enter2.cookie;
console.log("re-entered after PIN reset");

const long = structuredClone((await req("/api/admin/config", { cookie: adminCookie })).data.config);
long.tiers = long.tiers.map((t) => (t.tier === 1 ? { ...t, durationMinutes: 120 } : t));
long.wateringCooldownMinutes = 0;
long.wateringMaxPerDay = 99;
await req("/api/admin/config", { method: "PUT", body: { config: long }, cookie: adminCookie });

const garden = await req("/api/garden", { cookie: kidCookie2 });
const empty2 = garden.data.player.plots.find((p) => p.state === "empty");
if (!empty2) throw new Error("need a second empty plot for watering");
const planted2 = await req(`/api/plots/${empty2.slot}/plant`, {
  method: "POST",
  body: { tier: 1 },
  cookie: kidCookie2,
});
const selfieStatus = await req("/api/selfie", { cookie: kidCookie2 });
if (!selfieStatus.data.unlocked) {
  try {
    await req(`/api/plots/${empty2.slot}/water`, { method: "POST", cookie: kidCookie2 });
    throw new Error("water should fail without today's selfie");
  } catch (err) {
    if (!String(err.message).includes("selfie")) {
      throw err;
    }
  }
  console.log("water rejected without selfie unlock");
}

const seedsBeforeSelfie = planted2.data.player.seeds;
const jpeg = `data:image/jpeg;base64,${stubJpeg().toString("base64")}`;
const firstSelfie = await req("/api/selfie", { method: "POST", body: { image: jpeg }, cookie: kidCookie2 });
if (!firstSelfie.data.unlocked) throw new Error("selfie did not unlock watering");
if (!selfieStatus.data.unlocked && !firstSelfie.data.seedGranted) {
  throw new Error("first selfie of the day should grant +1 seed");
}
if (!selfieStatus.data.unlocked && firstSelfie.data.player.seeds !== seedsBeforeSelfie + 1) {
  throw new Error(`expected +1 seed, ${seedsBeforeSelfie} -> ${firstSelfie.data.player.seeds}`);
}
if (firstSelfie.data.reward?.points) throw new Error("selfie must not grant stars");
const secondSelfie = await req("/api/selfie", { method: "POST", body: { image: jpeg }, cookie: kidCookie2 });
if (secondSelfie.data.seedGranted) throw new Error("second selfie same day stacked a seed");
if (secondSelfie.data.player.seeds !== firstSelfie.data.player.seeds) {
  throw new Error("second selfie changed seed count");
}
console.log("selfie unlock + one seed per Chicago day ok");

const before = firstSelfie.data.player.plots.find((p) => p.slot === empty2.slot).remainingMs;
const watered = await req(`/api/plots/${empty2.slot}/water`, { method: "POST", cookie: kidCookie2 });
const after = watered.data.player.plots.find((p) => p.slot === empty2.slot).remainingMs;
if (after >= before) throw new Error(`watering did not reduce time (${before} -> ${after})`);
console.log("watering reduced remaining ms", before, "->", after);

const afterWaterBadges = await readAccolades(kidCookie2);
const helper = legend(afterWaterBadges, "homestead-helper");
if (!helper) throw new Error("Homestead Helper missing from lifetime legends");
if (helper.count < 500 && helper.earned) {
  throw new Error(`Homestead Helper awarded early at ${helper.count} waters`);
}
if (
  helper.count < 500 &&
  afterWaterBadges.lifetime.unlocks.some((u) => u.slug === "homestead-helper")
) {
  throw new Error("Homestead Helper unlock row present under 500 waters");
}
console.log("Homestead Helper still locked at", helper.count, "waters");

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

const catalog = await req("/api/parent/chores", { cookie: adminCookie });
if (catalog.data.chores?.length < 21) {
  throw new Error(`expected at least 21 seeded chores, got ${catalog.data.chores?.length}`);
}
const clothes = catalog.data.chores.find((c) => c.slug === "set-out-school-clothes");
if (!clothes || clothes.isActive) throw new Error("Set Out School Clothes should be seeded inactive");
if (!Array.isArray(clothes.assignments) || clothes.seedGrant !== 1) {
  throw new Error("parent chore list should include assignments and seedGrant 1");
}
if (catalog.data.chores[0]?.priority !== "CRITICAL") {
  throw new Error(`parent chore list should put CRITICAL first, got ${catalog.data.chores[0]?.slug}`);
}
const dogs = catalog.data.chores.filter((c) => ["feed-dog-am", "feed-dog-pm", "walk-the-dog"].includes(c.slug));
if (dogs.length !== 3 || dogs.some((c) => c.priority !== "CRITICAL" || c.assignmentMode !== "RACE")) {
  throw new Error("dog chores should be CRITICAL races");
}
console.log("chore catalog 21 ok");
// Player UI Job Board (Chores toolbar) still claims via this API: 1 purgatory plant, no pouch spend.

const parentKids = await req("/api/parent/kids", { cookie: adminCookie });
const kidNames = (parentKids.data.kids ?? []).map((k) => k.name).sort();
if (!["Finn", "Sage", "Willow"].every((name) => kidNames.includes(name))) {
  throw new Error(`parent kids missing demo names, got ${kidNames.join(",")}`);
}
const willowKid = parentKids.data.kids.find((k) => k.name === "Willow");
await req(`/api/parent/chores/${clothes.id}`, {
  method: "PATCH",
  cookie: adminCookie,
  body: { isActive: true },
});
const clothesOn = (await req("/api/parent/chores", { cookie: adminCookie })).data.chores.find(
  (c) => c.slug === "set-out-school-clothes",
);
if (!clothesOn?.isActive) throw new Error("parent PATCH should turn Set Out School Clothes on");
await req(`/api/parent/chores/${clothes.id}`, {
  method: "PATCH",
  cookie: adminCookie,
  body: { isActive: false, assignmentMode: "SPECIFIC", assignedPlayerIds: [willowKid.id] },
});
const clothesAssigned = (await req("/api/parent/chores", { cookie: adminCookie })).data.chores.find(
  (c) => c.slug === "set-out-school-clothes",
);
if (clothesAssigned?.isActive) throw new Error("parent PATCH should restore clothes inactive");
if (clothesAssigned?.assignmentMode !== "SPECIFIC" || clothesAssigned.assignedPlayerIds?.[0] !== willowKid.id) {
  throw new Error("parent PATCH should assign clothes to Willow only");
}
await req(`/api/parent/chores/${clothes.id}`, {
  method: "PATCH",
  cookie: adminCookie,
  body: { assignmentMode: "ALL", assignedPlayerIds: [] },
});
const weekStats = await req("/api/parent/stats?range=week", { cookie: adminCookie });
if (weekStats.data.range !== "week" || !Array.isArray(weekStats.data.kids) || weekStats.data.kids.length < 3) {
  throw new Error("parent stats week missing kids");
}
const willowStats = weekStats.data.kids.find((k) => k.name === "Willow");
if (
  typeof willowStats?.claims !== "number" ||
  typeof willowStats?.approvals !== "number" ||
  typeof willowStats?.denials !== "number" ||
  typeof willowStats?.streak !== "number" ||
  willowStats.series?.length !== 7
) {
  throw new Error("parent stats week shape is wrong");
}
const monthStats = await req("/api/parent/stats?range=month", { cookie: adminCookie });
if (monthStats.data.kids?.[0]?.series?.length !== 30) {
  throw new Error("parent stats month should be 30 days");
}
console.log("parent chore CRUD + stats ok");

const pushCfg = await req("/api/parent/push/config", { cookie: adminCookie });
const fakePush = `https://push.example.test/farmhand-smoke-${Date.now()}`;
await req("/api/parent/push/subscribe", {
  method: "POST",
  cookie: adminCookie,
  body: {
    endpoint: fakePush,
    keys: { p256dh: "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", auth: "AAAAAAAAAAAAAAAAAAAAAA" },
  },
});
const pushOn = await req("/api/parent/push/config", { cookie: adminCookie });
if (!pushOn.data.subscribed) throw new Error("parent push subscribe did not stick");
await req("/api/parent/push/unsubscribe", { method: "POST", cookie: adminCookie, body: { endpoint: fakePush } });
const pushOff = await req("/api/parent/push/config", { cookie: adminCookie });
console.log(
  "parent push subscribe/unsubscribe ok; vapid enabled",
  Boolean(pushCfg.data.enabled),
  "other parent devices still subscribed",
  Boolean(pushOff.data.subscribed),
);

await ensureEmptySlots(kidCookie2, adminCookie, 2);
let kidList = await req("/api/chores", { cookie: kidCookie2 });
const bed =
  kidList.data.chores.find((c) => c.slug === "make-your-bed" && c.eligible) ??
  kidList.data.chores.find((c) => c.eligible && c.assignmentMode === "ALL");
if (!bed) throw new Error("Willow should have an eligible ALL chore to claim");
const emptyChore = kidList.data.emptySlots?.[0];
if (emptyChore == null) throw new Error("Willow needs an empty plot for a chore claim");
const seedsBeforeClaim = kidList.data.player.seeds;
const claimed = await req(`/api/chores/${bed.id}/claim`, {
  method: "POST",
  body: { slot: emptyChore, tier: 1 },
  cookie: kidCookie2,
});
const waiting = claimed.data.player.plots.find((p) => p.slot === emptyChore);
if (waiting?.state !== "purgatory" || waiting.ready) {
  throw new Error(`expected purgatory plant, got ${JSON.stringify(waiting)}`);
}
if (claimed.data.player.seeds !== seedsBeforeClaim) {
  throw new Error("chore claim must not spend pouch seeds");
}
if (claimed.data.player.points !== kidList.data.player.points) {
  throw new Error("chore claim must not grant stars");
}
try {
  await req(`/api/plots/${emptyChore}/water`, { method: "POST", cookie: kidCookie2 });
  throw new Error("purgatory plant should reject water");
} catch (err) {
  if (!String(err.message).includes("grown-up") && !String(err.message).includes("waiting")) {
    throw err;
  }
}
console.log("claim planted purgatory; water blocked");

const inbox = await req("/api/parent/inbox", { cookie: adminCookie });
const pendingBed = inbox.data.claims.find((c) => c.id === claimed.data.claim.id);
if (!pendingBed) throw new Error("parent inbox missing pending claim");
await req(`/api/parent/claims/${claimed.data.claim.id}/approve`, { method: "POST", cookie: adminCookie });
try {
  await req(`/api/parent/claims/${claimed.data.claim.id}/approve`, { method: "POST", cookie: adminCookie });
  throw new Error("second approve should be rejected as already-resolved");
} catch (err) {
  if (!String(err.message).toLowerCase().includes("already")) throw err;
}
const afterApprove = await req("/api/garden", { cookie: kidCookie2 });
const growingChore = afterApprove.data.player.plots.find((p) => p.slot === emptyChore);
if (growingChore?.state !== "growing" || !growingChore.plantedAt) {
  throw new Error(`approve should start growth, got ${JSON.stringify(growingChore)}`);
}
try {
  await req(`/api/chores/${bed.id}/claim`, {
    method: "POST",
    body: { slot: afterApprove.data.player.plots.find((p) => p.state === "empty")?.slot ?? emptyChore, tier: 1 },
    cookie: kidCookie2,
  });
  throw new Error("double-claim same period should fail");
} catch (err) {
  if (!String(err.message).toLowerCase().includes("already")) throw err;
}
console.log("approve started growth; same-period claim blocked");

const raceChore =
  kidList.data.chores.find((c) => c.slug === "feed-dog-am" && c.eligible) ??
  kidList.data.chores.find((c) => ["feed-dog-pm", "walk-the-dog"].includes(c.slug) && c.eligible) ??
  (await req("/api/chores", { cookie: kidCookie2 })).data.chores.find((c) => c.assignmentMode === "RACE" && c.eligible);
if (!raceChore) throw new Error("no eligible dog/race chore for the race test");
const emptyRace = afterApprove.data.player.plots.find((p) => p.state === "empty");
if (!emptyRace) throw new Error("need an empty plot for race claim");
const raceClaim = await req(`/api/chores/${raceChore.id}/claim`, {
  method: "POST",
  body: { slot: emptyRace.slot, tier: 1 },
  cookie: kidCookie2,
});
if (raceClaim.data.player.plots.find((p) => p.slot === emptyRace.slot)?.state !== "purgatory") {
  throw new Error("race claim should plant purgatory");
}

const finn = players.data.players.find((p) => p.name === "Finn");
if (!finn) throw new Error("Finn missing");
const finnEnter = await req(`/api/players/${finn.id}/enter`, { method: "POST", body: { pin: "2222" } });
const finnEmpty = finnEnter.data.player.plots.find((p) => p.state === "empty");
try {
  await req(`/api/chores/${raceChore.id}/claim`, {
    method: "POST",
    body: { slot: finnEmpty?.slot ?? 0, tier: 1 },
    cookie: finnEnter.cookie,
  });
  throw new Error("second kid should not win the same race period");
} catch (err) {
  if (!String(err.message).toLowerCase().includes("already") && !String(err.message).toLowerCase().includes("someone")) {
    throw err;
  }
}
console.log("race double-claim blocked");

const inbox2 = await req("/api/parent/inbox", { cookie: adminCookie });
const first = inbox2.data.claims[0];
if (first && first.chore.priority !== "CRITICAL") {
  throw new Error(`CRITICAL claims should sort first, got ${first.chore.slug} ${first.chore.priority}`);
}
const seedsBeforeDeny = raceClaim.data.player.seeds;
await req(`/api/parent/claims/${raceClaim.data.claim.id}/deny`, { method: "POST", cookie: adminCookie });
const afterDeny = await req("/api/garden", { cookie: kidCookie2 });
const wilted = afterDeny.data.player.plots.find((p) => p.slot === emptyRace.slot);
if (wilted?.state !== "wilted") throw new Error(`deny should wilt, got ${JSON.stringify(wilted)}`);
const pruned = await req(`/api/plots/${emptyRace.slot}/prune`, { method: "POST", cookie: kidCookie2 });
const cleared = pruned.data.player.plots.find((p) => p.slot === emptyRace.slot);
if (cleared?.state !== "empty") throw new Error("prune should empty the plot");
if (pruned.data.player.seeds !== seedsBeforeDeny) throw new Error("prune must not return a seed");
if (pruned.data.player.points !== raceClaim.data.player.points) throw new Error("deny/prune must not grant stars");
console.log("deny → wilt → prune, no seed return");

const leftoverStore = await req("/api/parent/store", { cookie: adminCookie });
for (const row of leftoverStore.data.redemptions ?? []) {
  try {
    await req(`/api/parent/redemptions/${row.id}/deny`, { method: "POST", cookie: adminCookie });
  } catch {
    /* already resolved */
  }
}
const iceRow = leftoverStore.data.skus.find((s) => s.slug === "ice-cream");
if (iceRow) {
  await req(`/api/parent/store/skus/${iceRow.id}`, {
    method: "PATCH",
    body: { starCost: 500, isActive: true },
    cookie: adminCookie,
  });
}

const beforeSet = await req("/api/store", { cookie: kidCookie2 });
const harvestBeforeSet = beforeSet.data.lifetimeEarnedHarvest ?? 0;
await req(`/api/admin/players/${willow.id}/resources`, {
  method: "POST",
  body: { points: 800, reason: "smoke store stars" },
  cookie: adminCookie,
});
const parentStore = await req("/api/parent/store", { cookie: adminCookie });
if (!Array.isArray(parentStore.data.skus) || parentStore.data.skus.length < 5) {
  throw new Error(`starter catalog should have 5 SKUs, got ${parentStore.data.skus?.length}`);
}
const ice = parentStore.data.skus.find((s) => s.slug === "ice-cream");
if (!ice || ice.starCost !== 500) throw new Error("ice cream SKU missing or not 500★");
const storeOpen = await req("/api/store", { cookie: kidCookie2 });
if (storeOpen.data.points !== 800) {
  throw new Error(`expected 800 points after SET, got ${storeOpen.data.points}`);
}
if (storeOpen.data.availableStars !== 800 || storeOpen.data.starsHeld !== 0) {
  throw new Error(`expected 800 available / 0 held, got ${JSON.stringify(storeOpen.data)}`);
}
if (storeOpen.data.lifetimeEarnedHarvest !== harvestBeforeSet) {
  throw new Error(
    `SET must not bump harvest earned (${harvestBeforeSet} → ${storeOpen.data.lifetimeEarnedHarvest})`,
  );
}
const iceCard = storeOpen.data.catalog.find((s) => s.slug === "ice-cream");
if (!iceCard?.affordable) throw new Error("ice cream should be affordable at 800★");

const requested = await req("/api/store/request", {
  method: "POST",
  body: { skuId: ice.id },
  cookie: kidCookie2,
});
if (requested.data.points !== 800) throw new Error("request must not spend points yet");
if (requested.data.starsHeld !== 500) throw new Error(`held expected 500, got ${requested.data.starsHeld}`);
if (requested.data.availableStars !== 300) {
  throw new Error(`available expected 300, got ${requested.data.availableStars}`);
}
if (!requested.data.pending?.some((r) => r.status === "pending" && r.starCost === 500)) {
  throw new Error("pending ice cream missing after request");
}
try {
  await req("/api/store/request", {
    method: "POST",
    body: { skuId: ice.id },
    cookie: kidCookie2,
  });
  throw new Error("second ice cream should be unaffordable");
} catch (err) {
  const msg = String(err.message).toLowerCase();
  if (!msg.includes("enough") && !msg.includes("stars")) throw err;
}

const inboxStore = await req("/api/parent/inbox", { cookie: adminCookie });
const pendingIce = inboxStore.data.redemptions?.find((r) => r.id === requested.data.redemption.id);
if (!pendingIce) throw new Error("inbox missing pending store redemption");
await req(`/api/parent/redemptions/${requested.data.redemption.id}/deny`, {
  method: "POST",
  cookie: adminCookie,
});
const afterStoreDeny = await req("/api/store", { cookie: kidCookie2 });
if (afterStoreDeny.data.points !== 800) throw new Error("deny must not spend points");
if (afterStoreDeny.data.starsHeld !== 0 || afterStoreDeny.data.availableStars !== 800) {
  throw new Error(`deny should release the hold, got held=${afterStoreDeny.data.starsHeld} available=${afterStoreDeny.data.availableStars}`);
}

const requested2 = await req("/api/store/request", {
  method: "POST",
  body: { skuId: ice.id },
  cookie: kidCookie2,
});
await req(`/api/parent/redemptions/${requested2.data.redemption.id}/fulfill`, {
  method: "POST",
  cookie: adminCookie,
});
const afterStoreApprove = await req("/api/store", { cookie: kidCookie2 });
if (afterStoreApprove.data.points !== 300) {
  throw new Error(`approve should spend 500, points 300, got ${afterStoreApprove.data.points}`);
}
if (afterStoreApprove.data.points < 0) throw new Error("balance went negative");
if (afterStoreApprove.data.starsHeld !== 0 || afterStoreApprove.data.availableStars !== 300) {
  throw new Error(`expected 0 held / 300 available after approve, got ${JSON.stringify(afterStoreApprove.data)}`);
}
if (!afterStoreApprove.data.owned?.some((r) => r.id === requested2.data.redemption.id && r.status === "owned")) {
  throw new Error("owned ice cream missing after approve");
}
try {
  await req(`/api/parent/redemptions/${requested2.data.redemption.id}/approve`, {
    method: "POST",
    cookie: adminCookie,
  });
  throw new Error("second approve should be rejected");
} catch (err) {
  if (!String(err.message).toLowerCase().includes("already")) throw err;
}

const willowGarden = await req("/api/garden", { cookie: kidCookie2 });
const willowProfile = await req("/api/profile", { cookie: kidCookie2 });
if (willowProfile.data.pouch?.seeds !== willowGarden.data.player.seeds) {
  throw new Error("profile pouch seeds must match garden HUD");
}
if (willowProfile.data.pouch?.fertilizer !== willowGarden.data.player.fertilizer) {
  throw new Error("profile pouch fertilizer must match garden HUD");
}
if (willowProfile.data.wallet.availableStars !== 300) {
  throw new Error(`profile available expected 300 after ice cream, got ${willowProfile.data.wallet.availableStars}`);
}
if (willowProfile.data.wallet.lifetimeEarned !== afterStoreApprove.data.lifetimeEarned) {
  throw new Error("profile lifetime earned should match store wallet");
}
if (willowProfile.data.wallet.lifetimeEarned !== storeOpen.data.lifetimeEarned) {
  throw new Error("buying ice cream must not change lifetime earned");
}
if (!willowProfile.data.rewards.owned?.some((r) => r.id === requested2.data.redemption.id)) {
  throw new Error("profile owned missing ice cream");
}
if (!willowProfile.data.accolades?.seasonal) throw new Error("profile accolades missing");

await req(`/api/parent/redemptions/${requested2.data.redemption.id}/redeem`, {
  method: "POST",
  cookie: adminCookie,
});
const afterRedeem = await req("/api/profile", { cookie: kidCookie2 });
if (!afterRedeem.data.rewards.redeemed?.some((r) => r.id === requested2.data.redemption.id)) {
  throw new Error("profile redeemed missing ice cream");
}
if (afterRedeem.data.rewards.owned?.some((r) => r.id === requested2.data.redemption.id)) {
  throw new Error("redeemed ice cream should leave owned");
}
try {
  await req(`/api/parent/redemptions/${requested2.data.redemption.id}/redeem`, {
    method: "POST",
    cookie: adminCookie,
  });
  throw new Error("second redeem should be rejected");
} catch (err) {
  if (!String(err.message).toLowerCase().includes("already")) throw err;
}

const leftoverFinn = await req("/api/parent/store", { cookie: adminCookie });
for (const row of leftoverFinn.data.pending ?? leftoverFinn.data.redemptions ?? []) {
  if (row.player?.id !== finn.id && row.playerId !== finn.id) continue;
  try {
    await req(`/api/parent/redemptions/${row.id}/deny`, { method: "POST", cookie: adminCookie });
  } catch {
    /* already resolved */
  }
}
const finnShop = await req(`/api/players/${finn.id}/enter`, { method: "POST", body: { pin: "2222" } });
const finnCookie = finnShop.cookie;
const finnBeforeGrant = await req("/api/store", { cookie: finnCookie });
await req(`/api/admin/players/${finn.id}/grant-stars`, {
  method: "POST",
  body: { amount: 2100, reason: "smoke lifetime earn" },
  cookie: adminCookie,
});
const finnAfterGrant = await req("/api/store", { cookie: finnCookie });
if (finnAfterGrant.data.lifetimeEarned !== (finnBeforeGrant.data.lifetimeEarned ?? 0) + 2100) {
  throw new Error(
    `grant 2100 should bump lifetime earned, ${finnBeforeGrant.data.lifetimeEarned} → ${finnAfterGrant.data.lifetimeEarned}`,
  );
}
if (finnAfterGrant.data.availableStars !== (finnBeforeGrant.data.availableStars ?? 0) + 2100) {
  throw new Error("grant 2100 should add available stars");
}
const dateNight = leftoverFinn.data.skus.find((s) => s.slug === "date-night");
const movieNight = leftoverFinn.data.skus.find((s) => s.slug === "movie-night");
if (!dateNight || !movieNight) throw new Error("date night / movie night SKUs missing");
const dateReq = await req("/api/store/request", {
  method: "POST",
  body: { skuId: dateNight.id },
  cookie: finnCookie,
});
if (dateReq.data.starsHeld !== 2000) throw new Error("date night should hold 2000");
if (dateReq.data.availableStars !== finnAfterGrant.data.availableStars - 2000) {
  throw new Error("date night hold should drop available by 2000");
}
if (dateReq.data.lifetimeEarned !== finnAfterGrant.data.lifetimeEarned) {
  throw new Error("hold must not change lifetime earned");
}
await req(`/api/parent/redemptions/${dateReq.data.redemption.id}/approve`, {
  method: "POST",
  cookie: adminCookie,
});
const afterDate = await req("/api/store", { cookie: finnCookie });
if (afterDate.data.availableStars !== finnAfterGrant.data.availableStars - 2000) {
  throw new Error(`after date night approve, available should be reduced once, got ${afterDate.data.availableStars}`);
}
if (afterDate.data.lifetimeEarned !== finnAfterGrant.data.lifetimeEarned) {
  throw new Error("approve must not change lifetime earned");
}
if (!afterDate.data.owned?.some((r) => r.id === dateReq.data.redemption.id && r.status === "owned")) {
  throw new Error("date night should be owned");
}
await req(`/api/admin/players/${finn.id}/grant-stars`, {
  method: "POST",
  body: { amount: 100, reason: "smoke extra earn" },
  cookie: adminCookie,
});
const movieReq = await req("/api/store/request", {
  method: "POST",
  body: { skuId: movieNight.id },
  cookie: finnCookie,
});
await req(`/api/parent/redemptions/${movieReq.data.redemption.id}/approve`, {
  method: "POST",
  cookie: adminCookie,
});
const afterMovie = await req("/api/store", { cookie: finnCookie });
if (afterMovie.data.availableStars !== afterDate.data.availableStars + 100 - 200) {
  throw new Error(`after movie, available expected ${afterDate.data.availableStars + 100 - 200}, got ${afterMovie.data.availableStars}`);
}
await req(`/api/parent/redemptions/${dateReq.data.redemption.id}/redeem`, {
  method: "POST",
  cookie: adminCookie,
});
await req(`/api/parent/redemptions/${movieReq.data.redemption.id}/redeem`, {
  method: "POST",
  cookie: adminCookie,
});
const finnProfile = await req("/api/profile", { cookie: finnCookie });
if (finnProfile.data.rewards.owned?.some((r) => r.id === dateReq.data.redemption.id || r.id === movieReq.data.redemption.id)) {
  throw new Error("Finn owned should be empty of the two redeemed rewards");
}
if (
  !finnProfile.data.rewards.redeemed?.some((r) => r.id === dateReq.data.redemption.id) ||
  !finnProfile.data.rewards.redeemed?.some((r) => r.id === movieReq.data.redemption.id)
) {
  throw new Error("Finn profile should list both redeemed rewards");
}

await req(`/api/parent/store/skus/${ice.id}`, {
  method: "PATCH",
  body: { starCost: 550 },
  cookie: adminCookie,
});
const patched = await req("/api/parent/store", { cookie: adminCookie });
if (patched.data.skus.find((s) => s.id === ice.id)?.starCost !== 550) {
  throw new Error("parent SKU patch did not stick");
}
await req(`/api/parent/store/skus/${ice.id}`, {
  method: "PATCH",
  body: { starCost: 500 },
  cookie: adminCookie,
});
const createdSku = await req("/api/parent/store/skus", {
  method: "POST",
  body: { title: "Smoke extra treat", emoji: "🍪", starCost: 50, description: "smoke only", isActive: false },
  cookie: adminCookie,
});
if (!createdSku.data.sku?.id || createdSku.data.sku.isActive !== false) {
  throw new Error("parent create SKU should stay off the shelf");
}
console.log("store ledger + profile owned/redeemed ok");

const sage = players.data.players.find((p) => p.name === "Sage");
if (!sage) throw new Error("Sage missing");
await req(`/api/admin/players/${sage.id}/resources`, {
  method: "POST",
  body: { seeds: 20, reason: "smoke fill garden" },
  cookie: adminCookie,
});
const sageEnter = await req(`/api/players/${sage.id}/enter`, { method: "POST", body: { pin: "3333" } });
let sagePlots = sageEnter.data.player.plots;
for (const plot of sagePlots) {
  if (plot.state !== "empty") continue;
  const plantedSage = await req(`/api/plots/${plot.slot}/plant`, {
    method: "POST",
    body: { tier: 1 },
    cookie: sageEnter.cookie,
  });
  sagePlots = plantedSage.data.player.plots;
}
const sageChores = await req("/api/chores", { cookie: sageEnter.cookie });
if (sageChores.data.emptySlots?.length) throw new Error("Sage garden should be full");
const sageBed = sageChores.data.chores.find((c) => c.slug === "make-your-bed");
try {
  await req(`/api/chores/${sageBed.id}/claim`, {
    method: "POST",
    body: { slot: 0, tier: 1 },
    cookie: sageEnter.cookie,
  });
  throw new Error("full garden should reject chore claim");
} catch (err) {
  if (!String(err.message).toLowerCase().includes("empty")) throw err;
}
console.log("no empty plot rejects claim");

await req("/api/admin/config/reset", { method: "POST", cookie: adminCookie });
const resetConfig = await req("/api/admin/config", { cookie: adminCookie });
assertFlatEconomy(resetConfig.data.config, "config after reset");
console.log("restored default tunables");
console.log("SMOKE OK");
