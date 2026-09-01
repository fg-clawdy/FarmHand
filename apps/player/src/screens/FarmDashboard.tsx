import { MASCOT_EMOJI, type FarmPlayerCard } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ComingSoon from "../components/ComingSoon";

export default function FarmDashboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<FarmPlayerCard[]>([]);
  const [storeOpen, setStoreOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api.farm();
      setPlayers(data.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the farm.");
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="scene">
      <div className="cloud cloud-a" />
      <div className="cloud cloud-b" />
      <div className="brand">
        <small>HOMESTEAD</small>
        <strong>FarmHand</strong>
      </div>
      <div className="landscape">
        <button className="building barn" type="button" onClick={() => setStoreOpen(false)} aria-label="Red barn">
          <div className="barn-roof" />
          <div className="barn-body">
            <div className="barn-door" />
          </div>
          <div className="tractor" aria-hidden>🚜</div>
          <label>Red Barn</label>
        </button>
        <div className="garden-row">
          {players.map((player) => (
            <button
              key={player.id}
              className="garden-card"
              type="button"
              onClick={() => navigate(`/garden/${player.id}`)}
            >
              <div className="sign">{player.name}</div>
              <div className="mascot">{MASCOT_EMOJI[player.mascot]}</div>
              <div className="stats">
                <span>🌱 {player.seeds}</span>
                <span>⭐ {player.points}</span>
              </div>
              {player.hasPin && !player.unlocked ? <div className="lock">🔒 PIN</div> : <div className="lock">Open</div>}
            </button>
          ))}
        </div>
        <button className="building store" type="button" onClick={() => setStoreOpen(true)}>
          <div className="store-front">
            <div className="store-false">FARM STORE</div>
            <div className="store-window">
              <span />
              <span />
              <span />
            </div>
            <div className="store-porch" />
          </div>
          <label>General Store</label>
        </button>
        <div className="fence" />
      </div>
      {storeOpen && <ComingSoon onClose={() => setStoreOpen(false)} />}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
