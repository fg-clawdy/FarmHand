import { CURRENCY_DISPLAY, formatPoints } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type ParentKid, type ParentRedemption, type ParentStoreSku, type SkuWrite } from "../api";
import SharedGoalsPage from "./SharedGoalsPage";
import WishlistSection from "../components/WishlistSection";

type SkuForm = {
  title: string;
  emoji: string;
  description: string;
  pointCost: string;
  isActive: boolean;
};

const blankForm: SkuForm = {
  title: "",
  emoji: "⭐",
  description: "",
  pointCost: "100",
  isActive: true,
};

function fromSku(sku: ParentStoreSku): SkuForm {
  return {
    title: sku.title,
    emoji: sku.emoji,
    description: sku.description,
    pointCost: String(sku.pointCost),
    isActive: sku.isActive,
  };
}

function toWrite(form: SkuForm): SkuWrite {
  return {
    title: form.title,
    emoji: form.emoji,
    description: form.description,
    pointCost: Number(form.pointCost),
    isActive: form.isActive,
  };
}

export default function StorePage() {
  const [pending, setPending] = useState<ParentRedemption[] | null>(null);
  const [owned, setOwned] = useState<ParentRedemption[]>([]);
  const [history, setHistory] = useState<ParentRedemption[]>([]);
  const [skus, setSkus] = useState<ParentStoreSku[]>([]);
  const [kids, setKids] = useState<ParentKid[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SkuForm>(blankForm);

  async function refresh() {
    const data = await api.store();
    setPending(data.pending ?? data.redemptions);
    setOwned(data.owned ?? []);
    setHistory((data.history ?? []).filter((row) => row.status === "redeemed" || row.status === "denied"));
    setSkus(data.skus);
    setKids(data.kids ?? []);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    const t = setInterval(() => void refresh().catch(() => undefined), 8000);
    return () => clearInterval(t);
  }, []);

  async function act(id: string, action: "approve" | "deny") {
    setBusyId(id);
    setError("");
    try {
      if (action === "approve") await api.approveRedemption(id);
      else await api.denyRedemption(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function markUsed(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api.redeemRedemption(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function saveSku() {
    setBusyId(editingId ?? "new");
    setError("");
    try {
      if (editingId && editingId !== "new") {
        const data = await api.updateSku(editingId, toWrite(form));
        setSkus((rows) => rows.map((row) => (row.id === data.sku.id ? data.sku : row)));
      } else {
        const data = await api.createSku(toWrite(form));
        setSkus((rows) => [...rows, data.sku].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)));
      }
      setEditingId(null);
      setForm(blankForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleShelf(sku: ParentStoreSku) {
    setBusyId(sku.id);
    setError("");
    try {
      const data = await api.updateSku(sku.id, { isActive: !sku.isActive });
      setSkus((rows) => rows.map((row) => (row.id === data.sku.id ? data.sku : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusyId(null);
    }
  }

  if (!pending) {
    return (
      <div>
        <h2>Store</h2>
        <p>Opening the shelves…</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Store</h2>
      <p className="muted">
        Kids spend <strong>{CURRENCY_DISPLAY.noun}</strong> on real-world promises ({formatPoints(1)} = 1¢). A request sets {CURRENCY_DISPLAY.noun} aside.{" "}
        <strong>Approve</strong> turns the request into an owned reward. <strong>Deny</strong> gives the {CURRENCY_DISPLAY.noun} back.
        Later, <strong>Mark redeemed</strong> when it actually happens. Full history also lives on each kid's Profile.
      </p>
      <SharedGoalsPage />
      {error && <p className="error">{error}</p>}

      {kids.length > 0 && (
        <>
          <h3>{CURRENCY_DISPLAY.nounSingular} wallets</h3>
          <div className="claim-list">
            {kids.map((kid) => (
              <article key={kid.id} className="card">
                <h3 style={{ marginTop: 0 }}>{kid.name}</h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  {kid.wallet ? formatPoints(kid.wallet.availablePoints) : "—"} ready
                  {kid.wallet && kid.wallet.heldPoints > 0 ? ` · ${formatPoints(kid.wallet.heldPoints)} waiting` : ""}
                  {kid.wallet ? ` · ${formatPoints(kid.wallet.lifetimeEarned)} earned all time` : ""}
                </p>
              </article>
            ))}
          </div>
        </>
      )}

      <WishlistSection />

      <h3>Waiting for you</h3>
      {pending.length === 0 && <p className="card">No store requests right now.</p>}
      <div className="claim-list">
        {pending.map((row) => (
          <article key={row.id} className="card claim">
            <div className="claim-head">
              <span className="emoji">{row.emoji}</span>
              <div>
                <h3>{row.title}</h3>
                <p>
                  {row.player.name} · {formatPoints(row.pointCost)} set aside
                </p>
                {row.productUrl && (
                  <p>
                    <a href={row.productUrl} target="_blank" rel="noreferrer">
                      Buy it ↗
                    </a>
                  </p>
                )}
              </div>
            </div>
            <div className="row">
              <button
                className="btn sage"
                type="button"
                disabled={busyId === row.id}
                onClick={() => void act(row.id, "approve")}
              >
                Approve
              </button>
              <button
                className="btn stamp"
                type="button"
                disabled={busyId === row.id}
                onClick={() => void act(row.id, "deny")}
              >
                Deny
              </button>
            </div>
          </article>
        ))}
      </div>

      <h3>Owned — ready to use</h3>
      {owned.length === 0 && <p className="card">No owned rewards waiting to be used.</p>}
      <div className="claim-list">
        {owned.map((row) => (
          <article key={row.id} className="card claim">
            <div className="claim-head">
              <span className="emoji">{row.emoji}</span>
              <div>
                <h3>{row.title}</h3>
                <p>
                  {row.player.name} · owned
                </p>
                {row.productUrl && (
                  <p>
                    <a href={row.productUrl} target="_blank" rel="noreferrer">
                      Buy it ↗
                    </a>
                  </p>
                )}
              </div>
            </div>
            <div className="row">
              <button
                className="btn sage"
                type="button"
                disabled={busyId === row.id}
                onClick={() => void markUsed(row.id)}
              >
                Mark redeemed
              </button>
            </div>
          </article>
        ))}
      </div>

      {history.length > 0 && (
        <>
          <h3>Recently finished</h3>
          <div className="claim-list">
            {history.slice(0, 8).map((row) => (
              <article key={row.id} className="card">
                <p>
                  {row.emoji} {row.title} · {row.player.name} · {row.status}
                </p>
              </article>
            ))}
          </div>
        </>
      )}

      <h3>Catalog</h3>
      <p className="muted">Change the title, emoji, or ${CURRENCY_DISPLAY.nounSingular} cost here. Turning a reward off hides it from kids. Old requests keep the price they asked at.</p>
      <div className="row" style={{ marginBottom: 16 }}>
        <button
          className="btn sage"
          type="button"
          onClick={() => {
            setEditingId("new");
            setForm(blankForm);
          }}
        >
          Add a reward
        </button>
      </div>
      {editingId === "new" && (
        <SkuEditor
          form={form}
          setForm={setForm}
          busy={busyId === "new"}
          onSave={() => void saveSku()}
          onCancel={() => {
            setEditingId(null);
            setForm(blankForm);
          }}
        />
      )}
      <div className="claim-list">
        {skus.map((sku) => (
          <article key={sku.id} className={`card chore-card ${sku.isActive ? "" : "off"}`}>
            <div className="claim-head">
              <span className="emoji">{sku.emoji}</span>
              <div>
                <h3>
                  {sku.title}
                  {!sku.isActive && (
                    <em className="badge off" style={{ background: "#7a6a55" }}>
                      Off the shelf
                    </em>
                  )}
                </h3>
                <p>
                  {formatPoints(sku.pointCost)}
                  {sku.description ? ` · ${sku.description}` : ""}
                </p>
              </div>
            </div>
            {editingId === sku.id ? (
              <SkuEditor
                form={form}
                setForm={setForm}
                busy={busyId === sku.id}
                onSave={() => void saveSku()}
                onCancel={() => {
                  setEditingId(null);
                  setForm(blankForm);
                }}
              />
            ) : (
              <div className="row">
                <button
                  className="btn"
                  type="button"
                  disabled={busyId === sku.id}
                  onClick={() => {
                    setEditingId(sku.id);
                    setForm(fromSku(sku));
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn"
                  type="button"
                  disabled={busyId === sku.id}
                  onClick={() => void toggleShelf(sku)}
                >
                  {sku.isActive ? "Take off shelf" : "Put on shelf"}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function SkuEditor({
  form,
  setForm,
  busy,
  onSave,
  onCancel,
}: {
  form: SkuForm;
  setForm: (form: SkuForm) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <label className="field">
        Title
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </label>
      <label className="field">
        Emoji
        <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
      </label>
      <label className="field">
        {CURRENCY_DISPLAY.nounSingular} cost
        <input
          type="number"
          min={1}
          step={1}
          value={form.pointCost}
          onChange={(e) => setForm({ ...form, pointCost: e.target.value })}
          required
        />
      </label>
      <label className="field">
        Note (optional)
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </label>
      <label className="choice">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        On the shelf for kids
      </label>
      <div className="row">
        <button className="btn sage" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
