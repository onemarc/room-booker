"use client";

import { memo, useCallback, useMemo, useState, useTransition } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { RiArrowGoBackLine } from "react-icons/ri";
import {
  addCalendarDays,
  addCalendarMonths,
  formatCalendarMonth,
  getMondayStart,
  getMonthCalendarDates,
  getZonedDateIso,
  parseCalendarDate,
  startOfCalendarMonth,
} from "@/lib/time";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type MiniCalendarProps = {
  activeDate: string;
  visibleRangeStart?: string;
  visibleRangeEnd?: string;
  visibleMonth: string;
  timeZone: string;
  onSelectDate: (date: string) => void;
  onVisibleMonthChange: (month: string) => void;
};

type MiniCalendarCell = {
  date: string;
  day: number;
  isOutsideMonth: boolean;
};

const DATE_BUTTON_CLASS =
  "relative z-[1] grid aspect-square max-h-[31px] w-full cursor-pointer place-items-center rounded-[7px] border-0 text-[11px]";
const TODAY_MARKER_CLASS =
  "after:absolute after:right-1/2 after:bottom-[3px] after:size-[3px] after:translate-x-1/2 after:rounded-full after:content-['']";

const MiniCalendarDay = memo(function MiniCalendarDay({
  cell,
  isActive,
  isToday,
  isVisible,
  onSelectDate,
}: {
  cell: MiniCalendarCell;
  isActive: boolean;
  isToday: boolean;
  isVisible: boolean;
  onSelectDate: (date: string) => void;
}) {
  const { date, day, isOutsideMonth } = cell;

  return (
    <button
      className={[
        DATE_BUTTON_CLASS,
        isToday
          ? `${TODAY_MARKER_CLASS} ${
              isActive
                ? "after:bg-white"
                : "after:bg-[var(--accent)]"
            }`
          : "",
        isActive
          ? "bg-[var(--accent)] font-bold text-white hover:bg-[var(--accent)]"
          : isToday
            ? "bg-[#e2ece6] font-bold text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(37,91,67,0.34)] hover:bg-[#e2ece6]"
            : isVisible
              ? `bg-transparent ${isOutsideMonth ? "text-[#939d95]" : "text-[#4a554e]"} hover:bg-[#e5ebe6]`
              : `bg-transparent ${isOutsideMonth ? "text-[#b0b7b1]" : "text-[#4a554e]"} hover:bg-[#eff3ef]`,
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      aria-label={date}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={isActive}
      onClick={() => onSelectDate(date)}
    >
      {day}
    </button>
  );
});

export const MiniCalendar = memo(function MiniCalendar({
  activeDate,
  visibleRangeStart,
  visibleRangeEnd,
  visibleMonth,
  timeZone,
  onSelectDate,
  onVisibleMonthChange,
}: MiniCalendarProps) {
  const [optimisticActiveDate, setOptimisticActiveDate] =
    useState(activeDate);
  const [isSelectionPending, startSelectionTransition] =
    useTransition();
  const displayedActiveDate = isSelectionPending
    ? optimisticActiveDate
    : activeDate;
  const { monthLabel, weeks } = useMemo(() => {
    const visibleMonthNumber = parseCalendarDate(visibleMonth).month;
    const cells = getMonthCalendarDates(visibleMonth).map((date) => {
      const parts = parseCalendarDate(date);

      return {
        date,
        day: parts.day,
        isOutsideMonth: parts.month !== visibleMonthNumber,
      };
    });

    // The sidebar also owns room loading state. Keeping month-only work here
    // prevents those unrelated updates from rebuilding all 42 date cells.
    return {
      monthLabel: formatCalendarMonth(visibleMonth),
      weeks: Array.from({ length: 6 }, (_, index) =>
        cells.slice(index * 7, index * 7 + 7),
      ),
    };
  }, [visibleMonth]);
  const today = getZonedDateIso(new Date(), timeZone);
  const todayMonth = startOfCalendarMonth(today);
  const fallbackWeekStart = getMondayStart(activeDate);
  const highlightedRangeStart = visibleRangeStart ?? fallbackWeekStart;
  const highlightedRangeEnd =
    visibleRangeEnd ?? addCalendarDays(fallbackWeekStart, 6);
  const isAwayFromToday =
    displayedActiveDate !== today || visibleMonth !== todayMonth;

  const selectDate = useCallback(
    (date: string) => {
      // Paint the small selected-day change first. The parent callback also
      // moves and rebuilds the much larger schedule grid, so it can safely run
      // as a non-urgent transition without making the date button feel stuck.
      setOptimisticActiveDate(date);
      startSelectionTransition(() => onSelectDate(date));
    },
    [onSelectDate],
  );

  return (
    <section
      className="mx-3.5 mt-3.5 rounded-2xl border border-[#d7ddd7] bg-[var(--surface)] px-3 pt-[13px] pb-3"
      aria-label="Date picker"
    >
      <div className="flex min-h-8 items-center justify-between">
        <h2 className="m-0 text-base font-[670] text-[#313c35]">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-px">
          <button
            className={[
              "grid size-7 flex-none place-items-center rounded-lg border-0 bg-transparent text-[#526058] [&>svg]:size-4",
              isAwayFromToday
                ? "cursor-pointer hover:bg-[#edf1ed] hover:text-[var(--ink)]"
                : "invisible pointer-events-none",
            ].join(" ")}
            type="button"
            aria-label="Back to today"
            aria-hidden={!isAwayFromToday}
            disabled={!isAwayFromToday}
            tabIndex={isAwayFromToday ? undefined : -1}
            onClick={() => {
              setOptimisticActiveDate(today);
              startSelectionTransition(() => {
                onSelectDate(today);
                onVisibleMonthChange(todayMonth);
              });
            }}
          >
            <RiArrowGoBackLine aria-hidden="true" />
          </button>
          <button
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-4"
            type="button"
            aria-label="Previous month"
            onClick={() =>
              onVisibleMonthChange(
                addCalendarMonths(visibleMonth, -1),
              )
            }
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
          <button
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-4"
            type="button"
            aria-label="Next month"
            onClick={() =>
              onVisibleMonthChange(
                addCalendarMonths(visibleMonth, 1),
              )
            }
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="mt-[7px] grid grid-cols-7 text-center text-[11px] font-[650] text-[#859087] [&>span]:py-1"
        aria-hidden="true"
      >
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="grid">
        {weeks.map((week) => {
          // Keep the week range behind the date buttons so the selected day
          // can retain its dark treatment inside one continuous highlight.
          const visibleDayIndexes = week.reduce<number[]>(
            (indexes, cell, index) => {
              if (
                cell.date >= highlightedRangeStart &&
                cell.date <= highlightedRangeEnd
              ) {
                indexes.push(index);
              }
              return indexes;
            },
            [],
          );
          const firstVisibleIndex = visibleDayIndexes[0] ?? -1;
          const lastVisibleIndex =
            visibleDayIndexes[visibleDayIndexes.length - 1] ?? -1;

          return (
            <div
              className="relative grid grid-cols-7 py-1"
              key={week[0].date}
            >
              {firstVisibleIndex >= 0 ? (
                <span
                  className="pointer-events-none absolute top-1 bottom-1 z-0 rounded-[11px] bg-[#eef3ef]"
                  style={{
                    left: `${(firstVisibleIndex / 7) * 100}%`,
                    width: `${((lastVisibleIndex - firstVisibleIndex + 1) / 7) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              ) : null}
              {week.map((cell) => {
                const isToday = cell.date === today;
                const isActive = cell.date === displayedActiveDate;
                const isVisible =
                  cell.date >= highlightedRangeStart &&
                  cell.date <= highlightedRangeEnd;

                return (
                  <MiniCalendarDay
                    cell={cell}
                    isActive={isActive}
                    isToday={isToday}
                    isVisible={isVisible}
                    key={cell.date}
                    onSelectDate={selectDate}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
});
