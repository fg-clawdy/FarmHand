import { formatCountdown, type PublicPlot } from "@farmhand/shared";
import type { GardenPlayer } from "../api";
import { FertilizerBeaker, PlantFigure, WateringCan, plantKind } from "../art";
import Sheet from "./Sheet";

export default function PlotSheet({
  plot,
  player,
  onWater,
  onFertilize,
  onHarvest,
  onClose,
  busy,
}: {
  plot: PublicPlot;
  player: GardenPlayer;
  onWater: () => void;
  onFertilize: () => void;
  onHarvest: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const cooldown = formatCountdown(player.water.cooldownRemainingMs);
  const kind = plantKind(plot);
  return (
    <Sheet title={plot.ready ? "Ready to harvest!" : `Plot ${plot.slot + 1}`} onClose={onClose}>
      <div className="plot-hero">
        {kind && <PlantFigure className="hero-art" kind={kind} ready={plot.ready} />}
        <p>
          {plot.ready ? (
            <strong className="ready-tag">READY</strong>
          ) : (
            <>Time left: {formatCountdown(plot.remainingMs)}</>
          )}
        </p>
        <p>
          Waterings left today: {player.water.wateringsLeft}
          {player.water.cooldownRemainingMs > 0 ? ` · watering can ready in ${cooldown}` : ""}
        </p>
        <p className="inline-row">
          Fertilizer on hand: <FertilizerBeaker className="inline-art" /> {player.fertilizer}
        </p>
      </div>
      <div className={`sheet-actions ${busy ? "busy" : ""}`}>
        {plot.ready ? (
          <button className="btn gold" type="button" onClick={onHarvest}>
            Harvest
          </button>
        ) : (
          <>
            <button className="btn water" type="button" disabled={!player.water.canWater} onClick={onWater}>
              <WateringCan className="btn-art" /> Water (−1h)
            </button>
            <button className="btn primary" type="button" disabled={player.fertilizer < 1} onClick={onFertilize}>
              <FertilizerBeaker className="btn-art" /> Fertilizer
            </button>
          </>
        )}
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
