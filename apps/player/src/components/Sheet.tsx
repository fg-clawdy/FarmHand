import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { CloseIcon } from "./ModalIcons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom/center modal. When opened from a Pixi `pointerup` (plot tap), the
 * browser still emits a follow-up `click` at the same screen point. Without a
 * suppress, that click lands on whichever seed/button was just mounted under
 * the finger ("ghost plant"). Swallow only that leftover opening click.
 *
 * useLayoutEffect (not useEffect) so the capture listener is attached before
 * the browser dispatches the synthetic click that follows pointerup.
 *
 * Two shells share this component:
 * - "classic" (default): the original wood-grain panel, unchanged.
 * - "crate": the redesigned shell. Wood-plank header with a close button,
 *   pinned sub-header + footer, scrolling paper body, Esc to close, focus trap
 *   and focus restore, aria-modal, and an `overlay` slot for in-sheet confirms.
 *   Classes: `.sheet--crate`, `.crate-*` (styles.css).
 */
export default function Sheet({
  title,
  titleExtra,
  children,
  onClose,
  className,
  variant = "classic",
  icon,
  subhead,
  footer,
  overlay,
}: {
  title: string;
  /** Optional status pill / badge rendered beside the title (PlotSheet). */
  titleExtra?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  /** "crate" opts into the redesigned shell. */
  variant?: "classic" | "crate";
  /** crate: decorative art at the left of the header. */
  icon?: ReactNode;
  /** crate: pinned strip between the header and the scrolling body (wallet, tabs). */
  subhead?: ReactNode;
  /** crate: pinned action row under the body. */
  footer?: ReactNode;
  /** crate: layered over the sheet (confirm step). The content behind goes inert while set. */
  overlay?: ReactNode;
}) {
  const crate = variant === "crate";
  const suppressClick = useRef(true);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const hasOverlay = Boolean(overlay);

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

  // crate: move focus into the dialog, hand it back on close.
  useEffect(() => {
    if (!crate) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous && previous.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, [crate]);

  // crate: Esc closes.
  useEffect(() => {
    if (!crate) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [crate]);

  // crate: while an overlay (confirm) is up, nothing behind it can be reached.
  useEffect(() => {
    const el = mainRef.current;
    const root = dialogRef.current;
    if (!el || !root) return;
    if (hasOverlay) {
      el.setAttribute("inert", "");
      // Hand focus to the confirm step (the button that opened it just went inert).
      const first = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).find((n) => !n.closest("[inert]"));
      (first ?? root).focus({ preventScroll: true });
    } else {
      const hadInert = el.hasAttribute("inert");
      el.removeAttribute("inert");
      if (hadInert) root.focus({ preventScroll: true });
    }
  }, [hasOverlay]);

  function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.closest("[inert]"),
    );
    if (items.length === 0) {
      e.preventDefault();
      root.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function maybeClose(e: React.MouseEvent) {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClose();
  }

  if (crate) {
    return (
      <div className="sheet-backdrop sheet-backdrop--crate" onClick={maybeClose} role="presentation">
        <div
          ref={dialogRef}
          className={className ? `sheet sheet--crate ${className}` : "sheet sheet--crate"}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={trapTab}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <div className="crate-main" ref={mainRef}>
            <header className="crate-head">
              {icon && (
                <span className="crate-head-icon" aria-hidden>
                  {icon}
                </span>
              )}
              <h2 className="crate-title" id={titleId}>
                <span className="crate-title-text">{title}</span>
                {titleExtra}
              </h2>
              <button className="crate-close" type="button" aria-label="Close" onClick={onClose}>
                <CloseIcon />
              </button>
            </header>
            {subhead && <div className="crate-subhead">{subhead}</div>}
            <div className="crate-body">{children}</div>
            {footer && <footer className="crate-foot">{footer}</footer>}
          </div>
          {overlay}
        </div>
      </div>
    );
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

