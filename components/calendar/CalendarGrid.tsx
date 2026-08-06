"use client";

import { useMemo, type CSSProperties } from "react";
import { RoomSelector } from "@/components/calendar/RoomSelector";
import { OFFICE_CLOSE_HOUR, OFFICE_OPEN_HOUR, OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import type { RoomAvailability } from "@/lib/rooms";
import {
  CALENDAR_SLOT_MINUTES,
  canonicalizeTimeZone,
  formatCalendarDay,
  formatTimeInZone,
  getViewDates,
  getZonedDateIso,
  localDateTimeToUtc,
  type CalendarView,
} from "@/lib/time";

const SLOT_COUNT =
  ((OFFICE_CLOSE_HOUR - OFFICE_OPEN_HOUR) * 60) /
  CALENDAR_SLOT_MINUTES;

function getOfficeTime(rowIndex: number) {
  const totalMinutes =
    OFFICE_OPEN_HOUR * 60 + rowIndex * CALENDAR_SLOT_MINUTES;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function CalendarGrid({
  activeDate,
  view,
  timeZone,
  selectedRoom,
  rooms,
  selectedRoomId,
  isRoomsLoading,
  showRoomSelector,
  onSelectRoom,
}: {
  activeDate: string;
  view: CalendarView;
  timeZone: string;
  selectedRoom?: RoomAvailability;
  rooms: RoomAvailability[];
  selectedRoomId: string;
  isRoomsLoading: boolean;
  showRoomSelector: boolean;
  onSelectRoom: (roomId: string) => void;
}) {
  const dates = useMemo(
    () => getViewDates(activeDate, view),
    [activeDate, view],
  );
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
  const canonicalUserZone = canonicalizeTimeZone(timeZone);
  const canonicalOfficeZone = canonicalizeTimeZone(OFFICE_TIME_ZONE);
  const gridStyle = {
    "--calendar-columns": dates.length,
  } as CSSProperties;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-label={`${view === "week" ? "Week" : "Day"} calendar for ${
        selectedRoom?.name ?? "no selected room"
      }`}
    >
      <div className="flex min-h-[47px] flex-none items-center justify-between gap-[18px] border-b border-[var(--line)] py-1.5 pr-[15px] pl-3.5">
        <div className="grid gap-px">
          {showRoomSelector ? (
            <RoomSelector
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              timeZone={timeZone}
              isLoading={isRoomsLoading}
              onSelectRoom={onSelectRoom}
            />
          ) : (
            <strong className="text-[13px] font-bold text-[#29352e]">
              {selectedRoom?.name ?? "Select a room"}
            </strong>
          )}
          {selectedRoom && !showRoomSelector ? (
            <span className="text-[11px] text-[#778179]">
              Floor {selectedRoom.floor} · {selectedRoom.capacity} people
            </span>
          ) : null}
        </div>
        <p className="m-0 text-right text-xs text-[#778179]">
          {canonicalUserZone === canonicalOfficeZone
            ? `${canonicalOfficeZone} office time`
            : `Times shown in ${canonicalUserZone} · Office ${canonicalOfficeZone}`}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:size-[9px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#aab4ac] [&::-webkit-scrollbar-thumb]:bg-clip-padding">
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
              <span>
                {formatCalendarDay(date, { weekday: "short" })}
              </span>
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
              {dates.map((date) => (
                <div
                  className={[
                    "border-r border-[var(--grid-line)]",
                    rowIndex === 0
                      ? "border-t-0"
                      : rowIndex % 2 === 1
                        ? "border-t border-t-dashed border-t-[#eef1ee]"
                        : "border-t",
                    date === today
                      ? "bg-[#fbfdfb]"
                      : "bg-[var(--surface)]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={`${date}-${row.officeTime}`}
                  aria-hidden="true"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
