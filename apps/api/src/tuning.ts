/**
 * Config path/validation primitives for the balance agent's review/apply
 * workflow. The pure helpers (`getPath`/`setPath`/`validateTuningValue`/
 * `planChange`) are unit-tested in isolation (see tuning.test.ts); the DB-level
 * `applyTuningChanges` (three-way merge + single `saveConfig` + audit) lives at
 * the bottom.
 */

import type { GameConfig } from "@farmhand/shared";
import { mergeGameConfig } from "@farmhand/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { loadConfig, saveConfig } from "./game.js";

/** Dotted/indexed config path segments, e.g. "tiers.1.seedCost" → ["tiers", 1, "seedCost"]. */
export type PathSegment = string | number;

export function parsePath(path: string): PathSegment[] {
  if (!path || typeof path !== "string") throw new Error("Change has no path.");
  return path.split(".").map((part) => (part !== "" && /^\d+$/.test(part) ? Number(part) : part));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function getPath(config: GameConfig, path: string): unknown {
  const segments = parsePath(path);
  let value: unknown = config;
  for (const segment of segments) {
    if (typeof segment === "number") {
      if (!Array.isArray(value)) throw new Error(`Unknown path: ${path}`);
      const array = value as unknown[];
      if (segment < 0 || segment >= array.length) throw new Error(`Unknown path: ${path}`);
      value = array[segment];
    } else {
      if (!isPlainObject(value) || !hasOwn(value, segment)) throw new Error(`Unknown path: ${path}`);
      value = value[segment];
    }
  }
  return value;
}

/** Immutably set a path, deep-cloning every container along the way. */
export function setPath<T extends GameConfig>(config: T, path: string, value: unknown): T {
  const segments = parsePath(path);
  function apply(node: unknown, index: number): unknown {
    const segment = segments[index];
    if (segment === undefined) return value;
    if (typeof segment === "number") {
      const array = Array.isArray(node) ? node.slice() : [];
      array[segment] = apply(array[segment], index + 1);
      return array;
    }
    const object = isPlainObject(node) ? { ...node } : {};
    object[segment] = apply(object[segment], index + 1);
    return object;
  }
  return apply(config, 0) as T;
}

function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => deepEquals(value, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every((key) => hasOwn(b, key) && deepEquals(a[key], b[key]));
  }
  return false;
}

/** Sane bounds for top-level knobs the balance agent may recommend. */
const TOP_LEVEL_RANGES: Record<string, { min: number; max: number }> = {
  startingSeeds: { min: 0, max: 1000 },
  startingPoints: { min: 0, max: 1_000_000 },
  wateringCooldownMinutes: { min: 1, max: 1440 },
  wateringMaxPerDay: { min: 1, max: 50 },
  wateringReductionMinutes: { min: 1, max: 1440 },
  shardsPerSeed: { min: 1, max: 100 },
  mixYield: { min: 1, max: 100 },
  plotCount: { min: 9, max: 36 },
};

const TOP_LEVEL_ELIGIBLE = new Set(Object.keys(TOP_LEVEL_RANGES));

const TIER_SUBFIELDS = new Set(["seedCost", "points", "durationMinutes"]);

/**
 * The only paths the agent (and a parent refinement/override) may touch. The
 * review/apply/discuss workflow never mutates arbitrary config.
 */
export function isEligiblePath(path: string): boolean {
  let segments: PathSegment[];
  try {
    segments = parsePath(path);
  } catch {
    return false;
  }
  if (segments.length === 1 && typeof segments[0] === "string") {
    return TOP_LEVEL_ELIGIBLE.has(segments[0]);
  }
  if (segments.length === 2 && typeof segments[1] === "number") {
    return segments[0] === "seedRewardBandUpperBounds" || segments[0] === "seedRewardBandPayouts";
  }
  if (segments.length === 3 && segments[0] === "tiers" && typeof segments[1] === "number") {
    return typeof segments[2] === "string" && TIER_SUBFIELDS.has(segments[2]);
  }
  return false;
}

/**
 * Validate a numeric value for an eligible path. Returns null when valid,
 * otherwise a human-readable reason (callers record the change as INVALID).
 */
export function validateTuningValue(path: string, value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Value must be a number.";

  let segments: PathSegment[];
  try {
    segments = parsePath(path);
  } catch {
    return "Change has no path.";
  }

  if (segments.length === 1 && typeof segments[0] === "string") {
    const range = TOP_LEVEL_RANGES[segments[0]];
    if (!range) return `Unknown knob: ${segments[0]}`;
    if (!Number.isInteger(value)) return `${segments[0]} must be a whole number.`;
    if (value < range.min || value > range.max) return `${segments[0]} must be ${range.min}–${range.max}.`;
    return null;
  }

  if (segments.length === 2 && typeof segments[1] === "number") {
    if (segments[0] !== "seedRewardBandUpperBounds" && segments[0] !== "seedRewardBandPayouts") {
      return `Unknown path: ${path}`;
    }
    if (!Number.isInteger(value) || value < 0) return `${path} must be a non-negative whole number.`;
    return null;
  }

  if (segments.length === 3 && segments[0] === "tiers" && typeof segments[1] === "number") {
    if (segments[1] < 0) return "Tier index must be non-negative.";
    if (typeof segments[2] !== "string" || !TIER_SUBFIELDS.has(segments[2])) {
      return `Unknown path: ${path}`;
    }
    if (!Number.isInteger(value) || value < 0) return `${path} must be a non-negative whole number.`;
    return null;
  }

  return `Unknown path: ${path}`;
}

export type TuningChangeRef = {
  id?: string;
  path: string;
  baselineValue?: unknown;
  proposedValue: unknown;
};

export type TuningSkipReason = "conflict" | "already_applied" | "invalid";

export type TuningApplyOutcome =
  | { ok: true; applied: number; skipped: Array<{ id: string; reason: TuningSkipReason }> }
  | { ok: false; reason: string };

export type PlanChangeOutcome =
  | { status: "apply"; value: number }
  | { status: "noop" }
  | { status: "conflict" }
  | { status: "invalid"; reason: string }
  | { status: "skip" };

/**
 * Pure three-way merge for one change. No I/O: the caller supplies the values
 * being compared.
 *
 *   - skip: the path isn't eligible (never mutate arbitrary config).
 *   - noop: the live value already equals the proposal.
 *   - conflict: the live value drifted from baseline and `force` is false.
 *   - invalid: the proposed value fails `validateTuningValue`.
 *   - apply: write `value`.
 */
export function planChange(opts: {
  path: string;
  baseline?: unknown;
  current: unknown;
  proposed: unknown;
  force?: boolean;
}): PlanChangeOutcome {
  if (!isEligiblePath(opts.path)) return { status: "skip" };
  if (deepEquals(opts.current, opts.proposed)) return { status: "noop" };
  if (!opts.force && opts.baseline !== undefined && !deepEquals(opts.current, opts.baseline)) {
    return { status: "conflict" };
  }
  const reason = validateTuningValue(opts.path, opts.proposed);
  if (reason) return { status: "invalid", reason };
  return { status: "apply", value: opts.proposed as number };
}

/** Decode a JSON-encoded stored value, tolerating values stored bare. */
export function decodeTuningValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * DB-level apply primitive (Step 4). Runs the three-way merge against the live
 * config, writes the accepted deltas through `mergeGameConfig` + `saveConfig`
 * ONCE, stamps applied rows, resolves emptied sets, and writes an audit row.
 */
export async function applyTuningChanges(
  changes: Array<{ id?: string; path: string; baselineValue: unknown; proposedValue: unknown }>,
  opts: { force?: boolean; adminId?: string } = {},
): Promise<TuningApplyOutcome> {
  if (!changes.length) return { ok: true, applied: 0, skipped: [] };
  const config = await loadConfig();

  let next = config;
  const accepted: Array<{ id?: string; path: string; baselineValue: unknown; value: number }> = [];
  const skipped: Array<{ id: string; reason: TuningSkipReason }> = [];

  for (const change of changes) {
    let current: unknown;
    try {
      current = getPath(config, change.path);
    } catch {
      if (change.id) skipped.push({ id: change.id, reason: "invalid" });
      continue;
    }
    const decision = planChange({
      path: change.path,
      baseline: change.baselineValue,
      current,
      proposed: change.proposedValue,
      force: opts.force,
    });
    if (decision.status === "apply") {
      next = setPath(next, change.path, decision.value);
      accepted.push({
        id: change.id,
        path: change.path,
        baselineValue: change.baselineValue,
        value: decision.value,
      });
    } else {
      const reason: TuningSkipReason =
        decision.status === "noop"
          ? "already_applied"
          : decision.status === "conflict"
            ? "conflict"
            : "invalid";
      if (change.id) skipped.push({ id: change.id, reason });
    }
  }

  if (accepted.length === 0) return { ok: true, applied: 0, skipped };

  const merged = mergeGameConfig(next);
  const saved = await saveConfig(merged);
  void saved;

  const appliedAt = new Date();
  const appliedIds: string[] = [];
  for (const change of accepted) {
    if (!change.id) continue;
    appliedIds.push(change.id);
    await prisma.tuningChange.update({
      where: { id: change.id },
      data: {
        status: "APPLIED",
        appliedValue: JSON.stringify(change.value),
        appliedAt,
        appliedByAdminId: opts.adminId ?? null,
      },
    });
  }

  if (appliedIds.length > 0) {
    const rows = await prisma.tuningChange.findMany({
      where: { id: { in: appliedIds } },
      select: { setId: true },
    });
    const setIdSet = new Set(rows.map((row) => row.setId));
    for (const setId of setIdSet) {
      const pending = await prisma.tuningChange.count({ where: { setId, status: "PENDING" } });
      if (pending === 0) {
        await prisma.recommendationSet.update({ where: { id: setId }, data: { status: "RESOLVED" } });
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      adminId: opts.adminId ?? null,
      action: "apply_recommendations",
      details: {
        applied: accepted.map((change) => ({
          path: change.path,
          previous: change.baselineValue,
          value: change.value,
        })),
        skipped,
        force: Boolean(opts.force),
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, applied: accepted.length, skipped };
}