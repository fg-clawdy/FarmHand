import { MASCOT_EMOJI, type FarmPlayerCard } from "@farmhand/shared";
import { useState } from "react";
import { api, type GardenPlayer } from "../api";
import { MascotArt } from "../art";
import KidAvatar from "./KidAvatar";
import PinPad from "./PinPad";
import Sheet from "./Sheet";

export default function WhoseKidPicker({
  title,
  copy,
  players,
  onCancel,
  onIdentified,
  className,
  cancelLabel = "Back",
  large = false,
  freshPin = false,
  localPick,
}: {
  title: string;
  copy: string;
  players: FarmPlayerCard[];
  onCancel: () => void;
  onIdentified: (player: GardenPlayer, pin?: string) => void | Promise<void>;
  className?: string;
  cancelLabel?: string;
  /** Bigger pastel tiles for shared-tablet choices a young kid can read. */
  large?: boolean;
  /**
   * Donate sheet. A kid with a PIN always sees the pad, even if a garden
   * session is already on the tablet. Kids with no PIN skip it.
   */
  freshPin?: boolean;
  /** QA preview only. Resolves the tapped kid without the network. Real spends leave this unset. */
  localPick?: (kid: FarmPlayerCard, pin?: string) => void | Promise<void>;
}) {
  const [pinKid, setPinKid] = useState<FarmPlayerCard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function enterKid(kid: FarmPlayerCard, pin?: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api.enter(kid.id, pin);
      setPinKid(null);
      await onIdentified(data.player, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That PIN didn't work.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function pickKid(kid: FarmPlayerCard) {
    setError("");
    if (freshPin) {
      if (kid.hasPin) {
        setPinKid(kid);
        return;
      }
      if (localPick) {
        setBusy(true);
        try {
          await localPick(kid);
        } finally {
          setBusy(false);
        }
        return;
      }
      void enterKid(kid).catch(() => undefined);
      return;
    }
    if (localPick) {
      setBusy(true);
      try {
        await localPick(kid);
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const session = await api.session();
      if (session.player?.id === kid.id) {
        await onIdentified(session.player);
        return;
      }
    } catch {
      /* browse without a session is expected */
    }
    if (kid.hasPin) {
      setPinKid(kid);
      return;
    }
    void enterKid(kid).catch(() => undefined);
  }

  if (pinKid) {
    return (
      <PinPad
        name={pinKid.name}
        onCancel={() => setPinKid(null)}
        onSubmit={async (pin) => {
          if (localPick && freshPin) {
            setPinKid(null);
            await localPick(pinKid, pin);
            return;
          }
          await enterKid(pinKid, pin);
        }}
      />
    );
  }

  return (
    <Sheet title={title} onClose={onCancel} className={className}>
      <p>{copy}</p>
      {error && <p className="error">{error}</p>}
      <div className={large ? "jar-who-grid" : "store-kids"} data-qa={large ? "jar-who" : undefined}>
        {players.map((kid) => (
          <button
            key={kid.id}
            className={large ? "jar-who-tile" : "store-kid"}
            type="button"
            disabled={busy}
            onClick={() => void pickKid(kid)}
          >
            {large ? (
              <KidAvatar
                size="xl"
                name={kid.name}
                mascot={kid.mascot}
                avatarKind={kid.avatarKind}
                avatarPreset={kid.avatarPreset}
                avatarUrl={kid.avatarUrl}
                decorative
              />
            ) : (
              <MascotArt className="mascot-img" mascot={kid.mascot} />
            )}
            {large ? (
              <span className="jar-who-name">{kid.name}</span>
            ) : (
              <strong>
                {MASCOT_EMOJI[kid.mascot]} {kid.name}
              </strong>
            )}
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </Sheet>
  );
}
