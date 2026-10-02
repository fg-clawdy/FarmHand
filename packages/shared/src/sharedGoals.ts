export type SharedGoalStatus = "WAITING" | "OPEN" | "READY" | "HAPPENED" | "CANCELLED";

/** Lid pipeline. DEFAULT is the instant pastel jar. QUEUED never blocks create or the farm. */
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

/** How many mini jars fit on the farm tray before the +N chip. */
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
  buttonAdd: "Add",
  buttonNotNow: "Not now",
  buttonPutBack: "Put back",
  pourLabel: "Into the jar",
  afterPour: "The jar is fuller.",
  noStars: "No stars to add yet.",
  givingOff: "You can watch the jar fill.",
  roomLeft: "Room for {n} more.",
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
  parentTrayHint: "Open jars sit together on the farm. Kids see the jars, not who added stars.",
  trayTitle: "shared goals",
  trayEmpty: "0 goals",
  trayComing: "Family jar coming",
  artDefault: "Default art",
  artPainting: "Painting…",
  artReady: "Lid ready",
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

/** Short label under a mini jar. No names. */
export function jarProgressLabel(filled: number, target: number, status: SharedGoalStatus): string {
  if (status === "READY") return "Ready";
  if (target <= 0) return "0%";
  const ratio = filled / target;
  if (ratio >= 0.85) return "nearly full";
  return `${Math.round(ratio * 100)}%`;
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

/** Cork-lid prompt. Default art does not wait on this string. */
export function buildJarArtPrompt(input: { title: string; emoji: string; notes?: string | null }): string {
  const notes = input.notes?.trim();
  const base = [
    "A single round cork lid for a children's farm mason jar.",
    "Soft watercolor, gentle pastel, storybook, no neon, no text, no letters, no watermark, no people.",
    `Centered icon of ${input.emoji} ${input.title.trim()}, on a round cork, creamy paper.`,
  ];
  if (notes) base.push(`Parent notes: ${notes}`);
  return base.join(" ").slice(0, ART_PROMPT_MAX);
}

/** Pour chip amounts shown to kids. */
export const GIVE_CHIP_AMOUNTS = [1, 5, 10] as const;

/** Mis-tap put-back window in seconds. */
export const PUT_BACK_WINDOW_SECONDS = 15;
