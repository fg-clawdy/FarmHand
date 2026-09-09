import { useEffect, useState } from "react";
import type { GameConfig } from "@farmhand/shared";
import type { GardenPlayer, PublicChore } from "../api";
import Sheet from "./Sheet";

export default function ChoreSheet({
  chores,
  emptySlots,
  config,
  busy,
  onClose,
  onClaim,
  onNeedPhoto,
}: {
  chores: PublicChore[];
  emptySlots: number[];
  config: GameConfig;
  busy: boolean;
  onClose: () => void;
  onClaim: (chore: PublicChore, slot: number, tier: number) => Promise<GardenPlayer>;
  onNeedPhoto: (chore: PublicChore, slot: number, tier: number) => void;
}) {
  const [picked, setPicked] = useState<PublicChore | null>(null);
  const [slot, setSlot] = useState<number | null>(emptySlots[0] ?? null);
  const [tier, setTier] = useState(config.tiers[0]?.tier ?? 1);
  const [error, setError] = useState("");
  const eligible = chores.filter((chore) => chore.eligible);
  const defaultTier = config.tiers[0]?.tier ?? 1;

  useEffect(() => {
    setSlot(emptySlots[0] ?? null);
  }, [emptySlots]);

  async function claim(chore: PublicChore, nextSlot: number, nextTier: number) {
    setError("");
    if (emptySlots.length === 0) {
      setError("Need an empty plot to plant your chore seed.");
      return;
    }
    if (chore.requiresSelfie) {
      onNeedPhoto(chore, nextSlot, nextTier);
      return;
    }
    try {
      await onClaim(chore, nextSlot, nextTier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    }
  }

  if (picked) {
    return (
      <Sheet title={picked.title} onClose={() => setPicked(null)}>
        <p className="chore-copy">
          {picked.emoji} {picked.description || "Do the chore, then plant a waiting seed."}
        </p>
        {emptySlots.length === 0 ? (
          <p className="error">Need an empty plot first. Harvest or prune something.</p>
        ) : (
          <>
            <p className="chore-label">Empty plot</p>
            <div className="chore-beds">
              {Array.from({ length: 9 }, (_, s) => {
                const open = emptySlots.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`chore-bed ${open ? "" : "full"} ${slot === s ? "selected" : ""}`}
                    disabled={!open}
                    aria-label={open ? "Empty mound" : "Occupied mound"}
                    onClick={() => setSlot(s)}
                  />
                );
              })}
            </div>
            <p className="chore-label">Plant</p>
            <div className="chore-slots">
              {config.tiers.map((t) => (
                <button
                  key={t.tier}
                  type="button"
                  className={`chore-slot ${tier === t.tier ? "selected" : ""}`}
                  onClick={() => setTier(t.tier)}
                >
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <div className={`sheet-actions ${busy ? "busy" : ""}`}>
          <button
            className="btn primary"
            type="button"
            disabled={busy || slot == null || emptySlots.length === 0}
            onClick={() => void claim(picked, slot ?? emptySlots[0]!, tier || defaultTier)}
          >
            {picked.requiresSelfie ? "Take photo & plant" : "Plant waiting seed"}
          </button>
          <button className="btn ghost" type="button" onClick={() => setPicked(null)}>
            Back
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Chores" onClose={onClose}>
      <p className="chore-copy">Finish a job to plant a waiting seed. Stars come later, when a grown-up says yes and you harvest.</p>
      {emptySlots.length === 0 && <p className="error">Your garden is full. Harvest or prune a plot first.</p>}
      <div className="chore-list">
        {eligible.length === 0 && <p className="muted">No chores left to claim right now.</p>}
        {eligible.map((chore) => (
          <button
            key={chore.id}
            type="button"
            className={`chore-row ${chore.priority === "CRITICAL" ? "critical" : ""}`}
            onClick={() => {
              setPicked(chore);
              setError("");
            }}
          >
            <span className="chore-emoji">{chore.emoji}</span>
            <span className="chore-meta">
              <b>{chore.title}</b>
              <small>{chore.requiresSelfie ? "Needs a photo" : "1 waiting seed"}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
