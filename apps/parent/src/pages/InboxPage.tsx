import { useEffect, useState } from "react";
import { api, type InboxClaim } from "../api";

export default function InboxPage() {
  const [claims, setClaims] = useState<InboxClaim[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const data = await api.inbox();
    setClaims(data.claims);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  if (!claims) return <p>Loading the inbox…</p>;

  return (
    <div>
      <h2>Chore inbox</h2>
      <p className="muted">
        Dog chores are listed first. Approve starts the plant growing. Deny wilts it — the kid prunes, no seed back.
        Web Push comes later; this inbox is the daily driver.
      </p>
      {error && <p className="error">{error}</p>}
      {claims.length === 0 && <p className="card">Nothing waiting. Kids can keep claiming chores.</p>}
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
