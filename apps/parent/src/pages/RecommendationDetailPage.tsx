import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type RecommendationChange } from "../api";

function num(value: unknown): string {
  if (typeof value === "number") return String(value);
  return String(value ?? "—");
}

export default function RecommendationDetailPage() {
  const { id = "" } = useParams();
  const [changes, setChanges] = useState<RecommendationChange[] | null>(null);
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, string>>({});
  const [discuss, setDiscuss] = useState("");
  const [reply, setReply] = useState("");
  const [revised, setRevised] = useState<RecommendationChange[] | null>(null);

  async function refresh() {
    const data = await api.recommendation(id);
    setChanges(data.changes);
    setSummary(data.set.summary);
    setStatus(data.set.status);
    setCreatedAt(data.set.createdAt);
    setRevised(null);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, [id]);

  function applyAll() {
    setBusy("all");
    void api
      .applyRecommendations(id)
      .then((res) => {
        if (!res.outcome.ok) setError(res.outcome.reason || "Apply failed.");
        return refresh();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null));
  }

  function applyChange(changeId: string) {
    setBusy(changeId);
    void api
      .applyRecommendationChange(id, changeId)
      .then((res) => {
        if (!res.outcome.ok) setError(res.outcome.reason || "Apply failed.");
        return refresh();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null));
  }

  function applyOverride(changeId: string) {
    const raw = override[changeId];
    if (raw == null || raw === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setError("Override must be a number.");
      return;
    }
    setBusy(`${changeId}-override`);
    void api
      .applyRecommendationChange(id, changeId, { override: value })
      .then((res) => {
        if (!res.outcome.ok) setError(res.outcome.reason || "Apply failed.");
        return refresh();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null));
  }

  function sendDiscuss() {
    if (!discuss.trim()) return;
    setBusy("discuss");
    void api
      .discussRecommendation(id, discuss.trim())
      .then((res) => {
        setReply(res.reply);
        setRevised(res.changes);
        setDiscuss("");
        return res;
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null));
  }

  const pendingList = (changes ?? []).filter((c) => c.status === "PENDING");
  const shown = revised ?? changes;

  return (
    <div>
      <h2>{summary}</h2>
      <p className="muted">
        {new Date(createdAt).toLocaleString()} · {status}
      </p>
      <p className="muted">
        <Link to="/recommendations">← Back to recommendations</Link>
      </p>
      {error && <p className="error">{error}</p>}
      {pendingList.length > 0 && status === "OPEN" && (
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn sage" type="button" disabled={busy !== null} onClick={applyAll}>
            {busy === "all"
              ? "Applying…"
              : `Apply all ${pendingList.length} suggestion${pendingList.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
      {shown === null ? (
        <p className="muted">Loading…</p>
      ) : (
        shown.map((change) => (
          <div className="card" key={change.id}>
            <div className="claim-head">
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0 }}>
                  {change.label} {change.status && <em className="badge">{change.status}</em>}
                </h3>
                <p className="muted" style={{ wordBreak: "break-all" }}>
                  {change.path}
                </p>
              </div>
            </div>
            <p style={{ margin: "8px 0" }}>
              <strong>
                {num(change.baseline)} → {num(change.proposed)}
                {change.unit ? ` ${change.unit}` : ""}
              </strong>
              {change.applied !== null && (
                <span className="muted"> (applied {num(change.applied)})</span>
              )}
              {change.current !== null && (
                <span className="muted"> / now {num(change.current)}</span>
              )}
            </p>
            <p className="muted">{change.rationale}</p>
            {change.status === "PENDING" && (
              <div className="row">
                <button
                  className="btn"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => applyChange(change.id)}
                >
                  {busy === change.id ? "Applying…" : "Apply"}
                </button>
                <input
                  className="field"
                  style={{ maxWidth: 140 }}
                  type="number"
                  step="any"
                  value={override[change.id] ?? ""}
                  placeholder="override"
                  onChange={(e) => setOverride((prev) => ({ ...prev, [change.id]: e.target.value }))}
                />
                <button
                  className="btn stamp"
                  type="button"
                  disabled={busy !== null || !override[change.id]}
                  onClick={() => applyOverride(change.id)}
                >
                  {busy === `${change.id}-override` ? "Applying…" : "Apply override"}
                </button>
              </div>
            )}
          </div>
        ))
      )}
      <h3>Discuss</h3>
      <div className="card">
        <div className="field">
          <textarea
            rows={3}
            value={discuss}
            placeholder="e.g. Don't make chores pay more this week."
            onChange={(e) => setDiscuss(e.target.value)}
          />
        </div>
        <button
          className="btn"
          type="button"
          disabled={busy !== null || !discuss.trim()}
          onClick={sendDiscuss}
        >
          {busy === "discuss" ? "Asking…" : "Ask the agent to reconsider"}
        </button>
        {reply && (
          <p style={{ marginTop: 12 }}>
            <strong>Agent reply:</strong> {reply}
          </p>
        )}
      </div>
    </div>
  );
}