/**
 * Amazon Wishlist Phase 1.
 *
 * `WISHLIST_URLS` maps child name -> public wishlist URL (retailer is inferred
 * from the host). A weekly schedule (plus a boot-time pass and a manual parent
 * button) scrapes each child's public list, upserting WishlistItem rows.
 * Parents then confirm the price (Amazon often hides it from non-owners); only
 * CONFIRMED items show up in the child's store. Redemptions snapshot the
 * `productUrl` so a grown-up gets a direct link to buy.
 *
 * Target / Walmart are deliberately deferred: they need a headless browser,
 * which arrives once an example public list is available. The `ListProvider`
 * seam is already here so those slots in as additive providers.
 */
import { DateTime } from "luxon";
import { canAfford, starCostForPriceCents } from "@farmhand/shared";
import { prisma } from "./db.js";
import { httpError } from "./chores.js";
import { loadConfig } from "./game.js";

// ---- Config ----

export type WishlistUrlMap = Record<string, string>;

/** Parse `WISHLIST_URLS` (a JSON object). Keys are matched to child names case-insensitively. */
export function parseWishlistUrls(raw: string | undefined): WishlistUrlMap {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: WishlistUrlMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) out[key.trim().toLowerCase()] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function wishlistUrls(): WishlistUrlMap {
  return parseWishlistUrls(process.env.WISHLIST_URLS);
}

export function retailerFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("amazon.")) return "amazon";
    if (host.includes("target.")) return "target";
    if (host.includes("walmart.")) return "walmart";
  } catch {
    // ignore malformed URLs
  }
  return "";
}

// ---- Scrape types + provider seam ----

export type ScrapedWishlistItem = {
  asin: string | null;
  title: string;
  priceCents: number | null;
  productUrl: string | null;
  imageUrl: string | null;
  needsAttention: boolean;
};

export type WishlistScrapeResult = {
  retailer: string;
  ok: boolean;
  error?: string;
  items: ScrapedWishlistItem[];
};

export type ListProvider = {
  id: string;
  scrape(url: string, fetchFn?: typeof fetch): Promise<WishlistScrapeResult>;
};

// ---- HTML helpers ----

function decodeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parsePriceText(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  return whole * 100 + frac;
}

function resolveRelativeUrl(href: string): string {
  try {
    return new URL(href, "https://www.amazon.com").toString();
  } catch {
    return "";
  }
}

/** Pull the product image from an item block's `<img>` tags, skipping data URIs and spacers. */
function imageUrlFromBlock(block: string): string | null {
  const tags = block.match(/<img\b[^>]*>/gi) ?? [];
  const pick = (tag: string) =>
    /data-old-hires="([^"]+)"/i.exec(tag)?.[1] ??
    /data-csa-c-src="([^"]+)"/i.exec(tag)?.[1] ??
    /src="([^"]+)"/i.exec(tag)?.[1] ??
    null;
  for (const tag of tags) {
    const src = pick(tag);
    if (!src) continue;
    if (/^data:/i.test(src) || /spacer|sprite|blank|\.gif($|[?#])/i.test(src)) continue;
    return resolveRelativeUrl(decodeHtml(src));
  }
  return null;
}

/**
 * Best-effort parse of a server-rendered public Amazon wishlist.
 * Each item is an `<li ... data-itemId="I..." data-price="22.49" ...>` paired
 * with an `<a id="itemName_I..." title="..." href="/dp/ASIN/...">`. Prices that
 * Amazon hides from outsiders simply come back null and flag `needsAttention`.
 */
export function parseAmazonWishlist(html: string): WishlistScrapeResult {
  if (/api-services-support|automated access|Enter the characters you see|robot check/i.test(html)) {
    return {
      retailer: "amazon",
      ok: false,
      error: "Amazon asked us to prove we are human. A grown-up can enter the price by hand instead.",
      items: [],
    };
  }

  // title + ASIN from the named anchors.
  const anchors = new Map<string, { title: string; href: string }>();
  const anchorRe = /<a\b[^>]*?id="itemName_([^"]+)"[^>]*?>/g;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const tag = m[0];
    const title = /title="([^"]*)"/.exec(tag)?.[1] ?? "";
    const href = /href="([^"]*)"/.exec(tag)?.[1] ?? "";
    anchors.set(m[1]!, { title: decodeHtml(title), href: decodeHtml(href) });
  }

  const items: ScrapedWishlistItem[] = [];
  const liRe = /<li\b[^>]*?data-itemId="([^"]+)"[^>]*?>/g;
  while ((m = liRe.exec(html))) {
    const tag = m[0];
    const innerId = m[1]!;
    const priceRaw = /data-price="([^"]+)"/.exec(tag)?.[1];
    const asinExternal = /ASIN:([A-Z0-9]{10})/.exec(tag)?.[1];
    const anchor = anchors.get(innerId);
    const asin = asinExternal ?? /\/dp\/([A-Z0-9]{10})/.exec(anchor?.href ?? "")?.[1] ?? null;
    const title = anchor?.title ?? "";
    const productUrl = asin ? `https://www.amazon.com/dp/${asin}/` : (anchor?.href ? resolveRelativeUrl(anchor.href) : null);
    const priceCents = parsePriceText(priceRaw);
    const liEnd = html.indexOf("</li>", m.index);
    const block = html.slice(m.index, liEnd === -1 ? m.index + 8000 : liEnd);
    const imageUrl = imageUrlFromBlock(block);
    items.push({
      asin,
      title: title || `Amazon item ${asin ?? innerId}`,
      priceCents,
      productUrl,
      imageUrl,
      needsAttention: priceCents == null,
    });
  }

  if (items.length === 0) {
    if (/list is private|confidential|list.*not.*found|doesn.t exist/i.test(html)) {
      return { retailer: "amazon", ok: false, error: "That wishlist looks private or missing.", items: [] };
    }
    return { retailer: "amazon", ok: true, items: [] };
  }

  return { retailer: "amazon", ok: true, items };
}

async function scrapeAmazon(url: string, fetchFn: typeof fetch = fetch): Promise<WishlistScrapeResult> {
  try {
    const res = await fetchFn(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return { retailer: "amazon", ok: false, error: `Amazon returned ${res.status}.`, items: [] };
    return parseAmazonWishlist(await res.text());
  } catch (err) {
    return { retailer: "amazon", ok: false, error: (err as Error).message, items: [] };
  }
}

/** Add Target / Walmart providers here once example lists + a headless browser land. */
const providers: Record<string, ListProvider> = {
  amazon: { id: "amazon", scrape: scrapeAmazon },
};

// ---- Sync ----

export type WishlistSyncResult = {
  playerId: string;
  ok: boolean;
  skipped?: "no-url" | "unsupported-retailer";
  items?: number;
  error?: string;
};

export async function syncWishlistForPlayer(playerId: string): Promise<WishlistSyncResult> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { playerId, ok: false, error: "No such child." };

  const url = player.amazonWishlistUrl || wishlistUrls()[player.name.trim().toLowerCase()];
  if (!url) {
    return { playerId, ok: false, skipped: "no-url", error: "No wishlist URL configured for this child." };
  }
  const retailer = retailerFromUrl(url);
  const provider = providers[retailer];
  if (!provider) {
    return { playerId, ok: false, skipped: "unsupported-retailer", error: `Retailer "${retailer}" is not supported yet.` };
  }

  const result = await provider.scrape(url);
  if (!result.ok) {
    await prisma.player.update({
      where: { id: playerId },
      data: { amazonWishlistUrl: url, wishlistSyncedAt: new Date() },
    });
    return { playerId, ok: false, error: result.error, items: 0 };
  }

  const now = new Date();
  await upsertScrapedItems(playerId, retailer, result.items, now);
  await prisma.player.update({ where: { id: playerId }, data: { amazonWishlistUrl: url, wishlistSyncedAt: now } });
  return { playerId, ok: true, items: result.items.length };
}

function autoConfirmFor(
  mode: LinkWishlistMode | undefined,
  priceCents: number,
  thresholdCents: number | null | undefined,
): boolean {
  if (!mode) return false;
  if (mode === "accept") return true;
  if (mode === "over") return thresholdCents != null && priceCents <= thresholdCents;
  return false;
}

async function upsertScrapedItems(
  playerId: string,
  retailer: string,
  items: ScrapedWishlistItem[],
  now: Date,
  mode?: LinkWishlistMode,
  thresholdCents?: number | null,
): Promise<void> {
  for (const it of items) {
    const existing = await prisma.wishlistItem.findFirst({
      where: it.asin
        ? { playerId, retailer, asin: it.asin }
        : { playerId, retailer, title: it.title },
    });

    if (!existing) {
      const starCost = it.priceCents == null ? null : starCostForPriceCents(it.priceCents);
      const status =
        it.priceCents != null && autoConfirmFor(mode, it.priceCents, thresholdCents)
          ? "CONFIRMED"
          : "PENDING";
      await prisma.wishlistItem.create({
        data: {
          playerId,
          retailer,
          asin: it.asin,
          title: it.title,
          productUrl: it.productUrl,
          imageUrl: it.imageUrl,
          priceCents: it.priceCents,
          starCost,
          status,
          needsAttention: it.priceCents == null,
          lastSeenAt: now,
        },
      });
      continue;
    }

    // Refresh title/link/image/freshness; only a PENDING row takes a newly scraped price.
    const data: {
      title: string;
      productUrl: string | null;
      imageUrl: string | null;
      lastSeenAt: Date;
      priceCents?: number | null;
      starCost?: number | null;
      needsAttention?: boolean;
      status?: "PENDING" | "CONFIRMED";
    } = { title: it.title, productUrl: it.productUrl, imageUrl: it.imageUrl, lastSeenAt: now };
    if (existing.status === "PENDING") {
      data.priceCents = it.priceCents;
      data.starCost = it.priceCents == null ? null : starCostForPriceCents(it.priceCents);
      data.needsAttention = it.priceCents == null;
      if (it.priceCents != null && autoConfirmFor(mode, it.priceCents, thresholdCents)) {
        data.status = "CONFIRMED";
      }
    }
    await prisma.wishlistItem.update({ where: { id: existing.id }, data });
  }
}

export async function syncAllWishlists(): Promise<{ results: WishlistSyncResult[] }> {
  const urlMap = wishlistUrls();
  const players = await prisma.player.findMany({
    where: { isActive: true },
    select: { id: true, name: true, amazonWishlistUrl: true },
  });
  const withUrl = players.filter((p) => p.amazonWishlistUrl || urlMap[p.name.trim().toLowerCase()]);

  const results: WishlistSyncResult[] = [];
  for (const player of withUrl) {
    try {
      results.push(await syncWishlistForPlayer(player.id));
    } catch (err) {
      results.push({ playerId: player.id, ok: false, error: (err as Error).message });
    }
  }
  return { results };
}

export type LinkWishlistMode = "review" | "over" | "accept";

/** Link (or relink) a child's public wishlist and apply a first-pass verify mode. */
export async function linkWishlistForPlayer(
  playerId: string,
  url: string,
  mode: LinkWishlistMode,
  thresholdCents?: number | null,
): Promise<WishlistSyncResult & { linked: boolean }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw httpError("That child isn't on the farm.", 404);

  const cleanUrl = url.trim();
  if (!cleanUrl) throw httpError("Paste the wishlist link first.");

  const retailer = retailerFromUrl(cleanUrl);
  const provider = providers[retailer];
  if (!provider) {
    throw httpError(
      retailer
        ? `For now we can only read Amazon public wishlists (that link looks like "${retailer}").`
        : "That link doesn't look like a supported wishlist URL.",
    );
  }

  if (mode === "over" && (thresholdCents == null || thresholdCents < 1)) {
    throw httpError("Enter a dollar amount so we know what to auto-confirm.");
  }

  const result = await provider.scrape(cleanUrl);
  const now = new Date();
  await prisma.player.update({
    where: { id: playerId },
    data: { amazonWishlistUrl: cleanUrl, wishlistSyncedAt: now },
  });

  if (!result.ok) {
    return { playerId, linked: true, ok: false, error: result.error, items: 0 };
  }

  await upsertScrapedItems(playerId, retailer, result.items, now, mode, thresholdCents ?? undefined);
  return { playerId, linked: true, ok: true, items: result.items.length };
}

export async function unlinkWishlistForPlayer(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw httpError("That child isn't on the farm.", 404);
  await prisma.player.update({ where: { id: playerId }, data: { amazonWishlistUrl: null } });
}

// ---- Parent-facing actions + payload ----

export function parsePriceCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100_000_000) {
    throw httpError("Price should be a whole number of cents (1 to $1,000,000).");
  }
  return n;
}

export function publicWishlistItem(row: {
  id: string;
  playerId: string;
  retailer: string;
  asin: string | null;
  title: string;
  productUrl: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  starCost: number | null;
  status: string;
  needsAttention: boolean;
  lastSeenAt: Date | null;
}) {
  return {
    id: row.id,
    playerId: row.playerId,
    retailer: row.retailer,
    asin: row.asin,
    title: row.title,
    productUrl: row.productUrl,
    imageUrl: row.imageUrl,
    priceCents: row.priceCents,
    starCost: row.starCost,
    status: row.status,
    needsAttention: row.needsAttention,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
  };
}

export async function parentWishlistPayload() {
  const urlMap = wishlistUrls();
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { wishlistItems: { orderBy: { updatedAt: "asc" } } },
  });
  const kids = players.map((p) => {
    const configured = urlMap[p.name.trim().toLowerCase()] ?? null;
    return {
      id: p.id,
      name: p.name,
      mascot: p.mascot,
      wishlistUrl: p.amazonWishlistUrl ?? configured ?? null,
      syncedAt: p.wishlistSyncedAt?.toISOString() ?? null,
      items: p.wishlistItems.map(publicWishlistItem),
    };
  });
  return { kids, urlsConfigured: Object.keys(urlMap).length > 0 };
}

export async function confirmWishlistItem(id: string, priceCents: number) {
  const cents = parsePriceCents(priceCents);
  const item = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!item) throw httpError("That wish isn't here.", 404);
  return prisma.wishlistItem.update({
    where: { id },
    data: { priceCents: cents, starCost: starCostForPriceCents(cents), status: "CONFIRMED", needsAttention: false },
  });
}

export async function hideWishlistItem(id: string) {
  const item = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!item) throw httpError("That wish isn't here.", 404);
  return prisma.wishlistItem.update({ where: { id }, data: { status: "HIDDEN" } });
}

export async function unhideWishlistItem(id: string) {
  const item = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!item) throw httpError("That wish isn't here.", 404);
  return prisma.wishlistItem.update({
    where: { id },
    data: { status: item.priceCents == null ? "PENDING" : "CONFIRMED" },
  });
}

export async function createManualWishlistItem(opts: {
  playerId: string;
  title: string;
  priceCents?: number | null;
  productUrl?: string | null;
}) {
  const title = String(opts.title ?? "").trim();
  if (!title) throw httpError("Give the wish a name.");
  const player = await prisma.player.findUnique({ where: { id: opts.playerId } });
  if (!player) throw httpError("That child isn't on the farm.", 404);
  const cents = opts.priceCents == null ? null : parsePriceCents(opts.priceCents);
  return prisma.wishlistItem.create({
    data: {
      playerId: opts.playerId,
      retailer: "manual",
      asin: null,
      title,
      productUrl: opts.productUrl?.trim() || null,
      priceCents: cents,
      starCost: cents == null ? null : starCostForPriceCents(cents),
      status: cents == null ? "PENDING" : "CONFIRMED",
      needsAttention: cents == null,
    },
  });
}

// ---- Player-facing: confirmed items merge into the store ----

/** Confirmed wishlist rows, shaped like store catalog rows so the player store can merge them. */
export async function confirmedWishlistCatalog(playerId: string, currentStars: number, heldStars: number) {
  const rows = await prisma.wishlistItem.findMany({
    where: { playerId, status: "CONFIRMED", starCost: { gte: 1 } },
    orderBy: { updatedAt: "asc" },
  });
  return rows.map((row, i) => ({
    id: row.id,
    slug: `wishlist:${row.id}`,
    title: row.title,
    emoji: "🎁",
    imageUrl: row.imageUrl,
    description: "",
    starCost: row.starCost ?? 0,
    isActive: true,
    sortOrder: 900 + i,
    wishlistItemId: row.id,
    affordable: canAfford(currentStars, heldStars, row.starCost ?? 0),
  }));
}

// ---- Weekly schedule ----

/** Sync once a week, Sunday 04:00 in the family timezone (checked every 10 min). */
export function startWishlistWeeklySchedule(log?: { info: (obj: unknown, msg?: string) => void }): () => void {
  let lastRunWeekKey = "";
  const tick = async () => {
    try {
      const config = await loadConfig();
      const tz = config.timezone || "America/Chicago";
      const zoned = DateTime.now().setZone(tz);
      const weekKey = `${zoned.weekYear}-W${zoned.weekNumber}`;
      if (zoned.weekday !== 7 || zoned.hour !== 4) return;
      if (lastRunWeekKey === weekKey) return;
      lastRunWeekKey = weekKey;
      const result = await syncAllWishlists();
      log?.info?.(result, "wishlist weekly sync");
    } catch (err) {
      log?.info?.({ err }, "wishlist weekly sync failed");
    }
  };
  const handle = setInterval(() => void tick(), 10 * 60_000);
  if (typeof handle.unref === "function") handle.unref();
  return () => clearInterval(handle);
}