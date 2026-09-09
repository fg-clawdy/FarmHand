import { type FarmPlayerCard } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type PlayerStore, type StoreSku } from "../api";
import { FarmStoreArt } from "../art";
import Sheet from "./Sheet";
import WhoseKidPicker from "./WhoseKidPicker";

type StoreTab = "shop" | "waiting" | "owned";

export default function StoreSheet({
  players,
  onClose,
}: {
  players: FarmPlayerCard[];
  onClose: () => void;
}) {
  const [shopperId, setShopperId] = useState<string | null>(null);
  const [identify, setIdentify] = useState<null | { reason: "spend" | "waiting" | "owned"; sku?: StoreSku }>(null);
  const [catalog, setCatalog] = useState<StoreSku[]>([]);
  const [store, setStore] = useState<PlayerStore | null>(null);
  const [tab, setTab] = useState<StoreTab>("shop");
  const [confirm, setConfirm] = useState<StoreSku | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const shopper = players.find((p) => p.id === shopperId) ?? null;
  const shelf = store?.catalog ?? catalog;

  async function loadCatalog() {
    const data = await api.storeCatalog();
    setCatalog(data.catalog);
  }

  async function loadStore() {
    const data = await api.store();
    setStore(data);
  }

  useEffect(() => {
    let cancelled = false;
    void loadCatalog().catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function afterIdentified(playerId: string, next?: { reason: "spend" | "waiting" | "owned"; sku?: StoreSku }) {
    setShopperId(playerId);
    setIdentify(null);
    await loadStore();
    const reason = next?.reason ?? identify?.reason;
    const sku = next?.sku ?? identify?.sku;
    if (reason === "waiting") setTab("waiting");
    else if (reason === "owned") setTab("owned");
    else setTab("shop");
    if (reason === "spend" && sku) {
      const personal = await api.store();
      const fresh = personal.catalog.find((row) => row.id === sku.id);
      if (fresh && fresh.affordable === false) {
        setError(`Need ${fresh.starCost}★. ${personal.availableStars}★ ready.`);
        setConfirm(null);
        return;
      }
      setConfirm(fresh ?? sku);
    }
  }

  async function ensureIdentity(reason: "spend" | "waiting" | "owned", sku?: StoreSku) {
    setError("");
    setToast("");
    const session = await api.session();
    if (session.player) {
      await afterIdentified(session.player.id, { reason, sku });
      return;
    }
    setIdentify({ reason, sku });
  }

  async function requestSku(sku: StoreSku) {
    setBusy(true);
    setError("");
    try {
      const data = await api.requestStore(sku.id);
      setStore(data);
      setConfirm(null);
      setTab("waiting");
      setToast(`Asked a grown-up for ${sku.title}. ${sku.starCost}★ is set aside for now.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  function openTab(next: StoreTab) {
    if (next === "shop") {
      setTab("shop");
      return;
    }
    if (shopperId) {
      setTab(next);
      return;
    }
    void ensureIdentity(next);
  }

  if (identify) {
    return (
      <WhoseKidPicker
        title="Whose stars?"
        copy="Pick who is spending or checking rewards. Browse is open to everyone; spending uses that kid's stars."
        players={players}
        onCancel={() => setIdentify(null)}
        onIdentified={(player) => void afterIdentified(player.id)}
      />
    );
  }

  return (
    <Sheet title="Farm Store" className="store-sheet" onClose={onClose}>
      <FarmStoreArt className="store-preview" />
      <p className="store-balance">
        {shopper && store ? (
          <>
            {shopper.name}'s stars · <strong>{store.availableStars}★</strong> ready
            {store.starsHeld > 0 ? ` · ${store.starsHeld}★ waiting on a grown-up` : ""}
          </>
        ) : (
          <>Pick whose stars · catalog is open to browse</>
        )}
      </p>
      <p className="muted">
        Ask for a reward here. Your Profile keeps the full story — earned stars, used rewards, and badges.
      </p>
      {toast && <p className="store-toast">{toast}</p>}
      {error && <p className="error">{error}</p>}
      {shelf.length === 0 && <p>Opening the shelves…</p>}
      <div className="store-tabs" role="tablist" aria-label="Store sections">
        <button className={tab === "shop" ? "store-tab on" : "store-tab"} type="button" onClick={() => openTab("shop")}>
          Shop
        </button>
        <button
          className={tab === "waiting" ? "store-tab on" : "store-tab"}
          type="button"
          onClick={() => openTab("waiting")}
        >
          Waiting{store?.pending.length ? ` (${store.pending.length})` : ""}
        </button>
        <button className={tab === "owned" ? "store-tab on" : "store-tab"} type="button" onClick={() => openTab("owned")}>
          Owned{store?.owned.length ? ` (${store.owned.length})` : ""}
        </button>
      </div>
      {tab === "waiting" && shopperId && store && (
        <div className="store-pending">
          <h3>Waiting on a grown-up</h3>
          {store.pending.length === 0 && <p>Nothing waiting. Ask from Shop when you are ready.</p>}
          {store.pending.map((row) => (
            <p key={row.id}>
              {row.emoji} {row.title} · {row.starCost}★ set aside
            </p>
          ))}
        </div>
      )}
      {tab === "owned" && shopperId && store && (
        <div className="store-pending">
          <h3>Ready to use later</h3>
          {store.owned.length === 0 && (
            <p>When a grown-up says yes, the reward lives here until you use it in real life.</p>
          )}
          {store.owned.map((row) => (
            <p key={row.id}>
              {row.emoji} {row.title} · yours · {row.starCost}★
            </p>
          ))}
        </div>
      )}
      {tab === "shop" && shelf.length > 0 && (
        <div className="store-grid">
          {shelf.map((sku) => {
            const identified = Boolean(shopperId && store);
            const unaffordable = identified && sku.affordable === false;
            return (
              <button
                key={sku.id}
                className={`store-card ${unaffordable ? "off" : ""}`}
                type="button"
                disabled={busy}
                onClick={() => {
                  setToast("");
                  setError("");
                  if (!shopperId) {
                    void ensureIdentity("spend", sku);
                    return;
                  }
                  if (unaffordable) {
                    setError(`Need ${sku.starCost}★. You have ${store?.availableStars}★ ready.`);
                    return;
                  }
                  setConfirm(sku);
                }}
              >
                <span className="store-card-emoji">{sku.emoji}</span>
                <strong>{sku.title}</strong>
                <span className="store-card-cost">{sku.starCost}★</span>
                {sku.description && <span className="store-card-copy">{sku.description}</span>}
                {unaffordable && <span className="store-card-need">Need more stars</span>}
              </button>
            );
          })}
        </div>
      )}
      {shopperId && (
        <p>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setShopperId(null);
              setStore(null);
              setConfirm(null);
              setTab("shop");
              void loadCatalog();
            }}
          >
            Browse without a kid
          </button>
        </p>
      )}
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Back to the farm
        </button>
      </div>
      {confirm && (
        <div className="store-confirm" role="dialog" aria-label="Confirm store request">
          <p>
            Ask a grown-up for {confirm.emoji} <strong>{confirm.title}</strong>?
          </p>
          <p>
            We'll keep <strong>{confirm.starCost}★</strong> set aside while they decide. If they say yes, it's yours to
            use later. If they say no, you get the stars back.
          </p>
          <div className="sheet-actions">
            <button className="btn primary" type="button" disabled={busy} onClick={() => void requestSku(confirm)}>
              {busy ? "Asking…" : "Ask a grown-up"}
            </button>
            <button className="btn ghost" type="button" onClick={() => setConfirm(null)}>
              Not now
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
