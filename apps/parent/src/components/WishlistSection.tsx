import { formatPoints, priceBreakdown } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type ParentWishlistItem, type ParentWishlistPayload } from "../api";

function centsToDollars(cents: number | null): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

function dollarsToCents(input: string): number {
  const n = Number.parseFloat(input);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function dollarLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type LinkMode = "review" | "over" | "accept";

function ItemThumb({ item, fallback = "🎁" }: { item: ParentWishlistItem; fallback?: string }) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt=""
        style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, background: "#fff", flex: "0 0 auto" }}
      />
    );
  }
  return <span className="emoji">{fallback}</span>;
}

export default function WishlistSection() {
  const [payload, setPayload] = useState<ParentWishlistPayload | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const [linkPlayerId, setLinkPlayerId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkMode, setLinkMode] = useState<LinkMode>("review");
  const [linkThreshold, setLinkThreshold] = useState("25");
  const [linking, setLinking] = useState(false);

  async function load() {
    const data = await api.wishlist();
    setPayload(data);
    setLinkPlayerId((prev) => prev || data.kids[0]?.id || "");
    const seeded: Record<string, string> = {};
    for (const kid of data.kids) {
      for (const item of kid.items) {
        if (item.status === "PENDING") seeded[item.id] = centsToDollars(item.priceCents);
      }
    }
    setPrices((prev) => ({ ...seeded, ...prev }));
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  function refreshAfter(mutate: () => Promise<unknown>) {
    return async () => {
      try {
        await mutate();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "That didn't work.");
      } finally {
        setBusyId(null);
      }
    };
  }

  async function syncNow() {
    setSyncing(true);
    setNote("");
    setError("");
    try {
      const result = await api.syncWishlist();
      const ok = result.results.filter((r) => r.ok).length;
      const failed = result.results.filter((r) => !r.ok).length;
      setNote(`Synced ${ok} wishlist${ok === 1 ? "" : "s"}${failed ? ` · ${failed} skipped` : ""}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function saveLink() {
    setLinking(true);
    setError("");
    setNote("");
    try {
      const thresholdCents = linkMode === "over" ? dollarsToCents(linkThreshold) : null;
      if (linkMode === "over" && (thresholdCents == null || thresholdCents < 1)) {
        setError("Enter a dollar amount to auto-confirm under.");
        return;
      }
      const result = await api.linkWishlist({
        playerId: linkPlayerId,
        url: linkUrl,
        mode: linkMode,
        thresholdCents,
      });
      if (result.ok) {
        setNote(`Linked and pulled ${result.items ?? 0} item${result.items === 1 ? "" : "s"}.`);
        setLinkUrl("");
      } else {
        setError(result.error ?? "Linked, but we couldn't read that list just now. We'll retry weekly.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      await load().catch(() => undefined);
    } finally {
      setLinking(false);
    }
  }

  async function removeLink(playerId: string) {
    setBusyId(playerId);
    setError("");
    setNote("");
    try {
      await api.unlinkWishlist(playerId);
      await load();
      setNote("Wishlist unlinked. Confirmed items stay in the shop until you hide them.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusyId(null);
    }
  }

  function confirm(id: string) {
    return refreshAfter(async () => {
      const cents = dollarsToCents(prices[id] ?? "");
      if (cents < 1) throw new Error("Enter a price of at least $0.01.");
      await api.confirmWishlistItem(id, cents);
    });
  }

  function hide(id: string) {
    return refreshAfter(() => api.hideWishlistItem(id));
  }

  function unhide(id: string) {
    return refreshAfter(() => api.unhideWishlistItem(id));
  }

  if (!payload) {
    return (
      <section aria-label="Wishlists">
        <h3>Amazon wishlists</h3>
        <p>Opening wishlists…</p>
      </section>
    );
  }

  const visibleKids = payload.kids.filter((k) => k.wishlistUrl);
  const pending: ParentWishlistItem[] = [];
  const confirmed: ParentWishlistItem[] = [];
  const hidden: ParentWishlistItem[] = [];
  for (const kid of payload.kids) {
    for (const item of kid.items) {
      if (item.status === "PENDING") pending.push(item);
      else if (item.status === "CONFIRMED") confirmed.push(item);
      else if (item.status === "HIDDEN") hidden.push(item);
    }
  }

  return (
    <section aria-label="Wishlists">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h3>Amazon wishlists</h3>
        <button className="btn" type="button" disabled={syncing} onClick={() => void syncNow()}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h4 style={{ marginTop: 0 }}>Link a child's wishlist</h4>
        <label className="field">
          Child
          <select value={linkPlayerId} onChange={(e) => setLinkPlayerId(e.target.value)}>
            {payload.kids.length === 0 && <option value="">No kids yet</option>}
            {payload.kids.map((kid) => (
              <option key={kid.id} value={kid.id}>
                {kid.name}
                {kid.wishlistUrl ? " (has a wishlist)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Amazon wishlist link (one at a time)
          <input
            type="url"
            placeholder="https://www.amazon.com/hz/wishlist/ls/..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </label>
        <p style={{ margin: "12px 0 4px" }}>
          <strong>After we pull the items:</strong>
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <label className="choice">
            <input name="wishlistMode" type="radio" checked={linkMode === "review"} onChange={() => setLinkMode("review")} />
            Review every item
          </label>
          <label className="choice">
            <input name="wishlistMode" type="radio" checked={linkMode === "over"} onChange={() => setLinkMode("over")} />
            Confirm items under
          </label>
          <span className="muted">$</span>
          <input
            type="number"
            min="1"
            step="0.01"
            style={{ width: 72 }}
            value={linkThreshold}
            onChange={(e) => setLinkThreshold(e.target.value)}
            disabled={linkMode !== "over"}
          />
          <label className="choice">
            <input name="wishlistMode" type="radio" checked={linkMode === "accept"} onChange={() => setLinkMode("accept")} />
            Accept everything automatically
          </label>
        </div>
        <p className="muted" style={{ margin: "4px 0 10px" }}>
          Anything over the limit — and anything without a shown price — stays for you to review.
        </p>
        <button
          className="btn sage"
          type="button"
          disabled={linking || !linkPlayerId}
          onClick={() => void saveLink()}
        >
          {linking ? "Linking…" : "Link & pull items"}
        </button>
      </div>

      {visibleKids.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {visibleKids.map((kid) => (
            <div
              key={kid.id}
              className="card"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
            >
              <div>
                <strong>{kid.name}</strong>{" "}
                <span className="muted">
                  {kid.items.length} item{kid.items.length === 1 ? "" : "s"}
                  {kid.syncedAt ? ` · synced ${new Date(kid.syncedAt).toLocaleDateString()}` : ""}
                </span>
              </div>
              <button
                className="btn"
                type="button"
                disabled={busyId === kid.id}
                onClick={() => void removeLink(kid.id)}
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {note && <p className="muted">{note}</p>}

      {visibleKids.length === 0 && (
        <p className="card">No wishlists are linked yet. Add one above with a child's public Amazon wishlist link.</p>
      )}

      {pending.length === 0 && confirmed.length === 0 && hidden.length === 0 && visibleKids.length > 0 && (
        <p className="card">No wishlist items yet. Press “Sync now” to pull the latest list.</p>
      )}

      {pending.length > 0 && (
        <div className="claim-list">
          {pending.map((item) => {
            const preview = prices[item.id] ? priceBreakdown(dollarsToCents(prices[item.id] ?? "")) : null;
            return (
              <article key={item.id} className="card claim">
                <div>
                  <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <ItemThumb item={item} />
                    {item.title}
                  </h3>
                  {item.needsAttention && (
                    <p className="muted" style={{ marginTop: 0 }}>
                      Price not shown — enter it below to confirm.
                    </p>
                  )}
                  <div className="row">
                    <label className="field">
                      Price ($)
                      <input
                        inputMode="decimal"
                        value={prices[item.id] ?? ""}
                        placeholder="0.00"
                        onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                      />
                    </label>
                    {preview && (
                      <p className="muted">
                        {dollarLabel(preview.priceCents)} + {dollarLabel(preview.taxCents)} tax →{" "}
                        <strong>{formatPoints(preview.pointCost)}</strong>
                      </p>
                    )}
                  </div>
                  <div className="row">
                    <button
                      className="btn sage"
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => {
                        setBusyId(item.id);
                        setError("");
                        void confirm(item.id)();
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      className="btn"
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => {
                        setBusyId(item.id);
                        setError("");
                        void hide(item.id)();
                      }}
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {confirmed.length > 0 && (
        <div className="claim-list">
          {confirmed.map((item) => (
            <article key={item.id} className="card claim">
              <div className="claim-head">
                <ItemThumb item={item} />
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.pointCost != null ? formatPoints(item.pointCost) : ""} · live in {payload.kids.find((k) => k.id === item.playerId)?.name ?? "a child's"} shop
                  </p>
                  {item.productUrl && (
                    <a href={item.productUrl} target="_blank" rel="noreferrer">
                      View on Amazon ↗
                    </a>
                  )}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn"
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id);
                    setError("");
                    void hide(item.id)();
                  }}
                >
                  Hide
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <div className="claim-list">
          {hidden.map((item) => (
            <article key={item.id} className="card claim">
              <div className="claim-head">
                <ItemThumb item={item} fallback="🙈" />
                <div>
                  <h3>{item.title}</h3>
                  <p>Hidden from kids</p>
                </div>
              </div>
              <div className="row">
                <button
                  className="btn sage"
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id);
                    setError("");
                    void unhide(item.id)();
                  }}
                >
                  Unhide
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}