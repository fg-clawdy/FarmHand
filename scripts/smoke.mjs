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
if (harvest.data.player.plots.find((p) => p.slot === empty.slot).state !== "empty") {
  throw new Error("plot did not clear");
}
console.log("harvest +stars/+seeds ok", reward);

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
if (catalog.data.chores?.length !== 21) {
  throw new Error(`expected 21 seeded chores, got ${catalog.data.chores?.length}`);
}
const clothes = catalog.data.chores.find((c) => c.slug === "set-out-school-clothes");
if (!clothes || clothes.isActive) throw new Error("Set Out School Clothes should be seeded inactive");
const dogs = catalog.data.chores.filter((c) => ["feed-dog-am", "feed-dog-pm", "walk-the-dog"].includes(c.slug));
if (dogs.length !== 3 || dogs.some((c) => c.priority !== "CRITICAL" || c.assignmentMode !== "RACE")) {
  throw new Error("dog chores should be CRITICAL races");
}
console.log("chore catalog 21 ok");
// Player UI Job Board (Chores toolbar) still claims via this API: 1 purgatory plant, no pouch spend.

await ensureEmptySlots(kidCookie2, adminCookie, 2);
let kidList = await req("/api/chores", { cookie: kidCookie2 });
const bed = kidList.data.chores.find((c) => c.slug === "make-your-bed" && c.eligible);
if (!bed) throw new Error("Willow should be able to claim Make your bed");
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

const raceChore = kidList.data.chores.find((c) => c.slug === "feed-dog-am" && c.eligible)
  ?? (await req("/api/chores", { cookie: kidCookie2 })).data.chores.find((c) => c.slug === "feed-dog-am");
if (!raceChore) throw new Error("Feed Dog A.M. missing");
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
