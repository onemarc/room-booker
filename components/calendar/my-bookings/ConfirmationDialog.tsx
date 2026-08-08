import { useEffect, useRef, type KeyboardEvent } from "react";
import type { OwnedBooking } from "@/lib/bookings";
import {
  formatBookingDate,
  formatBookingTime,
  type CancellationScope,
} from "./myBookingsUtils";

export function ConfirmationDialog({
  booking,
  timeZone,
  isPending,
  error,
  scope,
  onCancel,
  onConfirm,
  onScopeChange,
}: {
  booking: OwnedBooking;
  timeZone: string;
  isPending: boolean;
  error: string;
  scope: CancellationScope;
  onCancel: () => void;
  onConfirm: () => void;
  onScopeChange: (scope: CancellationScope) => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  // Trap keyboard focus within dialog while active, and dismiss on Escape.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !isPending) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }

    if (event.key === "Tab") {
      const buttons = [
        ...event.currentTarget.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled])",
        ),
      ];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 grid place-items-center overflow-hidden
                bg-[rgba(23,32,27,0.42)] p-5 backdrop-blur-[2px] max-[640px]:p-3"
      role="presentation"
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-[430px] rounded-2xl border border-[#d5ddd7]
                  bg-white p-5 shadow-[0_22px_70px_rgba(20,35,26,0.25)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        aria-describedby="cancel-booking-description"
      >
        <h3
          className="m-0 text-lg font-[720] text-[#273229]"
          id="cancel-booking-title"
        >
          Cancel this booking?
        </h3>
        <p
          className="mt-2 mb-0 text-[13px] leading-5 text-[#647068] [overflow-wrap:anywhere]"
          id="cancel-booking-description"
        >
          <strong className="font-[690] text-[#354139] [overflow-wrap:anywhere]">
            {booking.title}
          </strong>{" "}
          in {booking.roomName} on{" "}
          {formatBookingDate(booking, timeZone)} at{" "}
          {formatBookingTime(booking, timeZone)} will be removed.
        </p>
        {booking.seriesId ? (
          <fieldset className="mt-4 grid gap-2 rounded-xl border border-[#d8dfda] bg-[#f8faf8] p-3">
            <legend className="px-1 text-xs font-[680] text-[#3f4b43]">
              Recurring booking
            </legend>
            <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#56625a]">
              <input
                className="mt-1 accent-[var(--accent)]"
                type="radio"
                name="cancellation-scope"
                checked={scope === "occurrence"}
                disabled={isPending}
                onChange={() => onScopeChange("occurrence")}
              />
              Cancel only this occurrence
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#56625a]">
              <input
                className="mt-1 accent-[var(--accent)]"
                type="radio"
                name="cancellation-scope"
                checked={scope === "series"}
                disabled={isPending}
                onChange={() => onScopeChange("series")}
              />
              Cancel this and all future occurrences
            </label>
          </fieldset>
        ) : null}
        {error ? (
          <p
            className="mt-3 mb-0 rounded-lg bg-[#fff4f4] px-3 py-2 text-xs text-[#943e3e]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="h-10 cursor-pointer rounded-[9px] border border-[#ccd4ce] bg-white px-4
                      text-[13px] font-[650] text-[#4c5850] hover:bg-[#f4f7f4] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            ref={cancelButtonRef}
            disabled={isPending}
            onClick={onCancel}
          >
            Keep booking
          </button>
          <button
            className="h-10 cursor-pointer rounded-[9px] border border-[#9c3d3d] bg-[#9c3d3d] px-4 
                      text-[13px] font-[680] text-white hover:bg-[#873434] disabled:cursor-wait disabled:opacity-55"
            type="button"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "Cancelling…" : "Cancel booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
