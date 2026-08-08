"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScheduleBooking, ScheduleResponse } from "@/lib/bookings";
import type { RoomAvailability } from "@/lib/rooms";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { getPeriodRangeUtc, serializeUtcInstant, type CalendarView } from "@/lib/time";
import {
  getCalendarEventPrefetchPeriodDates,
  type VisibleCalendarRange,
} from "@/components/calendar/calendar-grid/calendar-window";

type RoomsResponse = {
  rooms?: RoomAvailability[];
  error?: {
    message?: string;
  };
};

export type ScheduleLoadingMode = "blocking" | "background";

const CALENDAR_SYNC_INTERVAL_MILLISECONDS = 15_000;

function sortBookings(bookings: ScheduleBooking[]) {
  return [...bookings].sort(
    (left, right) =>
      new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
}

export function useCalendarData({
  initialActiveDate,
  initialRoomId,
  initialRooms,
  initialBookings,
  activeDate,
  timeZone,
  view,
  gridTargetDate,
  visibleGridRange,
  minimumCapacity,
}: {
  initialActiveDate: string;
  initialRoomId?: string;
  initialRooms: RoomAvailability[];
  initialBookings: ScheduleBooking[];
  activeDate: string;
  timeZone: string;
  view: CalendarView;
  gridTargetDate: string;
  visibleGridRange: VisibleCalendarRange;
  minimumCapacity: number;
}) {
  const selectedInitialRoomId = initialRoomId ?? initialRooms[0]?.id ?? "";
  const [rooms, setRooms] = useState(initialRooms);
  const [selectedRoomId, setSelectedRoomId] = useState(
    selectedInitialRoomId,
  );
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [roomsRefreshVersion, setRoomsRefreshVersion] = useState(0);
  const [scheduleBookings, setScheduleBookings] =
    useState(initialBookings);
  // --- SSR / client timezone hydration strategy ---
  // The server renders with OFFICE_TIME_ZONE so the initial HTML matches
  // hydration. The first schedule result key and loading mode are initialized
  // against that same zone. "background" mode prevents the loading skeleton
  // from blanking out server-rendered bookings while the browser reconciles
  // to its actual local timezone on mount.
  const [scheduleResultKey, setScheduleResultKey] = useState(
    `${OFFICE_TIME_ZONE}:week:${getCalendarEventPrefetchPeriodDates({
      visibleStartDate: initialActiveDate,
      visibleEndDate: initialActiveDate,
    }).join(",")}:${selectedInitialRoomId}`,
  );
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const isScheduleLoadingRef = useRef(false);
  const browserTimezoneReconciliationRef = useRef<string | null>(null);
  const [scheduleLoadingMode, setScheduleLoadingMode] =
    // The server already supplied the first room's schedule. The browser may
    // reconcile it with a request using a different display timezone, but
    // that request must not blank bookings that are already renderable.
    useState<ScheduleLoadingMode>("background");
  const scheduleLoadingModeRef = useRef<ScheduleLoadingMode>("background");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleRefreshVersion, setScheduleRefreshVersion] = useState(0);

  useEffect(() => {
    if (!selectedRoomId || typeof window === "undefined") {
      return;
    }

    // Persist the selected room without navigating or resetting the current
    // viewport; a browser reload can then hydrate the same room again.
    const url = new URL(window.location.href);
    if (url.searchParams.get("roomId") === selectedRoomId) {
      return;
    }

    url.searchParams.set("roomId", selectedRoomId);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [selectedRoomId]);

  const initialRoomsSignature = `${OFFICE_TIME_ZONE}:${initialActiveDate}:1:0`;
  const loadedRoomsSignature = useRef(initialRoomsSignature);
  const initialSchedulePeriodDates = getCalendarEventPrefetchPeriodDates({
    visibleStartDate: initialActiveDate,
    visibleEndDate: initialActiveDate,
  });
  const initialScheduleSignature = `${OFFICE_TIME_ZONE}:week:${initialSchedulePeriodDates.join(",")}:${selectedInitialRoomId}:0`;
  const loadedScheduleSignature = useRef(initialScheduleSignature);
  const roomsRequestKey = `${timeZone}:${activeDate}:${minimumCapacity}`;
  // Refresh versions make deliberate retries distinct from already-loaded
  // room/date combinations without allowing an older response to replace it.
  const roomsRequestSignature = `${roomsRequestKey}:${roomsRefreshVersion}`;
  const schedulePeriodDates = useMemo(() => {
    if (view === "day") {
      return [gridTargetDate];
    }

    return getCalendarEventPrefetchPeriodDates({
      visibleStartDate: visibleGridRange.startDate,
      visibleEndDate: visibleGridRange.endDate,
    });
  }, [gridTargetDate, view, visibleGridRange.endDate, visibleGridRange.startDate]);
  const scheduleRequestKey = `${timeZone}:${view}:${schedulePeriodDates.join(",")}:${selectedRoomId}`;
  const scheduleRequestSignature = `${scheduleRequestKey}:${scheduleRefreshVersion}`;

  useEffect(() => {
    isScheduleLoadingRef.current = isScheduleLoading;
  }, [isScheduleLoading]);

  useEffect(() => {
    scheduleLoadingModeRef.current = scheduleLoadingMode;
  }, [scheduleLoadingMode]);

  useEffect(() => {
    if (loadedRoomsSignature.current === roomsRequestSignature) {
      return;
    }

    const controller = new AbortController();

    async function loadRooms() {
      setIsRoomsLoading(true);
      setRoomError("");

      try {
        const searchParams = new URLSearchParams({
          date: activeDate,
          timeZone,
          minCapacity: String(minimumCapacity),
        });
        const response = await fetch(`/api/rooms?${searchParams}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });
        const data = (await response.json()) as RoomsResponse;

        if (!response.ok || !data.rooms) {
          throw new Error(
            data.error?.message ??
              "Room availability could not be loaded.",
          );
        }

        setRooms(data.rooms);
        setSelectedRoomId((current) =>
          data.rooms!.some((room) => room.id === current)
            ? current
            : (data.rooms![0]?.id ?? ""),
        );
        loadedRoomsSignature.current = roomsRequestSignature;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setRoomError(
          error instanceof Error
            ? error.message
            : "Room availability could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsRoomsLoading(false);
        }
      }
    }

    void loadRooms();
    return () => controller.abort();
  }, [
    activeDate,
    minimumCapacity,
    roomsRequestSignature,
    timeZone,
  ]);

  useEffect(() => {
    if (
      !selectedRoomId ||
      loadedScheduleSignature.current === scheduleRequestSignature
    ) {
      return;
    }

    const controller = new AbortController();
    // --- Browser timezone reconciliation ---
    // When the browser timezone differs from OFFICE_TIME_ZONE, the SSR-supplied
    // bookings are positioned at wrong UTC offsets. Force a blocking fetch on
    // the first timezone mismatch so stale data is cleared on failure rather
    // than silently showing events shifted by several hours. The ref ensures
    // subsequent fetches in the same timezone revert to quiet background mode.
    const shouldBlockForBrowserTimezone =
      timeZone !== OFFICE_TIME_ZONE &&
      browserTimezoneReconciliationRef.current !== timeZone;
    if (shouldBlockForBrowserTimezone) {
      browserTimezoneReconciliationRef.current = timeZone;
    }
    const requestIsBackground =
      !shouldBlockForBrowserTimezone &&
      scheduleLoadingModeRef.current === "background";

    async function loadSchedule() {
      setIsScheduleLoading(true);
      setScheduleError("");

      try {
        const periodResults = await Promise.all(
          schedulePeriodDates.map(async (periodDate) => {
            const expectedRange = getPeriodRangeUtc(
              periodDate,
              timeZone,
              view,
            );
            const searchParams = new URLSearchParams({
              roomId: selectedRoomId,
              date: periodDate,
              view,
              timeZone,
            });
            const response = await fetch(`/api/bookings?${searchParams}`, {
              signal: controller.signal,
              cache: "no-store",
              headers: {
                Accept: "application/json",
              },
            });
            const data = (await response.json()) as ScheduleResponse;
            // Verify each echoed room and UTC range before accepting a batch;
            // navigation may have changed while these requests were in flight.
            const matchesRequest =
              data.roomId === selectedRoomId &&
              data.range?.start === serializeUtcInstant(expectedRange.start) &&
              data.range?.end === serializeUtcInstant(expectedRange.end);

            if (!response.ok || !data.bookings || !matchesRequest) {
              throw new Error(
                data.error?.message ?? "The schedule could not be loaded.",
              );
            }

            return data.bookings;
          }),
        );
        const bookingsById = new Map(
          periodResults
            .flat()
            .map((booking) => [booking.id, booking] as const),
        );

        setScheduleBookings(sortBookings(Array.from(bookingsById.values())));
        setScheduleResultKey(scheduleRequestKey);
        loadedScheduleSignature.current = scheduleRequestSignature;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        // Polling and horizontal prefetch are best-effort. Keep the last
        // confirmed schedule visible when a background request fails, so a
        // transient network/database problem never erases a visible booking.
        if (requestIsBackground) {
          return;
        }

        setScheduleBookings([]);
        setScheduleResultKey(scheduleRequestKey);
        setScheduleError(
          error instanceof Error
            ? error.message
            : "The schedule could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsScheduleLoading(false);
        }
      }
    }

    void loadSchedule();
    return () => controller.abort();
  }, [
    schedulePeriodDates,
    scheduleRequestKey,
    scheduleRequestSignature,
    selectedRoomId,
    timeZone,
    view,
  ]);

  const requestScheduleRefresh = useCallback((mode: ScheduleLoadingMode) => {
    setScheduleLoadingMode(mode);
    setScheduleRefreshVersion((current) => current + 1);
  }, []);
  const markScheduleBlocking = useCallback(() => {
    setScheduleLoadingMode("blocking");
  }, []);
  const markScheduleBackground = useCallback(() => {
    setScheduleLoadingMode("background");
  }, []);
  const requestRoomsRefresh = useCallback(() => {
    setRoomsRefreshVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }

    const refreshSchedule = () => {
      if (
        document.visibilityState !== "visible" ||
        isScheduleLoadingRef.current
      ) {
        return;
      }

      // The API is the source of truth for bookings created in another tab or
      // by another user. Poll only while visible and reconcile in the
      // background so scrolling and an open editor are not interrupted.
      requestScheduleRefresh("background");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSchedule();
      }
    };
    const intervalId = window.setInterval(
      refreshSchedule,
      CALENDAR_SYNC_INTERVAL_MILLISECONDS,
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshSchedule);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshSchedule);
    };
  }, [requestScheduleRefresh, selectedRoomId]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId),
    [rooms, selectedRoomId],
  );
  // --- Dual-mode booking visibility ---
  // Booking visibility depends on whether the pending fetch is user-initiated
  // ("blocking" — e.g. room switch) or automatic ("background" — e.g. polling,
  // horizontal prefetch). Background fetches keep stale bookings rendered to
  // avoid flicker; blocking fetches hide them immediately so room A's events
  // never appear under room B's header during a transition.
  const isBackgroundScheduleFetch =
    scheduleLoadingMode === "background" &&
    scheduleResultKey !== scheduleRequestKey;
  const visibleScheduleBookings =
    scheduleResultKey === scheduleRequestKey || isBackgroundScheduleFetch
      ? scheduleBookings
      : [];
  const scheduleIsTransitioning =
    Boolean(selectedRoomId) &&
    scheduleLoadingMode === "blocking" &&
    (isScheduleLoading || scheduleResultKey !== scheduleRequestKey);

  const replaceScheduleBooking = useCallback((booking: ScheduleBooking) => {
    setScheduleBookings((current) =>
      sortBookings([
        ...current.filter((candidate) => candidate.id !== booking.id),
        booking,
      ]),
    );
  }, []);
  const removeScheduleBooking = useCallback((bookingId: string) => {
    setScheduleBookings((current) =>
      current.filter((candidate) => candidate.id !== bookingId),
    );
  }, []);

  return {
    rooms,
    selectedRoomId,
    selectedRoom,
    setSelectedRoomId,
    isRoomsLoading,
    roomError,
    requestRoomsRefresh,
    visibleScheduleBookings,
    isScheduleLoading: scheduleIsTransitioning,
    scheduleError,
    markScheduleBlocking,
    markScheduleBackground,
    requestScheduleRefresh,
    replaceScheduleBooking,
    removeScheduleBooking,
  };
}
