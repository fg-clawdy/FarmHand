import { MASCOT_EMOJI } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AdminPlayer } from "../api";

export default function PlayersPage() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [mascot, setMascot] = useState("cow");
  const [pin, setPin] = useState("");
  const [seeds, setSeeds] = useState(10);

  async function load() {
    const data = await api.players();
    setPlayers(data.players);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>Players</h1>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Kid</th>
            <th>Seeds</th>
            <th>Stars</th>
            <th>PIN</th>
            <th>Session</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td>
                <Link to={`/players/${player.id}`}>
                  {MASCOT_EMOJI[player.mascot]} {player.name}
                </Link>
              </td>
              <td>{player.seeds}</td>
              <td>{player.points}</td>
              <td>{player.hasPin ? "Yes" : "Open"}</td>
              <td>{player.activeSessions ?? 0}</td>
              <td>{player.isActive ? "Active" : "Hidden"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Add a garden</h2>
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
          <label className="field">
            PIN
            <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="optional 4 digits" />
          </label>
          <label className="field">
            Starting seeds
            <input type="number" value={seeds} onChange={(e) => setSeeds(Number(e.target.value))} />
          </label>
          <button
            className="btn sage"
            type="button"
            onClick={() => {
              void api
                .createPlayer({ name, mascot, pin: pin || undefined, seeds })
                .then(() => {
                  setName("");
                  setPin("");
                  return load();
                })
                .catch((err: Error) => setError(err.message));
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
