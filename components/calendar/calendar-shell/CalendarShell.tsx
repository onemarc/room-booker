"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BookingFormModal } from "@/components/calendar/booking-form-modal/BookingFormModal";
import { BookingPopover } from "@/components/calendar/booking-popover/BookingPopover";
import type { ScheduleBooking } from "@/lib/bookings";
import { getCalendarViewTransitionTarget, type VisibleCalendarRange } from "@/components/calendar/calendar-grid/calendar-window";
import { CalendarGrid, type CalendarGridHandle } from "@/components/calendar/calendar-grid/CalendarGrid";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import {
  addCalendarDays,
  detectBrowserTimeZone,
  formatPeriodLabel,
  getMondayStart,
  getZonedDateIso,
  startOfCalendarMonth,
  type CalendarView,
} from "@/lib/time";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarSidebar } from "./CalendarSidebar";
import { useBookingEditor } from "./useBookingEditor";
import { useCalendarData } from "./useCalendarData";
import type { RoomAvailability } from "@/lib/rooms";

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
  const [minimumCapacity, setMinimumCapacity] = useState(1);
  const activeDate =
    selectedDate ?? getZonedDateIso(initialNow, timeZone);
  const {
    rooms,
    selectedRoomId,
    selectedRoom,
    setSelectedRoomId,
    isRoomsLoading,
    roomError,
    requestRoomsRefresh,
    visibleScheduleBookings,
    isScheduleLoading,
    scheduleError,
    markScheduleBlocking,
    markScheduleBackground,
    requestScheduleRefresh,
    replaceScheduleBooking,
    removeScheduleBooking,
  } = useCalendarData({
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
  });
  const [isResendingConfirmation, setIsResendingConfirmation] =
    useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  function selectGridDate(date: string) {
    // Scrolling changes only the pale visible-range highlight. The selected
    // day changes when an interaction is anchored to a concrete grid date.
    setSelectedDate(date);
    setVisibleMiniCalendarMonth(startOfCalendarMonth(date));
  }

  const bookingEditor = useBookingEditor({
    timeZone,
    emailConfirmed,
    selectGridDate,
    setSelectedRoomId,
    replaceScheduleBooking,
    removeScheduleBooking,
    requestScheduleRefresh,
    requestRoomsRefresh,
    getZonedDateIso,
    startOfCalendarMonth,
    setSelectedDate,
    setVisibleMiniCalendarMonth,
  });

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
    markScheduleBlocking();
    setPositionRequestId((current) => current + 1);
    setSelectedDate(browserDate);
    setGridTargetDate(targetDate);
    setVisibleGridRange({
      startDate: targetDate,
      endDate: addCalendarDays(targetDate, view === "week" ? 6 : 0),
    });
    setVisibleMiniCalendarMonth(startOfCalendarMonth(browserDate));
  }, [
    initialActiveDate,
    initialNow,
    markScheduleBlocking,
    timeZone,
    view,
  ]);
  const today = getZonedDateIso(new Date(), timeZone);

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
    markScheduleBlocking();
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
    bookingEditor.close();
  }

  function goToToday() {
    // Today is the only command that cancels active trackpad momentum. Other
    // navigation and sidebar resizing must leave normal scrolling untouched.
    setStopScrollRequestId((current) => current + 1);
    selectActiveDate(today);
  }

  const selectActiveDate = useCallback(
    (date: string, targetView: CalendarView = view) => {
      markScheduleBlocking();
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
      bookingEditor.close();
    },
    [bookingEditor, markScheduleBlocking, view],
  );
  const registerSelectActiveDate = bookingEditor.registerSelectActiveDate;
  useEffect(() => {
    registerSelectActiveDate(selectActiveDate);
  }, [registerSelectActiveDate, selectActiveDate]);

  const changeCalendarView = useCallback((nextView: CalendarView) => {
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
    markScheduleBlocking();
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
    bookingEditor.close();
  }, [activeDate, bookingEditor, markScheduleBlocking, view, visibleGridRange.startDate]);

  const hasCheckedMobileView = useRef(false);
  useEffect(() => {
    if (hasCheckedMobileView.current || typeof window === "undefined") return;
    hasCheckedMobileView.current = true;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("view") && window.innerWidth < 640 && view === "week") {
      const frame = window.requestAnimationFrame(() => {
        changeCalendarView("day");
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [changeCalendarView, view]);

  const finishGridViewPositioning = useCallback(() => {
    setIsGridViewPositioning(false);
  }, []);

  const syncVisibleRange = useCallback((range: VisibleCalendarRange) => {
    // Horizontal scrolling prefetches the newly exposed schedule range. Keep
    // the current grid visible while that background request completes instead
    // of replacing it with a loading skeleton on every range boundary.
    markScheduleBackground();
    setGridTargetDate(range.startDate);
    setVisibleGridRange(range);
    setVisibleMiniCalendarMonth(
      startOfCalendarMonth(
        addCalendarDays(range.startDate, view === "week" ? 3 : 0),
      ),
    );
  }, [
    setGridTargetDate,
    markScheduleBackground,
    setVisibleGridRange,
    setVisibleMiniCalendarMonth,
    view,
  ]);

  function selectRoom(roomId: string) {
    markScheduleBlocking();
    setSelectedRoomId(roomId);
    bookingEditor.close();
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
          onRetry={requestRoomsRefresh}
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
          onOpenBooking={bookingEditor.openBookingForm}
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
                requestRoomsRefresh()
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
          draftColor={bookingEditor.draftColor}
          previewBookingColor={bookingEditor.previewBookingColor}
          canBook={emailConfirmed}
          isScheduleLoading={isScheduleLoading}
          scheduleError={scheduleError}
          selectedGridSelection={bookingEditor.selectedGridSelection}
          onVisibleRangeChange={syncVisibleRange}
          onViewPositioned={finishGridViewPositioning}
          onRetrySchedule={() => {
            requestScheduleRefresh("blocking");
          }}
          onCreateSelection={bookingEditor.handleCreateSelection}
          onUpdateSelection={bookingEditor.handleUpdateSelection}
          onEditBooking={bookingEditor.handleEditBooking}
        />
      </section>

      {bookingEditor.bookingEditorTarget ? (
        <BookingPopover
          key={
            bookingEditor.bookingEditorTarget.mode === "edit"
              ? `edit:${bookingEditor.bookingEditorTarget.booking.id}`
              : "create"
          }
          target={bookingEditor.bookingEditorTarget}
          timeZone={timeZone}
          onClose={bookingEditor.cancelDraft}
          onSaved={bookingEditor.handleSaved}
          onDeleted={bookingEditor.handleDeleted}
          onColorChange={bookingEditor.handleColorChange}
        />
      ) : null}

      {bookingEditor.isBookingFormOpen ? (
        <BookingFormModal
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          activeDate={
            selectedDate &&
            selectedDate >= visibleGridRange.startDate &&
            selectedDate <= visibleGridRange.endDate
              ? selectedDate
              : (view === "week"
                  ? visibleGridRange.startDate
                  : gridTargetDate)
          }
          timeZone={timeZone}
          onClose={() => bookingEditor.setIsBookingFormOpen(false)}
          onCreated={bookingEditor.handleCreated}
        />
      ) : null}

    </main>
  );
}
