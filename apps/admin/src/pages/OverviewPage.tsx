import { useEffect, useState } from "react";
import { api } from "../api";

export default function OverviewPage() {
  const [data, setData] = useState<{
    activeSessions: number;
    harvestsToday: number;
    wateringsToday: number;
    readyPlants: number;
    playerCount: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .overview()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Counting chickens…</p>;

  const items = [
    ["Active sessions", data.activeSessions],
    ["Harvests today", data.harvestsToday],
    ["Waterings today", data.wateringsToday],
    ["READY plants", data.readyPlants],
  ] as const;

  return (
    <div>
      <h1>Farm pulse</h1>
      <p className="muted">{data.playerCount} active gardens on the homestead.</p>
      <div className="pulse">
        {items.map(([label, value]) => (
          <div className="card" key={label}>
            <div>{label}</div>
            <div className="num">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
