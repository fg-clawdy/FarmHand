import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AdminStats } from "../api";
import { GroupedBarChart, MixBars } from "../charts";

function shortDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function OverviewPage() {
  const [pulse, setPulse] = useState<{
    activeSessions: number;
    harvestsToday: number;
    wateringsToday: number;
    readyPlants: number;
    playerCount: number;
  } | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.overview(), api.stats(14)])
      .then(([overview, next]) => {
        setPulse(overview);
        setStats(next);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!pulse || !stats) return <p>Counting chickens…</p>;

  const items = [
    ["Active sessions", pulse.activeSessions],
    ["Harvests today", pulse.harvestsToday],
    ["Waterings today", pulse.wateringsToday],
    ["READY plants", pulse.readyPlants],
  ] as const;

  const labels = stats.series.map((row) => shortDay(row.day));
  const series = [
    { key: "harvests", label: "Harvests", color: "#3f6b36", values: stats.series.map((row) => row.harvests) },
    { key: "waterings", label: "Waterings", color: "#2a6f97", values: stats.series.map((row) => row.waterings) },
    { key: "logins", label: "Logins", color: "#d7a441", values: stats.series.map((row) => row.logins) },
  ];
  const playerLabels = stats.players.map((p) => p.name);
  const playerSeries = [
    { key: "harvests", label: "Harvests", color: "#3f6b36", values: stats.players.map((p) => p.harvests) },
    { key: "plants", label: "Planted", color: "#9b2c1f", values: stats.players.map((p) => p.plants) },
    { key: "waterings", label: "Waterings", color: "#2a6f97", values: stats.players.map((p) => p.waterings) },
  ];

  return (
    <div>
      <h1>Farm pulse</h1>
      <p className="muted">
        {pulse.playerCount} active gardens on the homestead. Last {stats.days} days in {stats.timezone}.{" "}
        <Link to="/balance">Balance goals &amp; snapshot</Link>
      </p>
      <div className="pulse">
        {items.map(([label, value]) => (
          <div className="card" key={label}>
            <div>{label}</div>
            <div className="num">{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Harvests, waterings, and logins</h2>
        <p className="muted">Daily counts for the last {stats.days} days.</p>
        <div className="legend">
          {series.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
        <GroupedBarChart labels={labels} series={series} />
      </div>

      <div className="chart-grid">
        <div className="card">
          <h2>Crop mix — planted</h2>
          <MixBars
            title="What kids sowed"
            counts={stats.cropMixPlanted.counts}
            total={stats.cropMixPlanted.total}
            pct={stats.cropMixPlanted.pct}
          />
        </div>
        <div className="card">
          <h2>Crop mix — harvested</h2>
          <MixBars
            title="What they finished"
            counts={stats.cropMixHarvested.counts}
            total={stats.cropMixHarvested.total}
            pct={stats.cropMixHarvested.pct}
          />
        </div>
        <div className="card">
          <h2>Crop mix — in the ground now</h2>
          <MixBars
            title="Live plots"
            counts={stats.cropMixInGround.counts}
            total={stats.cropMixInGround.total}
            pct={stats.cropMixInGround.pct}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Per-kid activity</h2>
        <p className="muted">Planted vs harvested vs watered over the same {stats.days} days.</p>
        <div className="legend">
          {playerSeries.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
        {playerLabels.length ? (
          <GroupedBarChart labels={playerLabels} series={playerSeries} />
        ) : (
          <p className="muted">No active gardens yet.</p>
        )}
      </div>
    </div>
  );
}
