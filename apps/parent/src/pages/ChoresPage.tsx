import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, type ParentChore } from "../api";

function whoCanClaim(chore: ParentChore): string {
  if (chore.assignmentMode === "ALL") return "Every kid";
  if (chore.assignmentMode === "RACE") return "First one to claim";
  if (chore.assignments.length) return chore.assignments.map((row) => row.name).join(", ");
  return "No kids picked yet";
}

export default function ChoresPage() {
  const navigate = useNavigate();
  const [chores, setChores] = useState<ParentChore[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const data = await api.chores();
    setChores(data.chores);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function toggle(chore: ParentChore) {
    setBusyId(chore.id);
    setError("");
    try {
      const data = await api.updateChore(chore.id, { isActive: !chore.isActive });
      setChores((rows) => rows?.map((row) => (row.id === chore.id ? data.chore : row)) ?? [data.chore]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusyId(null);
    }
  }

  if (!chores) {
    return (
      <div>
        <h2>Chores</h2>
        <p>Loading the list…</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Chores</h2>
      <p className="muted">
        Turn jobs on or off, or edit who can claim them. Dog chores stay at the top. Kids still get{" "}
        <strong>1 waiting seed</strong> for every claim — that does not change here.
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn sage" type="button" onClick={() => navigate("/chores/new")}>
          Add a chore
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="claim-list">
        {chores.map((chore) => (
          <article
            key={chore.id}
            className={`card chore-card ${chore.priority === "CRITICAL" ? "critical" : ""} ${chore.isActive ? "" : "off"}`}
          >
            <div className="claim-head">
              <span className="emoji">{chore.emoji}</span>
              <div>
                <h3>
                  {chore.title}
                  {chore.priority === "CRITICAL" && <em className="badge">Must do</em>}
                  {!chore.isActive && (
                    <em className="badge off" style={{ background: "#7a6a55" }}>
                      Off
                    </em>
                  )}
                </h3>
                <p>
                  {whoCanClaim(chore)}
                  {chore.requiresSelfie ? " · needs a photo" : ""}
                </p>
              </div>
            </div>
            <div className="row">
              <button
                className="btn"
                type="button"
                disabled={busyId === chore.id}
                onClick={() => void toggle(chore)}
              >
                {chore.isActive ? "Turn off" : "Turn on"}
              </button>
              <Link className="btn sage" to={`/chores/${chore.id}`}>
                Edit
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
