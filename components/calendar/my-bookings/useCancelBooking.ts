import { useRef, useState } from "react";
import type { OwnedBooking } from "@/lib/bookings";
import type { CancellationScope } from "./myBookingsUtils";

export function useCancelBooking(
  onSuccess: (cancelledBooking: OwnedBooking, scope: CancellationScope) => void,
) {
  const [bookingToCancel, setBookingToCancel] = useState<OwnedBooking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancellingRef = useRef(false);
  const [cancellationError, setCancellationError] = useState("");
  const [cancellationScope, setCancellationScope] = useState<CancellationScope>("occurrence");

  function requestCancellation(booking: OwnedBooking) {
    setCancellationError("");
    setCancellationScope("occurrence");
    setBookingToCancel(booking);
  }

  function dismissCancellation() {
    setCancellationError("");
    setBookingToCancel(null);
  }

  async function confirmCancellation() {
    if (!bookingToCancel || isCancellingRef.current) {
      return;
    }

    isCancellingRef.current = true;
    setIsCancelling(true);
    setCancellationError("");

    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(
          bookingToCancel.id,
        )}?scope=${cancellationScope}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      const data = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        setCancellationError(
          data.error?.message ?? "The booking could not be cancelled.",
        );
        return;
      }

      onSuccess(bookingToCancel, cancellationScope);
      setBookingToCancel(null);
    } catch {
      setCancellationError(
        "The booking service is unavailable. Check your connection and try again.",
      );
    } finally {
      isCancellingRef.current = false;
      setIsCancelling(false);
    }
  }

  return {
    bookingToCancel,
    isCancelling,
    cancellationError,
    cancellationScope,
    setCancellationScope,
    requestCancellation,
    dismissCancellation,
    confirmCancellation,
  };
}
