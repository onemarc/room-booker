"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { formatCalendarDay, formatTimeInZone, getViewDates, getZonedDateIso, getZonedDateTimeParts, localDateTimeToUtc } from "@/lib/time";
import { getBookingPosition, getOfficeTime, getSelectionBounds, OFFICE_WINDOW_MINUTES, SLOT_COUNT } from "./calendar-grid-utils";
import { BOOKING_COLOR_STYLES } from "@/components/calendar/booking-colors";
import { OFFICE_OPEN_HOUR, OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { CalendarGridToolbar } from "./CalendarGridToolbar";
import { useGridSelection } from "./useGridSelection";
import type { ScheduleBooking } from "@/lib/bookings";
import type { CalendarGridProps } from "./types";

const HORIZONTAL_GESTURE_THRESHOLD = 80;
const NAVIGATION_LOCK_MILLISECONDS = 450;

function DraftBookingPreview({
  top,
  height,
  time,
  displayName,
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
  const color = BOOKING_COLOR_STYLES.sage;
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
  view,
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
  onSelectRoom,
  onMinimumCapacityChange,
  onNavigatePeriod,
  onRetrySchedule,
    onOpenBooking,
    onCreateSelection,
    onUpdateSelection,
    onEditBooking,
  selectedGridSelection,
}: CalendarGridProps) {
  const wheelDeltaRef = useRef(0);
  const wheelResetTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const navigationUnlockTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const isNavigationLockedRef = useRef(false);
  const dates = useMemo(
    () => getViewDates(activeDate, view),
    [activeDate, view],
  );
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());
    updateCurrentTime();
    const intervalId = window.setInterval(updateCurrentTime, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);
  const today = getZonedDateIso(new Date(), timeZone);
  const rows = useMemo(
    () =>
      Array.from({ length: SLOT_COUNT }, (_, index) => {
        const officeTime = getOfficeTime(index);
        const instant = localDateTimeToUtc(
          dates[0],
          officeTime,
          OFFICE_TIME_ZONE,
        );

        return {
          officeTime,
          label: formatTimeInZone(instant, timeZone),
        };
      }),
    [dates, timeZone],
  );
  const pastSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    if (currentTime === null) {
      return keys;
    }

    for (const date of dates) {
      rows.forEach((row, rowIndex) => {
        if (
          localDateTimeToUtc(date, row.label, timeZone).getTime() <
          currentTime
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
  const displayedBookingCount = [...bookingsByDate.values()].reduce(
    (total, dateBookings) => total + dateBookings.length,
    0,
  );
  const gridStyle = {
    "--calendar-columns": dates.length,
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

  useEffect(
    () => () => {
      if (wheelResetTimerRef.current) {
        clearTimeout(wheelResetTimerRef.current);
      }
      if (navigationUnlockTimerRef.current) {
        clearTimeout(navigationUnlockTimerRef.current);
      }
    },
    [],
  );


  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const horizontalDelta = event.deltaX;
    const verticalDelta = event.deltaY;

    if (
      Math.abs(horizontalDelta) <
        Math.max(12, Math.abs(verticalDelta) * 1.2) ||
      isNavigationLockedRef.current
    ) {
      return;
    }

    // Accumulate a horizontal gesture and briefly lock navigation so a single
    // touchpad swipe cannot advance multiple periods.
    event.preventDefault();
    wheelDeltaRef.current += horizontalDelta;

    if (wheelResetTimerRef.current) {
      clearTimeout(wheelResetTimerRef.current);
    }
    wheelResetTimerRef.current = setTimeout(() => {
      wheelDeltaRef.current = 0;
    }, 180);

    if (
      Math.abs(wheelDeltaRef.current) < HORIZONTAL_GESTURE_THRESHOLD
    ) {
      return;
    }

    const direction = wheelDeltaRef.current > 0 ? 1 : -1;
    wheelDeltaRef.current = 0;
    isNavigationLockedRef.current = true;
    onNavigatePeriod(direction);
    navigationUnlockTimerRef.current = setTimeout(() => {
      isNavigationLockedRef.current = false;
    }, NAVIGATION_LOCK_MILLISECONDS);
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
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

      <div
        className="flex min-h-0 flex-1 touch-pan-x touch-pan-y flex-col overflow-auto overscroll-contain [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin]
                  [&::-webkit-scrollbar]:size-[9px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2
                  [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#aab4ac] [&::-webkit-scrollbar-thumb]:bg-clip-padding"
        onWheel={handleWheel}
      >
        <div
          className="sticky top-0 z-8 grid min-h-[52px] w-full min-w-full flex-none grid-cols-[62px_repeat(var(--calendar-columns),minmax(94px,1fr))] bg-transparent"
          style={gridStyle}
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
          style={gridStyle}
        >
          {rows.map((row, rowIndex) => (
            <div
              className="grid min-h-7 w-full min-w-full flex-[1_0_28px] grid-cols-[62px_repeat(var(--calendar-columns),minmax(94px,1fr))]"
              key={row.officeTime}
            >
              <div className="sticky left-0 z-5 border-r border-[var(--grid-line)] bg-[var(--surface)] text-[11px] leading-none text-[#758078]">
                {rowIndex % 2 === 0 ? (
                  <span className="absolute top-0 right-[9px] -translate-y-1/2">
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
                      "touch-pan-y select-none border-0 border-r border-[var(--grid-line)] p-0 outline-none focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]",
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
            style={gridStyle}
          >
            <div aria-hidden="true" />
            {dates.map((date) => (
              <div className="relative min-w-0" key={date}>
                {(bookingsByDate.get(date) ?? []).map(
                  ({ booking, top, height }) => {
                    const color = BOOKING_COLOR_STYLES[booking.color];
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
            <div
              className="pointer-events-none absolute inset-[12px_12px_12px_74px] z-6 grid content-start
                        gap-3 rounded-xl bg-[rgba(255,255,255,0.68)] p-3 backdrop-blur-[1px]"
              role="status"
            >
              <span className="sr-only">Loading schedule</span>
              <div className="h-12 w-[28%] animate-pulse rounded-lg bg-[#e5ebe6]" />
              <div className="ml-[44%] h-16 w-[24%] animate-pulse rounded-lg bg-[#e9eeea]" />
              <div className="ml-[15%] h-10 w-[21%] animate-pulse rounded-lg bg-[#e5ebe6]" />
            </div>
          ) : null}

          {!isScheduleLoading && scheduleError ? (
            <div className="absolute inset-[18px_18px_18px_80px] z-6 grid place-items-center rounded-xl border
                            border-dashed border-[#dbd2d2] bg-[rgba(255,250,250,0.94)] p-6 text-center">
              <div role="alert">
                <p className="m-0 text-[13px] font-[650] text-[#854242]">
                  {scheduleError}
                </p>
                <button
                  className="mt-3 h-9 cursor-pointer rounded-lg border border-[#d7c9c9] bg-white px-3 text-xs font-bold text-[#8b3e3e] hover:bg-[#fff6f6]"
                  type="button"
                  onClick={onRetrySchedule}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          {!isScheduleLoading &&
          !scheduleError &&
          selectedRoom &&
          displayedBookingCount === 0 ? (
            <div className="pointer-events-none absolute inset-[18px_18px_18px_80px] z-3 grid place-items-center">
              <p className="m-0 rounded-xl border border-dashed border-[#d5ddd7] bg-[rgba(250,252,250,0.94)] px-5 py-3 text-center text-xs font-[620] text-[#718078]">
                No bookings for {selectedRoom.name} in this{" "}
                {view === "week" ? "week" : "day"}.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
