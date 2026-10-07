import type { FarmPlayerCard } from "@farmhand/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import StoreSheet from "../components/StoreSheet";

/**
 * Modal design QA. `/qa/ui?sheet=store` mounts the real StoreSheet against a stubbed
 * `fetch` (no API needed). Extra params:
 *   kid=1         session already identified (wallet + affordability visible)
 *   poor=1        kid has too few points (shows the "need more stars" state)
 *   held=1        some points held, one request pending, one owned
 *   steps=a,b,c   click `.sheet--crate` buttons whose text contains each step, in order
 */
const CATALOG = [
  { id: "s1", slug: "movie-night", title: "Movie night", emoji: "🎬", description: "Pick a movie and watch it together.", pointCost: 200, isActive: true },
  { id: "s2", slug: "ice-cream", title: "Ice cream", emoji: "🍦", description: "A real ice cream treat.", pointCost: 500, isActive: true },
  { id: "s3", slug: "date-night", title: "Date night with a grown-up", emoji: "🍕", description: "Dinner out, just the two of you.", pointCost: 2100, isActive: true },
  { id: "s4", slug: "late-bed", title: "Stay up 30 minutes late", emoji: "🌙", description: "", pointCost: 150, isActive: true },
];

const PLAYERS = [
  { id: "p1", name: "Willow", mascot: "fox", seeds: 3, provisionalSeeds: 0, points: 600, fertilizer: 0 },
  { id: "p2", name: "Juniper", mascot: "bunny", seeds: 3, provisionalSeeds: 0, points: 40, fertilizer: 0 },
] as unknown as FarmPlayerCard[];

export default function UiPolishQa() {
  const [params] = useSearchParams();
  const sheet = params.get("sheet");
  const kid = params.get("kid") === "1";
  const poor = params.get("poor") === "1";
  const held = params.get("held") === "1";
  const steps = params.get("steps") ?? "";
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);

  const personal = useMemo(() => {
    const points = poor ? 120 : 600;
    const availablePoints = held ? points - 100 : points;
    const redemption = (id: string, sku: (typeof CATALOG)[number]) => ({
      id, skuId: sku.id, slug: sku.slug, title: sku.title, emoji: sku.emoji, pointCost: sku.pointCost,
    });
    return {
      points,
      heldPoints: held ? 100 : 0,
      availablePoints,
      lifetimeEarned: 900,
      lifetimeEarnedHarvest: 900,
      lifetimeEarnedGrant: 0,
      catalog: CATALOG.map((s) => ({ ...s, affordable: s.pointCost <= availablePoints })),
      pending: held ? [redemption("r1", CATALOG[3])] : [],
      owned: held ? [redemption("r2", CATALOG[1])] : [],
    };
  }, [poor, held]);

  useEffect(() => {
    const real = window.fetch;
    const json = (body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      if (url.includes("/api/store/catalog")) return json({ catalog: CATALOG });
      if (url.includes("/api/store/request")) {
        return json({ ...personal, ok: true, redemption: { id: "rx", title: "x", emoji: "x", pointCost: 1 } });
      }
      if (url.includes("/api/store")) return json(personal);
      if (url.includes("/api/session")) return json({ player: kid ? PLAYERS[0] : null });
      return real(input, init);
    };
    setReady(true);
    return () => {
      window.fetch = real;
    };
  }, [kid, personal]);

  useEffect(() => {
    if (!ready || !steps) return;
    const list = steps.split(",").filter(Boolean);
    let i = 0;
    const timer = window.setInterval(() => {
      const text = list[i++];
      if (!text) {
        window.clearInterval(timer);
        return;
      }
      const btn = Array.from(document.querySelectorAll<HTMLButtonElement>(".sheet--crate button")).find((b) =>
        (b.textContent ?? "").includes(text),
      );
      btn?.click();
    }, 450);
    return () => window.clearInterval(timer);
  }, [ready, steps]);

  return (
    <div className="screen" style={{ padding: 24 }}>
      <h1>Modal design QA</h1>
      <p>
        <Link to="/qa/ui?sheet=store">Store</Link> · <Link to="/qa/ui?sheet=store&kid=1">Store (kid)</Link> ·{" "}
        <Link to="/qa/ui?sheet=store&kid=1&poor=1">Store (kid, low stars)</Link> · <Link to="/">Back to farm</Link>
      </p>
      {ready && sheet === "store" && open && <StoreSheet players={PLAYERS} onClose={() => setOpen(false)} />}
    </div>
  );
}
