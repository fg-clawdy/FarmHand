import { MASCOT_EMOJI } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type AccoladeLedger, type GardenPlayer, type KidProfile, type StarWallet, type StoreRedemption } from "../api";
import { AcornArt, CameraIcon, FertilizerBeaker, MascotArt, StarIcon } from "../art";
import { AccoladeLedgerBody } from "./AccoladePanel";
import Sheet from "./Sheet";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function emptyLedger(): AccoladeLedger {
  return {
    timezone: "America/Chicago",
    seasonKey: "",
    seasonLabel: "",
    seasonal: { counters: {}, tracks: [], unlocks: [] },
    lifetime: { counters: {}, legends: [], unlocks: [] },
  };
}

function emptyWallet(stars: number): StarWallet {
  return {
    currentStars: stars,
    points: stars,
    heldStars: 0,
    starsHeld: 0,
    availableStars: stars,
    lifetimeEarned: stars,
    lifetimeEarnedHarvest: 0,
    lifetimeEarnedGrant: 0,
    lifetimeEarnedLegacy: 0,
    lifetimeSpent: 0,
    adjustNet: 0,
  };
}

export function kidProfileFromPlayer(player: GardenPlayer): KidProfile {
  return {
    player: { id: player.id, name: player.name, mascot: player.mascot, garden: `${player.name}'s garden` },
    wallet: emptyWallet(player.points),
    pouch: { seeds: player.seeds, fertilizer: player.fertilizer },
    selfies: [],
    rewards: { pending: [], owned: [], redeemed: [], denied: [] },
    accolades: emptyLedger(),
    activity: [],
  };
}

function RewardRow({ row, stamp }: { row: StoreRedemption; stamp?: string }) {
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

export default function ProfileSheet({
  onClose,
  preview,
  skipFetch = false,
}: {
  onClose: () => void;
  preview?: KidProfile;
  skipFetch?: boolean;
}) {
  const [profile, setProfile] = useState<KidProfile | null>(preview ?? null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (preview) setProfile(preview);
    if (skipFetch) return;
    void api
      .profile()
      .then(setProfile)
      .catch((err: Error) => {
        if (!preview) setError(err.message);
      });
  }, [preview, skipFetch]);

  return (
    <Sheet title="Profile" className="profile-sheet" onClose={onClose}>
      {!profile && !error && <p className="sheet-lede">Opening your story…</p>}
      {error && <p className="sheet-error">{error}</p>}
      {profile && (
        <>
          <div className="profile-hero parchment">
            <div className="profile-hero-art">
              <MascotArt className="mascot-img" mascot={profile.player.mascot} />
            </div>
            <div>
              <h3>
                {MASCOT_EMOJI[profile.player.mascot]} {profile.player.name}
              </h3>
              <p className="profile-garden-label">{profile.player.garden}</p>
            </div>
          </div>

          <section className="profile-card parchment">
            <header className="profile-card-head">
              <StarIcon className="profile-card-icon" />
              <h3>Stars</h3>
            </header>
            <div className="profile-wallet">
              <p className="profile-stat">
                <strong>{profile.wallet.availableStars}★</strong> available
              </p>
              <p>
                <strong>{profile.wallet.heldStars}★</strong> set aside while a grown-up decides
              </p>
              <p>
                <strong>{profile.wallet.lifetimeEarned}★</strong> earned all time
                {profile.wallet.lifetimeSpent > 0 ? ` · ${profile.wallet.lifetimeSpent}★ spent on rewards` : ""}
              </p>
            </div>
          </section>

          <section className="profile-card parchment">
            <header className="profile-card-head">
              <AcornArt className="profile-card-icon" />
              <h3>Pouch</h3>
            </header>
            <div className="profile-pouch">
              <span className="profile-chip">
                <AcornArt className="inline-art" /> {profile.pouch.seeds} seeds
              </span>
              <span className="profile-chip">
                <FertilizerBeaker className="inline-art" /> {profile.pouch.fertilizer} fertilizer
              </span>
            </div>
          </section>

          <section className="profile-card parchment">
            <header className="profile-card-head">
              <CameraIcon className="profile-card-icon" />
              <h3>Recent selfies</h3>
            </header>
            {profile.selfies.length === 0 && (
              <p className="profile-empty">No selfies saved yet. Your first smile goes here.</p>
            )}
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

          <section className="profile-card parchment">
            <header className="profile-card-head">
              <span className="profile-card-emoji" aria-hidden>
                🎁
              </span>
              <h3>Rewards</h3>
            </header>
            <h4>Pending</h4>
            {profile.rewards.pending.length === 0 && <p className="profile-empty">Nothing waiting.</p>}
            {profile.rewards.pending.map((row) => (
              <RewardRow key={row.id} row={row} />
            ))}
            <h4>Owned — ready to use</h4>
            {profile.rewards.owned.length === 0 && <p className="profile-empty">No owned rewards yet.</p>}
            {profile.rewards.owned.map((row) => (
              <RewardRow key={row.id} row={row} stamp={formatWhen(row.approvedAt ?? row.resolvedAt)} />
            ))}
            <h4>Redeemed</h4>
            {profile.rewards.redeemed.length === 0 && <p className="profile-empty">No used rewards yet.</p>}
            {profile.rewards.redeemed.map((row) => (
              <RewardRow
                key={row.id}
                row={row}
                stamp={`used ${formatWhen(row.redeemedAt) || formatWhen(row.resolvedAt)}`}
              />
            ))}
          </section>

          {profile.activity.length > 0 && (
            <section className="profile-card parchment">
              <h3>Lately</h3>
              {profile.activity.map((row) => (
                <p key={row.id} className="muted">
                  {row.label}
                  {formatWhen(row.at) ? ` · ${formatWhen(row.at)}` : ""}
                </p>
              ))}
            </section>
          )}

          <section className="profile-card parchment">
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
