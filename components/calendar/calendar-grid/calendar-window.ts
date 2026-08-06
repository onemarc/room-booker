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
  targetDate,
  visibleStartDate,
  forcePosition,
}: {
  targetDate: string;
  visibleStartDate: string;
  forcePosition: boolean;
}) {
  // A resize restoration is layout-only. Once the shell requests another
  // date or view, that navigation must win over any queued restoration frame.
  return forcePosition || targetDate !== visibleStartDate;
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

export function getCalendarCanvasWidthStyle(dayCount: number) {
  const minimumWidth =
    CALENDAR_TIME_COLUMN_WIDTH +
    dayCount * CALENDAR_MIN_DAY_COLUMN_WIDTH;
  const viewportScale = dayCount / CALENDAR_VISIBLE_DAY_COUNT;
  const timeColumnOffset =
    (viewportScale - 1) * CALENDAR_TIME_COLUMN_WIDTH;

  // Container units let the browser resize all columns in the same layout
  // pass. A ResizeObserver-driven React update would rebuild the 49-day grid
  // one frame later, which is visible when the sidebar changes its width.
  return `max(${minimumWidth}px, calc(${viewportScale * 100}cqw - ${timeColumnOffset}px))`;
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
