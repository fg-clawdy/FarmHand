import type { ReactNode } from "react";

export default function Sheet({
  title,
  children,
  onClose,
  className,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className={className ? `sheet ${className}` : "sheet"}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
