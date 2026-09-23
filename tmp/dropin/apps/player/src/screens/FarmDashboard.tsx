import { type FarmPlayerCard, type GameConfig } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type FamilyJob } from "../api";
import FarmChoreClaim from "../components/FarmChoreClaim";
import FarmJobFlow from "../components/FarmJobFlow";
import PinPad from "../components/PinPad";
import StoreSheet from "../components/StoreSheet";
import { useFarmPixi } from "../pixi/usePixi";

export default function FarmDashboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<FarmPlayerCard[]>([]);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [jobs, setJobs] = useState<FamilyJob[]>([]);
  const [storeOpen, setStoreOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [claimJob, setClaimJob] = useState<FamilyJob | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [pinPlayer, setPinPlayer] = useState<{ id: string; name: string } | null>(null);

  async function handlePlayerTap(id: string) {
    const player = players.find((p) => p.id === id);
    if (!player) return;

    try {
      const session = await api.session();
      if (session.player?.id === id) {
        navigate(`/garden/${id}`);
        return;
      }
    } catch {
      /* no session — expected */
    }

    if (!player.hasPin) {
      try {
        await api.enter(id);
        navigate(`/garden/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open garden.");
      }
      return;
    }

    setPinPlayer({ id: player.id, name: player.name });
  }

  async function handlePinSubmit(pin: string) {
    if (!pinPlayer) return;
    await api.enter(pinPlayer.id, pin);
    setPinPlayer(null);
    navigate(`/garden/${pinPlayer.id}`);
  }

  const { hostRef, sceneRef, ready } = useFarmPixi({
    onPlayer: (id) => {
      void handlePlayerTap(id);
    },
    onStore: () => setStoreOpen(true),
    onJobBoard: () => {
      // Open the chore currently shown on the Wanted flyer (not the full family board).
      const current = sceneRef.current?.getCurrentWantedJob() ?? null;
      if (current) {
        const match = jobs.find((j) => j.id === current.id);
        if (match) {
          setClaimJob(match);
          return;
        }
        // Flyer job from placeholders / stale list — synthesize FamilyJob shape.
        setClaimJob({
          id: current.id,
          slug: current.slug ?? current.id,
          title: current.title,
          emoji: current.emoji,
          description: "",
          priority: "NORMAL",
          assignmentMode: "ANY",
          requiresSelfie: false,
          flyerUrl: current.flyerUrl ?? undefined,
        });
        return;
      }
      // Fallback only when no flyer chore exists.
      setJobsOpen(true);
    },
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

  function handleClaimed(name: string) {
    setToast(`Waiting seed planted in ${name}'s garden.`);
    window.setTimeout(() => setToast(""), 3200);
    void load();
  }

  return (
    <div className="scene farm-hybrid">
      <div className="pixi-host" ref={hostRef} />
      {storeOpen && <StoreSheet players={players} onClose={() => setStoreOpen(false)} />}
      {claimJob && (
        <FarmChoreClaim
          job={claimJob}
          players={players}
          onClose={() => setClaimJob(null)}
          onClaimed={handleClaimed}
        />
      )}
      {jobsOpen && config && (
        <FarmJobFlow
          players={players}
          jobs={jobs}
          onClose={() => setJobsOpen(false)}
          onClaimed={handleClaimed}
        />
      )}
      {pinPlayer && (
        <PinPad
          name={pinPlayer.name}
          onCancel={() => setPinPlayer(null)}
          onSubmit={async (pin) => {
            await handlePinSubmit(pin);
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
