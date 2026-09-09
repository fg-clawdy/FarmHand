import {
  CHORE_ASSIGNMENT_MODES,
  CHORE_PRIORITIES,
  CHORE_RECURRENCES,
  CHORE_TIMES_OF_DAY,
  type ChoreAssignmentMode,
  type ChorePriority,
  type ChoreRecurrence,
  type ChoreTimeOfDay,
} from "@farmhand/shared";

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

export type ParentChoreBody = {
  title?: unknown;
  emoji?: unknown;
  description?: unknown;
  recurrence?: unknown;
  timeOfDay?: unknown;
  priority?: unknown;
  estimatedMinutes?: unknown;
  requiresApproval?: unknown;
  requiresSelfie?: unknown;
  allowsSkip?: unknown;
  isGlobal?: unknown;
  includeInPath?: unknown;
  isActive?: unknown;
  assignmentMode?: unknown;
  assignedPlayerIds?: unknown;
};

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "chore";
}

export function isGlobalForMode(mode: ChoreAssignmentMode): boolean {
  return mode === "ALL";
}

function readString(value: unknown, label: string, opts?: { allowEmpty?: boolean }): string {
  if (typeof value !== "string") fail(`Please enter a ${label}.`);
  const trimmed = value.trim();
  if (!trimmed && !opts?.allowEmpty) fail(`Please enter a ${label}.`);
  return trimmed;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(`That ${label} isn't one of the choices.`);
  }
  return value as T;
}

function readBool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(`${label} should be yes or no.`);
  return value;
}

function readOptionalMinutes(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 24 * 60) {
    fail("Minutes should be a whole number, or blank.");
  }
  return n;
}

function readPlayerIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !id)) {
    fail("Pick the kids from the list.");
  }
  return [...new Set(value as string[])];
}

export function parseAssignmentMode(
  body: ParentChoreBody,
  fallback?: ChoreAssignmentMode,
): ChoreAssignmentMode | undefined {
  if (body.assignmentMode !== undefined) {
    return readEnum(body.assignmentMode, CHORE_ASSIGNMENT_MODES, "who-can-claim choice");
  }
  if (body.isGlobal !== undefined) {
    return readBool(body.isGlobal, "Every kid") ? "ALL" : fallback === "SPECIFIC" ? "SPECIFIC" : "RACE";
  }
  return undefined;
}

export type ParsedChoreWrite = {
  title?: string;
  emoji?: string;
  description?: string;
  recurrence?: ChoreRecurrence;
  timeOfDay?: ChoreTimeOfDay;
  priority?: ChorePriority;
  estimatedMinutes?: number | null;
  requiresApproval?: boolean;
  requiresSelfie?: boolean;
  allowsSkip?: boolean;
  includeInPath?: boolean;
  isActive?: boolean;
  assignmentMode?: ChoreAssignmentMode;
  assignedPlayerIds?: string[];
};

export function parseParentChoreWrite(body: ParentChoreBody, mode: "create" | "patch"): ParsedChoreWrite {
  const parsed: ParsedChoreWrite = {};
  if (mode === "create" || body.title !== undefined) parsed.title = readString(body.title, "title");
  if (mode === "create") parsed.emoji = body.emoji === undefined ? "⭐" : readString(String(body.emoji), "emoji") || "⭐";
  else if (body.emoji !== undefined) parsed.emoji = readString(String(body.emoji), "emoji") || "⭐";
  if (mode === "create") {
    parsed.description = body.description === undefined ? "" : readString(body.description, "note", { allowEmpty: true });
  } else if (body.description !== undefined) {
    parsed.description = readString(body.description, "note", { allowEmpty: true });
  }
  if (mode === "create") {
    parsed.recurrence = body.recurrence === undefined ? "DAILY" : readEnum(body.recurrence, CHORE_RECURRENCES, "how often");
  } else if (body.recurrence !== undefined) {
    parsed.recurrence = readEnum(body.recurrence, CHORE_RECURRENCES, "how often");
  }
  if (mode === "create") {
    parsed.timeOfDay =
      body.timeOfDay === undefined ? "ANYTIME" : readEnum(body.timeOfDay, CHORE_TIMES_OF_DAY, "time of day");
  } else if (body.timeOfDay !== undefined) {
    parsed.timeOfDay = readEnum(body.timeOfDay, CHORE_TIMES_OF_DAY, "time of day");
  }
  if (mode === "create") {
    parsed.priority = body.priority === undefined ? "NORMAL" : readEnum(body.priority, CHORE_PRIORITIES, "priority");
  } else if (body.priority !== undefined) {
    parsed.priority = readEnum(body.priority, CHORE_PRIORITIES, "priority");
  }
  const minutes = readOptionalMinutes(body.estimatedMinutes);
  if (minutes !== undefined) parsed.estimatedMinutes = minutes;
  if (mode === "create") {
    parsed.requiresApproval =
      body.requiresApproval === undefined ? true : readBool(body.requiresApproval, "Needs your OK");
  } else if (body.requiresApproval !== undefined) {
    parsed.requiresApproval = readBool(body.requiresApproval, "Needs your OK");
  }
  if (mode === "create") {
    parsed.requiresSelfie = body.requiresSelfie === undefined ? false : readBool(body.requiresSelfie, "Needs a photo");
  } else if (body.requiresSelfie !== undefined) {
    parsed.requiresSelfie = readBool(body.requiresSelfie, "Needs a photo");
  }
  if (mode === "create") {
    parsed.allowsSkip = body.allowsSkip === undefined ? false : readBool(body.allowsSkip, "Kids can skip");
  } else if (body.allowsSkip !== undefined) {
    parsed.allowsSkip = readBool(body.allowsSkip, "Kids can skip");
  }
  if (mode === "create") {
    parsed.includeInPath =
      body.includeInPath === undefined ? true : readBool(body.includeInPath, "Show on Job Board");
  } else if (body.includeInPath !== undefined) {
    parsed.includeInPath = readBool(body.includeInPath, "Show on Job Board");
  }
  if (mode === "create") {
    parsed.isActive = body.isActive === undefined ? true : readBool(body.isActive, "This chore is on");
  } else if (body.isActive !== undefined) {
    parsed.isActive = readBool(body.isActive, "This chore is on");
  }
  const assignmentMode = parseAssignmentMode(body, undefined);
  if (mode === "create") parsed.assignmentMode = assignmentMode ?? "ALL";
  else if (assignmentMode !== undefined) parsed.assignmentMode = assignmentMode;
  const assigned = readPlayerIds(body.assignedPlayerIds);
  if (assigned !== undefined) parsed.assignedPlayerIds = assigned;
  return parsed;
}
