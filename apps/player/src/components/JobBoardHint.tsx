import Sheet from "./Sheet";

/** Art/placement ping-ready sheet. Game Engineer wires Job Coach + claim on PR #1. */
export default function JobBoardHint({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Job Board" onClose={onClose}>
      <p className="sheet-lede">Do a job to plant a waiting seed.</p>
      <p className="sheet-status">
        Open jobs pin up on this corkboard. A grown-up will hook whose job it is — this board is just the farm hotspot.
      </p>
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Back to the farm
        </button>
      </div>
    </Sheet>
  );
}
