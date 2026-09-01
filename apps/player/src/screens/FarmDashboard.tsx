import { type FarmPlayerCard, type PublicPlot } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { ACCENTS, ART, FarmTitle, LockIcon, plantArt } from "../art";
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
      <img className="backdrop" src={ART.backdrop} alt="" />
      <div className="scene-shade" />
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
        <img src={ART.store} alt="" />
      </button>
      {storeOpen && <ComingSoon onClose={() => setStoreOpen(false)} />}
      {error && <div className="toast">{error}</div>}
    </div>
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
  const plots = Array.from({ length: 6 }, (_, slot) => player.plots?.find((p) => p.slot === slot));
  return (
    <div className="player-col">
      <div className="wood-sign" style={{ backgroundImage: `url(${ART.woodSign})` }}>
        <span>{player.name.toUpperCase()}</span>
      </div>
      <button
        className="garden-frame"
        type="button"
        onClick={onOpen}
        style={{
          borderColor: accent.border,
          background: `linear-gradient(180deg, #fff 0%, ${accent.wash} 38%, #dceec4 100%)`,
          boxShadow: `0 16px 0 rgba(40,70,20,0.18), 0 22px 28px rgba(20,40,10,0.28), inset 0 2px 0 #fff, 0 0 0 3px ${accent.glow}`,
        }}
      >
        {player.canWater && (
          <img className="badge badge-water" src={ART.wateringCan} alt="" title="Ready to water" />
        )}
        {player.fertilizer >= 1 && (
          <img className="badge badge-fert" src={ART.beaker} alt="" title="Fertilizer ready" />
        )}
        {player.hasPin && !player.unlocked && (
          <div className="pin-chip">
            <LockIcon />
            <span>PIN</span>
          </div>
        )}
        <div className="mini-garden">
          {plots.map((plot, slot) => (
            <MiniPlot key={slot} plot={plot} />
          ))}
        </div>
        <footer className="card-foot">
          <span className="seed-badge">
            <img src={ART.acorn} alt="" />
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

function MiniPlot({ plot }: { plot: PublicPlot | undefined }) {
  const src = plot ? plantArt(plot) : null;
  return (
    <div className={`mini-plot ${plot?.ready ? "ready" : ""} ${plot?.state ?? "empty"}`}>
      <div className="soil" />
      {src ? <img src={src} alt="" /> : <div className="sprout-dot" />}
    </div>
  );
}
