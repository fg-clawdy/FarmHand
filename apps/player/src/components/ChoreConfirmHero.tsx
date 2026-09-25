import { useState } from "react";
import { AcornArt } from "../art";
import {
  CHORE_GENERIC_SLUG,
  paintedChoreArtUrl,
} from "../chorePaintedArt";

/**
 * Confirm-sheet hero: painted chore art (cream frame) + title / reward / instruction.
 * Layout locked to the Dishes mock — apply for every chore slug.
 */
export default function ChoreConfirmHero({
  slug,
  title,
  rewardLabel,
}: {
  slug: string;
  title: string;
  rewardLabel: string;
}) {
  const [src, setSrc] = useState(() => paintedChoreArtUrl(slug));

  return (
    <div className="chore-confirm-hero">
      <div className="chore-confirm-art-frame">
        <img
          className="chore-confirm-art"
          src={src}
          alt=""
          draggable={false}
          onError={() => {
            const fallback = paintedChoreArtUrl(CHORE_GENERIC_SLUG);
            if (src !== fallback) setSrc(fallback);
          }}
        />
      </div>
      <div className="chore-confirm-meta">
        <h3 className="chore-confirm-title">{title}</h3>
        <div className="chore-confirm-reward" role="status">
          <AcornArt className="chore-confirm-acorn" title="Seeds" />
          <span>{rewardLabel}</span>
        </div>
        <p className="chore-confirm-instruction">Do the chore, then tap Confirm.</p>
      </div>
    </div>
  );
}
