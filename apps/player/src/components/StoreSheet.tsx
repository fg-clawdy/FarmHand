import { CURRENCY_DISPLAY, formatPoints, type FarmPlayerCard } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type PlayerStore, type StoreSku } from "../api";
import { FarmStoreArt } from "../art";
import { AlertIcon, CheckIcon, ClockIcon, GiftIcon, StarIcon, StoreIcon } from "./ModalIcons";
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
        setError(`Need ${formatPoints(fresh.pointCost)}. ${formatPoints(personal.availablePoints)} ready.`);
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
      const data = sku.wishlistItemId
        ? await api.requestStore({ wishlistItemId: sku.wishlistItemId })
        : await api.requestStore({ skuId: sku.id });
      setStore(data);
      setConfirm(null);
      setTab("waiting");
      setToast(`Asked a grown-up for ${sku.title}. ${formatPoints(sku.pointCost)} is set aside for now.`);
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
        title={`Whose ${CURRENCY_DISPLAY.noun}?`}
        copy={`Pick who is spending or checking rewards. Browse is open to everyone; spending uses that kid's ${CURRENCY_DISPLAY.noun}.`}
        players={players}
        onCancel={() => setIdentify(null)}
        onIdentified={(player) => void afterIdentified(player.id)}
      />
    );
  }

  return (
    <Sheet
      title="Farm Store"
      className="store-sheet"
      variant="crate"
      icon={<FarmStoreArt className="store-preview" />}
      onClose={onClose}
      subhead={
        <>
          <div className="store-wallet">
            <StarIcon className="store-wallet-star" />
            <p className="store-balance">
              {shopper && store ? (
                <>
                  <span className="store-wallet-name">{shopper.name}'s {CURRENCY_DISPLAY.noun}</span>
                  <span className="store-wallet-count">
                    <strong>{formatPoints(store.availablePoints)}</strong> ready
                  </span>
                  {store.heldPoints > 0 && (
                    <span className="store-wallet-held">
                      <ClockIcon /> {formatPoints(store.heldPoints)} waiting on a grown-up
                    </span>
                  )}
                </>
              ) : (
                <span className="store-wallet-name">Pick whose {CURRENCY_DISPLAY.noun} · catalog is open to browse</span>
              )}
            </p>
          </div>
          <div className="store-tabs" role="tablist" aria-label="Store sections">
            <button
              className={tab === "shop" ? "store-tab on" : "store-tab"}
              type="button"
              role="tab"
              aria-selected={tab === "shop"}
              onClick={() => openTab("shop")}
            >
              <StoreIcon /> Shop
            </button>
            <button
              className={tab === "waiting" ? "store-tab on" : "store-tab"}
              type="button"
              role="tab"
              aria-selected={tab === "waiting"}
              onClick={() => openTab("waiting")}
            >
              <ClockIcon /> Waiting{store?.pending.length ? ` (${store.pending.length})` : ""}
            </button>
            <button
              className={tab === "owned" ? "store-tab on" : "store-tab"}
              type="button"
              role="tab"
              aria-selected={tab === "owned"}
              onClick={() => openTab("owned")}
            >
              <GiftIcon /> Owned{store?.owned.length ? ` (${store.owned.length})` : ""}
            </button>
          </div>
        </>
      }
      footer={
        <>
          {shopperId && (
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
          )}
          <button className="btn ghost" type="button" onClick={onClose}>
            Back to the farm
          </button>
        </>
      }
      overlay={
        confirm && (
          <div className="store-confirm-scrim">
            <div className="store-confirm" role="dialog" aria-label="Confirm store request">
              <span className="store-confirm-emoji" aria-hidden>
                {confirm.emoji}
              </span>
              <p className="store-confirm-title">
                Ask a grown-up for {confirm.emoji} <strong>{confirm.title}</strong>?
              </p>
              <p className="store-confirm-copy">
                We'll keep <strong>{formatPoints(confirm.pointCost)}</strong> set aside while they decide. If they say yes, it's yours
                to use later. If they say no, you get the {CURRENCY_DISPLAY.noun} back.
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
          </div>
        )
      }
    >
      <p className="muted store-note">
        Ask for a reward here. Your Profile keeps the full story — earned {CURRENCY_DISPLAY.noun}, used rewards, and badges.
      </p>
      {toast && (
        <p className="store-toast" role="status">
          <CheckIcon /> {toast}
        </p>
      )}
      {error && (
        <p className="error store-error" role="alert">
          <AlertIcon /> {error}
        </p>
      )}
      {shelf.length === 0 && <p>Opening the shelves…</p>}
      {tab === "waiting" && shopperId && store && (
        <div className="store-pending">
          <h3>Waiting on a grown-up</h3>
          {store.pending.length === 0 && <p>Nothing waiting. Ask from Shop when you are ready.</p>}
          {store.pending.map((row) => (
            <p key={row.id} className="store-row">
              <span className="store-row-emoji">{row.emoji}</span>
              <span className="store-row-title">{row.title}</span>
              <span className="store-tag">
                <StarIcon /> {formatPoints(row.pointCost)} set aside
              </span>
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
            <p key={row.id} className="store-row">
              <span className="store-row-emoji">{row.emoji}</span>
              <span className="store-row-title">{row.title}</span>
              <span className="store-tag store-tag--owned">
                <CheckIcon /> yours · {formatPoints(row.pointCost)}
              </span>
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
                    setError(`Need ${formatPoints(sku.pointCost)}. You have ${formatPoints(store?.availablePoints ?? 0)} ready.`);
                    return;
                  }
                  setConfirm(sku);
                }}
              >
                {sku.imageUrl ? (
                  <img className="store-card-thumb" src={sku.imageUrl} alt="" draggable={false} />
                ) : (
                  <span className="store-card-emoji">{sku.emoji}</span>
                )}
                <strong className="store-card-title">{sku.title}</strong>
                {sku.description && <span className="store-card-copy">{sku.description}</span>}
                <span className="store-card-cost">
                  <StarIcon /> {formatPoints(sku.pointCost)}
                </span>
                {unaffordable && <span className="store-card-need">Need more {CURRENCY_DISPLAY.noun}</span>}
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
