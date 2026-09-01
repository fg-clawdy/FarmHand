export default function ComingSoon({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Farm Store</h2>
        <p>The General Store is still getting its shelves stocked. Check back after the next wagon comes through.</p>
        <div className="sheet-actions">
          <button className="btn gold" type="button" onClick={onClose}>
            Back to the farm
          </button>
        </div>
      </div>
    </div>
  );
}
