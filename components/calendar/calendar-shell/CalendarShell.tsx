"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BookingFormModal } from "@/components/calendar/booking-form-modal/BookingFormModal";
import { CalendarGrid, type CalendarGridHandle, type CalendarGridSelection } from "@/components/calendar/calendar-grid/CalendarGrid";
import { BookingPopover, type BookingEditorTarget } from "@/components/calendar/booking-popover/BookingPopover";
import { getCalendarEventPrefetchPeriodDates, getCalendarViewTransitionTarget, type VisibleCalendarRange } from "@/components/calendar/calendar-grid/calendar-window";
import { DEFAULT_BOOKING_COLOR, type BookingColor, type ScheduleBooking, type ScheduleResponse } from "@/lib/bookings";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import {
  addCalendarDays,
  detectBrowserTimeZone,
  formatPeriodLabel,
  getMondayStart,
  getPeriodRangeUtc,
  getZonedDateIso,
  serializeUtcInstant,
  startOfCalendarMonth,
  type CalendarView,
} from "@/lib/time";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarSidebar } from "./CalendarSidebar";
import type { RoomAvailability } from "@/lib/rooms";

type RoomsResponse = {
  rooms?: RoomAvailability[];
  error?: {
    message?: string;
  };
};

type ScheduleLoadingMode = "blocking" | "background";

const CALENDAR_SYNC_INTERVAL_MILLISECONDS = 15_000;

const CALENDAR_SHELL_CLASS = [
  "flex h-screen min-h-[560px] w-full overflow-hidden bg-[var(--surface)]",
  "supports-[height:100dvh]:h-dvh",
].join(" ");

const ROOM_ERROR_CLASS = [
  "flex items-center justify-between gap-3 border-b border-[#ecd2d2]",
  "bg-[#fff8f8] px-3.5 py-2 text-[13px] text-[#8c3d3d]",
].join(" ");

function subscribeToBrowserTimeZone() {
  return () => {};
}

export function CalendarShell({
  displayName,
  emailConfirmed,
  confirmationStatus,
  initialNow,
  initialActiveDate,
  initialView,
  initialRoomId,
  initialRooms,
  initialBookings,
}: {
  displayName: string;
  emailConfirmed: boolean;
  confirmationStatus: "success" | "invalid" | null;
  initialNow: string;
  initialActiveDate: string;
  initialView: CalendarView;
  initialRoomId?: string;
  initialRooms: RoomAvailability[];
  initialBookings: ScheduleBooking[];
}) {
  const timeZone = useSyncExternalStore(
    subscribeToBrowserTimeZone,
    detectBrowserTimeZone,
    () => OFFICE_TIME_ZONE,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleMiniCalendarMonth, setVisibleMiniCalendarMonth] =
    useState<string | null>(null);
  const [view, setView] = useState<CalendarView>(initialView);
  const [gridTargetDate, setGridTargetDate] = useState(() =>
    initialView === "day"
      ? initialActiveDate
      : getMondayStart(initialActiveDate),
  );
  const [visibleGridRange, setVisibleGridRange] =
    useState<VisibleCalendarRange>(() => {
      const startDate =
        initialView === "day"
          ? initialActiveDate
          : getMondayStart(initialActiveDate);
      return {
        startDate,
        endDate:
          initialView === "day" ? startDate : addCalendarDays(startDate, 6),
      };
    });
  const [isGridViewPositioning, setIsGridViewPositioning] =
    useState(false);
  const [positionRequestId, setPositionRequestId] = useState(0);
  const [stopScrollRequestId, setStopScrollRequestId] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const calendarGridRef = useRef<CalendarGridHandle>(null);
  const hasReconciledBrowserDate = useRef(false);
  const [rooms, setRooms] = useState(initialRooms);
  const [minimumCapacity, setMinimumCapacity] = useState(1);
  const selectedInitialRoomId = initialRoomId ?? initialRooms[0]?.id ?? "";
  const [selectedRoomId, setSelectedRoomId] = useState(
    selectedInitialRoomId,
  );
  useEffect(() => {
    if (!selectedRoomId || typeof window === "undefined") {
      return;
    }

    // The server uses roomId to hydrate the initial schedule. Keep the
    // client-side choice in the URL without navigating away or resetting the
    // current calendar viewport, so a browser reload restores the same room.
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
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [roomsRefreshVersion, setRoomsRefreshVersion] = useState(0);
  const initialSchedulePeriodDates = getCalendarEventPrefetchPeriodDates({
    visibleStartDate: initialActiveDate,
    visibleEndDate: initialActiveDate,
  });
  const [scheduleBookings, setScheduleBookings] =
    useState(initialBookings);
  const [scheduleResultKey, setScheduleResultKey] = useState(
    `${OFFICE_TIME_ZONE}:week:${initialSchedulePeriodDates.join(",")}:${
      selectedInitialRoomId
    }`,
  );
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const isScheduleLoadingRef = useRef(false);
  const [scheduleLoadingMode, setScheduleLoadingMode] =
    // The server already supplied the first room's schedule. The browser may
    // reconcile it with a request using a different display timezone, but
    // that request must not blank bookings that are already renderable.
    useState<ScheduleLoadingMode>("background");
  const scheduleLoadingModeRef = useRef<ScheduleLoadingMode>("background");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleRefreshVersion, setScheduleRefreshVersion] =
    useState(0);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] =
    useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [bookingEditorTarget, setBookingEditorTarget] =
    useState<BookingEditorTarget | null>(null);
  const [draftColor, setDraftColor] =
    useState<BookingColor>(DEFAULT_BOOKING_COLOR);
  const [previewBookingColor, setPreviewBookingColor] = useState<{
    bookingId: string;
    color: BookingColor;
  } | null>(null);
  // The completed range is separate from the popover target so the grid can
  // keep its selection treatment visible while the editor is open.
  const [selectedGridSelection, setSelectedGridSelection] =
    useState<CalendarGridSelection | null>(null);
  const closeBookingEditor = useCallback(() => {
    setBookingEditorTarget(null);
    setSelectedGridSelection(null);
    setDraftColor(DEFAULT_BOOKING_COLOR);
    setPreviewBookingColor(null);
  }, [
    setBookingEditorTarget,
    setDraftColor,
    setPreviewBookingColor,
    setSelectedGridSelection,
  ]);
  useEffect(() => {
    // The server must use the office zone for its deterministic first render,
    // but the browser owns the displayed calendar date after hydration. Only
    // replace the server's default "today"; an explicit URL date is user
    // navigation and should survive the timezone reconciliation.
    if (
      timeZone === OFFICE_TIME_ZONE ||
      hasReconciledBrowserDate.current
    ) {
      return;
    }

    const serverToday = getZonedDateIso(
      new Date(initialNow),
      OFFICE_TIME_ZONE,
    );
    const browserDate =
      initialActiveDate === serverToday
        ? getZonedDateIso(new Date(initialNow), timeZone)
        : initialActiveDate;
    const targetDate =
      view === "week" ? getMondayStart(browserDate) : browserDate;

    hasReconciledBrowserDate.current = true;
    setScheduleLoadingMode("blocking");
    setPositionRequestId((current) => current + 1);
    setSelectedDate(browserDate);
    setGridTargetDate(targetDate);
    setVisibleGridRange({
      startDate: targetDate,
      endDate: addCalendarDays(targetDate, view === "week" ? 6 : 0),
    });
    setVisibleMiniCalendarMonth(startOfCalendarMonth(browserDate));
  }, [initialActiveDate, initialNow, timeZone, view]);
  const cancelBookingDraft = useCallback(() => {
    if (bookingEditorTarget?.mode === "create") {
      // A grid click temporarily makes the draft date active. Cancelling the
      // unsaved editor must return both controlled MiniCalendar values to the
      // real current day instead of leaving the draft date selected.
      const currentDate = getZonedDateIso(new Date(), timeZone);
      setSelectedDate(currentDate);
      setVisibleMiniCalendarMonth(startOfCalendarMonth(currentDate));
    }
    closeBookingEditor();
  }, [bookingEditorTarget, closeBookingEditor, timeZone]);
  const initialRoomsSignature = `${OFFICE_TIME_ZONE}:${initialActiveDate}:1:0`;
  const loadedRoomsSignature = useRef(initialRoomsSignature);
  const initialScheduleSignature = `${OFFICE_TIME_ZONE}:week:${initialSchedulePeriodDates.join(",")}:${
    selectedInitialRoomId
  }:0`;
  const loadedScheduleSignature = useRef(initialScheduleSignature);
  const activeDate =
    selectedDate ?? getZonedDateIso(initialNow, timeZone);
  const today = getZonedDateIso(new Date(), timeZone);
  const roomsRequestKey = `${timeZone}:${activeDate}:${minimumCapacity}`;
  // Refresh versions make a deliberate retry distinct from an already-loaded
  // room/date combination without allowing an older response to replace it.
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
    const narrowLayout = window.matchMedia("(max-width: 760px)");

    function applyPhoneLayout() {
      if (narrowLayout.matches) {
        // Phone layout changes presentation only. Keep the requested or
        // user-selected view intact so Week never silently becomes Day.
        setIsSidebarOpen(false);
      }
    }

    applyPhoneLayout();
    narrowLayout.addEventListener("change", applyPhoneLayout);
    return () =>
      narrowLayout.removeEventListener("change", applyPhoneLayout);
  }, []);

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
    roomsRefreshVersion,
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
    const requestIsBackground = scheduleLoadingModeRef.current === "background";

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

        setScheduleBookings(
          Array.from(bookingsById.values()).sort(
            (left, right) =>
              new Date(left.startAt).getTime() -
              new Date(right.startAt).getTime(),
          ),
        );
        setScheduleResultKey(scheduleRequestKey);
        loadedScheduleSignature.current = scheduleRequestSignature;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        // Polling and horizontal prefetch are best-effort. Keep the last
        // confirmed schedule visible when a background request fails, so a
        // transient network/database problem never makes the calendar appear
        // empty or erase a booking the user just created.
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
    scheduleRefreshVersion,
    schedulePeriodDates,
    scheduleRequestKey,
    scheduleRequestSignature,
    selectedRoomId,
    timeZone,
    view,
  ]);

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
      setScheduleLoadingMode("background");
      setScheduleRefreshVersion((current) => current + 1);
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
  }, [selectedRoomId]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId),
    [rooms, selectedRoomId],
  );
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
  const periodLabel = formatPeriodLabel(
    view === "week" ? visibleGridRange.startDate : gridTargetDate,
    view,
  );
  const isTodayVisible =
    today >= visibleGridRange.startDate &&
    today <= visibleGridRange.endDate;

  function navigatePeriod(direction: -1 | 1) {
    const nextDate = addCalendarDays(
      view === "week" ? visibleGridRange.startDate : gridTargetDate,
      direction * (view === "week" ? 7 : 1),
    );
    // Header navigation moves the viewport by one complete period. It must not
    // move the independently selected (green) MiniCalendar date.
    setScheduleLoadingMode("blocking");
    setPositionRequestId((current) => current + 1);
    setGridTargetDate(nextDate);
    setVisibleGridRange({
      startDate: nextDate,
      endDate: addCalendarDays(nextDate, view === "week" ? 6 : 0),
    });
    setVisibleMiniCalendarMonth(
      startOfCalendarMonth(
        addCalendarDays(nextDate, view === "week" ? 3 : 0),
      ),
    );
    closeBookingEditor();
  }

  function goToToday() {
    // Today is the only command that cancels active trackpad momentum. Other
    // navigation and sidebar resizing must leave normal scrolling untouched.
    setStopScrollRequestId((current) => current + 1);
    selectActiveDate(today);
  }

  const selectActiveDate = useCallback(
    (date: string, targetView: CalendarView = view) => {
      setScheduleLoadingMode("blocking");
      // Date selections are explicit navigation commands. Incrementing the
      // request makes them win over queued momentum-scroll range updates even
      // when the requested week is the same as the last positioned target.
      setPositionRequestId((current) => current + 1);
      setSelectedDate(date);
      const targetDate =
        targetView === "week" ? getMondayStart(date) : date;
      setGridTargetDate(targetDate);
      setVisibleGridRange({
        startDate: targetDate,
        endDate: addCalendarDays(
          targetDate,
          targetView === "week" ? 6 : 0,
        ),
      });
      setVisibleMiniCalendarMonth(startOfCalendarMonth(date));
      closeBookingEditor();
    },
    [closeBookingEditor, setScheduleLoadingMode, view],
  );

  function changeCalendarView(nextView: CalendarView) {
    const targetDate = getCalendarViewTransitionTarget({
      activeDate,
      currentView: view,
      nextView,
      visibleStartDate: visibleGridRange.startDate,
    });

    // Both directions need a covered paint. Day view has one wide column, so
    // revealing it before the new schedule/position settles exposes the stale
    // Day surface for a frame before Week (or the reverse) is ready.
    setIsGridViewPositioning(nextView !== view);
    setScheduleLoadingMode("blocking");
    setPositionRequestId((current) => current + 1);
    setView(nextView);
    setGridTargetDate(targetDate);
    setVisibleGridRange({
      startDate: targetDate,
      endDate: addCalendarDays(targetDate, nextView === "week" ? 6 : 0),
    });
    setVisibleMiniCalendarMonth(
      startOfCalendarMonth(
        addCalendarDays(targetDate, nextView === "week" ? 3 : 0),
      ),
    );
    closeBookingEditor();
  }

  const finishGridViewPositioning = useCallback(() => {
    setIsGridViewPositioning(false);
  }, []);

  const syncVisibleRange = useCallback((range: VisibleCalendarRange) => {
    // Horizontal scrolling prefetches the newly exposed schedule range. Keep
    // the current grid visible while that background request completes instead
    // of replacing it with a loading skeleton on every range boundary.
    setScheduleLoadingMode("background");
    setGridTargetDate(range.startDate);
    setVisibleGridRange(range);
    setVisibleMiniCalendarMonth(
      startOfCalendarMonth(
        addCalendarDays(range.startDate, view === "week" ? 3 : 0),
      ),
    );
  }, [
    setGridTargetDate,
    setScheduleLoadingMode,
    setVisibleGridRange,
    setVisibleMiniCalendarMonth,
    view,
  ]);

  function selectGridDate(date: string) {
    // Scrolling changes only the pale visible-range highlight. The selected
    // day changes when an interaction is anchored to a concrete grid date.
    setSelectedDate(date);
    setVisibleMiniCalendarMonth(startOfCalendarMonth(date));
  }

  function selectRoom(roomId: string) {
    setScheduleLoadingMode("blocking");
    setSelectedRoomId(roomId);
    closeBookingEditor();
  }

  const toggleSidebar = useCallback((open: boolean) => {
    calendarGridRef.current?.captureSidebarLayoutAnchor();
    setIsSidebarOpen(open);
  }, []);

  async function resendConfirmation() {
    setIsResendingConfirmation(true);
    setConfirmationMessage("");

    try {
      const response = await fetch("/api/auth/confirm/resend", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const data = (await response.json()) as {
        error?: { message?: string };
      };
      setConfirmationMessage(
        response.ok
          ? "A fresh confirmation link was printed to the server log."
          : (data.error?.message ?? "A new link could not be issued."),
      );
    } catch {
      setConfirmationMessage("A new confirmation link could not be issued.");
    } finally {
      setIsResendingConfirmation(false);
    }
  }

  function handleBookingCreated({
    booking,
    roomId,
    date,
  }: {
    booking: ScheduleBooking;
    roomId: string;
    date: string;
  }) {
    setSelectedRoomId(roomId);
    setScheduleBookings((current) => {
      const withoutCreatedBooking = current.filter(
        (candidate) => candidate.id !== booking.id,
      );
      return [...withoutCreatedBooking, booking].sort(
        (left, right) =>
          new Date(left.startAt).getTime() -
          new Date(right.startAt).getTime(),
      );
    });
    selectActiveDate(date);
    setScheduleRefreshVersion((current) => current + 1);
    setIsBookingFormOpen(false);
  }

  function handleBookingSaved({
    booking,
  }: {
    booking: ScheduleBooking;
    mode: BookingEditorTarget["mode"];
  }) {
    // Apply the server response directly so a successful edit never replaces
    // the visible schedule with a full loading state.
    setScheduleBookings((current) => {
      const withoutSavedBooking = current.filter(
        (candidate) => candidate.id !== booking.id,
      );
      return [...withoutSavedBooking, booking].sort(
        (left, right) =>
          new Date(left.startAt).getTime() -
          new Date(right.startAt).getTime(),
      );
    });
    setScheduleLoadingMode("background");
    setScheduleRefreshVersion((current) => current + 1);
    closeBookingEditor();
  }

  function handleBookingDeleted(bookingId: string) {
    setScheduleBookings((current) =>
      current.filter((candidate) => candidate.id !== bookingId),
    );
    setScheduleLoadingMode("background");
    setScheduleRefreshVersion((current) => current + 1);
    closeBookingEditor();
  }

  return (
    <main className={CALENDAR_SHELL_CLASS}>
      {isSidebarOpen ? (
        <CalendarSidebar
          activeDate={activeDate}
          visibleRangeStart={visibleGridRange.startDate}
          visibleRangeEnd={visibleGridRange.endDate}
          visibleMonth={
            visibleMiniCalendarMonth ?? startOfCalendarMonth(activeDate)
          }
          timeZone={timeZone}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          isLoading={isRoomsLoading}
          error={roomError}
          minimumCapacity={minimumCapacity}
          onClose={() => toggleSidebar(false)}
          onSelectDate={selectActiveDate}
          onVisibleMonthChange={setVisibleMiniCalendarMonth}
          onSelectRoom={selectRoom}
          onRetry={() =>
            setRoomsRefreshVersion((current) => current + 1)
          }
          onMinimumCapacityChange={setMinimumCapacity}
        />
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--surface)]">
        <CalendarHeader
          isSidebarOpen={isSidebarOpen}
          displayName={displayName}
          periodLabel={periodLabel}
          isTodayVisible={isTodayVisible}
          activeDate={
            view === "week"
              ? visibleGridRange.startDate
              : gridTargetDate
          }
          view={view}
          timeZone={timeZone}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          isRoomsLoading={isRoomsLoading}
          minimumCapacity={minimumCapacity}
          canBook={emailConfirmed}
          onOpenSidebar={() => toggleSidebar(true)}
          onToday={goToToday}
          onNavigate={navigatePeriod}
          onChangeView={changeCalendarView}
          onSelectRoom={selectRoom}
          onMinimumCapacityChange={setMinimumCapacity}
          onOpenBooking={() => {
            if (!emailConfirmed) return;
            closeBookingEditor();
            setIsBookingFormOpen(true);
          }}
        />
        {!emailConfirmed || confirmationStatus === "invalid" ? (
          <div
            className="flex flex-none items-center justify-between gap-3 border-b border-[#e5d3aa] bg-[#fffaf0] px-3.5 py-2 text-xs text-[#745b25] max-[640px]:items-start"
            role={confirmationStatus === "invalid" ? "alert" : "status"}
          >
            <span>
              {confirmationMessage ||
                (confirmationStatus === "invalid"
                  ? "That confirmation link is invalid or expired."
                  : "Confirm your email using the development link in the server log before booking a room.")}
            </span>
            {!emailConfirmed ? (
              <button
                className="h-8 flex-none cursor-pointer rounded-lg border border-[#d8c38e] bg-white px-3 text-[11px] font-bold text-[#745b25] hover:bg-[#fffdf8] disabled:cursor-wait disabled:opacity-55"
                type="button"
                disabled={isResendingConfirmation}
                onClick={() => void resendConfirmation()}
              >
                {isResendingConfirmation ? "Issuing…" : "Print new link"}
              </button>
            ) : null}
          </div>
        ) : confirmationStatus === "success" ? (
          <div
            className="flex flex-none items-center border-b border-[#cfe1d5] bg-[#f3faf5] px-3.5 py-2 text-xs text-[#356047]"
            role="status"
          >
            Email confirmed. You can now create bookings.
          </div>
        ) : null}
        {roomError && !isSidebarOpen ? (
          <div
            className={ROOM_ERROR_CLASS}
            role="alert"
          >
            <span>{roomError}</span>
            <button
              className="m-0 cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-[var(--accent)]"
              type="button"
              onClick={() =>
                setRoomsRefreshVersion((current) => current + 1)
              }
            >
              Retry
            </button>
          </div>
        ) : null}

        <CalendarGrid
          ref={calendarGridRef}
          activeDate={activeDate}
          targetDate={gridTargetDate}
          view={view}
          isSidebarOpen={isSidebarOpen}
          positionRequestId={positionRequestId}
          stopScrollRequestId={stopScrollRequestId}
          isViewPositioning={isGridViewPositioning}
          timeZone={timeZone}
          displayName={displayName}
          selectedRoom={selectedRoom}
          bookings={visibleScheduleBookings}
          draftColor={draftColor}
          previewBookingColor={previewBookingColor}
          canBook={emailConfirmed}
          isScheduleLoading={scheduleIsTransitioning}
          scheduleError={scheduleError}
          selectedGridSelection={selectedGridSelection}
          onVisibleRangeChange={syncVisibleRange}
          onViewPositioned={finishGridViewPositioning}
          onRetrySchedule={() => {
            setScheduleLoadingMode("blocking");
            setScheduleRefreshVersion((current) => current + 1);
          }}
          onCreateSelection={({ gridSelection, ...selection }) => {
            setIsBookingFormOpen(false);
            setDraftColor(DEFAULT_BOOKING_COLOR);
            setPreviewBookingColor(null);
            selectGridDate(gridSelection.date);
            setSelectedGridSelection(gridSelection);
            setBookingEditorTarget({
              mode: "create",
              ...selection,
            });
          }}
          onUpdateSelection={({ gridSelection, ...selection }) => {
            selectGridDate(gridSelection.date);
            setSelectedGridSelection(gridSelection);
            setBookingEditorTarget((current) =>
              current?.mode === "create"
                ? {
                    ...current,
                    ...selection,
                  }
                : current,
            );
          }}
          onEditBooking={(selection) => {
            setIsBookingFormOpen(false);
            setPreviewBookingColor(null);
            setSelectedGridSelection(null);
            setBookingEditorTarget({
              mode: "edit",
              ...selection,
            });
          }}
        />
      </section>

      {bookingEditorTarget ? (
        <BookingPopover
          key={
            bookingEditorTarget.mode === "edit"
              ? `edit:${bookingEditorTarget.booking.id}`
              : "create"
          }
          target={bookingEditorTarget}
          timeZone={timeZone}
          onClose={cancelBookingDraft}
          onSaved={handleBookingSaved}
          onDeleted={handleBookingDeleted}
          onColorChange={(color) => {
            if (bookingEditorTarget.mode === "edit") {
              setPreviewBookingColor({
                bookingId: bookingEditorTarget.booking.id,
                color,
              });
            } else {
              setDraftColor(color);
            }
          }}
        />
      ) : null}

      {isBookingFormOpen ? (
        <BookingFormModal
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          activeDate={activeDate}
          timeZone={timeZone}
          onClose={() => setIsBookingFormOpen(false)}
          onCreated={handleBookingCreated}
        />
      ) : null}

    </main>
  );
}
