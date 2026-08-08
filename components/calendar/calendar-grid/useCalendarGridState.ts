"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  addCalendarDays,
  CALENDAR_SLOT_MINUTES,
  calendarDateToIso,
  formatCalendarTimeZoneNotice,
  formatGmtOffset,
  formatTimeInZone,
  getZonedDateIso,
  getZonedDateTimeParts,
  localDateTimeToUtc,
} from "@/lib/time";
import type { ScheduleBooking } from "@/lib/bookings";
import { OFFICE_OPEN_HOUR, OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import {
  getBookingPosition,
  getOfficeTime,
  getSelectionBounds,
  OFFICE_WINDOW_MINUTES,
  SLOT_COUNT,
} from "./calendar-grid-utils";
import {
  CALENDAR_TIME_COLUMN_WIDTH,
  getResponsiveCalendarCanvasWidth,
} from "./calendar-window";
import { useGridSelection } from "./useGridSelection";
import { useInfiniteWeekScroll } from "./useInfiniteWeekScroll";
import type { CalendarGridProps } from "./types";

export type CalendarGridRow = {
  officeTime: string;
  label: string;
};

export type PositionedCalendarBooking = {
  booking: ScheduleBooking;
  top: number;
  height: number;
};

export type DraftCalendarSelection = {
  date: string;
  top: number;
  height: number;
  selection: { date: string; startIndex: number; endIndex: number };
  time: string;
  opacity: number;
  isOrigin: boolean;
};

export function useCalendarGridState({
  activeDate,
  targetDate,
  view,
  isSidebarOpen,
  positionRequestId,
  stopScrollRequestId,
  isViewPositioning,
  timeZone,
  selectedRoom,
  bookings,
  onCreateSelection,
  onUpdateSelection,
  selectedGridSelection,
  onVisibleRangeChange,
  onViewPositioned,
}: Pick<
  CalendarGridProps,
  | "activeDate"
  | "targetDate"
  | "view"
  | "isSidebarOpen"
  | "positionRequestId"
  | "stopScrollRequestId"
  | "isViewPositioning"
  | "timeZone"
  | "selectedRoom"
  | "bookings"
  | "onCreateSelection"
  | "onUpdateSelection"
  | "selectedGridSelection"
  | "onVisibleRangeChange"
  | "onViewPositioned"
>) {
  const {
    captureSidebarLayoutAnchor,
    dates,
    handleScroll,
    scrollViewportRef,
    setDateColumnRef,
  } = useInfiniteWeekScroll({
    activeDate,
    targetDate,
    isSidebarOpen,
    positionRequestId,
    stopScrollRequestId,
    view,
    isViewPositioning,
    onVisibleRangeChange,
    onViewPositioned,
  });
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());
    updateCurrentTime();
    const intervalId = window.setInterval(updateCurrentTime, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const today = getZonedDateIso(new Date(), timeZone);
  const timeZoneNotice = formatCalendarTimeZoneNotice(timeZone);
  const officeGmtOffset = formatGmtOffset(OFFICE_TIME_ZONE);
  const rows = useMemo<CalendarGridRow[]>(() => {
    const officeStart = localDateTimeToUtc(
      dates[0],
      getOfficeTime(0),
      OFFICE_TIME_ZONE,
    );

    return Array.from({ length: SLOT_COUNT }, (_, index) => {
      const officeTime = getOfficeTime(index);
      const instant = new Date(
        officeStart.getTime() + index * CALENDAR_SLOT_MINUTES * 60_000,
      );

      return {
        officeTime,
        label: formatTimeInZone(instant, timeZone),
      };
    });
  }, [dates, timeZone]);
  const pastSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    if (currentTime === null) {
      return keys;
    }

    const currentInstant = new Date(currentTime);
    const currentParts = getZonedDateTimeParts(currentInstant, timeZone);
    const currentDate = calendarDateToIso(currentParts);
    const currentClock = `${String(currentParts.hour).padStart(
      2,
      "0",
    )}:${String(currentParts.minute).padStart(2, "0")}`;
    const currentMinuteHasElapsed =
      currentParts.second !== 0 || currentInstant.getUTCMilliseconds() !== 0;

    // Compare one zoned snapshot against ISO dates and 24-hour labels instead
    // of resolving every rendered cell through the timezone/DST resolver.
    for (const date of dates) {
      rows.forEach((row, rowIndex) => {
        if (
          date < currentDate ||
          (date === currentDate &&
            (row.label < currentClock ||
              (row.label === currentClock && currentMinuteHasElapsed)))
        ) {
          keys.add(`${date}:${rowIndex}`);
        }
      });
    }

    return keys;
  }, [currentTime, dates, rows, timeZone]);
  const bookingsByDate = useMemo(() => {
    const grouped = new Map<string, PositionedCalendarBooking[]>();

    for (const booking of bookings) {
      const position = getBookingPosition(booking, timeZone);
      if (position.height <= 0 || !dates.includes(position.date)) {
        continue;
      }

      const dateBookings = grouped.get(position.date) ?? [];
      dateBookings.push({
        booking,
        top: position.top,
        height: position.height,
      });
      grouped.set(position.date, dateBookings);
    }

    return grouped;
  }, [bookings, dates, timeZone]);
  const gridStyle = {
    "--calendar-columns": dates.length,
  } as CSSProperties;
  const transitionDates = useMemo(
    () =>
      view === "week"
        ? Array.from({ length: 7 }, (_, index) =>
            addCalendarDays(targetDate, index),
          )
        : [targetDate],
    [targetDate, view],
  );
  const gridCanvasStyle = {
    ...gridStyle,
    width:
      view === "week"
        ? getResponsiveCalendarCanvasWidth(dates.length)
        : "100%",
    minWidth: `${CALENDAR_TIME_COLUMN_WIDTH + 94}px`,
  } as CSSProperties;
  const officeNow = getZonedDateTimeParts(new Date(), OFFICE_TIME_ZONE);
  const currentUserDate = getZonedDateIso(new Date(), timeZone);
  const currentMinutes =
    officeNow.hour * 60 + officeNow.minute - OFFICE_OPEN_HOUR * 60;
  const currentTimeTop =
    currentMinutes >= 0 && currentMinutes <= OFFICE_WINDOW_MINUTES
      ? (currentMinutes / OFFICE_WINDOW_MINUTES) * 100
      : null;

  const {
    dragSelection,
    movingDraft,
    slotRefs,
    startSelection,
    extendSelection,
    selectSlotWithKeyboard,
    moveSelection,
    resizeSelection,
  } = useGridSelection({
    rows,
    timeZone,
    selectedRoom,
    onCreateSelection,
    onUpdateSelection,
  });
  const draftSelections = useMemo<DraftCalendarSelection[]>(() => {
    const activeSelections = movingDraft
      ? [
          { selection: movingDraft.origin, opacity: 0.6, isOrigin: true },
          { selection: movingDraft.current, opacity: 1, isOrigin: false },
        ]
      : (dragSelection ?? selectedGridSelection)
        ? [
            {
              selection: dragSelection ?? selectedGridSelection!,
              opacity: 1,
              isOrigin: false,
            },
          ]
        : [];

    return activeSelections.map(({ selection, opacity, isOrigin }) => {
      const { startIndex, endIndex } = getSelectionBounds(selection);
      const start = localDateTimeToUtc(
        selection.date,
        rows[startIndex].label,
        timeZone,
      );
      const end = new Date(
        start.getTime() + (endIndex - startIndex) * 30 * 60 * 1000,
      );

      return {
        date: selection.date,
        top: (startIndex / SLOT_COUNT) * 100,
        height: ((endIndex - startIndex) / SLOT_COUNT) * 100,
        selection: { date: selection.date, startIndex, endIndex },
        time: `${formatTimeInZone(start, timeZone)}–${formatTimeInZone(
          end,
          timeZone,
        )}`,
        opacity,
        isOrigin,
      };
    });
  }, [dragSelection, movingDraft, rows, selectedGridSelection, timeZone]);

  return {
    captureSidebarLayoutAnchor,
    dates,
    handleScroll,
    scrollViewportRef,
    setDateColumnRef,
    currentUserDate,
    currentTimeTop,
    today,
    timeZone,
    timeZoneNotice,
    officeGmtOffset,
    rows,
    pastSlotKeys,
    bookingsByDate,
    gridStyle,
    transitionDates,
    gridCanvasStyle,
    dragSelection,
    movingDraft,
    slotRefs,
    startSelection,
    extendSelection,
    selectSlotWithKeyboard,
    moveSelection,
    resizeSelection,
    draftSelections,
    selectedGridSelection,
  };
}

export type CalendarGridState = ReturnType<typeof useCalendarGridState>;
