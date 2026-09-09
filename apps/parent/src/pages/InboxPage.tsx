import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type InboxClaim, type ParentRedemption } from "../api";
import PushSettings from "../components/PushSettings";

export default function InboxPage() {
  const [claims, setClaims] = useState<InboxClaim[] | null>(null);
  const [redemptions, setRedemptions] = useState<ParentRedemption[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const data = await api.inbox();
    setClaims(data.claims);
    setRedemptions(data.redemptions ?? []);
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
      const data = action === "approve" ? await api.approve(id) : await api.deny(id);
      setClaims(data.claims);
      setRedemptions(data.redemptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function storeAct(id: string, action: "fulfill" | "deny") {
    setBusyId(id);
    setError("");
    try {
      const data = action === "fulfill" ? await api.fulfillRedemption(id) : await api.denyRedemption(id);
      setClaims(data.claims);
      setRedemptions(data.redemptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  if (!claims) {
    return (
      <div>
        <p>Loading the inbox…</p>
        <PushSettings />
      </div>
    );
  }

  const empty = claims.length === 0 && redemptions.length === 0;

  return (
    <div>
      <h2>Inbox</h2>
      <p className="muted">
        Dog chores are listed first. Approve starts the plant growing. Deny wilts it — the kid prunes, no seed back.
        Store requests hold stars until you Fulfill (spend) or Deny (give them back). Notifications are optional; this
        inbox is the fallback if push is off or a tap is stale.
      </p>
      <PushSettings />
      {error && <p className="error">{error}</p>}
      {empty && <p className="card">Nothing waiting. Kids can keep claiming chores and asking for store rewards.</p>}

      {redemptions.length > 0 && (
        <>
          <h3>
            Store requests{" "}
            <Link to="/store" style={{ fontSize: 16, fontWeight: 400 }}>
              Catalog
            </Link>
          </h3>
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
                    onClick={() => void storeAct(row.id, "fulfill")}
                  >
                    Fulfill
                  </button>
                  <button
                    className="btn stamp"
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void storeAct(row.id, "deny")}
                  >
                    Deny
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <h3>Chore claims</h3>
      {claims.length === 0 && !empty && <p className="card">No chore claims waiting.</p>}
      <div className="claim-list">
        {claims.map((claim) => (
          <article key={claim.id} className={`card claim ${claim.priority === "CRITICAL" ? "critical" : ""}`}>
            <div className="claim-head">
              <span className="emoji">{claim.chore.emoji}</span>
              <div>
                <h3>
                  {claim.chore.title}
                  {claim.priority === "CRITICAL" && <em className="badge">CRITICAL</em>}
                </h3>
                <p>
                  {claim.player.name} · plot {claim.slot + 1}
                  {claim.hasPhoto ? " · photo attached" : ""}
                </p>
              </div>
            </div>
            {claim.chore.description && <p>{claim.chore.description}</p>}
            {claim.hasPhoto && (
              <img
                className="proof"
                alt={`Photo from ${claim.player.name}`}
                src={`/api/parent/claims/${claim.id}/photo`}
              />
            )}
            <div className="row">
              <button
                className="btn sage"
                type="button"
                disabled={busyId === claim.id}
                onClick={() => void act(claim.id, "approve")}
              >
                Approve
              </button>
              <button
                className="btn stamp"
                type="button"
                disabled={busyId === claim.id}
                onClick={() => void act(claim.id, "deny")}
              >
                Deny
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
