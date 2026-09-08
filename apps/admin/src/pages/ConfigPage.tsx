import { formatDuration, type GameConfig } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ConfigPage() {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api
      .config()
      .then((data) => setConfig(data.config))
      .catch((err: Error) => setError(err.message));
  }, []);

  function num(key: keyof GameConfig, value: string) {
    if (!config) return;
    setConfig({ ...config, [key]: Number(value) });
  }

  if (!config) return <p>{error || "Loading tunables…"}</p>;

  return (
    <div>
      <h1>Game tunables</h1>
      <p className="muted">
        These numbers live in Postgres. Save once and the kids’ farm uses them without a redeploy. Write what “good
        play” means on <Link to="/balance">Balance</Link>.
      </p>
      {error && <p className="error">{error}</p>}
      {saved && <p>{saved}</p>}

      <div className="card">
        <h2>A new kid starts with</h2>
        <div className="row">
          <Num label="Starting seeds" hint="Pocket change on day one" value={config.startingSeeds} onChange={(v) => num("startingSeeds", v)} />
          <Num label="Starting stars" hint="Points, not seeds" value={config.startingPoints} onChange={(v) => num("startingPoints", v)} />
          <Num label="Starting fertilizer" hint="Bottles on the shelf" value={config.startingFertilizer} onChange={(v) => num("startingFertilizer", v)} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Watering</h2>
        <div className="row">
          <Num
            label="Waters per day"
            hint="Daily cap across the garden"
            value={config.wateringMaxPerDay}
            onChange={(v) => num("wateringMaxPerDay", v)}
          />
          <Num
            label="Minutes between waters"
            hint="Cooldown after each watering (240 = 4 hours)"
            value={config.wateringCooldownMinutes}
            onChange={(v) => num("wateringCooldownMinutes", v)}
          />
          <Num
            label="Each watering shortens wait (min)"
            hint="Shaves this many minutes off grow time"
            value={config.wateringReductionMinutes}
            onChange={(v) => num("wateringReductionMinutes", v)}
          />
        </div>
        <p className="muted">Cooldown is stored in minutes (240 = 4 hours).</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>How seeds are earned</h2>
        <div className="row">
          <Num
            label="Seeds back on harvest"
            hint="Same bonus for every crop"
            value={config.harvestSeedReturn}
            onChange={(v) => num("harvestSeedReturn", v)}
          />
          <Num
            label="Fertilizer bottles per mix"
            hint="After collecting all three ingredients"
            value={config.mixYield}
            onChange={(v) => num("mixYield", v)}
          />
          <Num label="Session minutes" hint="How long a PIN login lasts" value={config.sessionMinutes} onChange={(v) => num("sessionMinutes", v)} />
          <Num label="Plot count (3×3, min 9)" value={config.plotCount} onChange={(v) => num("plotCount", v)} />
        </div>
        <label className="field">
          Timezone
          <input value={config.timezone} onChange={(e) => setConfig({ ...config, timezone: e.target.value })} />
        </label>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Crops — time, cost, and fertilizer</h2>
        <p className="muted">
          Corn, strawberry, and cotton are the same for now: 1 seed to plant, 24 hours, 25 stars on harvest. Pick by
          look, not by a ladder. Fertilizer shave can still differ per crop. Reset to defaults restores this flat table.
        </p>
        <table>
          <thead>
            <tr>
              <th>Crop</th>
              <th>Name</th>
              <th>Seeds to plant</th>
              <th>How long until harvest (min)</th>
              <th>Stars on harvest</th>
              <th>Fertilizer shaves off (min)</th>
            </tr>
          </thead>
          <tbody>
            {config.tiers.map((tier, index) => (
              <tr key={tier.tier}>
                <td>
                  {tier.emoji} {tier.kind}
                  <div className="muted">{formatDuration(tier.durationMinutes)}</div>
                </td>
                <td>
                  <input
                    value={tier.name}
                    onChange={(e) => {
                      const tiers = config.tiers.slice();
                      tiers[index] = { ...tier, name: e.target.value };
                      setConfig({ ...config, tiers });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={tier.seedCost}
                    onChange={(e) => {
                      const tiers = config.tiers.slice();
                      tiers[index] = { ...tier, seedCost: Number(e.target.value) };
                      setConfig({ ...config, tiers });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={tier.durationMinutes}
                    onChange={(e) => {
                      const tiers = config.tiers.slice();
                      tiers[index] = { ...tier, durationMinutes: Number(e.target.value) };
                      setConfig({ ...config, tiers });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={tier.points}
                    onChange={(e) => {
                      const tiers = config.tiers.slice();
                      tiers[index] = { ...tier, points: Number(e.target.value) };
                      setConfig({ ...config, tiers });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={tier.fertilizerReductionMinutes}
                    onChange={(e) => {
                      const tiers = config.tiers.slice();
                      tiers[index] = { ...tier, fertilizerReductionMinutes: Number(e.target.value) };
                      setConfig({ ...config, tiers });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button
          className="btn sage"
          type="button"
          onClick={() =>
            void api
              .saveConfig(config)
              .then((data) => {
                setConfig(data.config);
                setSaved("Saved. The farm is using these numbers now.");
              })
              .catch((err: Error) => setError(err.message))
          }
        >
          Save
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() =>
            void api
              .resetConfig()
              .then((data) => {
                setConfig(data.config);
                setSaved("Restored design defaults.");
              })
              .catch((err: Error) => setError(err.message))
          }
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="field">
      {label}
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="muted">{hint}</span>}
    </label>
  );
}
