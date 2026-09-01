import { DEFAULT_GAME_CONFIG, type GameConfig } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function ConfigPage() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api
      .config()
      .then((data) => setConfig(data.config))
      .catch((err: Error) => setError(err.message));
  }, []);

  function num(key: keyof GameConfig, value: string) {
    setConfig({ ...config, [key]: Number(value) });
  }

  return (
    <div>
      <h1>Game tunables</h1>
      <p className="muted">These numbers live in Postgres. Save once and the kids’ farm uses them without a redeploy.</p>
      {error && <p className="error">{error}</p>}
      {saved && <p>{saved}</p>}

      <div className="card">
        <label className="field">
          Timezone
          <input value={config.timezone} onChange={(e) => setConfig({ ...config, timezone: e.target.value })} />
        </label>
        <div className="row">
          <Num label="Session minutes" value={config.sessionMinutes} onChange={(v) => num("sessionMinutes", v)} />
          <Num label="Starting seeds" value={config.startingSeeds} onChange={(v) => num("startingSeeds", v)} />
          <Num label="Starting points" value={config.startingPoints} onChange={(v) => num("startingPoints", v)} />
          <Num label="Starting fertilizer" value={config.startingFertilizer} onChange={(v) => num("startingFertilizer", v)} />
          <Num label="Plot count" value={config.plotCount} onChange={(v) => num("plotCount", v)} />
          <Num label="Harvest seed return" value={config.harvestSeedReturn} onChange={(v) => num("harvestSeedReturn", v)} />
        </div>
        <div className="row">
          <Num label="Water cooldown (min)" value={config.wateringCooldownMinutes} onChange={(v) => num("wateringCooldownMinutes", v)} />
          <Num label="Water max / day" value={config.wateringMaxPerDay} onChange={(v) => num("wateringMaxPerDay", v)} />
          <Num label="Water reduction (min)" value={config.wateringReductionMinutes} onChange={(v) => num("wateringReductionMinutes", v)} />
          <Num label="Mix yield" value={config.mixYield} onChange={(v) => num("mixYield", v)} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Plant tiers</h2>
        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Name</th>
              <th>Seed cost</th>
              <th>Duration (min)</th>
              <th>Points</th>
              <th>Fertilizer reduction (min)</th>
            </tr>
          </thead>
          <tbody>
            {config.tiers.map((tier, index) => (
              <tr key={tier.tier}>
                <td>
                  {tier.emoji} {tier.tier}
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

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="field">
      {label}
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
