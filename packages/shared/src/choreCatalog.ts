export const CHORE_RECURRENCES = ["DAILY", "WEEKLY", "WEEKDAYS", "NONE"] as const;
export type ChoreRecurrence = (typeof CHORE_RECURRENCES)[number];

export const CHORE_TIMES_OF_DAY = ["MORNING", "AFTERNOON", "EVENING", "ANYTIME"] as const;
export type ChoreTimeOfDay = (typeof CHORE_TIMES_OF_DAY)[number];

export const CHORE_PRIORITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"] as const;
export type ChorePriority = (typeof CHORE_PRIORITIES)[number];

export const CHORE_ASSIGNMENT_MODES = ["ALL", "SPECIFIC", "RACE"] as const;
export type ChoreAssignmentMode = (typeof CHORE_ASSIGNMENT_MODES)[number];

export const CHORE_CLAIM_STATUSES = ["PENDING", "APPROVED", "DENIED"] as const;
export type ChoreClaimStatus = (typeof CHORE_CLAIM_STATUSES)[number];

export const CHORE_PRIORITY_RANK: Record<ChorePriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export type SeedChore = {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  recurrence: ChoreRecurrence;
  timeOfDay: ChoreTimeOfDay;
  priority: ChorePriority;
  estimatedMinutes: number | null;
  requiresApproval: boolean;
  requiresSelfie: boolean;
  allowsSkip: boolean;
  isGlobal: boolean;
  includeInPath: boolean;
  isActive: boolean;
  legacyPoints: number | null;
};

/** `isGlobal` → each kid may claim once per period. Otherwise farm-wide race (one claim per period). */
export function assignmentModeForSeed(chore: Pick<SeedChore, "isGlobal">): "ALL" | "RACE" {
  return chore.isGlobal ? "ALL" : "RACE";
}

/**
 * Phase 2 seed catalog (21 rows). Every claim plants exactly 1 provisional seed.
 * `estimatedMinutes` / `legacyPoints` are deferred metadata only.
 */
export const CHORE_CATALOG: SeedChore[] = [
  {
    slug: "make-your-bed",
    title: "Make your bed",
    emoji: "🛏️",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "MORNING",
    priority: "NORMAL",
    estimatedMinutes: 2,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: true,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "clean-your-room",
    title: "Clean your room",
    emoji: "🪟",
    description: "",
    recurrence: "WEEKLY",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: true,
    includeInPath: false,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "brush-teeth-am",
    title: "Brush Teeth A.M.",
    emoji: "🌅",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "MORNING",
    priority: "NORMAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: true,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "brush-teeth-bedtime",
    title: "Brush Teeth Bedtime",
    emoji: "🌙",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: true,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "dishes-1-6",
    title: "Dishes (1/6)",
    emoji: "🍽️",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: true,
    isGlobal: false,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "feed-dog-am",
    title: "Feed Dog A.M.",
    emoji: "🌅",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "MORNING",
    priority: "CRITICAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "feed-dog-pm",
    title: "Feed Dog P.M.",
    emoji: "🌙",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "EVENING",
    priority: "CRITICAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "walk-the-dog",
    title: "Walk the Dog",
    emoji: "🚶",
    description: "Take the dog around the block. Stay together and come straight home.",
    recurrence: "DAILY",
    timeOfDay: "AFTERNOON",
    priority: "CRITICAL",
    estimatedMinutes: 15,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "take-out-trash",
    title: "Take Out Trash",
    emoji: "🗑️",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: null,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: false,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "put-up-clean-laundry",
    title: "Put Up Clean Laundry",
    emoji: "👕",
    description: "",
    recurrence: "WEEKLY",
    timeOfDay: "ANYTIME",
    priority: "HIGH",
    estimatedMinutes: 10,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: true,
    includeInPath: false,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "brush-your-hair",
    title: "Brush Your Hair",
    emoji: "🌅",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: true,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "set-out-school-clothes",
    title: "Set Out School Clothes",
    emoji: "👕",
    description: "",
    recurrence: "WEEKDAYS",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: null,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: true,
    includeInPath: false,
    isActive: false,
    legacyPoints: null,
  },
  {
    slug: "easy-bedtime",
    title: "Easy Bedtime",
    emoji: "🌙",
    description: "Get ready for bed without a fuss — pajamas, lights out, and settled in.",
    recurrence: "DAILY",
    timeOfDay: "EVENING",
    priority: "LOW",
    estimatedMinutes: 15,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: true,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "clean-living-room",
    title: "Clean Living Room",
    emoji: "🧹",
    description: "",
    recurrence: "NONE",
    timeOfDay: "AFTERNOON",
    priority: "HIGH",
    estimatedMinutes: 10,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: false,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "clean-dining-room",
    title: "Clean Dining Room",
    emoji: "🧹",
    description: "",
    recurrence: "NONE",
    timeOfDay: "AFTERNOON",
    priority: "HIGH",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: false,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "clean-shoe-room",
    title: "Clean Shoe Room",
    emoji: "👟",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "AFTERNOON",
    priority: "NORMAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: true,
    isGlobal: false,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "clean-formal-living",
    title: "Clean Formal Living",
    emoji: "🧹",
    description: "",
    recurrence: "NONE",
    timeOfDay: "AFTERNOON",
    priority: "HIGH",
    estimatedMinutes: 10,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: false,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "clean-formal-dining",
    title: "Clean Formal Dining",
    emoji: "🍽️",
    description: "",
    recurrence: "NONE",
    timeOfDay: "AFTERNOON",
    priority: "HIGH",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: false,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "clean-table",
    title: "Clean Table",
    emoji: "🧽",
    description: "",
    recurrence: "DAILY",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: 5,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: true,
    isGlobal: false,
    includeInPath: true,
    isActive: true,
    legacyPoints: null,
  },
  {
    slug: "sweep-and-vacuum-downstairs",
    title: "Sweep and Vacuum downstairs",
    emoji: "🧹",
    description: "",
    recurrence: "NONE",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: 30,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: false,
    isActive: true,
    legacyPoints: 100,
  },
  {
    slug: "mop-the-downstairs",
    title: "Mop the downstairs",
    emoji: "🧹",
    description: "",
    recurrence: "NONE",
    timeOfDay: "ANYTIME",
    priority: "NORMAL",
    estimatedMinutes: 30,
    requiresApproval: true,
    requiresSelfie: false,
    allowsSkip: false,
    isGlobal: false,
    includeInPath: false,
    isActive: true,
    legacyPoints: 100,
  },
];

export function compareChoresForKid<
  T extends { includeInPath: boolean; priority: ChorePriority; sortOrder?: number; title: string },
>(a: T, b: T): number {
  if (a.includeInPath !== b.includeInPath) return a.includeInPath ? -1 : 1;
  const rank = CHORE_PRIORITY_RANK[a.priority] - CHORE_PRIORITY_RANK[b.priority];
  if (rank !== 0) return rank;
  const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (order !== 0) return order;
  return a.title.localeCompare(b.title);
}

/** Parent catalog: CRITICAL (dog chores) first, then catalog order. Inactive rows stay in the list. */
export function compareChoresForParent<
  T extends { priority: ChorePriority; sortOrder?: number; title: string },
>(a: T, b: T): number {
  const rank = CHORE_PRIORITY_RANK[a.priority] - CHORE_PRIORITY_RANK[b.priority];
  if (rank !== 0) return rank;
  const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (order !== 0) return order;
  return a.title.localeCompare(b.title);
}

export function compareClaimsForInbox<
  T extends { priority: ChorePriority; claimedAt: Date | string },
>(a: T, b: T): number {
  const rank = CHORE_PRIORITY_RANK[a.priority] - CHORE_PRIORITY_RANK[b.priority];
  if (rank !== 0) return rank;
  const aAt = a.claimedAt instanceof Date ? a.claimedAt.getTime() : new Date(a.claimedAt).getTime();
  const bAt = b.claimedAt instanceof Date ? b.claimedAt.getTime() : new Date(b.claimedAt).getTime();
  return aAt - bAt;
}
