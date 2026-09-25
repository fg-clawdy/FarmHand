import { CHORE_CATALOG } from "@farmhand/shared";

/** Fallback PNG when a chore slug has no matching painted file. */
export const CHORE_GENERIC_SLUG = "chore-generic";

/** Cache-bust for painted chore PNGs (bump when art files change). */
export const PAINTED_CHORE_ART_BUST = "1";

const KNOWN_CHORE_ART_SLUGS = new Set<string>([
  ...CHORE_CATALOG.map((chore) => chore.slug),
  CHORE_GENERIC_SLUG,
]);

/** Resolve catalog slug (or id used as slug) to a known art filename stem. */
export function paintedChoreArtSlug(slug: string | null | undefined): string {
  const key = (slug ?? "").trim();
  if (key && KNOWN_CHORE_ART_SLUGS.has(key)) return key;
  return CHORE_GENERIC_SLUG;
}

/** Public URL for confirm-sheet / UI painted chore art. */
export function paintedChoreArtUrl(slug: string | null | undefined): string {
  const key = paintedChoreArtSlug(slug);
  return `/art/painted/chores/${key}.png?v=${PAINTED_CHORE_ART_BUST}`;
}
