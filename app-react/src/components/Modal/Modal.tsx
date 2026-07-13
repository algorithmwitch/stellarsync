import { useEffect, useId, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";

type ModalProps = PropsWithChildren<{
  open: boolean;
  title: string;
  onClose(): void;
  widthClassName?: string;
}>;

export function Modal({ open, title, onClose, widthClassName = "max-w-3xl", children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`stellar-panel max-h-[90vh] w-full ${widthClassName} overflow-y-auto`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="stellar-eyebrow">React editor</div>
            <h2 id={titleId} className="m-0 text-2xl font-semibold text-stellar-text-strong">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-xl border border-stellar-border px-3 py-2 text-sm text-stellar-muted hover:text-stellar-text"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
