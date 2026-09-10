import Sheet from "./Sheet";

export default function JobCoach({
  title = "Need a seed?",
  copy = "Your seed pouch is empty. Do a job on the Job Board to plant a waiting seed — jobs do not spend pouch seeds.",
  cta = "Do a job to plant a waiting seed",
  cancelLabel = "Back",
  onClose,
  onContinue,
}: {
  title?: string;
  copy?: string;
  cta?: string;
  cancelLabel?: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="chore-copy">{copy}</p>
      <div className="sheet-actions">
        <button className="btn gold" type="button" onClick={onContinue}>
          {cta}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </Sheet>
  );
}
