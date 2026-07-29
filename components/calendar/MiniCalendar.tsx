"use client";

import { useMemo } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { RiArrowGoBackLine } from "react-icons/ri";
import {
  addCalendarMonths,
  formatCalendarMonth,
  getMondayStart,
  getMonthCalendarDates,
  getZonedDateIso,
  parseCalendarDate,
  startOfCalendarMonth,
} from "@/lib/time";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MiniCalendar({
  activeDate,
  visibleMonth,
  timeZone,
  onSelectDate,
  onVisibleMonthChange,
}: {
  activeDate: string;
  visibleMonth: string;
  timeZone: string;
  onSelectDate: (date: string) => void;
  onVisibleMonthChange: (month: string) => void;
}) {
  const dates = useMemo(
    () => getMonthCalendarDates(visibleMonth),
    [visibleMonth],
  );
  const visibleMonthNumber = parseCalendarDate(visibleMonth).month;
  const today = getZonedDateIso(new Date(), timeZone);
  const todayMonth = startOfCalendarMonth(today);
  const selectedWeekStart = getMondayStart(activeDate);
  const weeks = Array.from({ length: 6 }, (_, index) =>
    dates.slice(index * 7, index * 7 + 7),
  );

  return (
    <section
      className="mx-3.5 mt-3.5 rounded-2xl border border-[#d7ddd7] bg-[var(--surface)] px-3 pt-[13px] pb-3"
      aria-label="Date picker"
    >
      <div className="flex min-h-8 items-center justify-between">
        <h2 className="m-0 text-base font-[670] text-[#313c35]">
          {formatCalendarMonth(visibleMonth)}
        </h2>
        <div className="flex items-center gap-px">
          {activeDate !== today || visibleMonth !== todayMonth ? (
            <button
              className="grid size-7 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-4"
              type="button"
              aria-label="Back to today"
              onClick={() => {
                onSelectDate(today);
                onVisibleMonthChange(todayMonth);
              }}
            >
              <RiArrowGoBackLine aria-hidden="true" />
            </button>
          ) : null}
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

      <div className="grid gap-px">
        {weeks.map((week) => (
          <div
            className={[
              "grid grid-cols-7 gap-px rounded-[9px] py-px",
              week[0] === selectedWeekStart ? "bg-[#eef3ef]" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={week[0]}
          >
            {week.map((date) => {
              const parts = parseCalendarDate(date);
              const isOutsideMonth =
                parts.month !== visibleMonthNumber;

              return (
                <button
                  className={[
                    "relative grid aspect-square max-h-[31px] w-full cursor-pointer place-items-center rounded-[7px] border-0 text-[11px]",
                    isOutsideMonth ? "text-[#b0b7b1]" : "",
                    date === today
                      ? "after:absolute after:right-1/2 after:bottom-[3px] after:size-[3px] after:translate-x-1/2 after:rounded-full after:bg-[var(--accent)] after:content-['']"
                      : "",
                    date === activeDate
                      ? "bg-[var(--accent)] font-bold text-white hover:bg-[var(--accent)] after:bg-white"
                      : date === today
                        ? "bg-[#e2ece6] font-bold text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(37,91,67,0.34)] hover:bg-[#e2ece6]"
                        : "bg-transparent text-[#4a554e] hover:bg-[#eff3ef]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  key={date}
                  aria-label={date}
                  aria-current={date === today ? "date" : undefined}
                  aria-pressed={date === activeDate}
                  onClick={() => onSelectDate(date)}
                >
                  {parts.day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
