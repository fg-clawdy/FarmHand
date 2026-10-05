export type SharedGoalStatus = "WAITING" | "OPEN" | "READY" | "HAPPENED" | "CANCELLED";

/** Cork-badge pipeline. DEFAULT is the instant pastel badge. QUEUED never blocks create or the farm. */
export type SharedGoalArtStatus = "DEFAULT" | "QUEUED" | "READY" | "FAILED";

/**
 * Soft pastel glass tints. Sage, clay, and cornflower match the tray mock;
 * butter and lilac keep a longer queue from repeating the first three.
 */
export const JAR_TINTS = [
  { id: "sage", glass: "#dfe8d4", rim: "#8fa883", fill: "#e8c15a" },
  { id: "clay", glass: "#f4ddd2", rim: "#c9957c", fill: "#e8c15a" },
  { id: "cornflower", glass: "#d5e2f6", rim: "#8aa4cc", fill: "#e8c15a" },
  { id: "butter", glass: "#f6efd2", rim: "#c9b56e", fill: "#e8c15a" },
  { id: "lilac", glass: "#e6dff2", rim: "#b09cc4", fill: "#e8c15a" },
] as const;

export type JarTint = (typeof JAR_TINTS)[number];

/** How many tubes fit on the farm rack before the +N chip. */
export const JAR_TRAY_CAPACITY = 3;

/** Public shape returned to the farm tablet and kid surfaces. No contributions, no prompts. */
export type PublicSharedGoal = {
  id: string;
  title: string;
  emoji: string;
  targetStars: number;
  filledStars: number;
  status: SharedGoalStatus;
  tintIndex: number;
  /** Painted cork, when Venice (or a later bake) has finished. Null keeps the emoji lid. */
  artUrl: string | null;
  artStatus: SharedGoalArtStatus;
};

/** Parent view of a single goal including per-child contribution totals. */
export type ParentSharedGoal = {
  id: string;
  title: string;
  emoji: string;
  targetStars: number;
  filledStars: number;
  status: SharedGoalStatus;
  sortOrder: number;
  createdAt: string;
  readyAt: string | null;
  happenedAt: string | null;
  cancelledAt: string | null;
  /** Per-child net contributions (GIVE minus RETURN). Parent-only. */
  contributions: ParentGoalContribution[];
  /** Dollar preview: targetStars / 100. */
  usdTarget: string;
  usdFilled: string;
  tintIndex: number;
  artUrl: string | null;
  artStatus: SharedGoalArtStatus;
  /** Parent-only. Never sent on kid farm payloads. */
  artPrompt: string | null;
  artNotes: string | null;
};

export type ParentGoalContribution = {
  playerId: string;
  playerName: string;
  mascot: string;
  netGiven: number;
  givingEnabled: boolean;
  giveCeiling: number;
};

/** Suggested starter goals shown to parents when creating. */
export const SHARED_GOAL_STARTERS = [
  { title: "Movie night", emoji: "🎬", targetStars: 200 },
  { title: "Family ice cream", emoji: "🍦", targetStars: 500 },
  { title: "Family game night", emoji: "🎲", targetStars: 800 },
  { title: "Netflix month", emoji: "📺", targetStars: 1000 },
] as const;

/** Kid-facing copy deck. Substitutes {title}. */
export const SHARED_GOAL_COPY = {
  farmLabel: "Family jar",
  coachLine1: "This jar is for all of us.",
  coachLine2: "You can add stars if you want. You don't have to.",
  sheetPrompt: "Add your stars. When the jar is full, we all get {title}.",
  confirm: "Add {n} stars to the {title} jar?",
  buttonAdd: "Add stars",
  buttonNotNow: "Not now",
  buttonPutBack: "Put back",
  pourLabel: "Into the jar",
  afterPour: "The jar is fuller.",
  noStars: "No stars to add yet.",
  givingOff: "You can watch the jar fill.",
  roomLeft: "Room for {n} more.",
  pickAmount: "Pick stars to add",
  halfway: "Halfway to {title}.",
  ready: "{title} is ready.",
  readySubline: "A grown-up will make it happen.",
  happened: "{title} happened.",
  putAway: "The {title} jar was put away. Your stars are back.",
  putBack: "Put those stars back?",
  parentPushReady: "The {title} jar is full.",
  parentCreateHint:
    "This is real money. 200★ is $2.00. Start with a jar the family can fill.",
  parentQueueLabel: "Later",
  parentQueueFull: "Finish or remove one first.",
  parentSwitch:
    "Stars in this jar are for {title}. To work on something else, put this jar away. Each child's stars come back.",
  parentSharedOnly:
    "Everyone in the family gets this. If only one child would use it, put it in the store.",
  parentTrayHint: "Open goals stand together on the farm. Kids see the tubes, not who added stars.",
  trayTitle: "Shared Goals",
  trayEmpty: "0 goals",
  trayComing: "A goal will stand here",
  artDefault: "Default art",
  artPainting: "Painting…",
  artReady: "Badge ready",
  artKeptDefault: "Using default art",
} as const;

export function jarTint(index: number): JarTint {
  const n = JAR_TINTS.length;
  const i = ((Math.trunc(index) % n) + n) % n;
  return JAR_TINTS[i] ?? JAR_TINTS[0];
}

/** Stable pastel pick so a title keeps its glass, with a salt so siblings can differ. */
export function tintIndexFor(title: string, salt = 0): number {
  let hash = Math.abs(Math.trunc(salt)) + 1;
  for (const ch of title.trim()) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  return hash % JAR_TINTS.length;
}

export function compactJarTitle(title: string, max = 12): string {
  const trimmed = title.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Exact filled/target under a tube. No rounded percent and no "nearly full". */
export function jarProgressLabel(filled: number, target: number, _status?: SharedGoalStatus): string {
  const safeTarget = Math.max(0, Math.trunc(target));
  const safeFilled = Math.max(0, Math.trunc(filled));
  if (safeTarget <= 0) return "0/0";
  return `${Math.min(safeFilled, safeTarget)}/${safeTarget}`;
}

/** Liquid height. Clamped to the real ratio so a pour cannot draw past the true level. */
export function tubeFillRatio(filled: number, target: number): number {
  if (!(target > 0)) return 0;
  const ratio = filled / target;
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}

/**
 * Translucent gift band between the old meniscus and the new one.
 * `solid` is the only height the liquid column may use.
 */
export function giftGhostBand(fromRatio: number, toRatio: number): { bottom: number; height: number; solid: number } {
  const from = tubeFillRatio(fromRatio, 1);
  const to = tubeFillRatio(toRatio, 1);
  const bottom = Math.min(from, to);
  const solid = Math.max(from, to);
  return { bottom, height: solid - bottom, solid };
}

/** Chip math kids can check: exact wallet stays separate; this is filled → filled+chip, clamped to the target. */
export function pourPreview(filled: number, target: number, chip: number): { fromFilled: number; toFilled: number; label: string } {
  const safeTarget = Math.max(0, Math.trunc(target));
  const fromFilled = safeTarget > 0 ? Math.min(Math.max(0, Math.trunc(filled)), safeTarget) : 0;
  const add = Math.max(0, Math.trunc(chip));
  const toFilled = safeTarget > 0 ? Math.min(safeTarget, fromFilled + add) : 0;
  return { fromFilled, toFilled, label: `${fromFilled}/${safeTarget} → ${toFilled}/${safeTarget}` };
}

export function trayWindow<T>(items: readonly T[], capacity = JAR_TRAY_CAPACITY) {
  const cap = Math.max(1, capacity);
  return {
    shown: items.slice(0, cap),
    hidden: items.slice(cap),
    overflow: Math.max(0, items.length - cap),
  };
}

const ART_PROMPT_MAX = 1500;

/** Round cork-badge prompt. Default art does not wait on this string. */
export function buildJarArtPrompt(input: { title: string; emoji: string; notes?: string | null }): string {
  const notes = input.notes?.trim();
  const base = [
    "A single round badge for a cork stopper on a tall glass test tube.",
    "Soft watercolor, gentle pastel, storybook, no neon, no text, no letters, no watermark, no people.",
    `Centered icon of ${input.emoji} ${input.title.trim()}, on a round creamy badge.`,
  ];
  if (notes) base.push(`Parent notes: ${notes}`);
  return base.join(" ").slice(0, ART_PROMPT_MAX);
}

/** Pour chip amounts shown to kids. */
export const GIVE_CHIP_AMOUNTS = [5, 10, 25, 50, 100] as const;

/** Largest chip a kid can tap. Chips above the wallet, ceiling, or room left are hidden. */
export const MAX_GIVE_CHIP = GIVE_CHIP_AMOUNTS[GIVE_CHIP_AMOUNTS.length - 1]!;

/** Default per-pour ceiling when a player row has no explicit one. Matches the DB default. */
export const DEFAULT_GIVE_CEILING = 100;

/** Mis-tap put-back window in seconds. */
export const PUT_BACK_WINDOW_SECONDS = 15;
