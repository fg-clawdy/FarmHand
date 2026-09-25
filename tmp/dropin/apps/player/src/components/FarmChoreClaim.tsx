import type { FarmPlayerCard } from "@farmhand/shared";
import { useState } from "react";
import { api, type FamilyJob, type GardenPlayer, type PublicChore } from "../api";
import PinPad from "./PinPad";
import SelfieCapture from "./SelfieCapture";
import Sheet from "./Sheet";

/**
 * Farm corkboard stake tap → claim the Wanted chore currently on the flyer.
 * No singled-out garden kid: one "{Name} Claims" button per child + Close.
 */
export default function FarmChoreClaim({
  job,
  players,
  onClose,
  onClaimed,
  onFallbackBoard,
}: {
  job: FamilyJob;
  players: FarmPlayerCard[];
  onClose: () => void;
  onClaimed: (name: string) => void;
  /** When claim path needs the full family board (rare). */
  onFallbackBoard?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pinKid, setPinKid] = useState<FarmPlayerCard | null>(null);
  const [photo, setPhoto] = useState<{ chore: PublicChore; playerName: string } | null>(null);

  async function claimAs(kid: FarmPlayerCard, pin?: string) {
    setBusyId(kid.id);
    setError("");
    try {
      // Establish / switch player session (PIN when required) — same enter semantics as garden.
      const session = await api.session().catch(() => ({ player: null as GardenPlayer | null }));
      if (session.player?.id !== kid.id) {
        if (kid.hasPin && pin == null) {
          setPinKid(kid);
          return;
        }
        await api.enter(kid.id, pin);
        setPinKid(null);
      }

      const board = await api.chores();
      const chore = board.chores.find((row) => row.id === job.id);
      if (!chore) {
        setError("That job is no longer on the board.");
        return;
      }
      if (!chore.eligible) {
        setError(chore.reason || `${kid.name} can't claim that chore.`);
        return;
      }

      if (chore.requiresSelfie) {
        setPhoto({ chore, playerName: board.player.name });
        return;
      }

      const data = await api.claimChore(chore.id);
      onClaimed(data.player.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  if (photo) {
    return (
      <SelfieCapture
        title="Chore photo"
        copy="Take a photo so a grown-up can check this chore. This is not today's watering selfie."
        buttonLabel="Send photo"
        onClose={() => setPhoto(null)}
        submit={async (image) => {
          const data = await api.claimChore(photo.chore.id, { image });
          return { player: data.player, unlocks: data.unlocks };
        }}
        onSuccess={(next) => {
          onClaimed(next.name);
          onClose();
        }}
      />
    );
  }

  if (pinKid) {
    return (
      <PinPad
        name={pinKid.name}
        onCancel={() => setPinKid(null)}
        onSubmit={async (pin) => {
          await claimAs(pinKid, pin);
        }}
      />
    );
  }

  const reward =
    job.rewardLabel ??
    (job.rewardSeedCount != null ? `+${job.rewardSeedCount} waiting seed` : "+1 waiting seed");

  return (
    <Sheet title={job.title} onClose={onClose}>
      <p className="chore-copy">
        {job.emoji} {job.description || "Do the chore, then plant a waiting seed."}
      </p>
      <p className="chore-label">{reward}</p>
      {error && <p className="error">{error}</p>}
      <div className={`sheet-actions ${busyId ? "busy" : ""}`} style={{ flexDirection: "column", alignItems: "stretch" }}>
        {players.map((kid) => (
          <button
            key={kid.id}
            className="btn primary"
            type="button"
            disabled={busyId != null}
            onClick={() => void claimAs(kid).catch(() => undefined)}
          >
            {kid.name} Claims
          </button>
        ))}
        <button className="btn ghost" type="button" disabled={busyId != null} onClick={onClose}>
          Close
        </button>
        {onFallbackBoard && (
          <button
            className="btn ghost"
            type="button"
            disabled={busyId != null}
            onClick={() => {
              onClose();
              onFallbackBoard();
            }}
          >
            Back to Board
          </button>
        )}
      </div>
    </Sheet>
  );
}
