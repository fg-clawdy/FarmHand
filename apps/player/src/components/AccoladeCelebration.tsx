import type { AccoladeUnlock } from "../api";

export default function AccoladeCelebration({ unlock }: { unlock: AccoladeUnlock }) {
  return (
    <div className="harvest-banner badge-banner" role="status" aria-live="polite">
      <div className="harvest-banner-title">
        {unlock.emoji} {unlock.title}!
      </div>
      <p className="harvest-note">{unlock.kind === "lifetime" ? "Yours forever" : "This season"}</p>
    </div>
  );
}
