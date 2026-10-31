import { compactJarTitle, jarProgressLabel, type FarmPlayerCard, type GameConfig, type PublicSharedGoal } from "@farmhand/shared";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type FarmPlaybookMission } from "../api";
import { BUNCH_SHOW_MAX, starsPerFrom } from "../balloons/balloonMath";
import FarmBalloonLayer from "../balloons/FarmBalloonLayer";
import { displayFilled, enqueueDonation, type BalloonJob } from "../balloons/balloonQueue";
import "../styles.balloons.css";
import AvatarPicker from "../components/AvatarPicker";
import FamilyJarSheet from "../components/FamilyJarSheet";
import PinPad from "../components/PinPad";
import PlaybookCoach, { type CoachMission } from "../components/PlaybookCoach";
import Sheet from "../components/Sheet";
import StoreSheet from "../components/StoreSheet";
import { familyJarVisible } from "../pixi/libraryShelfLayout";
import { LIVE_FARM_GRASS } from "../pixi/playfieldLayout";
import { useFarmPixi } from "../pixi/usePixi";

export default function FarmDashboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<FarmPlayerCard[]>([]);
  const [familyJars, setFamilyJars] = useState<PublicSharedGoal[]>([]);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [queue, setQueue] = useState<BalloonJob[]>([]);
  const [released, setReleased] = useState<string[]>([]);
  const [jarId, setJarId] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [error, setError] = useState("");
  const [pinPlayer, setPinPlayer] = useState<{ id: string; name: string; after?: "garden" | "avatar" } | null>(null);
  const [avatarKid, setAvatarKid] = useState<FarmPlayerCard | null>(null);
  const [missions, setMissions] = useState<FarmPlaybookMission[]>([]);

  async function ensureEntered(id: string, after: "garden" | "avatar") {
    const player = players.find((p) => p.id === id);
    if (!player) return null;
    try {
      const session = await api.session();
      if (session.player?.id === id) return player;
    } catch {
      /* no session */
    }
    if (!player.hasPin) {
      await api.enter(id);
      return player;
    }
    setPinPlayer({ id: player.id, name: player.name, after });
    return null;
  }

  async function handleAvatarTap(id: string) {
    try {
      const player = await ensureEntered(id, "avatar");
      if (!player) return;
      const fresh = players.find((p) => p.id === id) ?? player;
      setAvatarKid(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open picture picker.");
    }
  }

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

  const handlePinSubmit = useCallback(async (pin: string) => {
    if (!pinPlayer) return;
    const after = pinPlayer.after ?? "garden";
    const id = pinPlayer.id;
    await api.enter(id, pin);
    setPinPlayer(null);
    if (after === "avatar") {
      const fresh = players.find((p) => p.id === id) ?? null;
      if (fresh) setAvatarKid(fresh);
      return;
    }
    navigate(`/garden/${id}`);
  }, [pinPlayer, navigate, players]);

  const handlePinCancel = useCallback(() => setPinPlayer(null), []);

  const { hostRef, sceneRef, ready } = useFarmPixi({
    onPlayer: (id) => {
      void handlePlayerTap(id);
    },
    onStore: () => setStoreOpen(true),
    onAvatar: (id) => {
      void handleAvatarTap(id);
    },
  });

  async function load() {
    try {
      const farm = await api.farm();
      setPlayers(farm.players);
      setConfig(farm.config);
      setFamilyJars((prev) => {
        const incoming = (farm.familyJars ?? (farm.familyJar ? [farm.familyJar] : [])).filter(familyJarVisible);
        return incoming.map((jar) => {
          const old = prev.find((item) => item.id === jar.id);
          if (old && old.filledPoints > jar.filledPoints && old.status === jar.status) {
            return { ...jar, filledPoints: old.filledPoints };
          }
          return jar;
        });
      });
      const coach = await api.farmPlaybooks();
      setMissions(coach.missions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the farm.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Pause farm polling while PIN is open so digit taps aren't fighting Pixi/tree setState.
  useEffect(() => {
    if (pinPlayer) return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [pinPlayer]);

  const finishJob = useCallback(() => {
    setQueue((jobs) => {
      const done = jobs[0];
      if (done && done.to >= done.cost) {
        setReleased((ids) => (ids.includes(done.goalId) ? ids : [...ids, done.goalId]));
      }
      return jobs.slice(1);
    });
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !ready) return;
    scene.setGrassProps(LIVE_FARM_GRASS);
    scene.setPlayers(players);
  }, [players, ready, sceneRef]);

  useEffect(() => {
    if (jarId && !familyJars.some((jar) => jar.id === jarId)) setJarId(null);
    if (familyJars.filter((jar) => !released.includes(jar.id)).length <= BUNCH_SHOW_MAX) setOverflowOpen(false);
  }, [familyJars, jarId, released]);

  const meadowJars = familyJars.filter((jar) => !released.includes(jar.id) || queue[0]?.goalId === jar.id);
  const selectedJar = familyJars.find((jar) => jar.id === jarId) ?? null;

  const coachMissions: CoachMission[] = missions.map((mission) => ({
    playerId: mission.playerId,
    kidName: mission.playerName,
    mascot: mission.mascot,
    avatarKind: mission.avatarKind,
    avatarPreset: mission.avatarPreset,
    avatarUrl: mission.avatarUrl,
    color: mission.color,
    playbook: mission.playbook,
  }));

  return (
    <div className="scene farm-hybrid">
      <div className="pixi-host" ref={hostRef} />
      {storeOpen && <StoreSheet players={players} onClose={() => setStoreOpen(false)} />}
      {overflowOpen && (
        <Sheet title="More goals" onClose={() => setOverflowOpen(false)}>
          <div className="sheet-actions">
            {meadowJars.slice(BUNCH_SHOW_MAX).map((jar) => (
              <button
                key={jar.id}
                className="btn gold"
                type="button"
                onClick={() => {
                  setOverflowOpen(false);
                  setJarId(jar.id);
                }}
              >
                {jar.emoji} {compactJarTitle(jar.title, 22)} · {jarProgressLabel(jar.filledPoints, jar.targetPoints, jar.status)}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      <FarmBalloonLayer
        goals={meadowJars.map((jar) => ({
            id: jar.id,
            title: jar.title,
            cost: jar.targetPoints,
            filled: displayFilled(jar.id, jar.filledPoints, queue, queue[0] ?? null),
          }))}
        starsPer={starsPerFrom(config?.starsPerBalloon)}
        job={queue[0] ?? null}
        onOpen={(id) => {
          setOverflowOpen(false);
          setJarId(id);
        }}
        onOverflow={() => setOverflowOpen(true)}
        onFinished={finishJob}
      />
      {selectedJar && (
        // Farm overview has no kid in context. Do not pass sessionPlayer from the tablet cookie.
        <FamilyJarSheet
          jar={selectedJar}
          players={players}
          onClose={() => setJarId(null)}
          onDonated={({ from, to }) => {
            setQueue((jobs) =>
              enqueueDonation(jobs, {
                goalId: selectedJar.id,
                title: selectedJar.title,
                cost: selectedJar.targetPoints,
                from,
                to,
              }),
            );
            setJarId(null);
          }}
          onUpdated={(next) =>
            setFamilyJars((list) => {
              const stillVisible = next.status === "OPEN" || next.status === "READY";
              return stillVisible
                ? list.map((jar) => (jar.id === next.id ? next : jar))
                : list.filter((jar) => jar.id !== next.id);
            })
          }
        />
      )}
      {avatarKid && (
        <AvatarPicker
          player={avatarKid}
          onClose={() => setAvatarKid(null)}
          onDone={(next) => {
            setPlayers((list) =>
              list.map((p) =>
                p.id === next.id
                  ? {
                      ...p,
                      mascot: next.mascot,
                      avatarKind: next.avatarKind,
                      avatarPreset: next.avatarPreset ?? null,
                      avatarUrl: next.avatarUrl ?? null,
                    }
                  : p,
              ),
            );
            setAvatarKid(null);
            void load();
          }}
        />
      )}
      {pinPlayer && (
        <PinPad
          name={pinPlayer.name}
          onCancel={handlePinCancel}
          onSubmit={handlePinSubmit}
        />
      )}
      <PlaybookCoach
        missions={coachMissions}
        mode="farm"
        onOpenGarden={(id) => void handlePlayerTap(id)}
      />
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
