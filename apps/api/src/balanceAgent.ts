/**
 * Balance agent — a scheduled, read-only reviewer of the farm economy.
 *
 * Each run builds an immutable snapshot of the live config (knobs + 7d/30d
 * activity windows + the parent's `balanceGoals`), asks the geometric-evidence
 * judge ("Jev", via `/decisions`) whether the economy has drifted, and — only
 * when the judge is confident enough — asks the reasoner LLM for a strict JSON
 * delta of at most a handful of knob changes. The deltas are staged as a
 * `RecommendationSet` + `TuningChange` rows for the parent to review/apply/
 * discuss/override in the PWA. The agent never writes config directly.
 */
import { DateTime } from "luxon";
import type { GameConfig } from "@farmhand/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { loadConfig } from "./game.js";
import { startOfDaysAgo, todayKey } from "./tz.js";
import { balanceKnobs, cropMixFromPlots, windowStats, type LogRow } from "./adminStats.js";
import { decisionFromLlmJson, mapDecision, type DecisionResult } from "./balanceDecision.js";
import {
  chat,
  decision,
  metricsVeniceEnabled,
  readVeniceConfig,
  resolveTextModels,
} from "./balanceVenice.js";
import {
  decodeTuningValue,
  getPath,
  isEligiblePath,
  validateTuningValue,
} from "./tuning.js";
import { notifyRecommendationsReady } from "./push.js";

export type BalanceAgentResult = { created: boolean; setId?: string; reason?: string };

/** Normalise the catalog's bracket style (`tiers[1].seedCost`) to the dot-indexed
 *  path style the tuning primitives parse (`tiers.1.seedCost`). */
function normalizePath(path: string): string {
  return path.replace(/\[(\d+)\]/g, ".$1");
}

type Knob = { path: string; label: string; unit: string; value: number };

const TOP_LEVEL_UNITS: Record<string, { label: string; unit: string }> = {
  startingSeeds: { label: "Starting seeds", unit: "count" },
  startingPoints: { label: "Starting points", unit: "count" },
  wateringCooldownMinutes: { label: "Watering cooldown", unit: "minutes" },
  wateringMaxPerDay: { label: "Waterings per day", unit: "count" },
  wateringReductionMinutes: { label: "Watering reduction", unit: "minutes" },
  shardsPerSeed: { label: "Shards per seed", unit: "count" },
  mixYield: { label: "Mix yield", unit: "ratio" },
  plotCount: { label: "Plot count", unit: "count" },
};

const TIER_FIELD_LABELS: Record<string, string> = {
  seedCost: "seed cost",
  points: "points",
  durationMinutes: "grow time",
};

/**
 * The only knobs the agent may recommend. Tier fields, watering/shard/mix/
 * starting knobs, plot count, and individual seed-reward band cells — never
 * arbitrary keys on the config.
 */
export function eligibleKnobs(config: GameConfig): Knob[] {
  const knobs: Knob[] = [];
  for (const [path, meta] of Object.entries(TOP_LEVEL_UNITS)) {
    if (!(path in config)) continue;
    knobs.push({ path, label: meta.label, unit: meta.unit, value: Number((config as Record<string, unknown>)[path]) });
  }
  for (const tier of config.tiers) {
    for (const field of ["seedCost", "points", "durationMinutes"] as const) {
      knobs.push({
        // `tier.tier` is a 1-based identity key, but the tiers array is 0-indexed;
        // emit the array index so `getPath`/`setPath` address the right element.
        path: `tiers.${tier.tier - 1}.${field}`,
        label: `${tier.name} ${TIER_FIELD_LABELS[field]}`,
        unit: field === "durationMinutes" ? "minutes" : field === "seedCost" ? "stars" : "points",
        value: tier[field],
      });
    }
  }
  config.seedRewardBandUpperBounds.forEach((value, index) => {
    knobs.push({ path: `seedRewardBandUpperBounds.${index}`, label: `Seed reward band ${index + 1} upper`, unit: "count", value });
  });
  config.seedRewardBandPayouts.forEach((value, index) => {
    knobs.push({ path: `seedRewardBandPayouts.${index}`, label: `Seed reward band ${index + 1} payout`, unit: "count", value });
  });
  return knobs;
}

export type BalanceSnapshot = Record<string, unknown>;

export async function buildBalanceSnapshot(): Promise<{ config: GameConfig; snapshot: BalanceSnapshot; rows: LogRow[] }> {
  const config = await loadConfig();
  const now = new Date();
  const from30 = startOfDaysAgo(config.timezone, 29, now);
  const from7 = startOfDaysAgo(config.timezone, 6, now);
  const [logs, players] = await Promise.all([
    prisma.activityLog.findMany({
      where: { createdAt: { gte: from30 } },
      select: { action: true, playerId: true, createdAt: true, details: true },
    }),
    prisma.player.findMany({
      where: { isActive: true },
      include: { plots: { select: { plantTier: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const rows: LogRow[] = logs.map((log) => ({
    action: log.action,
    playerId: log.playerId,
    createdAt: log.createdAt,
    details: log.details,
  }));
  const last7 = rows.filter((log) => log.createdAt >= from7);
  const snapshot: BalanceSnapshot = {
    generatedAt: now.toISOString(),
    timezone: config.timezone,
    dayKey: todayKey(config.timezone, now),
    goals: config.balanceGoals,
    knobs: balanceKnobs(config),
    cropMixInGround: cropMixFromPlots(players.flatMap((player) => player.plots.map((plot) => plot.plantTier))),
    windows: {
      "7d": windowStats(last7, config),
      "30d": windowStats(rows, config),
    },
  };
  return { config, snapshot, rows };
}

/** Ask Jev whether the economy has drifted. Returns the mapped triage result, or
 *  null (caller falls back to the reasoner LLM in the same JSON shape). */
async function judgeTriage(snapshot: BalanceSnapshot): Promise<DecisionResult | null> {
  const cfg = readVeniceConfig();
  const state = JSON.stringify({
    goals: snapshot.goals,
    economy7d: (snapshot.windows as Record<string, unknown> | undefined)?.["7d"],
    economy30d: (snapshot.windows as Record<string, unknown> | undefined)?.["30d"],
  });
  const call = await decision({
    state,
    questions: {
      triage: {
        type: "noul",
        instructions: "Does the 7d/30d economy drift from the stated balance goals?",
        context: snapshot.goals as string,
      },
      knob: {
        type: "choice",
        instructions: "Which single knob direction would best correct any drift?",
        options: ["no change", "tier seed cost up", "tier seed cost down", "tier points up", "watering cooldown down", "mix yield up"],
      },
      severity: {
        type: "score",
        instructions: "How severe is the economy drift?",
        options: ["Cosmetic", "Noticeable", "Economy-breaking"],
      },
    },
  });
  if (!call.ok) return null;
  const mapped = mapDecision(call.raw, "triage");
  return mapped && mapped.answer.kind === "noul" ? mapped : null;
}

/** Reasoner fallback when `/decisions` is unavailable (401/404/beta-block). */
async function llmTriageFallback(snapshot: BalanceSnapshot): Promise<DecisionResult | null> {
  const cfg = readVeniceConfig();
  const models = await resolveTextModels({ apiKey: cfg.apiKey });
  const state = JSON.stringify({
    goals: snapshot.goals,
    economy7d: (snapshot.windows as Record<string, unknown> | undefined)?.["7d"],
    economy30d: (snapshot.windows as Record<string, unknown> | undefined)?.["30d"],
  });
  const result = await chat({
    apiKey: cfg.apiKey,
    model: models.text,
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You triage whether a kids' farm-game economy has drifted from its goals. " +
          "Return ONLY strict JSON: { triage: boolean, knob: string, severity: string, confidence: number }.",
      },
      { role: "user", content: state },
    ],
  });
  if (!result.ok) return null;
  return decisionFromLlmJson(result.parsed);
}

type DeltaChange = {
  path: string;
  proposedValue: number;
  rationale: string;
  label?: string;
  unit?: string;
};

type Delta = { summary?: string; changes?: DeltaChange[] };

/** Ask the reasoner for a strict JSON delta of at most a handful of eligible knobs. */
async function reasonerDelta(snapshot: BalanceSnapshot, config: GameConfig): Promise<Delta | null> {
  const cfg = readVeniceConfig();
  const models = await resolveTextModels({ apiKey: cfg.apiKey });
  const knobs = eligibleKnobs(config).map((knob) => ({
    path: knob.path,
    label: knob.label,
    unit: knob.unit,
    value: knob.value,
  }));
  const prompt = {
    goals: snapshot.goals,
    economy7d: (snapshot.windows as Record<string, unknown> | undefined)?.["7d"],
    economy30d: (snapshot.windows as Record<string, unknown> | undefined)?.["30d"],
    eligibleKnobs: knobs,
  };
  const result = await chat({
    apiKey: cfg.apiKey,
    model: models.text,
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You recommend small, safe tuning changes for a kids' farm game so play stays rewarded and fair. " +
          "Propose at most 4 changes, ONLY from the `eligibleKnobs` list using their exact `path`, and only where the value would stay within sane bounds. " +
          "Return ONLY strict JSON: { summary: string, changes: [{ path, proposedValue, rationale, unit, label }] }.",
      },
      { role: "user", content: JSON.stringify(prompt) },
    ],
  });
  if (!result.ok) return null;
  const parsed = result.parsed as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") return null;
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const changes = Array.isArray(parsed.changes)
    ? (parsed.changes as Array<Record<string, unknown>>).map((c) => ({
        path: typeof c.path === "string" ? normalizePath(c.path) : "",
        proposedValue: Number(c.proposedValue),
        rationale: typeof c.rationale === "string" ? c.rationale : "",
        label: typeof c.label === "string" ? c.label : undefined,
        unit: typeof c.unit === "string" ? c.unit : undefined,
      }))
    : [];
  return { summary, changes: changes.filter((c) => c.path !== "") } as Delta;
}

function defaultSummary(changes: Array<{ label: string }>): string {
  const first = changes[0]?.label ?? "a few knobs";
  if (changes.length === 1) return `${first} is off balance.`;
  return `${changes.length} balance suggestions ready (${first} and more).`;
}
export async function runBalanceAgent(force = false): Promise<BalanceAgentResult> {
  if (!metricsVeniceEnabled()) return { created: false, reason: "no-key" };

  const { config, snapshot } = await buildBalanceSnapshot();

  // Idempotency: one run per local month (unless force).
  if (!force) {
    // Start of the current local month, as a UTC instant, matching how the
    // other `startOf*` helpers in ./tz.js normalize timezone boundaries.
    const monthStart = DateTime.now()
      .setZone(config.timezone || "America/Chicago")
      .startOf("month")
      .toUTC()
      .toJSDate();
    const existing = await prisma.recommendationSet.findFirst({
      where: { createdAt: { gte: monthStart } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { created: false, reason: "already-ran-this-month" };
  }

  const cfg = readVeniceConfig();
  const models = await resolveTextModels({ apiKey: cfg.apiKey });

  // Judge (triage). Fall back to the reasoner JSON if Jev is unavailable.
  let triage = await judgeTriage(snapshot);
  let decisionModel = cfg.decisionModel ?? "jev-latest";
  if (!triage) {
    triage = await llmTriageFallback(snapshot);
    decisionModel = "llm-fallback";
  }
  if (!triage) return { created: false, reason: "judge-failed" };

  const confidence = triage.answer.kind === "noul" ? triage.answer.probability : triage.confidence;
  if (confidence < 0.6) return { created: false, reason: "low-confidence" };

  const delta = await reasonerDelta(snapshot, config);
  if (!delta || !delta.changes || delta.changes.length === 0) {
    return { created: false, reason: "no-delta" };
  }

  // Validate + shape each change, keeping at most 4 and rejecting ineligible/invalid ones.
  const accepted: Array<DeltaChange & { baseline: number; label: string; unit: string; sortOrder: number }> = [];
  const knobByPath = new Map(eligibleKnobs(config).map((knob) => [knob.path, knob]));
  for (let index = 0; index < delta.changes.length && accepted.length < 4; index += 1) {
    const change = delta.changes[index];
    if (!isEligiblePath(change.path)) continue;
    if (validateTuningValue(change.path, change.proposedValue) !== null) continue;
    let baseline: unknown;
    try {
      baseline = getPath(config, change.path);
    } catch {
      continue;
    }
    if (typeof baseline !== "number" || !Number.isFinite(baseline)) continue;
    if (change.proposedValue === baseline) continue;
    const knob = knobByPath.get(change.path);
    accepted.push({
      ...change,
      baseline,
      label: change.label || knob?.label || change.path,
      unit: change.unit || knob?.unit || "count",
      sortOrder: accepted.length,
    });
  }
  if (accepted.length === 0) return { created: false, reason: "no-valid-changes" };

  const modelIds = {
    decision: decisionModel,
    text: models.text,
    explain: models.explain,
  };

  const created = await prisma.recommendationSet.create({
    data: {
      snapshot: snapshot as Prisma.InputJsonValue,
      modelIds: modelIds as Prisma.InputJsonValue,
      summary: delta.summary || defaultSummary(accepted),
      changes: {
        create: accepted.map((change) => ({
          path: change.path,
          label: change.label,
          unit: change.unit,
          baselineValue: JSON.stringify(change.baseline),
          proposedValue: JSON.stringify(change.proposedValue),
          rationale: change.rationale,
          sortOrder: change.sortOrder,
        })),
      },
    },
    select: { id: true },
  });

  void notifyRecommendationsReady(created.id, accepted.length)
    .then(() =>
      prisma.recommendationSet.update({ where: { id: created.id }, data: { notifiedAt: new Date() } }),
    )
    .catch(() => {
      /* notification is best-effort */
    });

  return { created: true, setId: created.id };
}
/**
 * Schedule the balance agent monthly, firing on the 1st of the month at ~06:00
 * local (same 06:00 window as the previous nightly schedule).
 *
 * REVISIT (cadence + data-sufficiency thresholds — do NOT change until measured):
 *   This monthly cadence is a deliberate placeholder. At ship time the balance
 *   agent had produced no `ActivityLog` metrics in production (farmhand.famgala.com),
 *   so there was no real volume to calibrate against. About one month after the
 *   first prod run, extract per-action `ActivityLog` counts, the number of distinct
 *   active days, and the active-player count from prod, then use that observed
 *   volume to (a) confirm or tighten the cadence (weekly vs monthly) and (b) set an
 *   explicit data-sufficiency threshold (minimum economy events / active days)
 *   before the judge + reasoner are trusted to make recommendations. Do not add
 *   thresholds before that data exists.
 */
export function startBalanceAgentSchedule(log?: { info: (obj: unknown, msg?: string) => void }): () => void {
  let lastRunMonthKey = "";
  const tick = async () => {
    try {
      const config = await loadConfig();
      const tz = config.timezone || "America/Chicago";
      const zoned = DateTime.now().setZone(tz);
      const monthKey = zoned.toFormat("yyyy-LL");
      // Run only on the 1st, inside the 06:00 window of a once-per-minute tick.
      if (zoned.day !== 1 || zoned.hour !== 6 || zoned.minute > 1) return;
      if (lastRunMonthKey === monthKey) return;
      lastRunMonthKey = monthKey;
      const result = await runBalanceAgent();
      log?.info?.(result, "balance agent run");
    } catch (err) {
      log?.info?.({ err }, "balance agent run failed");
    }
  };
  const handle = setInterval(() => {
    void tick();
  }, 60_000);
  if (typeof handle.unref === "function") handle.unref();
  return () => clearInterval(handle);
}

export type DiscussOutcome = {
  reply: string;
  revised: Array<{ changeId: string; path: string; proposedValue: number; rationale: string; label: string; unit: string }>;
};

/** Multi-turn "discuss/amend": reasoner anchored to the set snapshot + goals + the
 *  parent message; revised values are staged as NEW rows, superseding old ones. */
export async function discussRecommendation(setId: string, message: string): Promise<DiscussOutcome> {
  const cfg = readVeniceConfig();
  const models = await resolveTextModels({ apiKey: cfg.apiKey });
  const config = await loadConfig();
  const set = await prisma.recommendationSet.findUnique({ where: { id: setId } });
  if (!set) throw new Error("Recommendation set not found.");

  const changes = await prisma.tuningChange.findMany({
    where: { setId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const anchor = {
    summary: set.summary,
    goals: config.balanceGoals,
    snapshot: set.snapshot,
    changes: changes.map((change) => ({
      id: change.id,
      path: change.path,
      label: change.label,
      baselineValue: decodeTuningValue(change.baselineValue),
      proposedValue: decodeTuningValue(change.proposedValue),
      status: change.status,
      rationale: change.rationale,
    })),
  };

  const result = await chat({
    apiKey: cfg.apiKey,
    model: models.text,
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are helping a parent refine balance recommendations for their kids' farm game. " +
          "Respond in plain language and, if you revise any change, give the exact new value. " +
          "Return ONLY strict JSON: { reply: string, revised?: [{ path, proposedValue, rationale }] }.",
      },
      { role: "user", content: JSON.stringify({ anchor, parentMessage: message }) },
    ],
  });
  if (!result.ok) throw new Error("Discuss call failed.");

  const parsed = result.parsed as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object" || typeof parsed.reply !== "string") {
    throw new Error("Discuss response was not usable.");
  }
  const reply = parsed.reply;

  const revisedOut: DiscussOutcome["revised"] = [];
  if (Array.isArray(parsed.revised)) {
    const byPath = new Map(changes.map((change) => [change.path, change]));
    for (const item of parsed.revised as Array<Record<string, unknown>>) {
      const path = normalizePath(typeof item.path === "string" ? item.path : "");
      const proposedValue = Number(item.proposedValue);
      if (!path || !isEligiblePath(path) || validateTuningValue(path, proposedValue) !== null) continue;

      let baseline: unknown;
      try {
        baseline = getPath(config, path);
      } catch {
        continue;
      }
      const previous = byPath.get(path);
      if (previous && previous.status === "PENDING") {
        await prisma.tuningChange.update({ where: { id: previous.id }, data: { status: "SUPERSEDED" } });
      }
      const knob = eligibleKnobs(config).find((k) => k.path === path);
      const created = await prisma.tuningChange.create({
        data: {
          setId,
          path,
          label: previous?.label ?? knob?.label ?? path,
          unit: previous?.unit ?? knob?.unit ?? "count",
          baselineValue: JSON.stringify(baseline),
          proposedValue: JSON.stringify(proposedValue),
          rationale: typeof item.rationale === "string" ? item.rationale : "",
          sortOrder: Number(previous?.sortOrder ?? 0),
        },
      });
      revisedOut.push({
        changeId: created.id,
        path,
        proposedValue,
        rationale: typeof item.rationale === "string" ? item.rationale : "",
        label: created.label,
        unit: created.unit,
      });
    }
  }

  return { reply, revised: revisedOut };
}

/** Helper the routes use: re-serialize a change for the UI with live current value. */
export function serializeChange(change: {
  id: string;
  path: string;
  label: string;
  unit: string;
  baselineValue: string;
  proposedValue: string;
  appliedValue: string | null;
  rationale: string;
  status: string;
  sortOrder: number;
  createdAt: Date;
}, config: GameConfig) {
  let current: unknown = null;
  try {
    current = getPath(config, change.path);
  } catch {
    /* unknown path → null */
  }
  return {
    id: change.id,
    path: change.path,
    label: change.label,
    unit: change.unit,
    baseline: decodeTuningValue(change.baselineValue),
    proposed: decodeTuningValue(change.proposedValue),
    applied: change.appliedValue == null ? null : decodeTuningValue(change.appliedValue),
    current,
    rationale: change.rationale,
    status: change.status,
    sortOrder: change.sortOrder,
    createdAt: change.createdAt.toISOString(),
  };
}