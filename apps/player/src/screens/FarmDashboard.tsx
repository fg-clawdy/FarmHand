import { type FarmPlayerCard, type GameConfig } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type FamilyJob } from "../api";
import FarmJobFlow from "../components/FarmJobFlow";
import StoreSheet from "../components/StoreSheet";
import { useFarmPixi } from "../pixi/usePixi";

export default function FarmDashboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<FarmPlayerCard[]>([]);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [jobs, setJobs] = useState<FamilyJob[]>([]);
  const [storeOpen, setStoreOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const { hostRef, sceneRef, ready } = useFarmPixi({
    onPlayer: (id) => navigate(`/garden/${id}`),
    onStore: () => setStoreOpen(true),
    onJobBoard: () => setJobsOpen(true),
  });

  async function load() {
    try {
      const [farm, board] = await Promise.all([api.farm(), api.farmJobs()]);
      setPlayers(farm.players);
      setConfig(farm.config);
      setJobs(board.jobs);
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

  useEffect(() => {
    sceneRef.current?.setWantedJobs(jobs, config?.jobBoardPosterDwellSeconds);
  }, [jobs, config, ready, sceneRef]);

  return (
    <div className="scene farm-hybrid">
      <div className="pixi-host" ref={hostRef} />
      {storeOpen && <StoreSheet players={players} onClose={() => setStoreOpen(false)} />}
      {jobsOpen && config && (
        <FarmJobFlow
          players={players}
          config={config}
          jobs={jobs}
          onClose={() => setJobsOpen(false)}
          onClaimed={(name) => {
            setToast(`Waiting seed planted in ${name}'s garden.`);
            window.setTimeout(() => setToast(""), 3200);
            void load();
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
