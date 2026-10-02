export type SharedGoalStatus = "WAITING" | "OPEN" | "READY" | "HAPPENED" | "CANCELLED";

/** Public shape returned to the farm tablet and kid surfaces. No contributions. */
export type PublicSharedGoal = {
  id: string;
  title: string;
  emoji: string;
  targetStars: number;
  filledStars: number;
  status: SharedGoalStatus;
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
} as const;

/** Pour chip amounts shown to kids. */
export const GIVE_CHIP_AMOUNTS = [1, 5, 10] as const;

/** Mis-tap put-back window in seconds. */
export const PUT_BACK_WINDOW_SECONDS = 15;
