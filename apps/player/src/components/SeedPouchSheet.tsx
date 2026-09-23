import type { GameConfig } from "@farmhand/shared";
import { AcornArt, StarIcon } from "../art";
import type { GardenPlayer } from "../api";
import { cheapestSeedCost } from "../pixi/gardenLayout";
import Sheet from "./Sheet";

export default function SeedPouchSheet({
  player,
  config,
  onClose,
  onNeedJobs,
}: {
  player: GardenPlayer;
  config: GameConfig;
  onClose: () => void;
  onNeedJobs?: () => void;
}) {
  const pouch = player.seeds;
  const waiting = player.provisionalSeeds;
  const total = pouch + waiting;
  const cheapest = cheapestSeedCost(config.tiers);
  const broke = total < cheapest;
  const affordable = config.tiers.filter((t) => total >= t.seedCost);
  const best =
    affordable.length === 0
      ? null
      : affordable.reduce((a, b) =>
          b.seedCost > a.seedCost || (b.seedCost === a.seedCost && b.tier > a.tier) ? b : a,
        );

  const empty = player.plots.filter((p) => p.state === "empty").length;
  const growing = player.plots.filter((p) => p.state === "growing" && !p.ready).length;
  const ready = player.plots.filter((p) => p.ready).length;
  const waitingPlots = player.plots.filter((p) => p.state === "purgatory").length;
  const shardsPer = config.shardsPerSeed;

  return (
    <Sheet title="Seed pouch" className="seed-pouch-sheet" onClose={onClose}>
      <p className="picker-intro">
        Tap a glowing empty plot to plant. This pouch is just your seed stats.
      </p>

      <section className="profile-section">
        <h3>Seeds</h3>
        <div className="profile-wallet">
          <p>
            <AcornArt className="inline-art" /> <strong>{pouch}</strong> ready to plant
          </p>
          {waiting > 0 && (
            <p className="muted">
              {waiting} waiting for a grown-up to approve
            </p>
          )}
          <p className="muted">
            Shard meter: {player.seedShards}/{shardsPer} toward the next seed
          </p>
        </div>
      </section>

      <section className="profile-section">
        <h3>Garden right now</h3>
        <div className="profile-wallet">
          <p>
            <strong>{empty}</strong> empty plots · <strong>{growing}</strong> growing ·{" "}
            <strong>{ready}</strong> ready to harvest
          </p>
          {waitingPlots > 0 && (
            <p className="muted">{waitingPlots} waiting-seed plot{waitingPlots === 1 ? "" : "s"}</p>
          )}
        </div>
      </section>

      <section className="profile-section">
        <h3>Stars & plants</h3>
        <div className="profile-wallet">
          <p>
            <StarIcon className="inline-art" /> <strong>{player.points}</strong> stars in your wallet
          </p>
          {best ? (
            <p>
              Biggest plant you can afford: <strong>{best.name}</strong> ({best.seedCost} seeds → {best.points}★)
            </p>
          ) : (
            <p className="muted">You need more seeds before you can plant.</p>
          )}
        </div>
      </section>

      <div className="sheet-actions">
        {broke && onNeedJobs && (
          <button className="btn gold" type="button" onClick={onNeedJobs}>
            Do a job for a waiting seed
          </button>
        )}
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
