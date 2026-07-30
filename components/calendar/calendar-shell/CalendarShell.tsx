"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ScheduleBooking, ScheduleResponse } from "@/lib/bookings";
import { BookingFormModal } from "@/components/calendar/booking-form-modal/BookingFormModal";
import { BookingPopover, type BookingEditorTarget } from "@/components/calendar/booking-popover/BookingPopover";
import { CalendarGrid, type CalendarGridSelection } from "@/components/calendar/calendar-grid/CalendarGrid";
import { MyBookingsModal } from "@/components/calendar/my-bookings-modal/MyBookingsModal";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import type { RoomAvailability } from "@/lib/rooms";
import {
  addCalendarDays,
  detectBrowserTimeZone,
  formatPeriodLabel,
  getPeriodRangeUtc,
  getZonedDateIso,
  serializeUtcInstant,
  startOfCalendarMonth,
  type CalendarView,
} from "@/lib/time";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarSidebar } from "./CalendarSidebar";

type RoomsResponse = {
  rooms?: RoomAvailability[];
  error?: {
    message?: string;
  };
};

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
  initialNow,
  initialActiveDate,
  initialRooms,
  initialBookings,
}: {
  displayName: string;
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [rooms, setRooms] = useState(initialRooms);
  const [selectedRoomId, setSelectedRoomId] = useState(
    initialRooms[0]?.id ?? "",
  );
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [roomsRefreshVersion, setRoomsRefreshVersion] = useState(0);
  const [scheduleBookings, setScheduleBookings] =
    useState(initialBookings);
  const [scheduleResultKey, setScheduleResultKey] = useState(
    `${OFFICE_TIME_ZONE}:${initialActiveDate}:week:${
      initialRooms[0]?.id ?? ""
    }`,
  );
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleRefreshVersion, setScheduleRefreshVersion] =
    useState(0);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [isMyBookingsOpen, setIsMyBookingsOpen] = useState(false);
  const [bookingEditorTarget, setBookingEditorTarget] =
    useState<BookingEditorTarget | null>(null);
  // The completed range is separate from the popover target so the grid can
  // keep its selection treatment visible while the editor is open.
  const [selectedGridSelection, setSelectedGridSelection] =
    useState<CalendarGridSelection | null>(null);
  const closeBookingEditor = useCallback(() => {
    setBookingEditorTarget(null);
    setSelectedGridSelection(null);
  }, []);
  const initialRoomsSignature = `${OFFICE_TIME_ZONE}:${initialActiveDate}:0`;
  const loadedRoomsSignature = useRef(initialRoomsSignature);
  const initialScheduleSignature = `${OFFICE_TIME_ZONE}:${initialActiveDate}:week:${
    initialRooms[0]?.id ?? ""
  }:0`;
  const loadedScheduleSignature = useRef(initialScheduleSignature);
  const activeDate =
    selectedDate ?? getZonedDateIso(initialNow, timeZone);
  const today = getZonedDateIso(new Date(), timeZone);
  const roomsRequestKey = `${timeZone}:${activeDate}`;
  // Refresh versions make a deliberate retry distinct from an already-loaded
  // room/date combination without allowing an older response to replace it.
  const roomsRequestSignature = `${roomsRequestKey}:${roomsRefreshVersion}`;
  const scheduleRequestKey = `${timeZone}:${activeDate}:${view}:${selectedRoomId}`;
  const scheduleRequestSignature = `${scheduleRequestKey}:${scheduleRefreshVersion}`;

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
        const expectedRange = getPeriodRangeUtc(
          activeDate,
          timeZone,
          view,
        );
        const searchParams = new URLSearchParams({
          roomId: selectedRoomId,
          date: activeDate,
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
        // Verify the echoed room and UTC range before accepting a response;
        // navigation may have changed while this request was in flight.
        const matchesRequest =
          data.roomId === selectedRoomId &&
          data.range?.start === serializeUtcInstant(expectedRange.start) &&
          data.range?.end === serializeUtcInstant(expectedRange.end);

        if (!response.ok || !data.bookings || !matchesRequest) {
          throw new Error(
            data.error?.message ?? "The schedule could not be loaded.",
          );
        }

        setScheduleBookings(data.bookings);
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
    activeDate,
    scheduleRefreshVersion,
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
  const visibleScheduleBookings =
    scheduleResultKey === scheduleRequestKey ? scheduleBookings : [];
  const scheduleIsTransitioning =
    Boolean(selectedRoomId) &&
    (isScheduleLoading || scheduleResultKey !== scheduleRequestKey);
  const periodLabel = formatPeriodLabel(activeDate, view);

  function navigatePeriod(direction: -1 | 1) {
    const nextDate = addCalendarDays(
      activeDate,
      direction * (view === "week" ? 7 : 1),
    );
    setSelectedDate(nextDate);
    setVisibleMiniCalendarMonth(startOfCalendarMonth(nextDate));
    closeBookingEditor();
  }

  function goToToday() {
    setSelectedDate(today);
    setVisibleMiniCalendarMonth(startOfCalendarMonth(today));
    closeBookingEditor();
  }

  function selectActiveDate(date: string) {
    setSelectedDate(date);
    setVisibleMiniCalendarMonth(startOfCalendarMonth(date));
    closeBookingEditor();
  }

  function selectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    closeBookingEditor();
  }

  function refreshBookingData() {
    setRoomsRefreshVersion((current) => current + 1);
    setScheduleRefreshVersion((current) => current + 1);
  }

  function handleBookingCreated({
    roomId,
    date,
  }: {
    booking: ScheduleBooking;
    roomId: string;
    date: string;
  }) {
    setSelectedRoomId(roomId);
    selectActiveDate(date);
    setIsBookingFormOpen(false);
    refreshBookingData();
  }

  function handleBookingCancelled() {
    refreshBookingData();
  }

  function handleBookingSaved({
    booking,
  }: {
    booking: ScheduleBooking;
    mode: BookingEditorTarget["mode"];
  }) {
    // Update the visible grid immediately, then refresh both sources of truth
    // so room availability and server conflict state cannot become stale.
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
    refreshBookingData();
  }

  return (
    <main className={CALENDAR_SHELL_CLASS}>
      {isSidebarOpen ? (
        <CalendarSidebar
          activeDate={activeDate}
          visibleMonth={
            visibleMiniCalendarMonth ?? startOfCalendarMonth(activeDate)
          }
          timeZone={timeZone}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          isLoading={isRoomsLoading}
          error={roomError}
          onClose={() => setIsSidebarOpen(false)}
          onSelectDate={selectActiveDate}
          onVisibleMonthChange={setVisibleMiniCalendarMonth}
          onSelectRoom={selectRoom}
          onRetry={() =>
            setRoomsRefreshVersion((current) => current + 1)
          }
        />
      ) : null}

      <section
        className={[
          "flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--surface)] max-[760px]:overflow-x-auto",
          isSidebarOpen ? "max-[760px]:min-w-[460px]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <CalendarHeader
          isSidebarOpen={isSidebarOpen}
          displayName={displayName}
          periodLabel={periodLabel}
          view={view}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onToday={goToToday}
          onNavigate={navigatePeriod}
          onChangeView={(mode) => {
            setView(mode);
            closeBookingEditor();
          }}
          onOpenMyBookings={() => {
            closeBookingEditor();
            setIsMyBookingsOpen(true);
          }}
        />
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
          view={view}
          timeZone={timeZone}
          displayName={displayName}
          selectedRoom={selectedRoom}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          bookings={visibleScheduleBookings}
          isRoomsLoading={isRoomsLoading}
          isScheduleLoading={scheduleIsTransitioning}
          scheduleError={scheduleError}
          showRoomSelector={!isSidebarOpen}
          selectedGridSelection={selectedGridSelection}
          onSelectRoom={selectRoom}
          onNavigatePeriod={navigatePeriod}
          onRetrySchedule={() =>
            setScheduleRefreshVersion((current) => current + 1)
          }
          onOpenBooking={() => {
            closeBookingEditor();
            setIsBookingFormOpen(true);
          }}
          onCreateSelection={({ gridSelection, ...selection }) => {
            setIsBookingFormOpen(false);
            setSelectedGridSelection(gridSelection);
            setBookingEditorTarget({
              mode: "create",
              ...selection,
            });
          }}
          onUpdateSelection={({ gridSelection, ...selection }) => {
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
              : `create:${bookingEditorTarget.startAt}:${bookingEditorTarget.endAt}`
          }
          target={bookingEditorTarget}
          timeZone={timeZone}
          onClose={closeBookingEditor}
          onSaved={handleBookingSaved}
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
            selectActiveDate(date);
            setIsMyBookingsOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
