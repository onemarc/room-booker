"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MyBookingsModal } from "@/components/calendar/my-bookings-modal/MyBookingsModal";
import { BookingFormModal } from "@/components/calendar/booking-form-modal/BookingFormModal";
import { CalendarGrid, type CalendarGridSelection } from "@/components/calendar/calendar-grid/CalendarGrid";
import { BookingPopover, type BookingEditorTarget } from "@/components/calendar/booking-popover/BookingPopover";
import { getCalendarViewTransitionTarget, type VisibleCalendarRange } from "@/components/calendar/calendar-grid/calendar-window";
import { DEFAULT_BOOKING_COLOR, type BookingColor, type OwnedBooking, type ScheduleBooking, type ScheduleResponse } from "@/lib/bookings";
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
  initialRooms,
  initialBookings,
}: {
  displayName: string;
  emailConfirmed: boolean;
  confirmationStatus: "success" | "invalid" | null;
  initialNow: string;
  initialActiveDate: string;
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
  const [view, setView] = useState<CalendarView>("week");
  const [gridTargetDate, setGridTargetDate] = useState(() =>
    getMondayStart(initialActiveDate),
  );
  const [visibleGridRange, setVisibleGridRange] =
    useState<VisibleCalendarRange>(() => {
      const startDate = getMondayStart(initialActiveDate);
      return {
        startDate,
        endDate: addCalendarDays(startDate, 6),
      };
    });
  const [isGridViewPositioning, setIsGridViewPositioning] =
    useState(false);
  const [positionRequestId, setPositionRequestId] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [rooms, setRooms] = useState(initialRooms);
  const [minimumCapacity, setMinimumCapacity] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState(
    initialRooms[0]?.id ?? "",
  );
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [roomsRefreshVersion, setRoomsRefreshVersion] = useState(0);
  const [scheduleBookings, setScheduleBookings] =
    useState(initialBookings);
  const [scheduleResultKey, setScheduleResultKey] = useState(
    `${OFFICE_TIME_ZONE}:week:${getMondayStart(initialActiveDate)}:${
      initialRooms[0]?.id ?? ""
    }`,
  );
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [scheduleLoadingMode, setScheduleLoadingMode] =
    useState<ScheduleLoadingMode>("blocking");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleRefreshVersion, setScheduleRefreshVersion] =
    useState(0);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [isMyBookingsOpen, setIsMyBookingsOpen] = useState(false);
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
  }, []);
  const initialRoomsSignature = `${OFFICE_TIME_ZONE}:${initialActiveDate}:1:0`;
  const loadedRoomsSignature = useRef(initialRoomsSignature);
  const initialScheduleSignature = `${OFFICE_TIME_ZONE}:week:${getMondayStart(initialActiveDate)}:${
    initialRooms[0]?.id ?? ""
  }:0`;
  const loadedScheduleSignature = useRef(initialScheduleSignature);
  const activeDate =
    selectedDate ?? getZonedDateIso(initialNow, timeZone);
  const activeDateRef = useRef(activeDate);
  const today = getZonedDateIso(new Date(), timeZone);
  const roomsRequestKey = `${timeZone}:${activeDate}:${minimumCapacity}`;
  // Refresh versions make a deliberate retry distinct from an already-loaded
  // room/date combination without allowing an older response to replace it.
  const roomsRequestSignature = `${roomsRequestKey}:${roomsRefreshVersion}`;
  const schedulePeriodDates = useMemo(() => {
    if (view === "day") {
      return [gridTargetDate];
    }

    // A seven-day viewport can cross a Monday boundary. Load both intersecting
    // server weeks so a scrolled Tuesday-to-Monday view never loses Monday's
    // bookings, while a normal Monday-to-Sunday view remains one request.
    return Array.from(
      new Set([
        getMondayStart(visibleGridRange.startDate),
        getMondayStart(visibleGridRange.endDate),
      ]),
    );
  }, [gridTargetDate, view, visibleGridRange.endDate, visibleGridRange.startDate]);
  const scheduleRequestKey = `${timeZone}:${view}:${schedulePeriodDates.join(",")}:${selectedRoomId}`;
  const scheduleRequestSignature = `${scheduleRequestKey}:${scheduleRefreshVersion}`;

  useEffect(() => {
    activeDateRef.current = activeDate;
  }, [activeDate]);

  useEffect(() => {
    const narrowLayout = window.matchMedia("(max-width: 760px)");

    function applyPhoneDefaults() {
      if (narrowLayout.matches) {
        // A single-day canvas is immediately usable on a phone; Week remains
        // available as a deliberate horizontally scrollable view.
        const phoneDate = activeDateRef.current;
        setIsSidebarOpen(false);
        setView("day");
        setGridTargetDate(phoneDate);
        setVisibleGridRange({
          startDate: phoneDate,
          endDate: phoneDate,
        });
      }
    }

    applyPhoneDefaults();
    narrowLayout.addEventListener("change", applyPhoneDefaults);
    return () =>
      narrowLayout.removeEventListener("change", applyPhoneDefaults);
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

  function navigatePeriod(direction: -1 | 1) {
    const nextDate = addCalendarDays(
      view === "week" ? visibleGridRange.startDate : gridTargetDate,
      direction * (view === "week" ? 7 : 1),
    );
    // Header navigation moves the viewport by one complete period. It must not
    // move the independently selected (green) MiniCalendar date.
    setScheduleLoadingMode("blocking");
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
    selectActiveDate(today);
  }

  const selectActiveDate = useCallback(
    (date: string, targetView: CalendarView = view) => {
      setScheduleLoadingMode("blocking");
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
    [closeBookingEditor, view],
  );

  function changeCalendarView(nextView: CalendarView) {
    const targetDate = getCalendarViewTransitionTarget({
      activeDate,
      currentView: view,
      nextView,
      visibleStartDate: visibleGridRange.startDate,
    });

    setIsGridViewPositioning(nextView === "week" && view !== "week");
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
  }, [view]);

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
    setIsBookingFormOpen(false);
  }

  function handleBookingCancelled(booking: OwnedBooking) {
    setScheduleBookings((current) =>
      current.filter((candidate) => candidate.id !== booking.id),
    );
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
    closeBookingEditor();
  }

  function handleBookingDeleted(bookingId: string) {
    setScheduleBookings((current) =>
      current.filter((candidate) => candidate.id !== bookingId),
    );
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
          onClose={() => setIsSidebarOpen(false)}
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
          view={view}
          timeZone={timeZone}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onToday={goToToday}
          onNavigate={navigatePeriod}
          onChangeView={changeCalendarView}
          onOpenMyBookings={() => {
            closeBookingEditor();
            setIsMyBookingsOpen(true);
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
          activeDate={activeDate}
          targetDate={gridTargetDate}
          view={view}
          isSidebarOpen={isSidebarOpen}
          positionRequestId={positionRequestId}
          isViewPositioning={isGridViewPositioning}
          timeZone={timeZone}
          displayName={displayName}
          selectedRoom={selectedRoom}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          bookings={visibleScheduleBookings}
          draftColor={draftColor}
          previewBookingColor={previewBookingColor}
          isRoomsLoading={isRoomsLoading}
          isScheduleLoading={scheduleIsTransitioning}
          scheduleError={scheduleError}
          canBook={emailConfirmed}
          showRoomSelector={!isSidebarOpen}
          minimumCapacity={minimumCapacity}
          selectedGridSelection={selectedGridSelection}
          onSelectRoom={selectRoom}
          onMinimumCapacityChange={setMinimumCapacity}
          onVisibleRangeChange={syncVisibleRange}
          onViewPositioned={finishGridViewPositioning}
          onRetrySchedule={() => {
            setScheduleLoadingMode("blocking");
            setScheduleRefreshVersion((current) => current + 1);
          }}
          onOpenBooking={() => {
            if (!emailConfirmed) {
              return;
            }
            closeBookingEditor();
            setIsBookingFormOpen(true);
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
          onClose={closeBookingEditor}
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

      {isMyBookingsOpen ? (
        <MyBookingsModal
          timeZone={timeZone}
          view={view}
          onClose={() => setIsMyBookingsOpen(false)}
          onCancelled={handleBookingCancelled}
          onNavigate={({ roomId, date, view: targetView }) => {
            selectRoom(roomId);
            setView(targetView);
            selectActiveDate(date, targetView);
            setIsMyBookingsOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
