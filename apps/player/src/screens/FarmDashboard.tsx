import { type FarmPlayerCard } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { FarmTitle } from "../art";
import ComingSoon from "../components/ComingSoon";
import { useFarmPixi } from "../pixi/usePixi";

export default function FarmDashboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<FarmPlayerCard[]>([]);
  const [storeOpen, setStoreOpen] = useState(false);
  const [error, setError] = useState("");
  const { hostRef, sceneRef, ready } = useFarmPixi({
    onPlayer: (id) => navigate(`/garden/${id}`),
    onStore: () => setStoreOpen(true),
  });

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

  useEffect(() => {
    sceneRef.current?.setPlayers(players);
  }, [players, ready, sceneRef]);

  return (
    <div className="scene farm-hybrid">
      <div className="pixi-host" ref={hostRef} />
      <header className="title-bar">
        <FarmTitle />
      </header>
      {storeOpen && <ComingSoon onClose={() => setStoreOpen(false)} />}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
