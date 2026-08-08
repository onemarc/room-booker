import { useEffect, useState } from "react";
import type { OwnedBooking } from "@/lib/bookings";
import {
  mergeBookingPages,
  requestBookingSection,
  type BookingSection,
  type CancellationScope,
} from "./myBookingsUtils";

export function useMyBookings() {
  const [upcoming, setUpcoming] = useState<OwnedBooking[]>([]);
  const [past, setPast] = useState<OwnedBooking[]>([]);
  const [upcomingCursor, setUpcomingCursor] = useState<string | null>(null);
  const [pastCursor, setPastCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);

  // Fetch upcoming and past booking lists in parallel on initial mount or manual retry.
  useEffect(() => {
    const controller = new AbortController();

    async function loadBookings() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [upcomingData, pastData] = await Promise.all([
          requestBookingSection("upcoming", controller.signal),
          requestBookingSection("past", controller.signal),
        ]);

        setUpcoming(upcomingData.bookings ?? []);
        setUpcomingCursor(upcomingData.nextCursor ?? null);
        setPast(pastData.bookings ?? []);
        setPastCursor(pastData.nextCursor ?? null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Your bookings could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadBookings();
    return () => controller.abort();
  }, [retryVersion]);

  // Load subsequent page of bookings for the selected section using cursor-based pagination.
  async function loadMoreBookings(targetSection: BookingSection) {
    const cursor = targetSection === "upcoming" ? upcomingCursor : pastCursor;
    if (!cursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadError("");
    const controller = new AbortController();

    try {
      const data = await requestBookingSection(
        targetSection,
        controller.signal,
        cursor,
      );
      if (targetSection === "upcoming") {
        setUpcoming((current) =>
          mergeBookingPages(current, data.bookings ?? []),
        );
        setUpcomingCursor(data.nextCursor ?? null);
      } else {
        setPast((current) =>
          mergeBookingPages(current, data.bookings ?? []),
        );
        setPastCursor(data.nextCursor ?? null);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "More bookings could not be loaded.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Remove a cancelled booking (or entire recurring series) from local state without full reload.
  function removeCancelledBooking(cancelledBooking: OwnedBooking, scope: CancellationScope) {
    setUpcoming((current) =>
      current.filter((booking) =>
        scope === "series" && cancelledBooking.seriesId
          ? booking.seriesId !== cancelledBooking.seriesId
          : booking.id !== cancelledBooking.id,
      ),
    );
  }

  function refetch() {
    setRetryVersion((v) => v + 1);
  }

  return {
    upcoming,
    past,
    upcomingCursor,
    pastCursor,
    isLoading,
    isLoadingMore,
    loadError,
    loadMoreBookings,
    removeCancelledBooking,
    refetch,
  };
}
