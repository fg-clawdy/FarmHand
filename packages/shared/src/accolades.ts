import type { CropKind } from "./types.js";

export const ACCOLADE_MEDALS = ["bronze", "silver", "gold"] as const;
export type AccoladeMedal = (typeof ACCOLADE_MEDALS)[number];

export const LIFETIME_SEASON_KEY = "lifetime";

export const MEDAL_STEPS: Array<{ medal: AccoladeMedal; at: number }> = [
  { medal: "bronze", at: 10 },
  { medal: "silver", at: 50 },
  { medal: "gold", at: 100 },
];

/** Only three crops exist, so Crop Explorer medals are 1 / 2 / 3 distinct kinds. */
export const CROP_EXPLORER_STEPS: Array<{ medal: AccoladeMedal; at: number }> = [
  { medal: "bronze", at: 1 },
  { medal: "silver", at: 2 },
  { medal: "gold", at: 3 },
];

export type AccoladeKind = "seasonal" | "lifetime";

export type AccoladeDef = {
  slug: string;
  kind: AccoladeKind;
  title: string;
  emoji: string;
  blurb: string;
  counter: "harvests" | "waterings" | "plantings" | "selfies" | "camera" | "crops" | "activeDays";
  steps: Array<{ medal: AccoladeMedal; at: number }> | null;
  lifetimeAt?: number;
};

export const SEASONAL_TRACKS: AccoladeDef[] = [
  {
    slug: "harvests",
    kind: "seasonal",
    title: "Harvester",
    emoji: "🌽",
    blurb: "Pick ripe plants. Bronze at 10, silver at 50, gold at 100 this season.",
    counter: "harvests",
    steps: MEDAL_STEPS,
  },
  {
    slug: "waterings",
    kind: "seasonal",
    title: "Rain Maker",
    emoji: "💧",
    blurb: "Water growing plants. Bronze at 10, silver at 50, gold at 100 this season.",
    counter: "waterings",
    steps: MEDAL_STEPS,
  },
  {
    slug: "plantings",
    kind: "seasonal",
    title: "Green Thumb",
    emoji: "🌱",
    blurb: "Confirmed plants (pouch plant or a grown-up OK on a waiting seed). Not grey waiting plants.",
    counter: "plantings",
    steps: MEDAL_STEPS,
  },
  {
    slug: "selfies",
    kind: "seasonal",
    title: "Smile Season",
    emoji: "📸",
    blurb: "First watering selfie of a Chicago day. Bronze at 10 days, silver at 50, gold at 100.",
    counter: "selfies",
    steps: MEDAL_STEPS,
  },
  {
    slug: "crops",
    kind: "seasonal",
    title: "Crop Explorer",
    emoji: "🧺",
    blurb: "Harvest corn, strawberry, and cotton. Bronze / silver / gold for 1 / 2 / 3 kinds this season.",
    counter: "crops",
    steps: CROP_EXPLORER_STEPS,
  },
  {
    slug: "active-days",
    kind: "seasonal",
    title: "Show-Up",
    emoji: "🌅",
    blurb: "Distinct Chicago days you harvested, watered, planted, or took a selfie/photo.",
    counter: "activeDays",
    steps: MEDAL_STEPS,
  },
];

export const LIFETIME_LEGENDS: AccoladeDef[] = [
  {
    slug: "first-harvest",
    kind: "lifetime",
    title: "First Harvest",
    emoji: "🥇",
    blurb: "Pick your first ripe plant.",
    counter: "harvests",
    steps: null,
    lifetimeAt: 1,
  },
  {
    slug: "homestead-helper",
    kind: "lifetime",
    title: "Homestead Helper",
    emoji: "🏡",
    blurb: "Water plants 500 times. Forever.",
    counter: "waterings",
    steps: null,
    lifetimeAt: 500,
  },
  {
    slug: "barn-full",
    kind: "lifetime",
    title: "Barn Full",
    emoji: "🏚️",
    blurb: "Harvest all three crops: corn, strawberry, and cotton. Forever.",
    counter: "crops",
    steps: null,
    lifetimeAt: 3,
  },
  {
    slug: "early-bird",
    kind: "lifetime",
    title: "Early Bird",
    emoji: "🐦",
    blurb: "Play on 30 different Chicago days (not a consecutive streak).",
    counter: "activeDays",
    steps: null,
    lifetimeAt: 30,
  },
  {
    slug: "camera-kid",
    kind: "lifetime",
    title: "Camera Kid",
    emoji: "📷",
    blurb: "50 watering selfies and/or chore photos, added together, forever.",
    counter: "camera",
    steps: null,
    lifetimeAt: 50,
  },
];

export type AccoladeUnlockDraft = {
  slug: string;
  kind: AccoladeKind;
  seasonKey: string;
  medal: AccoladeMedal | null;
  title: string;
  emoji: string;
  blurb: string;
};

export function seasonKeyFromParts(year: number, month: number): string {
  const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4;
  return `${year}-Q${quarter}`;
}

export function seasonLabel(seasonKey: string): string {
  const match = /^(\d{4})-Q([1-4])$/.exec(seasonKey);
  if (!match) return seasonKey;
  const names: Record<string, string> = {
    "1": "Jan–Mar",
    "2": "Apr–Jun",
    "3": "Jul–Sep",
    "4": "Oct–Dec",
  };
  return `${names[match[2]!] ?? "Season"} ${match[1]}`;
}

export function cropBit(kind: CropKind): number {
  if (kind === "corn") return 1;
  if (kind === "strawberry") return 2;
  return 4;
}

export function distinctCrops(mask: number): number {
  return (mask & 1 ? 1 : 0) + (mask & 2 ? 1 : 0) + (mask & 4 ? 1 : 0);
}

export function unlockKey(unlock: { kind: AccoladeKind; slug: string; medal: AccoladeMedal | null; seasonKey: string }): string {
  return `${unlock.kind}:${unlock.slug}:${unlock.medal ?? ""}:${unlock.seasonKey}`;
}

export function nextStep(
  count: number,
  steps: Array<{ medal: AccoladeMedal; at: number }>,
): { medal: AccoladeMedal | null; at: number; remaining: number; done: boolean } {
  const next = steps.find((step) => count < step.at);
  if (!next) {
    const last = steps[steps.length - 1]!;
    return { medal: last.medal, at: last.at, remaining: 0, done: true };
  }
  return { medal: next.medal, at: next.at, remaining: next.at - count, done: false };
}

export function medalsEarned(count: number, steps: Array<{ medal: AccoladeMedal; at: number }>): AccoladeMedal[] {
  return steps.filter((step) => count >= step.at).map((step) => step.medal);
}

export type AccoladeCounters = {
  harvests: number;
  waterings: number;
  plantings: number;
  selfies: number;
  chorePhotos: number;
  cropsMask: number;
  activeDays: number;
};

function countFor(def: AccoladeDef, counters: AccoladeCounters): number {
  if (def.counter === "crops") return distinctCrops(counters.cropsMask);
  if (def.counter === "camera") return counters.selfies + counters.chorePhotos;
  if (def.counter === "activeDays") return counters.activeDays;
  return counters[def.counter];
}

export function evaluateUnlocks(opts: {
  seasonKey: string;
  seasonal: AccoladeCounters;
  lifetime: AccoladeCounters;
  existingKeys: Iterable<string>;
}): AccoladeUnlockDraft[] {
  const have = new Set(opts.existingKeys);
  const fresh: AccoladeUnlockDraft[] = [];

  function add(draft: AccoladeUnlockDraft) {
    const key = unlockKey(draft);
    if (have.has(key)) return;
    have.add(key);
    fresh.push(draft);
  }

  for (const track of SEASONAL_TRACKS) {
    if (!track.steps) continue;
    const n = countFor(track, opts.seasonal);
    for (const step of track.steps) {
      if (n < step.at) continue;
      add({
        slug: track.slug,
        kind: "seasonal",
        seasonKey: opts.seasonKey,
        medal: step.medal,
        title: `${track.title} ${step.medal}`,
        emoji: track.emoji,
        blurb: track.blurb,
      });
    }
  }

  for (const legend of LIFETIME_LEGENDS) {
    const n = countFor(legend, opts.lifetime);
    const need = legend.lifetimeAt ?? 1;
    if (n < need) continue;
    add({
      slug: legend.slug,
      kind: "lifetime",
      seasonKey: LIFETIME_SEASON_KEY,
      medal: null,
      title: legend.title,
      emoji: legend.emoji,
      blurb: legend.blurb,
    });
  }

  return fresh;
}
