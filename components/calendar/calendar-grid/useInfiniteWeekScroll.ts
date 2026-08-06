"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent as ReactUIEvent } from "react";
import { addCalendarDays, getViewDates, type CalendarView } from "@/lib/time";
import {
  CALENDAR_VISIBLE_DAY_COUNT,
  CALENDAR_WINDOW_SHIFT_DAYS,
  getCalendarDateColumnScrollLeft,
  getCalendarDayColumnWidth,
  getRenderedCalendarDayColumnWidth,
  getCalendarWindowDates,
  getCalendarWindowShiftDirection,
  getCalendarWindowStart,
  getDateScrollLeft,
  getVisibleCalendarRange,
  resolveCalendarWindowStart,
  shouldCancelCalendarResizeRestore,
  shouldPositionCalendarTarget,
  type VisibleCalendarRange,
} from "./calendar-window";

export function useInfiniteWeekScroll({
  targetDate,
  isSidebarOpen,
  positionRequestId,
  view,
  isViewPositioning,
  onVisibleRangeChange,
  onViewPositioned,
}: {
  targetDate: string;
  isSidebarOpen: boolean;
  positionRequestId: number;
  view: CalendarView;
  isViewPositioning: boolean;
  onVisibleRangeChange: (range: VisibleCalendarRange) => void;
  onViewPositioned: () => void;
}) {
  const [windowStart, setWindowStart] = useState(() =>
    getCalendarWindowStart(targetDate),
  );
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const windowResetFrameRef = useRef<number | null>(null);
  const viewRevealFrameRef = useRef<number | null>(null);
  const viewRevealPaintFrameRef = useRef<number | null>(null);
  const layoutRestoreFrameRef = useRef<number | null>(null);
  const layoutRestorePaintFrameRef = useRef<number | null>(null);
  const pendingScrollAdjustmentDaysRef = useRef(0);
  const shouldPositionImmediatelyRef = useRef(true);
  const isShiftingWindowRef = useRef(false);
  const isRestoringLayoutRef = useRef(false);
  const lastPositionedTargetRef = useRef<string | null>(null);
  const previousSidebarOpenRef = useRef(isSidebarOpen);
  const previousPositionRequestIdRef = useRef(positionRequestId);
  const previousViewRef = useRef(view);
  const previousDayColumnWidthRef = useRef<number | null>(null);
  const dateColumnRefs = useRef(new Map<string, HTMLDivElement>());
  const layoutAnchorDateRef = useRef<string | null>(null);
  const lastVisibleRangeRef = useRef<VisibleCalendarRange>({
    startDate: targetDate,
    endDate: addCalendarDays(targetDate, CALENDAR_VISIBLE_DAY_COUNT - 1),
  });
  const lastReportedRangeKeyRef = useRef("");
  const resolvedWindowStart =
    view === "week"
      ? resolveCalendarWindowStart(windowStart, targetDate)
      : windowStart;
  const windowNeedsReset = resolvedWindowStart !== windowStart;

  const dates = useMemo(
    () =>
      view === "week"
        ? getCalendarWindowDates(resolvedWindowStart)
        : getViewDates(targetDate, view),
    [resolvedWindowStart, targetDate, view],
  );

  const measureDayColumnWidth = useCallback(
    (viewport: HTMLDivElement) =>
      view === "week"
        ? getRenderedCalendarDayColumnWidth({
            dayCount: dates.length,
            scrollWidth: viewport.scrollWidth,
          })
        : getCalendarDayColumnWidth(viewport.clientWidth),
    [dates.length, view],
  );

  const setDateColumnRef = useCallback(
    (date: string, element: HTMLDivElement | null) => {
      if (element) {
        dateColumnRefs.current.set(date, element);
      } else {
        dateColumnRefs.current.delete(date);
      }
    },
    [],
  );

  const getDateColumnLeft = useCallback(
    (date: string, dayColumnWidth: number) => {
      const renderedColumn = dateColumnRefs.current.get(date);
      if (renderedColumn) {
        return getCalendarDateColumnScrollLeft(renderedColumn.offsetLeft);
      }

      // The fallback is only needed during a recycled-window commit before the
      // new column ref attaches. Normal resize positioning uses rendered DOM.
      return getDateScrollLeft({
        windowStart: resolvedWindowStart,
        targetDate: date,
        dayColumnWidth,
      });
    },
    [resolvedWindowStart],
  );

  const positionDateColumn = useCallback(
    (
      viewport: HTMLDivElement,
      date: string,
      behavior: ScrollBehavior = "auto",
    ) => {
      const dayColumnWidth = measureDayColumnWidth(viewport);
      const left = getDateColumnLeft(date, dayColumnWidth);

      if (behavior === "auto") {
        viewport.scrollLeft = left;
      } else {
        viewport.scrollTo({ left, behavior });
      }
      previousDayColumnWidthRef.current = dayColumnWidth;
      return left;
    },
    [getDateColumnLeft, measureDayColumnWidth],
  );

  const cancelLayoutRestore = useCallback(() => {
    if (layoutRestoreFrameRef.current !== null) {
      cancelAnimationFrame(layoutRestoreFrameRef.current);
      layoutRestoreFrameRef.current = null;
    }
    if (layoutRestorePaintFrameRef.current !== null) {
      cancelAnimationFrame(layoutRestorePaintFrameRef.current);
      layoutRestorePaintFrameRef.current = null;
    }
    layoutAnchorDateRef.current = null;
    isRestoringLayoutRef.current = false;
  }, []);

  const restoreDateAfterLayout = useCallback(
    (viewport: HTMLDivElement, anchorDate: string) => {
      cancelLayoutRestore();
      layoutAnchorDateRef.current = anchorDate;
      isRestoringLayoutRef.current = true;
      positionDateColumn(viewport, anchorDate);

      // Container-query units can settle after React's layout effects. Align
      // from the rendered date again on the next layout and paint frames.
      layoutRestoreFrameRef.current = requestAnimationFrame(() => {
        layoutRestoreFrameRef.current = null;
        const settledViewport = scrollViewportRef.current;
        if (!settledViewport || layoutAnchorDateRef.current !== anchorDate) {
          return;
        }
        positionDateColumn(settledViewport, anchorDate);
        layoutRestorePaintFrameRef.current = requestAnimationFrame(() => {
          layoutRestorePaintFrameRef.current = null;
          const paintedViewport = scrollViewportRef.current;
          if (paintedViewport && layoutAnchorDateRef.current === anchorDate) {
            positionDateColumn(paintedViewport, anchorDate);
          }
          layoutAnchorDateRef.current = null;
          isRestoringLayoutRef.current = false;
        });
      });
    },
    [cancelLayoutRestore, positionDateColumn],
  );

  const reportVisibleRange = useCallback(
    (viewport: HTMLDivElement, measuredDayColumnWidth?: number) => {
      const dayColumnWidth =
        measuredDayColumnWidth ??
        measureDayColumnWidth(viewport);
      const range =
        view === "week"
          ? getVisibleCalendarRange({
              windowStart: resolvedWindowStart,
              scrollLeft: viewport.scrollLeft,
              dayColumnWidth,
            })
          : { startDate: targetDate, endDate: targetDate };
      const rangeKey = `${range.startDate}:${range.endDate}`;

      lastVisibleRangeRef.current = range;
      if (rangeKey !== lastReportedRangeKeyRef.current) {
        lastReportedRangeKeyRef.current = rangeKey;
        onVisibleRangeChange(range);
      }

      return range;
    },
    [
      measureDayColumnWidth,
      onVisibleRangeChange,
      resolvedWindowStart,
      targetDate,
      view,
    ],
  );

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || view !== "week") {
      return;
    }

    const preserveVisibleDate = () => {
      const nextWidth = measureDayColumnWidth(viewport);
      const previousWidth = previousDayColumnWidthRef.current;

      if (
        previousWidth !== null &&
        Math.abs(previousWidth - nextWidth) >= 0.01
      ) {
        // Flexbox can expose a different set of dates before ResizeObserver
        // restores the anchored scroll position. Cancel that pending scroll
        // report, otherwise CalendarShell would adopt the transient range as
        // the new navigation target while the sidebar is opening or closing.
        if (scrollFrameRef.current !== null) {
          cancelAnimationFrame(scrollFrameRef.current);
          scrollFrameRef.current = null;
        }
        pendingScrollAdjustmentDaysRef.current = 0;
        isShiftingWindowRef.current = false;
        if (!isViewPositioning) {
          // Sidebar resizing is layout-only. Do not let a delayed positioning
          // frame from an earlier command move the viewport after the resize.
          if (viewRevealFrameRef.current !== null) {
            cancelAnimationFrame(viewRevealFrameRef.current);
            viewRevealFrameRef.current = null;
          }
          if (viewRevealPaintFrameRef.current !== null) {
            cancelAnimationFrame(viewRevealPaintFrameRef.current);
            viewRevealPaintFrameRef.current = null;
          }
        }
        lastPositionedTargetRef.current =
          lastVisibleRangeRef.current.startDate;
        lastReportedRangeKeyRef.current = `${lastVisibleRangeRef.current.startDate}:${lastVisibleRangeRef.current.endDate}`;
        restoreDateAfterLayout(
          viewport,
          lastVisibleRangeRef.current.startDate,
        );
      }

      previousDayColumnWidthRef.current = nextWidth;
    };
    const resizeObserver = new ResizeObserver(preserveVisibleDate);

    resizeObserver.observe(viewport);
    preserveVisibleDate();
    return () => resizeObserver.disconnect();
  }, [
    isViewPositioning,
    measureDayColumnWidth,
    restoreDateAfterLayout,
    resolvedWindowStart,
    view,
  ]);

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    const sidebarStateChanged =
      previousSidebarOpenRef.current !== isSidebarOpen;
    previousSidebarOpenRef.current = isSidebarOpen;

    if (!viewport || view !== "week" || !sidebarStateChanged) {
      return;
    }

    // Sidebar visibility changes are layout-only. Re-anchor the rendered start
    // date while CSS stretches the same columns to the new available width.
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    pendingScrollAdjustmentDaysRef.current = 0;
    isShiftingWindowRef.current = false;
    if (!isViewPositioning) {
      if (viewRevealFrameRef.current !== null) {
        cancelAnimationFrame(viewRevealFrameRef.current);
        viewRevealFrameRef.current = null;
      }
      if (viewRevealPaintFrameRef.current !== null) {
        cancelAnimationFrame(viewRevealPaintFrameRef.current);
        viewRevealPaintFrameRef.current = null;
      }
    }

    lastPositionedTargetRef.current =
      lastVisibleRangeRef.current.startDate;
    lastReportedRangeKeyRef.current = `${lastVisibleRangeRef.current.startDate}:${lastVisibleRangeRef.current.endDate}`;
    restoreDateAfterLayout(viewport, lastVisibleRangeRef.current.startDate);
  }, [
    isSidebarOpen,
    isViewPositioning,
    restoreDateAfterLayout,
    resolvedWindowStart,
    view,
  ]);

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    if (view !== "week") {
      // A scroll event is reported on the next animation frame. Cancel any
      // Week callback before it can replace the Day target with an old Monday.
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      if (windowResetFrameRef.current !== null) {
        cancelAnimationFrame(windowResetFrameRef.current);
        windowResetFrameRef.current = null;
      }
      if (viewRevealFrameRef.current !== null) {
        cancelAnimationFrame(viewRevealFrameRef.current);
        viewRevealFrameRef.current = null;
      }
      if (viewRevealPaintFrameRef.current !== null) {
        cancelAnimationFrame(viewRevealPaintFrameRef.current);
        viewRevealPaintFrameRef.current = null;
      }
      pendingScrollAdjustmentDaysRef.current = 0;
      isShiftingWindowRef.current = false;
      // Day view is a new navigation context. Remove both sidebar restoration
      // frames so a fast Week -> Day -> Week toggle cannot replay an old offset.
      cancelLayoutRestore();
      viewport.scrollLeft = 0;
      shouldPositionImmediatelyRef.current = true;
      lastPositionedTargetRef.current = null;
      previousDayColumnWidthRef.current = null;
      previousViewRef.current = view;
      reportVisibleRange(viewport);
      return;
    }

    const enteredWeekView = previousViewRef.current !== "week";
    const hasExplicitPositionRequest =
      previousPositionRequestIdRef.current !== positionRequestId;
    previousPositionRequestIdRef.current = positionRequestId;
    previousViewRef.current = view;
    const dayColumnWidth = measureDayColumnWidth(viewport);
    const forcePosition =
      enteredWeekView || isViewPositioning || hasExplicitPositionRequest;

    if (
      isRestoringLayoutRef.current &&
      shouldCancelCalendarResizeRestore({
        targetDate,
        visibleStartDate: lastVisibleRangeRef.current.startDate,
        forcePosition,
      })
    ) {
      // Previous/Next, Today, MiniCalendar, and view changes can arrive before
      // the sidebar's two-frame resize guard settles. Cancel that guard now so
      // its old offset cannot overwrite the requested date on the next frame.
      cancelLayoutRestore();
    }

    if (windowNeedsReset) {
      // The render already uses the target's centered window. Persist it before
      // paint so switching back from a distant Day view never shows old dates.
      shouldPositionImmediatelyRef.current = true;
      pendingScrollAdjustmentDaysRef.current = 0;
      isShiftingWindowRef.current = false;
      if (windowResetFrameRef.current === null) {
        windowResetFrameRef.current = requestAnimationFrame(() => {
          windowResetFrameRef.current = null;
          setWindowStart(resolvedWindowStart);
        });
      }
    }

    if (forcePosition) {
      // View changes are navigation commands, not continuation of the old
      // horizontal gesture. Position the requested Monday directly before the
      // browser paints or any ResizeObserver anchoring can preserve stale days.
      pendingScrollAdjustmentDaysRef.current = 0;
      isShiftingWindowRef.current = false;
      const positionTarget = (
        targetViewport: HTMLDivElement,
      ) => {
        positionDateColumn(targetViewport, targetDate);
      };

      positionTarget(viewport);
      shouldPositionImmediatelyRef.current = false;
      lastPositionedTargetRef.current = targetDate;
      // CalendarShell already owns this requested range. Do not let an
      // intermediate browser measurement replace it with dates from the old
      // scroll position while the transition surface is still covered.
      lastVisibleRangeRef.current = {
        startDate: targetDate,
        endDate: addCalendarDays(
          targetDate,
          CALENDAR_VISIBLE_DAY_COUNT - 1,
        ),
      };

      if (
        viewRevealFrameRef.current === null &&
        viewRevealPaintFrameRef.current === null
      ) {
        // A layout effect still runs before the browser paints. Keep the cover
        // for one complete paint, then reveal the already-positioned calendar
        // on the following frame so the recycled multi-week canvas cannot flash.
        viewRevealFrameRef.current = requestAnimationFrame(() => {
          viewRevealFrameRef.current = null;
          const settledViewport = scrollViewportRef.current;
          if (settledViewport) {
            positionTarget(settledViewport);
          }
          viewRevealPaintFrameRef.current = requestAnimationFrame(() => {
            viewRevealPaintFrameRef.current = null;
            onViewPositioned();
          });
        });
      }
      return;
    }

    if (pendingScrollAdjustmentDaysRef.current !== 0) {
      viewport.scrollLeft +=
        pendingScrollAdjustmentDaysRef.current * dayColumnWidth;
      pendingScrollAdjustmentDaysRef.current = 0;
      isShiftingWindowRef.current = false;
      previousDayColumnWidthRef.current = dayColumnWidth;
      const range = reportVisibleRange(viewport);
      if (targetDate === range.startDate) {
        lastPositionedTargetRef.current = targetDate;
      }
      return;
    }

    const previousDayColumnWidth = previousDayColumnWidthRef.current;
    const columnWidthChanged =
      previousDayColumnWidth !== null &&
      Math.abs(previousDayColumnWidth - dayColumnWidth) >= 0.01;
    if (columnWidthChanged) {
      // Re-anchor from the rendered date column. The browser can now stretch
      // the columns without keeping a stale pixel-based scroll position.
      restoreDateAfterLayout(
        viewport,
        lastVisibleRangeRef.current.startDate,
      );
      lastPositionedTargetRef.current =
        lastVisibleRangeRef.current.startDate;
      lastReportedRangeKeyRef.current = `${lastVisibleRangeRef.current.startDate}:${lastVisibleRangeRef.current.endDate}`;
      return;
    }

    previousDayColumnWidthRef.current = dayColumnWidth;

    const shouldPositionTarget = shouldPositionCalendarTarget({
      lastPositionedTarget: lastPositionedTargetRef.current,
      targetDate,
      visibleStartDate: lastVisibleRangeRef.current.startDate,
      forcePosition: hasExplicitPositionRequest,
    });
    if (!shouldPositionTarget) {
      // CalendarShell mirrors gesture-reported ranges into targetDate. Accept
      // that new anchor without issuing a programmatic scroll back to the old
      // navigation target (usually the date shown when the page first opened).
      lastPositionedTargetRef.current = targetDate;
      return;
    }

    positionDateColumn(
      viewport,
      targetDate,
      shouldPositionImmediatelyRef.current || windowNeedsReset
        ? "auto"
        : "smooth",
    );
    shouldPositionImmediatelyRef.current = false;
    lastPositionedTargetRef.current = targetDate;
    reportVisibleRange(viewport, dayColumnWidth);
  }, [
    reportVisibleRange,
    resolvedWindowStart,
    cancelLayoutRestore,
    isViewPositioning,
    measureDayColumnWidth,
    onViewPositioned,
    positionDateColumn,
    positionRequestId,
    restoreDateAfterLayout,
    targetDate,
    view,
    windowNeedsReset,
  ]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
      if (windowResetFrameRef.current !== null) {
        cancelAnimationFrame(windowResetFrameRef.current);
      }
      if (viewRevealFrameRef.current !== null) {
        cancelAnimationFrame(viewRevealFrameRef.current);
      }
      if (viewRevealPaintFrameRef.current !== null) {
        cancelAnimationFrame(viewRevealPaintFrameRef.current);
      }
      if (layoutRestoreFrameRef.current !== null) {
        cancelAnimationFrame(layoutRestoreFrameRef.current);
      }
      if (layoutRestorePaintFrameRef.current !== null) {
        cancelAnimationFrame(layoutRestorePaintFrameRef.current);
      }
    },
    [],
  );

  const handleScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>) => {
      if (
        view !== "week" ||
        isViewPositioning ||
        scrollFrameRef.current !== null
      ) {
        return;
      }

      const viewport = event.currentTarget;
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const dayColumnWidth = measureDayColumnWidth(viewport);
        const previousDayColumnWidth =
          previousDayColumnWidthRef.current;

        if (isRestoringLayoutRef.current) {
          // Ignore the browser-generated scroll event from the resize. It must
          // never be mistaken for a horizontal navigation gesture.
          positionDateColumn(
            viewport,
            layoutAnchorDateRef.current ??
              lastVisibleRangeRef.current.startDate,
          );
          return;
        }

        // ResizeObserver normally handles this first, but the frame can win
        // the browser's scheduling race. Re-check here so a resize-induced
        // scroll event can never publish the transient left edge to the shell.
        if (
          previousDayColumnWidth !== null &&
          Math.abs(previousDayColumnWidth - dayColumnWidth) >= 0.01
        ) {
          restoreDateAfterLayout(
            viewport,
            lastVisibleRangeRef.current.startDate,
          );
          lastPositionedTargetRef.current =
            lastVisibleRangeRef.current.startDate;
          lastReportedRangeKeyRef.current = `${lastVisibleRangeRef.current.startDate}:${lastVisibleRangeRef.current.endDate}`;
          return;
        }

        const visibleRange = reportVisibleRange(viewport);

        if (isShiftingWindowRef.current) {
          return;
        }

        const shiftDirection = getCalendarWindowShiftDirection({
          windowStart: resolvedWindowStart,
          visibleStartDate: visibleRange.startDate,
        });
        if (shiftDirection === 0) {
          return;
        }

        // Recycle two off-screen weeks and compensate scrollLeft after React
        // commits, preserving the exact dates beneath a moving pointer/gesture.
        isShiftingWindowRef.current = true;
        pendingScrollAdjustmentDaysRef.current =
          -shiftDirection * CALENDAR_WINDOW_SHIFT_DAYS;
        setWindowStart(
          addCalendarDays(
            resolvedWindowStart,
            shiftDirection * CALENDAR_WINDOW_SHIFT_DAYS,
          ),
        );
      });
    }, [
      isViewPositioning,
      measureDayColumnWidth,
      positionDateColumn,
      reportVisibleRange,
      resolvedWindowStart,
      restoreDateAfterLayout,
      view,
    ],
  );

  return {
    dates,
    handleScroll,
    scrollViewportRef,
    setDateColumnRef,
  };
}
