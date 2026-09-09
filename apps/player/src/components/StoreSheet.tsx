import { MASCOT_EMOJI, type FarmPlayerCard } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type PlayerStore, type StoreSku } from "../api";
import { FarmStoreArt, MascotArt } from "../art";
import PinPad from "./PinPad";
import Sheet from "./Sheet";

type StoreTab = "shop" | "waiting" | "owned";

export default function StoreSheet({
  players,
  onClose,
}: {
  players: FarmPlayerCard[];
  onClose: () => void;
}) {
  const [shopperId, setShopperId] = useState<string | null>(null);
  const [pinKid, setPinKid] = useState<FarmPlayerCard | null>(null);
  const [store, setStore] = useState<PlayerStore | null>(null);
  const [tab, setTab] = useState<StoreTab>("shop");
  const [confirm, setConfirm] = useState<StoreSku | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const shopper = players.find((p) => p.id === shopperId) ?? null;

  async function loadStore() {
    const data = await api.store();
    setStore(data);
  }

  useEffect(() => {
    let cancelled = false;
    void api
      .session()
      .then((data) => {
        if (cancelled) return;
        if (data.player) {
          setShopperId(data.player.id);
          return api.store().then((storeData) => {
            if (!cancelled) setStore(storeData);
          });
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enterKid(kid: FarmPlayerCard, pin?: string) {
    setBusy(true);
    setError("");
    try {
      await api.enter(kid.id, pin);
      setShopperId(kid.id);
      setPinKid(null);
      await loadStore();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That PIN didn't work.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function pickKid(kid: FarmPlayerCard) {
    setError("");
    if (kid.hasPin && shopperId !== kid.id) {
      setPinKid(kid);
      return;
    }
    void enterKid(kid).catch(() => undefined);
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

  if (pinKid) {
    return (
      <PinPad
        name={pinKid.name}
        onCancel={() => setPinKid(null)}
        onSubmit={(pin) => enterKid(pinKid, pin)}
      />
    );
  }

  if (!shopperId) {
    return (
      <Sheet title="Farm Store" className="store-sheet" onClose={onClose}>
        <FarmStoreArt className="store-preview" />
        <p>Who is spending stars? Stars come from harvesting plants. A grown-up has to say yes.</p>
        {error && <p className="error">{error}</p>}
        <div className="store-kids">
          {players.map((kid) => (
            <button key={kid.id} className="store-kid" type="button" onClick={() => pickKid(kid)}>
              <MascotArt className="mascot-img" mascot={kid.mascot} />
              <strong>
                {MASCOT_EMOJI[kid.mascot]} {kid.name}
              </strong>
              <span>{kid.points}★</span>
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            Back to the farm
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Farm Store" className="store-sheet" onClose={onClose}>
      <p className="store-balance">
        {shopper ? `${shopper.name}'s stars` : "Your stars"} · <strong>{store?.availableStars ?? "…"}★</strong> ready
        {store && store.starsHeld > 0 ? ` · ${store.starsHeld}★ waiting on a grown-up` : ""}
      </p>
      <p className="muted">
        Ask for a reward here. Your Profile keeps the full story — earned stars, used rewards, and badges.
      </p>
      {toast && <p className="store-toast">{toast}</p>}
      {error && <p className="error">{error}</p>}
      {!store && <p>Opening the shelves…</p>}
      {store && (
        <div className="store-tabs" role="tablist" aria-label="Store sections">
          <button
            className={tab === "shop" ? "store-tab on" : "store-tab"}
            type="button"
            onClick={() => setTab("shop")}
          >
            Shop
          </button>
          <button
            className={tab === "waiting" ? "store-tab on" : "store-tab"}
            type="button"
            onClick={() => setTab("waiting")}
          >
            Waiting{store.pending.length ? ` (${store.pending.length})` : ""}
          </button>
          <button
            className={tab === "owned" ? "store-tab on" : "store-tab"}
            type="button"
            onClick={() => setTab("owned")}
          >
            Owned{store.owned.length ? ` (${store.owned.length})` : ""}
          </button>
        </div>
      )}
      {store && tab === "waiting" && (
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
      {store && tab === "owned" && (
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
      {store && tab === "shop" && (
        <div className="store-grid">
          {store.catalog.map((sku) => (
            <button
              key={sku.id}
              className={`store-card ${sku.affordable ? "" : "off"}`}
              type="button"
              disabled={busy}
              onClick={() => {
                setToast("");
                setError("");
                if (!sku.affordable) {
                  setError(`Need ${sku.starCost}★. You have ${store.availableStars}★ ready.`);
                  return;
                }
                setConfirm(sku);
              }}
            >
              <span className="store-card-emoji">{sku.emoji}</span>
              <strong>{sku.title}</strong>
              <span className="store-card-cost">{sku.starCost}★</span>
              {sku.description && <span className="store-card-copy">{sku.description}</span>}
              {!sku.affordable && <span className="store-card-need">Need more stars</span>}
            </button>
          ))}
        </div>
      )}
      {players.length > 1 && (
        <p>
          <button className="btn ghost" type="button" onClick={() => { setShopperId(null); setStore(null); }}>
            Shop as someone else
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
