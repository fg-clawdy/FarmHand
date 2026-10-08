import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type RecommendationSummary } from "../api";

export default function RecommendationsPage() {
  const [sets, setSets] = useState<RecommendationSummary[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");

  async function refresh() {
    const data = await api.recommendations();
    setSets(data.sets);
    setPending(data.pendingChanges);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div>
      <h2>
        Balance recommendations
        {pending > 0 && <em className="badge">{pending} pending</em>}
      </h2>
      <p className="muted">
        Once a day FarmHand's balance agent reviews chore and in-game rewards and stages a
        small set of tuning suggestions. Nothing changes until you apply it here.
      </p>
      {error && <p className="error">{error}</p>}
      {sets === null ? (
        <p className="muted">Loading…</p>
      ) : sets.length === 0 ? (
        <p className="muted">No recommendations yet. The agent runs each morning at 6:00 AM.</p>
      ) : (
        sets.map((set) => (
          <div className={`card${set.status === "OPEN" ? "" : " chore-card off"}`} key={set.id}>
            <div className="claim-head">
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0 }}>
                  <Link to={`/recommendations/${set.id}`}>{set.summary}</Link>
                </h3>
                <p className="muted">
                  {new Date(set.createdAt).toLocaleString()} · {set.status}
                  {set.changeCount > 0 && ` · ${set.changeCount} suggestion${set.changeCount === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}