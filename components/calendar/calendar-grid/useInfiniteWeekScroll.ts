"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent as ReactUIEvent } from "react";
import { addCalendarDays, getMondayStart, getViewDates, type CalendarView } from "@/lib/time";
import {
  CALENDAR_VISIBLE_DAY_COUNT,
  CALENDAR_WINDOW_SHIFT_DAYS,
  getCalendarCanvasWidth,
  getCalendarDateColumnScrollLeft,
  getCalendarDayOffset,
  getCalendarDayColumnWidth,
  getCalendarScrollLeftForDayOffset,
  getCalendarScrollLeftForCenteredDate,
  getCalendarScrollOffsetInDays,
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

const MOMENTUM_STOP_SETTLE_DELAY_MS = 160;

export function useInfiniteWeekScroll({
  activeDate,
  targetDate,
  isSidebarOpen,
  positionRequestId,
  stopScrollRequestId,
  view,
  isViewPositioning,
  onVisibleRangeChange,
  onViewPositioned,
}: {
  activeDate: string;
  targetDate: string;
  isSidebarOpen: boolean;
  positionRequestId: number;
  stopScrollRequestId: number;
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
  const momentumStopSettleTimerRef = useRef<number | null>(null);
  const pendingScrollAdjustmentDaysRef = useRef(0);
  const shouldPositionImmediatelyRef = useRef(true);
  const isShiftingWindowRef = useRef(false);
  const isRestoringLayoutRef = useRef(false);
  const windowShiftAnchorDateRef = useRef<string | null>(null);
  const windowShiftAnchorColumnOffsetRef = useRef<number | null>(null);
  const lastPositionedTargetRef = useRef<string | null>(null);
  const previousSidebarOpenRef = useRef(isSidebarOpen);
  const previousPositionRequestIdRef = useRef(positionRequestId);
  const previousStopScrollRequestIdRef = useRef(stopScrollRequestId);
  const previousViewRef = useRef(view);
  const previousDayColumnWidthRef = useRef<number | null>(null);
  const dateColumnRefs = useRef(new Map<string, HTMLDivElement>());
  const layoutAnchorDateRef = useRef<string | null>(null);
  const layoutAnchorDayOffsetRef = useRef<number | null>(null);
  const layoutAnchorCenterOnMobileRef = useRef(false);
  const momentumStopAnchorDateRef = useRef<string | null>(null);
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
    (viewport: HTMLDivElement) => {
      if (view === "week") {
        // The date cells are the source of truth while the responsive canvas is
        // settling. scrollWidth can briefly describe the minimum 49-day canvas,
        // which makes every calculated date offset too small during a transition.
        const renderedColumn = dateColumnRefs.current.values().next().value;
        const renderedWidth = renderedColumn?.getBoundingClientRect().width;
        if (renderedWidth && renderedWidth > 0) {
          return renderedWidth;
        }

        return getRenderedCalendarDayColumnWidth({
          dayCount: dates.length,
          scrollWidth: viewport.scrollWidth,
        });
      }
      return getCalendarDayColumnWidth(viewport.clientWidth);
    },
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
        // A rendered column already includes the browser's final grid-track
        // width. It remains correct even if scrollWidth or a cached width still
        // belongs to the previous Day/Week layout pass.
        return getCalendarDateColumnScrollLeft(renderedColumn.offsetLeft);
      }

      // The fallback is only needed during a recycled-window commit before the
      // new column ref attaches.
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
      centerOnMobile = false,
    ) => {
      const dayColumnWidth = measureDayColumnWidth(viewport);
      const dateColumnScrollLeft = getDateColumnLeft(date, dayColumnWidth);
      // Week view navigation targets the Monday starting the period. Monday must ALWAYS
      // align as the first visible column (left edge) and never be centered, which would
      // otherwise push Monday to column 4 and expose the prior week's Friday-Sunday.
      const isMonday = date === getMondayStart(date);
      const shouldCenter =
        centerOnMobile &&
        !isMonday &&
        window.matchMedia("(max-width: 760px)").matches;
      const unclampedLeft = shouldCenter
        ? getCalendarScrollLeftForCenteredDate({
            dateColumnScrollLeft,
            viewportWidth: viewport.clientWidth,
            dayColumnWidth,
          })
        : dateColumnScrollLeft;
      const canvasWidth = Math.max(
        viewport.scrollWidth,
        getCalendarCanvasWidth({
          dayCount: dates.length,
          viewportWidth: viewport.clientWidth,
        }),
      );
      const left = Math.min(
        unclampedLeft,
        Math.max(0, canvasWidth - viewport.clientWidth),
      );

      if (behavior === "auto") {
        viewport.scrollLeft = left;
      } else {
        viewport.scrollTo({ left, behavior });
      }
      return left;
    },
    [dates.length, getDateColumnLeft, measureDayColumnWidth],
  );

  const positionLayoutAnchor = useCallback(
    (
      viewport: HTMLDivElement,
      anchorDate: string,
      anchorDayOffset: number | null,
      centerOnMobile = false,
    ) => {
      if (anchorDayOffset === null) {
        positionDateColumn(viewport, anchorDate, "auto", centerOnMobile);
        return;
      }

      viewport.scrollLeft = getCalendarScrollLeftForDayOffset({
        dayOffset: anchorDayOffset,
        dayColumnWidth: measureDayColumnWidth(viewport),
      });
    },
    [measureDayColumnWidth, positionDateColumn],
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
    layoutAnchorDayOffsetRef.current = null;
    layoutAnchorCenterOnMobileRef.current = false;
    isRestoringLayoutRef.current = false;
  }, []);

  const cancelMomentumStop = useCallback(() => {
    if (momentumStopSettleTimerRef.current !== null) {
      window.clearTimeout(momentumStopSettleTimerRef.current);
      momentumStopSettleTimerRef.current = null;
    }
    momentumStopAnchorDateRef.current = null;
  }, []);

  // --- Trackpad momentum lock ---
  // Trackpad inertia continues dispatching wheel/scroll events for hundreds of
  // milliseconds after user input ends. When "Today" is clicked, we lock the
  // viewport to the target date and absorb residual events. The lock releases
  // only after 160ms of silence — each new inertial event resets the timer.
  const releaseMomentumStopAfterScrollSettles = useCallback(
    (anchorDate: string) => {
      if (momentumStopSettleTimerRef.current !== null) {
        window.clearTimeout(momentumStopSettleTimerRef.current);
      }

      // Today is allowed to cancel trackpad momentum. Release that one-purpose
      // lock as soon as residual events have been quiet for a short interval.
      momentumStopSettleTimerRef.current = window.setTimeout(() => {
        momentumStopSettleTimerRef.current = null;
        if (momentumStopAnchorDateRef.current !== anchorDate) {
          return;
        }
        momentumStopAnchorDateRef.current = null;
      }, MOMENTUM_STOP_SETTLE_DELAY_MS);
    },
    [],
  );

  // --- Multi-frame sidebar reflow protection ---
  // Sidebar toggles change flexbox layout, causing the browser to dispatch
  // synthetic scroll events during reflow. This 3-tier rAF cascade applies
  // the anchor position, re-applies after layout settles, then holds a guard
  // frame. The final extra guard catches the scroll event that browsers often
  // dispatch *after* the frame where scrollLeft was assigned.
  const restoreDateAfterLayout = useCallback(
    (
      viewport: HTMLDivElement,
      anchorDate: string,
      anchorDayOffset: number | null = null,
      centerOnMobile = false,
    ) => {
      cancelLayoutRestore();
      layoutAnchorDateRef.current = anchorDate;
      layoutAnchorDayOffsetRef.current = anchorDayOffset;
      layoutAnchorCenterOnMobileRef.current = centerOnMobile;
      isRestoringLayoutRef.current = true;
      positionLayoutAnchor(
        viewport,
        anchorDate,
        anchorDayOffset,
        centerOnMobile,
      );

      // Reapply through the next paints so browser-generated scroll events from
      // the flex reflow cannot overwrite the logical day offset.
      layoutRestoreFrameRef.current = requestAnimationFrame(() => {
        layoutRestoreFrameRef.current = null;
        const settledViewport = scrollViewportRef.current;
        if (!settledViewport || layoutAnchorDateRef.current !== anchorDate) {
          cancelLayoutRestore();
          return;
        }
        positionLayoutAnchor(
          settledViewport,
          anchorDate,
          anchorDayOffset,
          centerOnMobile,
        );
        layoutRestorePaintFrameRef.current = requestAnimationFrame(() => {
          layoutRestorePaintFrameRef.current = null;
          const paintedViewport = scrollViewportRef.current;
          if (paintedViewport && layoutAnchorDateRef.current === anchorDate) {
            positionLayoutAnchor(
              paintedViewport,
              anchorDate,
              anchorDayOffset,
              centerOnMobile,
            );
            // The CSS-sized canvas and its date columns are now committed.
            // Record this settled width so the next genuine user scroll is not
            // mistaken for another resize and snapped back to the anchor.
            previousDayColumnWidthRef.current =
              measureDayColumnWidth(paintedViewport);
            // Keep the transaction alive for one more paint. Browsers can
            // dispatch the scroll event caused by assigning scrollLeft after
            // this callback returns; releasing here would let that event
            // publish the transient range and move CalendarShell's target.
            layoutRestorePaintFrameRef.current = requestAnimationFrame(() => {
              layoutRestorePaintFrameRef.current = null;
              if (layoutAnchorDateRef.current !== anchorDate) {
                return;
              }
              layoutAnchorDateRef.current = null;
              layoutAnchorDayOffsetRef.current = null;
              isRestoringLayoutRef.current = false;
            });
          } else {
            cancelLayoutRestore();
          }
        });
      });
    },
    [
      cancelLayoutRestore,
      measureDayColumnWidth,
      positionLayoutAnchor,
    ],
  );

  const captureSidebarLayoutAnchor = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || view !== "week") {
      return;
    }

    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    if (windowResetFrameRef.current !== null) {
      cancelAnimationFrame(windowResetFrameRef.current);
      windowResetFrameRef.current = null;
    }

    // A sidebar toggle can arrive in the same frame as the two-week recycler.
    // The rendered date anchor below supersedes that pending compensation; if
    // it were left alive, the next genuine scroll could apply the old shift a
    // second time and advance the visible calendar by another fortnight.
    pendingScrollAdjustmentDaysRef.current = 0;
    isShiftingWindowRef.current = false;
    windowShiftAnchorDateRef.current = null;
    windowShiftAnchorColumnOffsetRef.current = null;

    // Read the current rendered canvas instead of a cached width. The cached
    // value can belong to the opposite sidebar state when a browser delivers
    // ResizeObserver and requestAnimationFrame callbacks in a different order.
    const dayColumnWidth = measureDayColumnWidth(viewport);
    const visibleRange = getVisibleCalendarRange({
      windowStart: resolvedWindowStart,
      scrollLeft: viewport.scrollLeft,
      dayColumnWidth,
    });
    const dayOffset = getCalendarScrollOffsetInDays({
      scrollLeft: viewport.scrollLeft,
      dayColumnWidth,
    });

    // This runs before the sidebar state changes, while scrollLeft still has
    // its original meaning. The browser may clamp or reinterpret scrollLeft
    // during the flex reflow, so capturing it after React removes/adds the
    // sidebar loses the exact date under the viewport.
    layoutAnchorDateRef.current = visibleRange.startDate;
    layoutAnchorDayOffsetRef.current = dayOffset;
    layoutAnchorCenterOnMobileRef.current = false;
    lastVisibleRangeRef.current = visibleRange;
    isRestoringLayoutRef.current = true;
    // Sidebar visibility is presentation-only. Publishing this range here
    // would turn a flex reflow into a CalendarShell target-date update, which
    // can recycle the bounded window while the captured anchor is restoring.
  }, [
    measureDayColumnWidth,
    resolvedWindowStart,
    view,
  ]);

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
      // A flex resize can dispatch its scroll event after the final
      // requestAnimationFrame that restored the anchor. Keep the shell from
      // adopting that transient range; the next real gesture will publish it
      // once the layout transaction has been released.
      if (
        isRestoringLayoutRef.current ||
        layoutAnchorDateRef.current !== null
      ) {
        return range;
      }
      if (!isViewPositioning && rangeKey !== lastReportedRangeKeyRef.current) {
        lastReportedRangeKeyRef.current = rangeKey;
        onVisibleRangeChange(range);
      }

      return range;
    },
    [
      measureDayColumnWidth,
      onVisibleRangeChange,
      resolvedWindowStart,
      isViewPositioning,
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

      // Recycling changes the rendered date nodes but not their width. Any
      // restore scheduled by the same layout pass belongs to the old window;
      // letting it run after compensation reinterprets the current scrollLeft
      // as the old date offset and jumps several weeks ahead.
      if (
        isShiftingWindowRef.current ||
        pendingScrollAdjustmentDaysRef.current !== 0
      ) {
        cancelLayoutRestore();
        previousDayColumnWidthRef.current = nextWidth;
        return;
      }

      if (isViewPositioning) {
        // A view transition owns the positioning transaction. ResizeObserver
        // can run between its frames; record the new width, but never cancel
        // the transition restore or start a competing sidebar restore here.
        previousDayColumnWidthRef.current = nextWidth;
        return;
      }

      if (
        previousWidth !== null &&
        Math.abs(previousWidth - nextWidth) >= 0.01
      ) {
        if (scrollFrameRef.current !== null) {
          cancelAnimationFrame(scrollFrameRef.current);
          scrollFrameRef.current = null;
        }
        lastReportedRangeKeyRef.current = `${lastVisibleRangeRef.current.startDate}:${lastVisibleRangeRef.current.endDate}`;
        const anchorDayOffset =
          layoutAnchorDayOffsetRef.current ??
          getCalendarScrollOffsetInDays({
            scrollLeft: viewport.scrollLeft,
            dayColumnWidth: previousWidth,
          });

        const restoreAnchorDate =
          layoutAnchorDateRef.current ??
          lastVisibleRangeRef.current.startDate;
        const isMondayAnchor =
          restoreAnchorDate === getMondayStart(restoreAnchorDate);

        if (layoutAnchorDayOffsetRef.current !== null) {
          // A sidebar click captured the logical offset before flex reflow.
          // Reapply it directly to the CSS-sized canvas and leave the existing
          // transaction alive; restarting it here creates competing restorers.
          positionLayoutAnchor(
            viewport,
            restoreAnchorDate,
            anchorDayOffset,
            !isMondayAnchor && layoutAnchorCenterOnMobileRef.current,
          );
        } else {
          const centerOnMobile =
            !isMondayAnchor &&
            layoutAnchorCenterOnMobileRef.current &&
            layoutAnchorDateRef.current !== null;
          restoreDateAfterLayout(
            viewport,
            restoreAnchorDate,
            centerOnMobile ? null : anchorDayOffset,
            centerOnMobile,
          );
        }
      }

      previousDayColumnWidthRef.current = nextWidth;
    };
    const resizeObserver = new ResizeObserver(preserveVisibleDate);

    resizeObserver.observe(viewport);
    preserveVisibleDate();
    return () => resizeObserver.disconnect();
  }, [
    cancelLayoutRestore,
    isViewPositioning,
    measureDayColumnWidth,
    positionLayoutAnchor,
    restoreDateAfterLayout,
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

    // Sidebar visibility changes are layout-only. The CSS canvas has already
    // resized in this commit, so this is the only effect that owns restoring
    // the pre-click logical day offset.
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

    lastReportedRangeKeyRef.current = `${lastVisibleRangeRef.current.startDate}:${lastVisibleRangeRef.current.endDate}`;
    const anchorDayOffset =
      layoutAnchorDayOffsetRef.current ??
      getCalendarDayOffset(
        resolvedWindowStart,
        lastVisibleRangeRef.current.startDate,
      );
    restoreDateAfterLayout(
      viewport,
      lastVisibleRangeRef.current.startDate,
      anchorDayOffset,
    );
  }, [
    isSidebarOpen,
    isViewPositioning,
    measureDayColumnWidth,
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
      const enteredDayView = previousViewRef.current !== view;

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
      windowShiftAnchorDateRef.current = null;
      windowShiftAnchorColumnOffsetRef.current = null;
      // Day view is a new navigation context. Remove both sidebar restoration
      // frames so a fast Week -> Day -> Week toggle cannot replay an old offset.
      cancelLayoutRestore();
      viewport.scrollLeft = 0;
      shouldPositionImmediatelyRef.current = true;
      lastPositionedTargetRef.current = null;
      previousDayColumnWidthRef.current = null;
      previousStopScrollRequestIdRef.current = stopScrollRequestId;
      previousViewRef.current = view;
      reportVisibleRange(viewport);

      if (enteredDayView && isViewPositioning) {
        // Day view does not need horizontal positioning, but it still needs
        // two paints before the transition cover is removed. This prevents the
        // old Week header or schedule from flashing during the view switch.
        viewRevealFrameRef.current = requestAnimationFrame(() => {
          viewRevealFrameRef.current = null;
          viewRevealPaintFrameRef.current = requestAnimationFrame(() => {
            viewRevealPaintFrameRef.current = null;
            onViewPositioned();
          });
        });
      }
      return;
    }

    const enteredWeekView = previousViewRef.current !== "week";
    const hasExplicitPositionRequest =
      previousPositionRequestIdRef.current !== positionRequestId;
    const shouldStopMomentum =
      previousStopScrollRequestIdRef.current !== stopScrollRequestId;
    previousPositionRequestIdRef.current = positionRequestId;
    previousStopScrollRequestIdRef.current = stopScrollRequestId;
    previousViewRef.current = view;
    const dayColumnWidth = measureDayColumnWidth(viewport);
    const forcePosition =
      enteredWeekView || isViewPositioning || hasExplicitPositionRequest;
    const shouldCenterTodayOnMobile =
      !enteredWeekView &&
      !isViewPositioning &&
      shouldStopMomentum &&
      view === "week" &&
      activeDate !== getMondayStart(activeDate) &&
      window.matchMedia("(max-width: 760px)").matches;
    const positionTargetDate = shouldCenterTodayOnMobile
      ? activeDate
      : targetDate;

    if (
      isRestoringLayoutRef.current &&
      shouldCancelCalendarResizeRestore({
        forcePosition,
      })
    ) {
      // Previous/Next, Today, MiniCalendar, and view changes can arrive before
      // the sidebar's render-time restore finishes. The explicit navigation
      // request must replace that old layout anchor.
      cancelLayoutRestore();
    }

    if (windowNeedsReset) {
      // The render already uses the target's centered window. Persist it before
      // paint so switching back from a distant Day view never shows old dates.
      shouldPositionImmediatelyRef.current = true;
      // A window recycle also renders through this branch for one commit while
      // the shell adopts the newly visible range. Keep its pending compensation
      // intact; clearing it here leaves the viewport at the old pixel offset and
      // causes every subsequent scroll frame to recycle another full fortnight.
      if (!isShiftingWindowRef.current) {
        pendingScrollAdjustmentDaysRef.current = 0;
        isShiftingWindowRef.current = false;
        windowShiftAnchorDateRef.current = null;
        windowShiftAnchorColumnOffsetRef.current = null;
      }
      if (windowResetFrameRef.current === null) {
        windowResetFrameRef.current = requestAnimationFrame(() => {
          windowResetFrameRef.current = null;
          setWindowStart(resolvedWindowStart);
        });
      }
    }

    if (forcePosition) {
      // View changes are navigation commands, not continuation of the old
      // horizontal gesture. Position the requested period before the browser
      // paints; Today may use the active date as the mobile focus column.
      pendingScrollAdjustmentDaysRef.current = 0;
      isShiftingWindowRef.current = false;
      windowShiftAnchorDateRef.current = null;
      windowShiftAnchorColumnOffsetRef.current = null;
      cancelMomentumStop();
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      if (viewRevealFrameRef.current !== null) {
        cancelAnimationFrame(viewRevealFrameRef.current);
        viewRevealFrameRef.current = null;
      }
      if (viewRevealPaintFrameRef.current !== null) {
        cancelAnimationFrame(viewRevealPaintFrameRef.current);
        viewRevealPaintFrameRef.current = null;
      }
      const positionTarget = (
        targetViewport: HTMLDivElement,
      ) => {
        positionDateColumn(
          targetViewport,
          positionTargetDate,
          "auto",
          shouldCenterTodayOnMobile,
        );
      };

      if (shouldStopMomentum) {
        momentumStopAnchorDateRef.current = positionTargetDate;
      }
      restoreDateAfterLayout(
        viewport,
        positionTargetDate,
        null,
        shouldCenterTodayOnMobile,
      );
      if (shouldStopMomentum) {
        releaseMomentumStopAfterScrollSettles(positionTargetDate);
      }
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
            const paintedViewport = scrollViewportRef.current;
            if (paintedViewport) {
              // Reapply after the canvas has completed its second layout pass.
              // This is the final Monday-to-Sunday positioning write before
              // the transition cover is released.
              positionTarget(paintedViewport);
            }
            // CalendarShell owns the requested range for this transaction.
            // Do not measure the recycled canvas from this older render here:
            // it can still describe the pre-transition window and poison the
            // next Day/Week switch with stale dates.
            onViewPositioned();
          });
        });
      }
      return;
    }

    if (pendingScrollAdjustmentDaysRef.current !== 0) {
      const shiftAnchorDate = windowShiftAnchorDateRef.current;
      const shiftAnchorColumnOffset =
        windowShiftAnchorColumnOffsetRef.current;
      const renderedShiftAnchor = shiftAnchorDate
        ? dateColumnRefs.current.get(shiftAnchorDate)
        : null;

      if (renderedShiftAnchor && shiftAnchorColumnOffset !== null) {
        // The window may have been recycled after a sidebar resize. Restore
        // from the rendered date instead of applying a stale pixel correction
        // based on the previous column width.
        viewport.scrollLeft =
          getCalendarDateColumnScrollLeft(renderedShiftAnchor.offsetLeft) -
          shiftAnchorColumnOffset;
      } else {
        viewport.scrollLeft +=
          pendingScrollAdjustmentDaysRef.current * dayColumnWidth;
      }
      pendingScrollAdjustmentDaysRef.current = 0;
      isShiftingWindowRef.current = false;
      windowShiftAnchorDateRef.current = null;
      windowShiftAnchorColumnOffsetRef.current = null;
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
      // Re-anchor from the fractional day offset. The browser can now stretch
      // the columns without keeping a stale pixel-based scroll position.
      restoreDateAfterLayout(
        viewport,
        lastVisibleRangeRef.current.startDate,
        getCalendarScrollOffsetInDays({
          scrollLeft: viewport.scrollLeft,
          dayColumnWidth: previousDayColumnWidth,
        }),
      );
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
    activeDate,
    cancelMomentumStop,
    cancelLayoutRestore,
    isViewPositioning,
    measureDayColumnWidth,
    onViewPositioned,
    positionDateColumn,
    positionRequestId,
    releaseMomentumStopAfterScrollSettles,
    restoreDateAfterLayout,
    stopScrollRequestId,
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
      if (momentumStopSettleTimerRef.current !== null) {
        window.clearTimeout(momentumStopSettleTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || view !== "week") {
      return;
    }

    const stopResidualWheelMomentum = (event: WheelEvent) => {
      const anchorDate = momentumStopAnchorDateRef.current;
      if (!anchorDate) {
        return;
      }

      // A non-passive listener is intentional here: after Today is clicked,
      // remaining trackpad wheel events must not move the viewport away from
      // that date before their momentum naturally ends.
      event.preventDefault();
      positionDateColumn(viewport, anchorDate, "auto", true);
      releaseMomentumStopAfterScrollSettles(anchorDate);
    };

    viewport.addEventListener("wheel", stopResidualWheelMomentum, {
      passive: false,
    });
    return () =>
      viewport.removeEventListener("wheel", stopResidualWheelMomentum);
  }, [positionDateColumn, releaseMomentumStopAfterScrollSettles, view]);

  const handleScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>) => {
      if (view !== "week") {
        return;
      }

      const viewport = event.currentTarget;
      const momentumStopAnchorDate = momentumStopAnchorDateRef.current;
      if (momentumStopAnchorDate) {
        positionDateColumn(viewport, momentumStopAnchorDate, "auto", true);
        releaseMomentumStopAfterScrollSettles(momentumStopAnchorDate);
        return;
      }

      if (
        isRestoringLayoutRef.current ||
        layoutAnchorDateRef.current !== null
      ) {
        // Ignore only the browser-generated scroll caused by the two-frame
        // sidebar reflow. This state never blocks normal wheel input afterward.
        const anchorDate =
          layoutAnchorDateRef.current ??
          lastVisibleRangeRef.current.startDate;
        positionLayoutAnchor(
          viewport,
          anchorDate,
          layoutAnchorDayOffsetRef.current,
          layoutAnchorCenterOnMobileRef.current,
        );
        return;
      }

      if (isViewPositioning || scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const dayColumnWidth = measureDayColumnWidth(viewport);
        const previousDayColumnWidth =
          previousDayColumnWidthRef.current;

        if (
          isRestoringLayoutRef.current ||
          layoutAnchorDateRef.current !== null
        ) {
          // Ignore the browser-generated scroll event from the resize. It must
          // never be mistaken for a horizontal navigation gesture.
          const anchorDate =
            layoutAnchorDateRef.current ??
            lastVisibleRangeRef.current.startDate;
          positionLayoutAnchor(
            viewport,
            anchorDate,
            layoutAnchorDayOffsetRef.current,
            layoutAnchorCenterOnMobileRef.current,
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
            getCalendarScrollOffsetInDays({
              scrollLeft: viewport.scrollLeft,
              dayColumnWidth: previousDayColumnWidth,
            }),
          );
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
        cancelLayoutRestore();
        isShiftingWindowRef.current = true;
        pendingScrollAdjustmentDaysRef.current =
          -shiftDirection * CALENDAR_WINDOW_SHIFT_DAYS;
        windowShiftAnchorDateRef.current = visibleRange.startDate;
        const renderedShiftAnchor = dateColumnRefs.current.get(
          visibleRange.startDate,
        );
        windowShiftAnchorColumnOffsetRef.current = renderedShiftAnchor
          ? getCalendarDateColumnScrollLeft(renderedShiftAnchor.offsetLeft) -
            viewport.scrollLeft
          : null;
        setWindowStart(
          addCalendarDays(
            resolvedWindowStart,
            shiftDirection * CALENDAR_WINDOW_SHIFT_DAYS,
          ),
        );
      });
    }, [
      cancelLayoutRestore,
      isViewPositioning,
      measureDayColumnWidth,
      positionLayoutAnchor,
      positionDateColumn,
      releaseMomentumStopAfterScrollSettles,
      reportVisibleRange,
      resolvedWindowStart,
      restoreDateAfterLayout,
      view,
    ],
  );

  return {
    captureSidebarLayoutAnchor,
    dates,
    handleScroll,
    scrollViewportRef,
    setDateColumnRef,
  };
}
