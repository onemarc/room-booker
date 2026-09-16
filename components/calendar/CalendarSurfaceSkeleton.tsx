"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { SkeletonBlock } from "@/components/ui/AsyncState";
import { SLOT_COUNT } from "@/components/calendar/calendar-grid/calendar-grid-utils";
import { CalendarLoadingOverlay } from "@/components/calendar/calendar-grid/CalendarLoadingOverlay";

const PLACEHOLDER_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MOBILE_FOCUS_DAY_INDEX = 3;
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
      className="z-30 flex min-h-[58px] flex-none items-center justify-between gap-[18px] overflow-x-auto bg-[var(--surface)] px-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[1200px]:gap-2 max-[1200px]:px-2 max-[1060px]:gap-1 max-[1060px]:px-1.5 max-[760px]:min-h-[58px] max-[760px]:flex-row max-[760px]:items-center max-[760px]:gap-2 max-[760px]:py-1.5"
      aria-hidden="true"
    >
      <div className="flex min-w-max flex-none items-center gap-[7px] max-[1200px]:gap-1">
        <SkeletonBlock className="size-[34px] rounded-lg max-[1200px]:size-8 max-[1060px]:size-[30px] max-[760px]:size-[34px]" />
        <SkeletonBlock className="h-5 w-36 max-[1200px]:w-24 max-[760px]:w-20" />
        <span className="mx-1 h-[23px] w-px flex-none bg-[#d7ddd8]" />
        <SkeletonBlock className="h-5 w-20 max-[1200px]:w-16" />
        <SkeletonBlock className="size-6 rounded-full" />
      </div>
      <div className="ml-auto flex min-w-max flex-none items-center gap-[7px] max-[1200px]:gap-1 max-[760px]:gap-0.5">
        <SkeletonBlock className="h-8 w-14 rounded-lg max-[1200px]:w-12 max-[1060px]:w-10 max-[760px]:w-7" />
        <div className="flex items-center">
          <SkeletonBlock className="size-[30px] rounded-lg max-[1200px]:size-7 max-[760px]:size-[30px]" />
          <SkeletonBlock className="size-[30px] rounded-lg max-[1200px]:size-7 max-[760px]:size-[30px]" />
        </div>
        <div className="flex items-center gap-0.5 rounded-[9px] border border-[#d8ded9] p-0.5">
          <SkeletonBlock className="h-6 w-8 rounded-lg max-[760px]:h-7 max-[760px]:w-7" />
          <SkeletonBlock className="h-6 w-10 rounded-lg max-[760px]:h-7 max-[760px]:w-7" />
        </div>
        <SkeletonBlock className="h-8 w-28 rounded-lg max-[1200px]:w-24 max-[1060px]:w-20 max-[760px]:w-10" />
        <SkeletonBlock className="h-8 w-24 rounded-lg max-[1200px]:w-20 max-[1060px]:w-16 max-[760px]:w-12" />
        <span className="h-[23px] w-px flex-none bg-[#d7ddd8]" />
        <SkeletonBlock className="h-[34px] w-36 rounded-lg max-[1200px]:h-8 max-[1200px]:w-28 max-[1060px]:hidden" />
        <SkeletonBlock className="size-[34px] rounded-lg" />
        <SkeletonBlock className="size-[34px] rounded-lg" />
      </div>
    </div>
  );
}

export function CalendarGridSkeleton({ overlay }: { overlay?: ReactNode }) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }
    const scrollViewport = viewport;

    const mobileQuery = window.matchMedia("(max-width: 760px)");

    function alignMobileSkeleton() {
      if (!mobileQuery.matches) {
        scrollViewport.scrollLeft = 0;
        return;
      }

      const focusColumn = scrollViewport.querySelector<HTMLElement>(
        `[data-skeleton-day="${MOBILE_FOCUS_DAY_INDEX}"]`,
      );
      if (!focusColumn) {
        return;
      }

      const visibleDateAreaWidth = Math.max(
        0,
        scrollViewport.clientWidth - 62,
      );
      const centerOffset = Math.max(
        0,
        (visibleDateAreaWidth - focusColumn.offsetWidth) / 2,
      );
      const requestedScrollLeft = Math.max(
        0,
        focusColumn.offsetLeft - 62 - centerOffset,
      );

      scrollViewport.scrollLeft = Math.min(
        requestedScrollLeft,
        Math.max(
          0,
          scrollViewport.scrollWidth - scrollViewport.clientWidth,
        ),
      );
    }

    alignMobileSkeleton();
    window.addEventListener("resize", alignMobileSkeleton);
    mobileQuery.addEventListener("change", alignMobileSkeleton);

    return () => {
      window.removeEventListener("resize", alignMobileSkeleton);
      mobileQuery.removeEventListener("change", alignMobileSkeleton);
    };
  }, []);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden" aria-hidden={!overlay}>
      <div
        className="flex min-h-0 h-full touch-pan-x touch-pan-y flex-col overflow-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={scrollViewportRef}
      >
        <div className="sticky top-0 z-8 grid min-h-[92px] w-full min-w-[720px] flex-none grid-cols-[62px_repeat(7,minmax(94px,1fr))] bg-[var(--surface)]">
          <div className="border-r border-[var(--grid-line)]" />
          {PLACEHOLDER_DAYS.map((day, dayIndex) => (
            <div
              className="flex min-w-0 flex-col items-center justify-center gap-2 border-r border-b border-[var(--grid-line)] bg-[var(--surface)]"
              data-skeleton-day={dayIndex}
              key={day}
            >
              <SkeletonBlock
                className={[
                  "h-10 w-14 rounded-md",
                  dayIndex === MOBILE_FOCUS_DAY_INDEX ? "bg-[#b8cdbd]" : "",
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
                    dayIndex === MOBILE_FOCUS_DAY_INDEX ? "bg-[#fbfdfb]" : "",
                  ].join(" ")}
                  key={`${day}-${rowIndex}`}
                />
              ))}
            </div>
          ))}

          <CalendarLoadingOverlay dates={PLACEHOLDER_DAYS} />
        </div>
      </div>

      {overlay ? (
        // Keep route errors in the viewport layer rather than the wide,
        // horizontally scrolling canvas so the retry card stays centered on
        // phones after the skeleton aligns its focus day.
        <div className="absolute inset-[12px_12px_12px_74px] z-6 grid place-items-center rounded-xl bg-[rgba(255,255,255,0.62)] p-3 backdrop-blur-[1px] max-[760px]:inset-2 max-[760px]:p-2">
          {overlay}
        </div>
      ) : null}
    </div>
  );
}
