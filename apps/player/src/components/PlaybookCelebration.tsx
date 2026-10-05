export type PlaybookComplete = { slug: string; title: string; emoji: string };

export default function PlaybookCelebration({ playbook }: { playbook: PlaybookComplete }) {
  return (
    <div className="harvest-banner badge-banner" role="status" aria-live="polite">
      <div className="harvest-banner-title">
        {playbook.emoji} {playbook.title} complete!
      </div>
      <p className="harvest-note">Nice work — see you next time.</p>
    </div>
  );
}
