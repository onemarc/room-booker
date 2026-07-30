"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { FiX } from "react-icons/fi";

export function Modal({
  title,
  description,
  children,
  onClose,
  closeDisabled = false,
  size = "large",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  size?: "medium" | "large";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    // Capture the element and scroll state before opening, then restore both
    // on cleanup so a dialog behaves as a contained, reversible interaction.
    const previousActiveElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      const autofocusTarget =
        panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      const firstFocusable =
        panelRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
      (autofocusTarget ?? firstFocusable ?? panelRef.current)?.focus();
    });

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      // Trap Tab within the dialog because the application behind it remains
      // mounted and otherwise exposes controls to keyboard users.
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];

      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [closeDisabled, onClose]);

  return (
    <div
      className="fixed inset-0 z-100 grid place-items-center bg-[rgba(20,29,24,0.42)] p-5 backdrop-blur-[2px] max-[640px]:p-2.5"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) {
          onClose();
        }
      }}
    >
      <div
        className={[
          "relative flex max-h-[min(88vh,820px)] w-full flex-col overflow-hidden rounded-[18px] border border-[#d7ddd8] bg-[var(--surface)] shadow-[0_28px_80px_rgba(20,35,26,0.26)]",
          size === "large" ? "max-w-[920px]" : "max-w-[590px]",
        ].join(" ")}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="flex flex-none items-start justify-between gap-6 border-b border-[var(--line)] px-6 py-5 max-[640px]:px-4 max-[640px]:py-4">
          <div className="grid gap-1">
            <h2
              className="m-0 text-xl font-[720] tracking-[-0.025em] text-[#202b24]"
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <p
                className="m-0 text-[13px] leading-5 text-[#6c776f]"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            className="grid size-9 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#5f6a63] hover:bg-[#eef2ef] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-45 [&>svg]:size-[19px]"
            type="button"
            aria-label={`Close ${title}`}
            disabled={closeDisabled}
            onClick={onClose}
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
