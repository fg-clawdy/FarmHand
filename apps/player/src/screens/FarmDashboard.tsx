import { type FarmPlayerCard, type PublicPlot } from "@farmhand/shared";
import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  ACCENTS,
  AcornArt,
  FarmStoreArt,
  FarmTitle,
  FertilizerBeaker,
  LockIcon,
  MiniGarden,
  SceneShell,
  WateringCan,
  WoodSign,
} from "../art";
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
    <SceneShell>
      <header className="title-bar">
        <FarmTitle />
      </header>
      <div className="card-row">
        {players.map((player, index) => (
          <GardenCard
            key={player.id}
            player={player}
            accent={ACCENTS[index % ACCENTS.length]}
            onOpen={() => navigate(`/garden/${player.id}`)}
          />
        ))}
      </div>
      <button className="store-btn" type="button" onClick={() => setStoreOpen(true)} aria-label="Farm Store">
        <FarmStoreArt />
      </button>
      {storeOpen && <ComingSoon onClose={() => setStoreOpen(false)} />}
      {error && <div className="toast">{error}</div>}
    </SceneShell>
  );
}

function GardenCard({
  player,
  accent,
  onOpen,
}: {
  player: FarmPlayerCard;
  accent: (typeof ACCENTS)[number];
  onOpen: () => void;
}) {
  const plots = Array.from({ length: 6 }, (_, slot) => player.plots?.find((p: PublicPlot) => p.slot === slot));
  return (
    <div className="player-col">
      <WoodSign label={player.name.toUpperCase()} />
      <button
        className="garden-frame"
        type="button"
        onClick={onOpen}
        style={
          {
            borderColor: accent.border,
            "--accent-glow": accent.glow,
            "--accent-text": accent.text,
          } as CSSProperties
        }
      >
        {player.canWater && (
          <span className="badge badge-water">
            <WateringCan />
          </span>
        )}
        {player.fertilizer >= 1 && (
          <span className="badge badge-fert">
            <FertilizerBeaker />
          </span>
        )}
        {player.hasPin && !player.unlocked && (
          <div className="pin-chip">
            <LockIcon />
            <span>PIN</span>
          </div>
        )}
        <MiniGarden plots={plots} wash={accent.wash} />
        <footer className="card-foot">
          <span className="seed-badge">
            <AcornArt />
            {player.seeds}
          </span>
          <span className="points-label" style={{ color: accent.text }}>
            {player.points} {player.points === 1 ? "point" : "points"}
          </span>
        </footer>
      </button>
    </div>
  );
}
