import { MASCOT_EMOJI } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type KidProfile, type StoreRedemption } from "../api";
import { MascotArt } from "../art";
import { AccoladeLedgerBody } from "./AccoladePanel";
import Sheet from "./Sheet";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RewardRow({
  row,
  stamp,
}: {
  row: StoreRedemption;
  stamp?: string;
}) {
  return (
    <p className={stamp ? "profile-reward used" : "profile-reward"}>
      <span>
        {row.emoji} {row.title}
      </span>
      <span>
        {row.starCost}★
        {stamp ? ` · ${stamp}` : ""}
      </span>
    </p>
  );
}

export default function ProfileSheet({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<KidProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .profile()
      .then(setProfile)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Sheet title="Profile" className="profile-sheet" onClose={onClose}>
      {!profile && !error && <p>Opening your story…</p>}
      {error && <p className="error">{error}</p>}
      {profile && (
        <>
          <div className="profile-identity">
            <MascotArt className="mascot-img" mascot={profile.player.mascot} />
            <div>
              <h3>
                {MASCOT_EMOJI[profile.player.mascot]} {profile.player.name}
              </h3>
              <p className="muted">{profile.player.garden}</p>
            </div>
          </div>

          <section className="profile-section">
            <h3>Stars</h3>
            <div className="profile-wallet">
              <p>
                <strong>{profile.wallet.availableStars}★</strong> ready to spend
              </p>
              {profile.wallet.heldStars > 0 && (
                <p className="muted">
                  {profile.wallet.heldStars}★ set aside while a grown-up decides
                </p>
              )}
              <p className="muted">
                {profile.wallet.lifetimeEarned}★ earned all time
                {profile.wallet.lifetimeSpent > 0 ? ` · ${profile.wallet.lifetimeSpent}★ spent on rewards` : ""}
              </p>
            </div>
          </section>

          <section className="profile-section">
            <h3>Pouch</h3>
            <p>
              {profile.pouch.seeds} seeds · {profile.pouch.fertilizer} fertilizer
            </p>
          </section>

          <section className="profile-section">
            <h3>Selfies</h3>
            {profile.selfies.length === 0 && <p className="muted">No selfies saved yet.</p>}
            {profile.selfies.length > 0 && (
              <div className="profile-selfies">
                {profile.selfies.map((shot) => (
                  <img
                    key={shot.file}
                    src={shot.url}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="profile-section">
            <h3>Rewards</h3>
            <h4>Waiting on a grown-up</h4>
            {profile.rewards.pending.length === 0 && <p className="muted">Nothing waiting.</p>}
            {profile.rewards.pending.map((row) => (
              <RewardRow key={row.id} row={row} />
            ))}
            <h4>Ready to use</h4>
            {profile.rewards.owned.length === 0 && <p className="muted">No owned rewards yet.</p>}
            {profile.rewards.owned.map((row) => (
              <RewardRow key={row.id} row={row} stamp={formatWhen(row.approvedAt ?? row.resolvedAt)} />
            ))}
            <h4>Already used</h4>
            {profile.rewards.redeemed.length === 0 && <p className="muted">No used rewards yet.</p>}
            {profile.rewards.redeemed.map((row) => (
              <RewardRow
                key={row.id}
                row={row}
                stamp={`used ${formatWhen(row.redeemedAt) || formatWhen(row.resolvedAt)}`}
              />
            ))}
          </section>

          {profile.activity.length > 0 && (
            <section className="profile-section">
              <h3>Lately</h3>
              {profile.activity.map((row) => (
                <p key={row.id} className="muted">
                  {row.label}
                  {formatWhen(row.at) ? ` · ${formatWhen(row.at)}` : ""}
                </p>
              ))}
            </section>
          )}

          <section className="profile-section">
            <h3>Accolades</h3>
            <AccoladeLedgerBody ledger={profile.accolades} />
          </section>
        </>
      )}
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Back to garden
        </button>
      </div>
    </Sheet>
  );
}
