import { formatCountdown, type PublicPlot } from "@farmhand/shared";
import type { GardenPlayer } from "../api";
import { ART, plantArt } from "../art";
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
  const src = plantArt(plot);
  return (
    <Sheet title={plot.ready ? "Ready to harvest!" : `Plot ${plot.slot + 1}`} onClose={onClose}>
      <div className="plot-hero">
        {src && <img src={src} alt="" />}
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
          Fertilizer on hand: <img className="inline-art" src={ART.beaker} alt="" /> {player.fertilizer}
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
              <img className="btn-art" src={ART.wateringCan} alt="" /> Water (−1h)
            </button>
            <button className="btn primary" type="button" disabled={player.fertilizer < 1} onClick={onFertilize}>
              <img className="btn-art" src={ART.beaker} alt="" /> Fertilizer
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
