import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Bottom/center modal. When opened from a Pixi `pointerup` (plot tap), the
 * browser still emits a follow-up `click` at the same screen point. Without a
 * suppress, that click lands on whichever seed/button was just mounted under
 * the finger ("ghost plant"). Swallow only that leftover opening click.
 *
 * useLayoutEffect (not useEffect) so the capture listener is attached before
 * the browser dispatches the synthetic click that follows pointerup.
 */
export default function Sheet({
  title,
  titleExtra,
  children,
  onClose,
  className,
}: {
  title: string;
  /** Optional status pill / badge rendered beside the title (PlotSheet). */
  titleExtra?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const suppressClick = useRef(true);

  useLayoutEffect(() => {
    suppressClick.current = true;
    const block = (e: Event) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
      if ("stopImmediatePropagation" in e && typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      document.removeEventListener("click", block, true);
    };
    // Capture so we beat a seed button's onClick from the opening gesture.
    document.addEventListener("click", block, true);
    // Safety: if no click arrives (rare), stop suppressing after a beat.
    const t = window.setTimeout(() => {
      suppressClick.current = false;
      document.removeEventListener("click", block, true);
    }, 500);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", block, true);
    };
  }, []);

  function maybeClose(e: React.MouseEvent) {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={maybeClose} role="presentation">
      <div
        className={className ? `sheet ${className}` : "sheet"}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <h2 className={titleExtra ? "sheet-heading" : undefined}>
          {titleExtra ? (
            <>
              <span className="sheet-heading-text">{title}</span>
              {titleExtra}
            </>
          ) : (
            title
          )}
        </h2>
        {children}
      </div>
    </div>
  );
}
