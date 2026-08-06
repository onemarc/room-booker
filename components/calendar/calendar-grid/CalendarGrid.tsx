"use client";

import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  CALENDAR_SLOT_MINUTES,
  calendarDateToIso,
  formatCalendarDay,
  formatTimeInZone,
  getZonedDateIso,
  getZonedDateTimeParts,
  localDateTimeToUtc,
} from "@/lib/time";
import { getBookingPosition, getOfficeTime, getSelectionBounds, OFFICE_WINDOW_MINUTES, SLOT_COUNT } from "./calendar-grid-utils";
import { BOOKING_COLOR_STYLES } from "@/components/calendar/booking-colors";
import { OFFICE_OPEN_HOUR, OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { CalendarGridToolbar } from "./CalendarGridToolbar";
import { CalendarLoadingOverlay } from "./CalendarLoadingOverlay";
import { CALENDAR_TIME_COLUMN_WIDTH, getCalendarCanvasWidthStyle } from "./calendar-window";
import { useInfiniteWeekScroll } from "./useInfiniteWeekScroll";
import { useGridSelection } from "./useGridSelection";
import type { BookingColor, ScheduleBooking } from "@/lib/bookings";
import type { CalendarGridProps } from "./types";

function DraftBookingPreview({
  top,
  height,
  time,
  displayName,
  color: draftColor,
  selection,
  isInteractive,
  opacity = 1,
  onMove,
  onResize,
}: {
  top: number;
  height: number;
  time: string;
  displayName: string;
  color: BookingColor;
  selection: { date: string; startIndex: number; endIndex: number };
  isInteractive: boolean;
  opacity?: number;
  onMove: (
    event: ReactPointerEvent<HTMLDivElement>,
    selection: { date: string; startIndex: number; endIndex: number },
  ) => void;
  onResize: (
    event: ReactPointerEvent<HTMLButtonElement>,
    selection: { date: string; startIndex: number; endIndex: number },
    edge: "start" | "end",
  ) => void;
}) {
  const color = BOOKING_COLOR_STYLES[draftColor];
  const showTime = height >= 6;
  const showAuthor = height >= 9;

  return (
    <div
      className={[
        "absolute right-1 left-1 z-2 select-none overflow-hidden rounded-[7px] border px-2 py-1 text-left shadow-[0_2px_8px_rgba(34,53,42,0.08)]",
        isInteractive
          ? "pointer-events-auto cursor-grab active:cursor-grabbing"
          : "pointer-events-none",
      ].join(" ")}
      style={{
        top: `calc(${top}% + 1px)`,
        height: `calc(${height}% - 2px)`,
        minHeight: "26px",
        backgroundColor: color.surface,
        borderColor: color.border,
        color: color.text,
        opacity,
      }}
      aria-hidden={!isInteractive}
      data-booking-draft
      onPointerDown={
        isInteractive ? (event) => onMove(event, selection) : undefined
      }
    >
      <strong className="block overflow-hidden text-xs leading-4 font-[700] text-ellipsis whitespace-nowrap">
        (No title)
      </strong>
      {showTime ? (
        <span className="block overflow-hidden text-[10px] leading-4 text-ellipsis whitespace-nowrap opacity-80">
          {time}
        </span>
      ) : null}
      {showAuthor ? (
        <span className="block overflow-hidden text-[10px] leading-4 text-ellipsis whitespace-nowrap opacity-80">
          {displayName}
        </span>
      ) : null}
      {isInteractive ? (
        <>
          <button
            className="absolute -top-1 left-0 h-2 w-full cursor-ns-resize border-0 bg-transparent p-0"
            type="button"
            aria-label="Adjust draft booking start time"
            onPointerDown={(event) => onResize(event, selection, "start")}
          />
          <button
            className="absolute -bottom-1 left-0 h-2 w-full cursor-ns-resize border-0 bg-transparent p-0"
            type="button"
            aria-label="Adjust draft booking end time"
            onPointerDown={(event) => onResize(event, selection, "end")}
          />
        </>
      ) : null}
    </div>
  );
}

export type { CalendarGridSelection } from "./types";

export function CalendarGrid({
  activeDate,
  targetDate,
  view,
  isSidebarOpen,
  positionRequestId,
  isViewPositioning,
  timeZone,
  displayName,
  selectedRoom,
  rooms,
  selectedRoomId,
  bookings,
  isRoomsLoading,
  isScheduleLoading,
  scheduleError,
  canBook,
  showRoomSelector,
  minimumCapacity,
  draftColor,
  previewBookingColor,
  onSelectRoom,
  onMinimumCapacityChange,
  onRetrySchedule,
    onOpenBooking,
    onCreateSelection,
    onUpdateSelection,
  onEditBooking,
  selectedGridSelection,
  onVisibleRangeChange,
  onViewPositioned,
}: CalendarGridProps) {
  const { dates, handleScroll, scrollViewportRef, setDateColumnRef } =
    useInfiniteWeekScroll({
      targetDate,
      isSidebarOpen,
      positionRequestId,
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
  const rows = useMemo(
    () => {
      const officeStart = localDateTimeToUtc(
        dates[0],
        getOfficeTime(0),
        OFFICE_TIME_ZONE,
      );

      return Array.from({ length: SLOT_COUNT }, (_, index) => {
        const officeTime = getOfficeTime(index);
        const instant = new Date(
          officeStart.getTime() +
            index * CALENDAR_SLOT_MINUTES * 60_000,
        );

        return {
          officeTime,
          label: formatTimeInZone(instant, timeZone),
        };
      });
    },
    [dates, timeZone],
  );
  const pastSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    if (currentTime === null) {
      return keys;
    }

    const currentInstant = new Date(currentTime);
    const currentParts = getZonedDateTimeParts(
      currentInstant,
      timeZone,
    );
    const currentDate = calendarDateToIso(currentParts);
    const currentClock = `${String(currentParts.hour).padStart(
      2,
      "0",
    )}:${String(currentParts.minute).padStart(2, "0")}`;
    const currentMinuteHasElapsed =
      currentParts.second !== 0 ||
      currentInstant.getUTCMilliseconds() !== 0;

    // ISO dates and 24-hour labels sort chronologically. Comparing them to a
    // single zoned snapshot avoids converting every rendered calendar cell
    // through the timezone/DST resolver during each navigation render.
    for (const date of dates) {
      rows.forEach((row, rowIndex) => {
        if (
          date < currentDate ||
          (date === currentDate &&
            (row.label < currentClock ||
              (row.label === currentClock &&
                currentMinuteHasElapsed)))
        ) {
          keys.add(`${date}:${rowIndex}`);
        }
      });
    }

    return keys;
  }, [currentTime, dates, rows, timeZone]);
  const bookingsByDate = useMemo(() => {
    const grouped = new Map<
      string,
      Array<{
        booking: ScheduleBooking;
        top: number;
        height: number;
      }>
    >();

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
  const gridCanvasStyle = {
    ...gridStyle,
    width:
      view === "week"
        ? getCalendarCanvasWidthStyle(dates.length)
        : "100%",
    minWidth: `${CALENDAR_TIME_COLUMN_WIDTH + 94}px`,
  } as CSSProperties;
  const officeNow = getZonedDateTimeParts(
    new Date(),
    OFFICE_TIME_ZONE,
  );
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
  const draftSelections = useMemo(() => {
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

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-label={`${view === "week" ? "Week" : "Day"} calendar for ${
        selectedRoom?.name ?? "no selected room"
      }`}
    >
      <CalendarGridToolbar
        selectedRoom={selectedRoom}
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        timeZone={timeZone}
        showRoomSelector={showRoomSelector}
        isRoomsLoading={isRoomsLoading}
        minimumCapacity={minimumCapacity}
        canBook={canBook}
        onSelectRoom={onSelectRoom}
        onMinimumCapacityChange={onMinimumCapacityChange}
        onOpenBooking={onOpenBooking}
      />

      {isViewPositioning ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-[61px] bottom-0 z-20 bg-[var(--surface)]"
          aria-hidden="true"
        />
      ) : null}

      <div
        className={[
          "flex min-h-0 flex-1 touch-pan-x touch-pan-y flex-col overflow-auto overscroll-contain [container-type:inline-size] [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin]",
          "[&::-webkit-scrollbar]:size-[9px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2",
          "[&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#aab4ac] [&::-webkit-scrollbar-thumb]:bg-clip-padding",
          isViewPositioning ? "invisible" : "visible",
        ].join(" ")}
        ref={scrollViewportRef}
        onScroll={handleScroll}
        aria-busy={isViewPositioning || isScheduleLoading}
        data-calendar-scroll-viewport
      >
        <div
          className="sticky top-0 z-8 grid min-h-[52px] w-full min-w-full flex-none grid-cols-[62px_repeat(var(--calendar-columns),minmax(94px,1fr))] bg-transparent"
          style={gridCanvasStyle}
        >
          <div
            className="sticky left-0 z-9 border-r border-[var(--grid-line)] bg-[linear-gradient(to_bottom,var(--surface)_0_calc(100%_-_6px),transparent_calc(100%_-_6px)_100%)]"
            aria-hidden="true"
          />
          {dates.map((date) => (
            <div
              className={[
                "flex min-w-0 items-center justify-center gap-[5px] border-r border-b border-[var(--grid-line)] text-[13px] text-[#69746c] [&>strong]:text-[15px] [&>strong]:font-[680] [&>strong]:text-[#354138]",
                date === today
                  ? "bg-[var(--surface)] [&>strong]:grid [&>strong]:h-[25px] [&>strong]:min-w-[25px] [&>strong]:place-items-center [&>strong]:rounded-[7px] [&>strong]:bg-[var(--accent)] [&>strong]:text-white"
                  : date === activeDate
                    ? "bg-[#f5f8f5]"
                    : "bg-[var(--surface)]",
              ]
                .filter(Boolean)
                .join(" ")}
              key={date}
              data-calendar-date={date}
              ref={(element) => setDateColumnRef(date, element)}
            >
              <span>{formatCalendarDay(date, { weekday: "short" })}</span>
              <strong>
                {formatCalendarDay(date, {
                  day: "numeric",
                })}
              </strong>
            </div>
          ))}
        </div>

        <div
          className="relative flex min-h-[560px] min-w-max flex-[1_0_auto] flex-col pb-px"
          style={gridCanvasStyle}
        >
          {rows.map((row, rowIndex) => (
            <div
              className="grid min-h-7 w-full min-w-full flex-[1_0_28px] grid-cols-[62px_repeat(var(--calendar-columns),minmax(94px,1fr))]"
              key={row.officeTime}
            >
              <div className="sticky left-0 z-5 border-r border-[var(--grid-line)] bg-[var(--surface)] text-[11px] leading-none text-[#758078]">
                {rowIndex % 2 === 0 ? (
                  <span
                    className={
                      rowIndex === 0
                        ? "absolute top-[7px] right-[9px]"
                        : "absolute top-0 right-[9px] -translate-y-1/2"
                    }
                  >
                    {row.label}
                  </span>
                ) : null}
              </div>
              {dates.map((date) => {
                const isPastSlot = pastSlotKeys.has(`${date}:${rowIndex}`);

                return (
                  <button
                    className={[
                      isPastSlot
                        ? "cursor-not-allowed"
                        : dragSelection || movingDraft
                          ? "cursor-grabbing"
                          : "cursor-crosshair",
                      "touch-pan-x touch-pan-y select-none border-0 border-r border-[var(--grid-line)] p-0 outline-none focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]",
                      rowIndex === 0
                        ? "border-t-0"
                        : rowIndex % 2 === 0
                          ? "border-t"
                          : "border-t-0",
                      date === today
                          ? "bg-[#fbfdfb]"
                          : "bg-[var(--surface)]",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={`${date}-${row.officeTime}`}
                    type="button"
                    disabled={isPastSlot || !canBook}
                    aria-label={`Select ${formatCalendarDay(date, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })} at ${row.label}`}
                    ref={(element) => {
                      const key = `${date}:${rowIndex}`;
                      if (element) {
                        slotRefs.current.set(key, element);
                      } else {
                        slotRefs.current.delete(key);
                      }
                    }}
                    onPointerDown={(event) =>
                      startSelection(event, date, rowIndex)
                    }
                    onPointerEnter={() =>
                      extendSelection(date, rowIndex)
                    }
                    onClick={(event) =>
                      selectSlotWithKeyboard(event, date, rowIndex)
                    }
                  />
                );
              })}
            </div>
          ))}

          <div
            className="pointer-events-none absolute inset-0 z-4 grid grid-cols-[62px_repeat(var(--calendar-columns),minmax(94px,1fr))]"
            style={gridCanvasStyle}
          >
            <div aria-hidden="true" />
            {dates.map((date) => (
              <div className="relative min-w-0" key={date}>
                {(bookingsByDate.get(date) ?? []).map(
                  ({ booking, top, height }) => {
                    const renderedColor =
                      previewBookingColor?.bookingId === booking.id
                        ? previewBookingColor.color
                        : booking.color;
                    const color = BOOKING_COLOR_STYLES[renderedColor];
                    const canEdit =
                      booking.isOwner &&
                      new Date(booking.startAt).getTime() > Date.now();

                    return (
                      <button
                        className={[
                          "pointer-events-auto absolute right-1 left-1 z-2 overflow-hidden rounded-[7px] border px-2 py-1 text-left shadow-[0_2px_8px_rgba(34,53,42,0.08)]",
                          canEdit
                            ? "cursor-pointer hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
                            : "cursor-default",
                        ].join(" ")}
                        style={{
                          top: `calc(${top}% + 1px)`,
                          height: `calc(${height}% - 2px)`,
                          minHeight: "26px",
                          backgroundColor: color.surface,
                          borderColor: color.border,
                          color: color.text,
                          opacity: booking.isOwner ? 1 : 0.82,
                        }}
                        type="button"
                        disabled={!canEdit}
                        key={booking.id}
                        aria-label={
                          canEdit
                            ? `Edit ${booking.title}`
                            : `${booking.title} by ${booking.authorDisplayName}`
                        }
                        title={`${booking.title} · ${booking.authorDisplayName} · ${formatTimeInZone(
                          booking.startAt,
                          timeZone,
                        )}–${formatTimeInZone(booking.endAt, timeZone)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!canEdit || !selectedRoom) {
                            return;
                          }

                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          onEditBooking({
                            roomId: selectedRoom.id,
                            roomName: selectedRoom.name,
                            booking,
                            anchor: {
                              top: rect.top,
                              right: rect.right,
                              bottom: rect.bottom,
                              left: rect.left,
                            },
                          });
                        }}
                      >
                        <strong className="block overflow-hidden text-xs leading-4 font-[700] text-ellipsis whitespace-nowrap">
                          {booking.title}
                        </strong>
                        {height >= 9 ? (
                          <span className="block overflow-hidden text-[10px] leading-4 text-ellipsis whitespace-nowrap opacity-80">
                            {booking.authorDisplayName}
                          </span>
                        ) : null}
                      </button>
                    );
                  },
                )}

                {draftSelections
                  .filter((draftSelection) => draftSelection.date === date)
                  .map((draftSelection) => (
                    <DraftBookingPreview
                      top={draftSelection.top}
                      height={draftSelection.height}
                      time={draftSelection.time}
                      displayName={displayName}
                      color={draftColor}
                      selection={draftSelection.selection}
                      isInteractive={
                        !dragSelection && !movingDraft && !draftSelection.isOrigin
                      }
                      opacity={draftSelection.opacity}
                      onMove={moveSelection}
                      onResize={resizeSelection}
                      key={`${draftSelection.date}:${draftSelection.selection.startIndex}:${draftSelection.selection.endIndex}:${draftSelection.opacity}`}
                    />
                  ))}

                {date === currentUserDate && currentTimeTop !== null ? (
                  <div
                    className="absolute right-0 left-0 z-3 h-[2px] -translate-y-1/2 bg-[#c84949]"
                    style={{ top: `${currentTimeTop}%` }}
                    aria-label="Current time"
                  >
                    <span className="absolute top-1/2 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c84949]" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {isScheduleLoading ? (
            // Keep the transition layer on the same seven-day canvas as the
            // active view so the loading state cannot stretch across days.
            <CalendarLoadingOverlay dates={dates} />
          ) : null}
        </div>
      </div>

      {/* Keep this layer outside the recycled day canvas so the error card is
          centered in the visible viewport instead of in the full 49-day grid. */}
      {!isScheduleLoading && scheduleError ? (
        <div
          className="absolute inset-x-0 top-[61px] bottom-0 z-30 grid place-items-center bg-[rgba(255,236,236,0.58)] p-4 backdrop-blur-[3px]"
          role="presentation"
        >
          <div
            className="w-full max-w-[390px] rounded-2xl border border-[#e3a1a1] bg-white p-5 text-center shadow-[0_22px_70px_rgba(70,35,35,0.2)]"
            role="alert"
          >
            <p className="m-0 break-words text-[13px] leading-5 font-[650] text-[#b43737]">
              {scheduleError}
            </p>
            <button
              className="mt-4 h-9 cursor-pointer rounded-lg border border-[#d78a8a] bg-white px-3.5 text-xs font-bold text-[#b43737] hover:bg-[#fff0f0]"
              type="button"
              onClick={onRetrySchedule}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
