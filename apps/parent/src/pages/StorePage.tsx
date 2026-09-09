import { useEffect, useState } from "react";
import { api, type ParentRedemption, type ParentStoreSku, type SkuWrite } from "../api";

type SkuForm = {
  title: string;
  emoji: string;
  description: string;
  starCost: string;
  isActive: boolean;
};

const blankForm: SkuForm = {
  title: "",
  emoji: "⭐",
  description: "",
  starCost: "100",
  isActive: true,
};

function fromSku(sku: ParentStoreSku): SkuForm {
  return {
    title: sku.title,
    emoji: sku.emoji,
    description: sku.description,
    starCost: String(sku.starCost),
    isActive: sku.isActive,
  };
}

function toWrite(form: SkuForm): SkuWrite {
  return {
    title: form.title,
    emoji: form.emoji,
    description: form.description,
    starCost: Number(form.starCost),
    isActive: form.isActive,
  };
}

export default function StorePage() {
  const [redemptions, setRedemptions] = useState<ParentRedemption[] | null>(null);
  const [skus, setSkus] = useState<ParentStoreSku[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SkuForm>(blankForm);

  async function refresh() {
    const data = await api.store();
    setRedemptions(data.redemptions);
    setSkus(data.skus);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    const t = setInterval(() => void refresh().catch(() => undefined), 8000);
    return () => clearInterval(t);
  }, []);

  async function act(id: string, action: "fulfill" | "deny") {
    setBusyId(id);
    setError("");
    try {
      const data = action === "fulfill" ? await api.fulfillRedemption(id) : await api.denyRedemption(id);
      setRedemptions(data.redemptions);
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

  if (!redemptions) {
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
        Kids spend <strong>stars</strong> on real-world promises (1★ = 1¢). A request holds stars.{" "}
        <strong>Fulfill</strong> spends them; <strong>Deny</strong> gives them back. Nothing auto-buys.
      </p>
      {error && <p className="error">{error}</p>}

      <h3>Waiting for you</h3>
      {redemptions.length === 0 && <p className="card">No store requests right now.</p>}
      <div className="claim-list">
        {redemptions.map((row) => (
          <article key={row.id} className="card claim">
            <div className="claim-head">
              <span className="emoji">{row.emoji}</span>
              <div>
                <h3>{row.title}</h3>
                <p>
                  {row.player.name} · {row.starCost}★ held
                </p>
              </div>
            </div>
            <div className="row">
              <button
                className="btn sage"
                type="button"
                disabled={busyId === row.id}
                onClick={() => void act(row.id, "fulfill")}
              >
                Fulfill
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

      <h3>Catalog</h3>
      <p className="muted">Change the title, emoji, or star cost here. Turning a reward off hides it from kids. Old requests keep the price they asked at.</p>
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
                  {sku.starCost}★
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
        Star cost
        <input
          type="number"
          min={1}
          step={1}
          value={form.starCost}
          onChange={(e) => setForm({ ...form, starCost: e.target.value })}
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
