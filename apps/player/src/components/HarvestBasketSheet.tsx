import { useEffect, useState } from "react";
import { type CropKind } from "@farmhand/shared";
import { StarIcon } from "../art";
import type { BasketItem } from "../api";
import Sheet from "./Sheet";

export type BasketLine = {
  kind: string;
  name: string;
  emoji: string;
  count: number;
  pointsEach: number;
  points: number;
};

/** Cache-bust after matting baked checkerboard to true alpha. */
const MARKET_ART_V = "1";

/** Must cover CSS marketTruckDrive (0.85s) so kids see the truck leave before the sheet closes. */
export const MARKET_TRUCK_DRIVE_MS = 900;

const PRODUCE_ART: Record<string, string> = {
  corn: `/art/painted/market/produce_sweet_corn.png?v=${MARKET_ART_V}`,
  sweet_corn: `/art/painted/market/produce_sweet_corn.png?v=${MARKET_ART_V}`,
  sweetCorn: `/art/painted/market/produce_sweet_corn.png?v=${MARKET_ART_V}`,
  cotton: `/art/painted/market/produce_cotton.png?v=${MARKET_ART_V}`,
  sunflower: `/art/painted/market/produce_sunflower.png?v=${MARKET_ART_V}`,
};

const TRUCK_ART = `/art/painted/market/truck.png?v=${MARKET_ART_V}`;

/** Map a basket/crop kind (or alias) to painted produce art, else null → emoji fallback. */
export function produceArtSrc(kind: string): string | null {
  const key = kind.trim();
  if (!key) return null;
  if (PRODUCE_ART[key]) return PRODUCE_ART[key]!;
  const lower = key.toLowerCase().replace(/[\s-]+/g, "_");
  if (PRODUCE_ART[lower]) return PRODUCE_ART[lower]!;
  if (lower === "sweetcorn" || lower === "sweet_corn") return PRODUCE_ART.corn!;
  return null;
}

export function basketLines(items: BasketItem[]): BasketLine[] {
  const order: string[] = [];
  const byKind = new Map<string, BasketLine>();
  for (const item of items) {
    const key = item.kind || item.name;
    const existing = byKind.get(key);
    if (!existing) {
      order.push(key);
      byKind.set(key, {
        kind: item.kind,
        name: item.name,
        emoji: item.emoji,
        count: 1,
        pointsEach: item.points,
        points: item.points,
      });
      continue;
    }
    existing.count += 1;
    existing.points += item.points;
  }
  return order.map((key) => byKind.get(key)!);
}

function pluralName(name: string, count: number) {
  if (count === 1) return name;
  if (name.endsWith("s")) return name;
  const prev = name.length > 1 ? name[name.length - 2]!.toLowerCase() : "";
  if (name.endsWith("y") && !"aeiou".includes(prev)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

export default function HarvestBasketSheet({
  items,
  totalPoints,
  busy,
  error,
  onClose,
  onSell,
}: {
  items: BasketItem[];
  totalPoints: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSell: () => void;
}) {
  const lines = basketLines(items);
  const empty = lines.length === 0;
  const [driving, setDriving] = useState(false);

  // After a failed sell, bring the truck back so kids can try again.
  useEffect(() => {
    if (error) setDriving(false);
  }, [error]);

  function handleSell() {
    if (busy || driving || empty) return;
    setDriving(true);
    onSell();
  }

  const selling = busy || driving;

  return (
    <Sheet title="Farmers Market" onClose={onClose} className="basket-sheet plant-picker-sheet">
      <p className="picker-intro basket-worth">
        {empty ? (
          "The basket is empty."
        ) : (
          <>
            Worth {totalPoints}
            <StarIcon className="inline-art" />
          </>
        )}
      </p>
      {!empty && (
        <div className="tier-grid basket-produce-grid">
          {lines.map((line) => {
            const art = produceArtSrc(line.kind);
            return (
              <div className="tier basket-produce-card" key={line.kind || line.name}>
                <div className="basket-produce-art-well">
                  {art ? (
                    <img
                      className="basket-produce-art"
                      src={art}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                  ) : (
                    <span className="basket-line-emoji basket-produce-fallback" aria-hidden="true">
                      {line.emoji}
                    </span>
                  )}
                </div>
                <b>
                  {line.count} {pluralName(line.name, line.count)}
                </b>
                <div className="inline-row">
                  <StarIcon className="inline-art" /> {line.points}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="basket-error">{error}</p>}
      {!empty && (
        <button
          className={selling ? "market-sell-cta market-sell-cta--driving" : "market-sell-cta"}
          type="button"
          disabled={selling}
          onClick={handleSell}
        >
          <img
            className="market-sell-cta-art"
            src={TRUCK_ART}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <span className="market-sell-cta-label">
            <span className="market-sell-cta-copy">
              {selling ? (
                "Driving to market…"
              ) : (
                <>
                  Sell for {totalPoints}
                  <StarIcon className="inline-art market-sell-cta-star" />
                </>
              )}
            </span>
            <span className="market-sell-cta-sub">Drive to market</span>
          </span>
        </button>
      )}
    </Sheet>
  );
}

// Keep CropKind import for consumers / type docs (kinds with art today).
export type ProduceArtKind = Extract<CropKind, "corn" | "cotton" | "sunflower">;
