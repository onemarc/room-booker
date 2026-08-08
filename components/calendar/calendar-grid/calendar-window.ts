import { addCalendarDays, getMondayStart, parseCalendarDate, type CalendarView } from "../../../lib/time.ts";

export const CALENDAR_TIME_COLUMN_WIDTH = 62;
export const CALENDAR_DEFAULT_DAY_COLUMN_WIDTH = 180;
export const CALENDAR_MIN_DAY_COLUMN_WIDTH = 94;
export const CALENDAR_VISIBLE_DAY_COUNT = 7;
export const CALENDAR_WEEK_BUFFER = 3;
export const CALENDAR_WINDOW_WEEK_COUNT = CALENDAR_WEEK_BUFFER * 2 + 1;
export const CALENDAR_WINDOW_DAY_COUNT = CALENDAR_WINDOW_WEEK_COUNT * 7;
export const CALENDAR_WINDOW_SHIFT_WEEKS = 2;
export const CALENDAR_WINDOW_SHIFT_DAYS = CALENDAR_WINDOW_SHIFT_WEEKS * 7;
export const CALENDAR_EVENT_PREFETCH_WEEK_COUNT = 2;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function getCalendarDayOffset(fromDate: string, toDate: string) {
  const from = parseCalendarDate(fromDate);
  const to = parseCalendarDate(toDate);
  const fromTime = Date.UTC(from.year, from.month - 1, from.day);
  const toTime = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toTime - fromTime) / DAY_IN_MILLISECONDS);
}

export function getCalendarWindowStart(activeDate: string) {
  return addCalendarDays(
    getMondayStart(activeDate),
    -CALENDAR_WEEK_BUFFER * 7,
  );
}

export function resolveCalendarWindowStart(
  currentWindowStart: string,
  targetDate: string,
) {
  const targetOffset = getCalendarDayOffset(
    currentWindowStart,
    targetDate,
  );
  const targetFitsWindow =
    targetOffset >= 0 &&
    targetOffset <=
      CALENDAR_WINDOW_DAY_COUNT - CALENDAR_VISIBLE_DAY_COUNT;

  return targetFitsWindow
    ? currentWindowStart
    : getCalendarWindowStart(targetDate);
}

export function getCalendarWindowDates(windowStart: string) {
  return Array.from({ length: CALENDAR_WINDOW_DAY_COUNT }, (_, index) =>
    addCalendarDays(windowStart, index),
  );
}

export function getCalendarWindowWeekStarts(activeDate: string) {
  const windowStart = getCalendarWindowStart(activeDate);
  return Array.from({ length: CALENDAR_WINDOW_WEEK_COUNT }, (_, index) =>
    addCalendarDays(windowStart, index * 7),
  );
}

export function getCalendarEventPrefetchPeriodDates({
  visibleStartDate,
  visibleEndDate,
}: {
  visibleStartDate: string;
  visibleEndDate: string;
}) {
  const visibleStartWeek = getMondayStart(visibleStartDate);
  const visibleEndWeek = getMondayStart(visibleEndDate);
  const periodDates = Array.from(
    new Set([visibleStartWeek, visibleEndWeek]),
  );

  // Keep one adjacent week ready even when the seven-day viewport begins and
  // ends inside the same server period. Each period is fetched separately
  // because the schedule endpoint intentionally caps a request at one week.
  while (periodDates.length < CALENDAR_EVENT_PREFETCH_WEEK_COUNT) {
    periodDates.push(
      addCalendarDays(
        visibleStartWeek,
        periodDates.length * CALENDAR_VISIBLE_DAY_COUNT,
      ),
    );
  }

  return periodDates;
}

export type VisibleCalendarRange = {
  startDate: string;
  endDate: string;
};

export function getCalendarViewTransitionTarget({
  activeDate,
  currentView,
  nextView,
  visibleStartDate,
}: {
  activeDate: string;
  currentView: CalendarView;
  nextView: CalendarView;
  visibleStartDate: string;
}) {
  // Day navigation moves the viewport without changing selectedDate. Anchor a
  // Day -> Week transition to the date the user is actually looking at, while
  // preserving the selected/today behavior used when entering Day view.
  const contextDate =
    currentView === "day" ? visibleStartDate : activeDate;

  return nextView === "week"
    ? getMondayStart(contextDate)
    : contextDate;
}

export function shouldPositionCalendarTarget({
  lastPositionedTarget,
  targetDate,
  visibleStartDate,
  forcePosition = false,
}: {
  lastPositionedTarget: string | null;
  targetDate: string;
  visibleStartDate: string;
  forcePosition?: boolean;
}) {
  return (
    forcePosition ||
    (lastPositionedTarget !== targetDate &&
      (lastPositionedTarget === null || targetDate !== visibleStartDate))
  );
}

export function shouldCancelCalendarResizeRestore({
  forcePosition,
}: {
  forcePosition: boolean;
}) {
  // Gesture-reported ranges can continue changing during trackpad momentum.
  // Only an explicit navigation request may replace the protected resize
  // anchor; passive target-date drift must not cancel it.
  return forcePosition;
}

export function getCalendarDayColumnWidth(viewportWidth: number) {
  return Math.max(
    CALENDAR_MIN_DAY_COLUMN_WIDTH,
    (viewportWidth - CALENDAR_TIME_COLUMN_WIDTH) /
      CALENDAR_VISIBLE_DAY_COUNT,
  );
}

export function getRenderedCalendarDayColumnWidth({
  dayCount,
  scrollWidth,
}: {
  dayCount: number;
  scrollWidth: number;
}) {
  if (dayCount <= 0) {
    return CALENDAR_DEFAULT_DAY_COLUMN_WIDTH;
  }

  return Math.max(
    CALENDAR_MIN_DAY_COLUMN_WIDTH,
    (scrollWidth - CALENDAR_TIME_COLUMN_WIDTH) / dayCount,
  );
}

export function getCalendarCanvasWidth({
  dayCount,
  viewportWidth,
}: {
  dayCount: number;
  viewportWidth: number;
}) {
  const minimumWidth =
    CALENDAR_TIME_COLUMN_WIDTH +
    dayCount * CALENDAR_MIN_DAY_COLUMN_WIDTH;

  if (viewportWidth <= 0) {
    return minimumWidth;
  }

  // Model the numeric geometry used by scroll calculations and regression
  // tests. The live grid uses the responsive CSS helper below so a sidebar
  // reflow does not require a second React render before columns resize.
  return Math.max(
    minimumWidth,
    CALENDAR_TIME_COLUMN_WIDTH +
      dayCount * getCalendarDayColumnWidth(viewportWidth),
  );
}

// The CSS calc() expression sizes the 49-day canvas relative to the scroll
// viewport so columns resize in the same layout pass as a sidebar toggle —
// no ResizeObserver → React state → second render cycle needed.
// viewportScale = 49/7 = 7 means the canvas occupies 700% of viewport width.
// timeRailCorrection subtracts the extra 62px time rails that would appear
// if each of the 7 viewport-widths had its own rail (only one is rendered).
// Result: max(minimumWidth, 700% - 372px)
export function getResponsiveCalendarCanvasWidth(dayCount: number) {
  const minimumWidth =
    CALENDAR_TIME_COLUMN_WIDTH + dayCount * CALENDAR_MIN_DAY_COLUMN_WIDTH;
  const viewportScale = dayCount / CALENDAR_VISIBLE_DAY_COUNT;
  const timeRailCorrection =
    CALENDAR_TIME_COLUMN_WIDTH * (viewportScale - 1);

  // Resolve the buffered canvas directly from its scroll viewport. This lets
  // the browser resize all date columns in the same layout pass as the sidebar,
  // instead of waiting for ResizeObserver -> React state -> a second render.
  return `max(${minimumWidth}px, calc(${viewportScale * 100}% - ${timeRailCorrection}px))`;
}

export function getDateScrollLeft({
  windowStart,
  targetDate,
  dayColumnWidth,
}: {
  windowStart: string;
  targetDate: string;
  dayColumnWidth: number;
}) {
  return Math.max(
    0,
    getCalendarDayOffset(windowStart, targetDate) * dayColumnWidth,
  );
}

export function getCalendarDateColumnScrollLeft(columnOffsetLeft: number) {
  // Date columns start after the sticky time rail. Anchoring from the rendered
  // column position lets CSS stretch the cells without reinterpreting an old
  // pixel offset as a different date.
  return Math.max(0, columnOffsetLeft - CALENDAR_TIME_COLUMN_WIDTH);
}

export function getCalendarScrollLeftForCenteredDate({
  dateColumnScrollLeft,
  viewportWidth,
  dayColumnWidth,
}: {
  dateColumnScrollLeft: number;
  viewportWidth: number;
  dayColumnWidth: number;
}) {
  const visibleDateAreaWidth = Math.max(
    0,
    viewportWidth - CALENDAR_TIME_COLUMN_WIDTH,
  );
  const centerOffset = Math.max(
    0,
    (visibleDateAreaWidth - dayColumnWidth) / 2,
  );

  return Math.max(0, dateColumnScrollLeft - centerOffset);
}

export function getCalendarScrollOffsetInDays({
  scrollLeft,
  dayColumnWidth,
}: {
  scrollLeft: number;
  dayColumnWidth: number;
}) {
  return dayColumnWidth > 0 ? Math.max(0, scrollLeft / dayColumnWidth) : 0;
}

export function getCalendarScrollLeftForDayOffset({
  dayOffset,
  dayColumnWidth,
}: {
  dayOffset: number;
  dayColumnWidth: number;
}) {
  return Math.max(0, dayOffset * dayColumnWidth);
}

export function getVisibleCalendarRange({
  windowStart,
  scrollLeft,
  dayColumnWidth,
}: {
  windowStart: string;
  scrollLeft: number;
  dayColumnWidth: number;
}): VisibleCalendarRange {
  // Advance the logical week when the next date's center crosses the viewport
  // edge. The recycled canvas may physically expose more than seven columns,
  // but Week view must always report one Monday-to-Sunday-sized range.
  const halfDayWidth = dayColumnWidth / 2;
  const firstVisibleDayIndex = Math.max(
    0,
    Math.min(
      CALENDAR_WINDOW_DAY_COUNT - 1,
      Math.floor((scrollLeft + halfDayWidth) / dayColumnWidth),
    ),
  );
  const lastVisibleDayIndex = Math.min(
    CALENDAR_WINDOW_DAY_COUNT - 1,
    firstVisibleDayIndex + CALENDAR_VISIBLE_DAY_COUNT - 1,
  );

  return {
    startDate: addCalendarDays(windowStart, firstVisibleDayIndex),
    endDate: addCalendarDays(windowStart, lastVisibleDayIndex),
  };
}

export function getCalendarWindowShiftDirection({
  windowStart,
  visibleStartDate,
}: {
  windowStart: string;
  visibleStartDate: string;
}): -1 | 0 | 1 {
  const visibleDateOffset = getCalendarDayOffset(
    windowStart,
    visibleStartDate,
  );
  const edgeBufferDays = CALENDAR_WINDOW_SHIFT_DAYS;

  if (visibleDateOffset < edgeBufferDays) {
    return -1;
  }

  if (
    visibleDateOffset >=
    CALENDAR_WINDOW_DAY_COUNT - edgeBufferDays
  ) {
    return 1;
  }

  return 0;
}
