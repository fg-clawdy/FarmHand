import { MASCOT_EMOJI, type FarmPlayerCard } from "@farmhand/shared";
import { useState } from "react";
import { api, type GardenPlayer } from "../api";
import { MascotArt } from "../art";
import PinPad from "./PinPad";
import Sheet from "./Sheet";

export default function WhoseKidPicker({
  title,
  copy,
  players,
  onCancel,
  onIdentified,
}: {
  title: string;
  copy: string;
  players: FarmPlayerCard[];
  onCancel: () => void;
  onIdentified: (player: GardenPlayer) => void | Promise<void>;
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
      await onIdentified(data.player);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That PIN didn't work.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function pickKid(kid: FarmPlayerCard) {
    setError("");
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
      <PinPad name={pinKid.name} onCancel={() => setPinKid(null)} onSubmit={(pin) => enterKid(pinKid, pin)} />
    );
  }

  return (
    <Sheet title={title} onClose={onCancel}>
      <p>{copy}</p>
      {error && <p className="error">{error}</p>}
      <div className="store-kids">
        {players.map((kid) => (
          <button key={kid.id} className="store-kid" type="button" disabled={busy} onClick={() => void pickKid(kid)}>
            <MascotArt className="mascot-img" mascot={kid.mascot} />
            <strong>
              {MASCOT_EMOJI[kid.mascot]} {kid.name}
            </strong>
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onCancel}>
          Back
        </button>
      </div>
    </Sheet>
  );
}
