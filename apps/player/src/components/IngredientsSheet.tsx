import type { GameConfig } from "@farmhand/shared";
import type { GardenPlayer } from "../api";
import { FertilizerBeaker, IngredientOrb } from "../art";
import Sheet from "./Sheet";

export default function IngredientsSheet({
  player,
  config,
  onClaim,
  onMix,
  onClose,
  busy,
}: {
  player: GardenPlayer;
  config: GameConfig;
  onClaim: () => void;
  onMix: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <Sheet title="Ingredient shed" onClose={onClose}>
      <p>
        Claim one ingredient each day, in order: Moon Dew, then Grow Goo, then Phoenix Ash. Mix one of each into
        fertilizer.
      </p>
      <div className="ings">
        <div className="ing">
          <IngredientOrb kind="dew" />
          <b>Moon Dew</b>
          <div className="qty">{player.ingredients.moonDew}</div>
        </div>
        <div className="ing">
          <IngredientOrb kind="goo" />
          <b>Grow Goo</b>
          <div className="qty">{player.ingredients.growGoo}</div>
        </div>
        <div className="ing">
          <IngredientOrb kind="ash" />
          <b>Phoenix Ash</b>
          <div className="qty">{player.ingredients.phoenixAsh}</div>
        </div>
      </div>
      <p>
        Next claim: {player.nextIngredient.name}
        {player.claimedIngredientToday ? " (already claimed today)" : ""}
      </p>
      <p className="inline-row">
        Fertilizer ready: <FertilizerBeaker className="inline-art" /> {player.fertilizer}
      </p>
      <div className={`sheet-actions ${busy ? "busy" : ""}`}>
        <button className="btn gold" type="button" disabled={player.claimedIngredientToday} onClick={onClaim}>
          Claim daily
        </button>
        <button className="btn primary" type="button" disabled={!player.canMix} onClick={onMix}>
          Mix {config.mixYield} fertilizer
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
