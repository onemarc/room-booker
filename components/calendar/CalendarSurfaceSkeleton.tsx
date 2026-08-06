import type { ReactNode } from "react";
import { SkeletonBlock } from "@/components/ui/AsyncState";
import { SLOT_COUNT } from "@/components/calendar/calendar-grid/calendar-grid-utils";
import { CalendarLoadingOverlay } from "@/components/calendar/calendar-grid/CalendarLoadingOverlay";

const PLACEHOLDER_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Keep the fallback canvas on the same 30-minute row count as CalendarGrid.
// This prevents the loading/error state from visibly jumping when the real
// grid replaces it, even if office hours change in the calendar utilities.
const PLACEHOLDER_ROWS = Array.from({ length: SLOT_COUNT }, (_, index) => index);
const PLACEHOLDER_MONTH_DAYS = Array.from({ length: 42 }, (_, index) => index);

export function CalendarSidebarSkeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <aside
      className={`flex h-full min-h-0 w-[clamp(260px,23vw,304px)] min-w-[260px] flex-none flex-col overflow-hidden border-r border-[var(--line)] bg-[#f8faf8] max-[1060px]:w-[250px] max-[1060px]:min-w-[250px] max-[760px]:w-[clamp(220px,38vw,250px)] max-[760px]:min-w-[clamp(220px,38vw,250px)] ${className}`}
      aria-hidden="true"
    >
      <div className="flex min-h-[58px] items-center gap-3 border-b border-[var(--line)] px-3.5">
        <SkeletonBlock className="size-8 rounded-lg" />
        <SkeletonBlock className="h-5 w-28" />
      </div>

      <div className="mx-3.5 mt-3.5 grid gap-2 rounded-2xl border border-[#d7ddd7] bg-[var(--surface)] px-3 pt-[13px] pb-3">
        <div className="flex min-h-8 items-center justify-between">
          <SkeletonBlock className="h-5 w-28" />
          <div className="flex gap-1">
            <SkeletonBlock className="size-7 rounded-lg" />
            <SkeletonBlock className="size-7 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-7 justify-items-center">
          {PLACEHOLDER_DAYS.map((day) => (
            <SkeletonBlock className="h-3 rounded-sm" key={day} />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {PLACEHOLDER_MONTH_DAYS.map((day) => (
            <SkeletonBlock
              className="aspect-square max-h-[31px] rounded-md"
              key={day}
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-3.5">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-5 w-24" />
          <SkeletonBlock className="h-8 w-20 rounded-lg" />
        </div>
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-[#dfe5df] bg-[var(--surface)]">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="grid gap-2 border-b border-[#e5e9e5] px-3 py-3 last:border-b-0"
              key={index}
            >
              <SkeletonBlock className="h-3.5 w-[68%] rounded-sm" />
              <SkeletonBlock className="h-3 w-[45%] rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function CalendarHeaderSkeleton() {
  return (
    <div
      className="flex min-h-[58px] flex-none items-center justify-between gap-[18px] bg-[var(--surface)] px-[13px] max-[1060px]:min-h-[58px] max-[1060px]:gap-2 max-[1060px]:px-2 max-[760px]:min-h-[98px] max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-1 max-[760px]:py-1.5"
      aria-hidden="true"
    >
      <div className="flex min-w-0 items-center gap-2">
        <SkeletonBlock className="h-5 w-36" />
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2 overflow-hidden max-[760px]:justify-start">
        <SkeletonBlock className="h-[34px] w-14 rounded-lg" />
        <SkeletonBlock className="h-[34px] w-16 rounded-lg" />
        <SkeletonBlock className="h-8 w-20 rounded-[9px]" />
        <SkeletonBlock className="h-[34px] w-24 rounded-lg" />
        <SkeletonBlock className="size-8 rounded-lg" />
        <SkeletonBlock className="size-8 rounded-lg" />
      </div>
    </div>
  );
}

export function CalendarToolbarSkeleton() {
  return (
    <div
      className="flex min-h-[55px] flex-none items-center justify-between gap-[18px] border-b border-[var(--line)] bg-[var(--surface)] py-1.5 pr-[15px] pl-3.5"
      aria-hidden="true"
    >
      <div className="grid gap-1">
        <SkeletonBlock className="h-4 w-28 rounded-sm" />
        <SkeletonBlock className="h-3 w-24 rounded-sm" />
      </div>
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-5 w-36 rounded-sm max-[820px]:hidden" />
        <SkeletonBlock className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function CalendarGridSkeleton({ overlay }: { overlay?: ReactNode }) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden" aria-hidden={!overlay}>
      <div className="flex min-h-0 h-full flex-col overflow-auto overscroll-contain [scrollbar-width:thin]">
        <div className="sticky top-0 z-8 grid min-h-[92px] w-full min-w-[720px] flex-none grid-cols-[62px_repeat(7,minmax(94px,1fr))] bg-[var(--surface)]">
          <div className="border-r border-[var(--grid-line)]" />
          {PLACEHOLDER_DAYS.map((day, dayIndex) => (
            <div
              className="flex min-w-0 flex-col items-center justify-center gap-2 border-r border-b border-[var(--grid-line)] bg-[var(--surface)]"
              key={day}
            >
              <SkeletonBlock
                className={[
                  "h-10 w-14 rounded-md",
                  dayIndex === 2 ? "bg-[#b8cdbd]" : "",
                ].join(" ")}
              />
              <SkeletonBlock className="h-5 w-10 rounded-sm" />
            </div>
          ))}
        </div>

        <div className="relative flex min-h-[560px] min-w-[720px] flex-1 flex-col pb-px">
          {PLACEHOLDER_ROWS.map((rowIndex) => (
            <div
              className="grid min-h-7 w-full flex-[1_0_28px] grid-cols-[62px_repeat(7,minmax(94px,1fr))]"
              key={rowIndex}
            >
              <div
                className={[
                  "relative border-r border-[var(--grid-line)] bg-[var(--surface)]",
                  rowIndex % 2 === 0 ? "border-t" : "",
                ].join(" ")}
              >
                {rowIndex % 2 === 0 ? (
                  <SkeletonBlock className="absolute top-[-6px] right-2 h-3 w-8 rounded-sm" />
                ) : null}
              </div>
              {PLACEHOLDER_DAYS.map((day, dayIndex) => (
                <div
                  className={[
                    "border-r border-[var(--grid-line)] bg-[var(--surface)]",
                    rowIndex % 2 === 0 ? "border-t" : "",
                    dayIndex === 2 ? "bg-[#fbfdfb]" : "",
                  ].join(" ")}
                  key={`${day}-${rowIndex}`}
                />
              ))}
            </div>
          ))}

          <CalendarLoadingOverlay dates={PLACEHOLDER_DAYS} />

          {overlay ? (
            <div className="absolute inset-[12px_12px_12px_74px] z-6 grid place-items-center rounded-xl bg-[rgba(255,255,255,0.62)] p-3 backdrop-blur-[1px]">
              {overlay}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
