import { MASCOT_EMOJI } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type AdminPlayer } from "../api";

export default function PlayerDetailPage() {
  const { id } = useParams();
  const [player, setPlayer] = useState<AdminPlayer | null>(null);
  const [name, setName] = useState("");
  const [mascot, setMascot] = useState("cow");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [resources, setResources] = useState({ seeds: 0, points: 0, fertilizer: 0, moonDew: 0, growGoo: 0, phoenixAsh: 0 });

  async function load() {
    if (!id) return;
    const data = await api.player(id);
    setPlayer(data.player);
    setName(data.player.name);
    setMascot(data.player.mascot);
    setResources({
      seeds: data.player.seeds,
      points: data.player.points,
      fertilizer: data.player.fertilizer,
      moonDew: data.player.ingredients.moonDew,
      growGoo: data.player.ingredients.growGoo,
      phoenixAsh: data.player.ingredients.phoenixAsh,
    });
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  if (!player) return <p>{error || "Loading garden…"}</p>;

  return (
    <div>
      <p>
        <Link to="/players">← Players</Link>
      </p>
      <h1>
        {MASCOT_EMOJI[player.mascot]} {player.name}
      </h1>
      {error && <p className="error">{error}</p>}
      <p className="muted">
        {player.hasPin ? "PIN locked" : "No PIN"} · {player.activeSessions ?? 0} live session(s) ·{" "}
        {player.isActive ? "on the farm" : "hidden"}
      </p>

      <h2>Garden (read only)</h2>
      <div className="grid6 plots-readonly">
        {player.plots.map((plot) => (
          <div key={plot.slot} className={`mini-plot ${plot.ready ? "ready" : ""}`} title={plot.state}>
            {plot.state === "empty" ? "·" : plot.ready ? `${plot.emoji}!` : plot.emoji}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Edit</h2>
        <div className="row">
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            Mascot
            <select value={mascot} onChange={(e) => setMascot(e.target.value)}>
              <option value="cow">Cow</option>
              <option value="chicken">Chicken</option>
              <option value="pig">Pig</option>
              <option value="sheep">Sheep</option>
              <option value="horse">Horse</option>
            </select>
          </label>
          <button
            className="btn"
            type="button"
            onClick={() => void api.editPlayer(player.id, { name, mascot }).then(load).catch((err: Error) => setError(err.message))}
          >
            Save
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Reset PIN</h2>
        <div className="row">
          <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4 digits" />
          <button
            className="btn"
            type="button"
            onClick={() =>
              void api
                .resetPin(player.id, pin)
                .then(() => {
                  setPin("");
                  return load();
                })
                .catch((err: Error) => setError(err.message))
            }
          >
            Set PIN
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => void api.resetPin(player.id, null).then(load).catch((err: Error) => setError(err.message))}
          >
            Clear PIN
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Adjust resources</h2>
        <div className="row">
          {(
            [
              ["seeds", "Seeds"],
              ["points", "Stars"],
              ["fertilizer", "Fertilizer"],
              ["moonDew", "Moon Dew"],
              ["growGoo", "Grow Goo"],
              ["phoenixAsh", "Phoenix Ash"],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                type="number"
                value={resources[key]}
                onChange={(e) => setResources({ ...resources, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <label className="field">
          Reason (audit log)
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="birthday bonus, oops, …" />
        </label>
        <button
          className="btn sage"
          type="button"
          onClick={() =>
            void api
              .resources(player.id, { ...resources, reason })
              .then(load)
              .catch((err: Error) => setError(err.message))
          }
        >
          Save resources
        </button>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button
          className="btn stamp"
          type="button"
          onClick={() => void api.endSession(player.id).then(load).catch((err: Error) => setError(err.message))}
        >
          Force end session
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() =>
            void api.deactivate(player.id, !player.isActive).then(load).catch((err: Error) => setError(err.message))
          }
        >
          {player.isActive ? "Soft deactivate" : "Reactivate"}
        </button>
      </div>
    </div>
  );
}
