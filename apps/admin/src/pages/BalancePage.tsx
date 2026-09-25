import { DEFAULT_BALANCE_GOALS } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type BalanceSnapshot } from "../api";

export default function BalancePage() {
  const [goals, setGoals] = useState("");
  const [snapshot, setSnapshot] = useState<BalanceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function load() {
    const [goalsRes, snap] = await Promise.all([api.balanceGoals(), api.balanceSnapshot()]);
    setGoals(goalsRes.goals);
    setSnapshot(snap);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>Balance</h1>
      <p className="muted">
        Tell reviewers what good play looks like. Knobs live on <Link to="/config">Tunables</Link>. Agents can read{" "}
        <code>GET /api/admin/balance-snapshot</code> without scraping this page.
      </p>
      {error && <p className="error">{error}</p>}
      {saved && <p>{saved}</p>}

      <div className="card">
        <h2>Balance goals</h2>
        <p className="muted">Plain text is fine. Example locked default: {DEFAULT_BALANCE_GOALS}</p>
        <label className="field">
          What should “good play” mean?
          <textarea rows={6} value={goals} onChange={(e) => setGoals(e.target.value)} />
        </label>
        <div className="row">
          <button
            className="btn sage"
            type="button"
            onClick={() =>
              void api
                .saveBalanceGoals(goals)
                .then((data) => {
                  setGoals(data.goals);
                  setSaved("Saved balance goals.");
                  return api.balanceSnapshot().then(setSnapshot);
                })
                .catch((err: Error) => setError(err.message))
            }
          >
            Save goals
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setGoals(DEFAULT_BALANCE_GOALS)}
          >
            Restore locked default text
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Balance snapshot (read-only)</h2>
        <p className="muted">
          Knobs + crop mix % + seed/water economy for 7 and 30 days. Generated{" "}
          {snapshot ? new Date(snapshot.generatedAt).toLocaleString() : "…"}.
        </p>
        <pre className="snapshot">{snapshot ? JSON.stringify(snapshot, null, 2) : "Loading snapshot…"}</pre>
      </div>
    </div>
  );
}
