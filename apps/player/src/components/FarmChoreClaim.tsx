import type { FarmPlayerCard } from "@farmhand/shared";
import { useState } from "react";
import { api, type FamilyJob, type GardenPlayer, type PublicChore } from "../api";
import ChoreConfirmHero from "./ChoreConfirmHero";
import KidAvatar from "./KidAvatar";
import PinPad from "./PinPad";
import SelfieCapture from "./SelfieCapture";
import Sheet from "./Sheet";
import { kidSeedRewardLabel } from "../kidSeedReward";

/**
 * Farm corkboard stake tap → claim the Wanted chore currently on the flyer.
 * Kid tiles with PFP (Option 1 claim UX). Claim/skip flows unchanged.
 * Confirm sheet hero matches JobBoard (painted art + cream chips).
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
  onFallbackBoard?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pinKid, setPinKid] = useState<FarmPlayerCard | null>(null);
  const [pendingAction, setPendingAction] = useState<"claim" | "skip">("claim");
  const [photo, setPhoto] = useState<{ chore: PublicChore; playerName: string } | null>(null);

  async function ensureSession(kid: FarmPlayerCard, pin?: string) {
    const session = await api.session().catch(() => ({ player: null as GardenPlayer | null }));
    if (session.player?.id !== kid.id) {
      if (kid.hasPin && pin == null) {
        setPinKid(kid);
        return null;
      }
      await api.enter(kid.id, pin);
      setPinKid(null);
    }
    return true;
  }

  async function skipAs(kid: FarmPlayerCard, pin?: string) {
    setPendingAction("skip");
    setBusyId(kid.id);
    setError("");
    try {
      const ok = await ensureSession(kid, pin);
      if (!ok) return;
      const board = await api.chores();
      const chore = board.chores.find((row) => row.id === job.id);
      if (!chore) {
        setError("That job is no longer on the board.");
        return;
      }
      if (!chore.allowsSkip) {
        setError("That chore can't be cleared as not needed.");
        return;
      }
      if (!chore.eligible) {
        setError(chore.reason || `${kid.name} can't clear that chore.`);
        return;
      }
      const data = await api.skipChore(chore.id);
      onClaimed(data.player.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  async function claimAs(kid: FarmPlayerCard, pin?: string) {
    setPendingAction("claim");
    setBusyId(kid.id);
    setError("");
    try {
      const ok = await ensureSession(kid, pin);
      if (!ok) return;

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
          if (pendingAction === "skip") await skipAs(pinKid, pin);
          else await claimAs(pinKid, pin);
        }}
      />
    );
  }

  const reward = job.rewardLabel ?? kidSeedRewardLabel(job.rewardSeedCount, job.rewardSeedKind);

  return (
    <Sheet title={job.title} onClose={onClose} className="sheet--chore-confirm">
      <ChoreConfirmHero slug={job.slug} title={job.title} rewardLabel={reward} />
      {error && <p className="error">{error}</p>}
      <div className={`kid-claim-grid ${busyId ? "busy" : ""}`}>
        {players.map((kid) => (
          <button
            key={kid.id}
            className="kid-claim-tile"
            type="button"
            disabled={busyId != null}
            aria-label={`${kid.name} claims`}
            onClick={() => void claimAs(kid).catch(() => undefined)}
          >
            <KidAvatar
              size="xl"
              name={kid.name}
              mascot={kid.mascot}
              avatarKind={kid.avatarKind}
              avatarPreset={kid.avatarPreset}
              avatarUrl={kid.avatarUrl}
              decorative
            />
            <strong className="kid-claim-name">{kid.name}</strong>
            <span className="kid-claim-action">Confirm</span>
            {kid.hasPin && (
              <span className="kid-claim-lock" aria-hidden>
                🔒
              </span>
            )}
          </button>
        ))}
      </div>
      {job.allowsSkip && (
        <div
          className={`sheet-actions sheet-actions--chore-confirm ${busyId ? "busy" : ""}`}
          data-testid="chore-skip-group"
        >
          {players.map((kid) => (
            <button
              key={`skip-${kid.id}`}
              className="btn cream-secondary"
              type="button"
              disabled={busyId != null}
              data-testid="chore-skip"
              onClick={() => void skipAs(kid).catch(() => undefined)}
            >
              {kid.name}: Not needed · +1 shard
            </button>
          ))}
        </div>
      )}
      <button
        className="chore-confirm-back"
        type="button"
        disabled={busyId != null}
        onClick={() => {
          if (onFallbackBoard) {
            onClose();
            onFallbackBoard();
          } else {
            onClose();
          }
        }}
      >
        Back to board
      </button>
    </Sheet>
  );
}
