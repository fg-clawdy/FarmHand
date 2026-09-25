import { AVATAR_PRESETS, type FarmPlayerCard } from "@farmhand/shared";
import { useState } from "react";
import { api, type GardenPlayer } from "../api";
import KidAvatar from "./KidAvatar";
import SelfieCapture from "./SelfieCapture";
import Sheet from "./Sheet";

type PlayerLike = Pick<
  GardenPlayer,
  "id" | "name" | "mascot" | "avatarKind" | "avatarPreset" | "avatarUrl"
> &
  Partial<GardenPlayer>;

export default function AvatarPicker({
  player,
  onClose,
  onDone,
}: {
  player: PlayerLike | FarmPlayerCard;
  onClose: () => void;
  onDone: (next: GardenPlayer) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selfie, setSelfie] = useState(false);
  const current = player as PlayerLike;

  async function apply(body: { kind: "mascot" } | { kind: "preset"; presetId: string }) {
    setBusy(true);
    setError("");
    try {
      const data = await api.setAvatar(body);
      onDone(data.player);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that picture.");
    } finally {
      setBusy(false);
    }
  }

  if (selfie) {
    return (
      <SelfieCapture
        title="Profile selfie"
        copy="Smile! This picture goes on your garden sign. It does not unlock watering."
        buttonLabel="Use this selfie"
        onClose={() => setSelfie(false)}
        submit={async (image) => {
          const data = await api.setAvatar({ kind: "selfie", image });
          return { player: data.player };
        }}
        onSuccess={(next) => {
          onDone(next);
          onClose();
        }}
      />
    );
  }

  return (
    <Sheet title="Pick a picture" className="avatar-picker-sheet" onClose={onClose}>
      <div className="avatar-picker-current">
        <KidAvatar
          size="xl"
          name={current.name}
          mascot={current.mascot}
          avatarKind={current.avatarKind}
          avatarPreset={current.avatarPreset}
          avatarUrl={current.avatarUrl}
        />
        <p className="muted">This is {current.name}'s picture right now.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className={`avatar-picker-grid ${busy ? "busy" : ""}`}>
        <button className="avatar-picker-tile" type="button" disabled={busy} onClick={() => void apply({ kind: "mascot" })}>
          <KidAvatar size="lg" mascot={current.mascot} avatarKind="mascot" decorative />
          <span>Use my mascot</span>
        </button>
        {AVATAR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className="avatar-picker-tile"
            type="button"
            disabled={busy}
            onClick={() => void apply({ kind: "preset", presetId: preset.id })}
          >
            <span className="kid-avatar kid-avatar--lg kid-avatar--emoji" aria-hidden>
              <span className="kid-avatar-emoji">{preset.emoji}</span>
            </span>
            <span>{preset.label}</span>
          </button>
        ))}
        <button className="avatar-picker-tile avatar-picker-tile--selfie" type="button" disabled={busy} onClick={() => setSelfie(true)}>
          <span className="kid-avatar kid-avatar--lg kid-avatar--emoji" aria-hidden>
            <span className="kid-avatar-emoji">📷</span>
          </span>
          <span>Take a selfie</span>
        </button>
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" type="button" disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
