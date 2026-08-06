import assert from "node:assert/strict";
import test from "node:test";
import {
  CALENDAR_TIME_COLUMN_WIDTH,
  CALENDAR_WINDOW_DAY_COUNT,
  getCalendarCanvasWidthStyle,
  getCalendarDateColumnScrollLeft,
  getCalendarDayColumnWidth,
  getRenderedCalendarDayColumnWidth,
  getCalendarViewTransitionTarget,
  getCalendarWindowDates,
  getCalendarWindowShiftDirection,
  getCalendarWindowStart,
  getDateScrollLeft,
  getVisibleCalendarRange,
  resolveCalendarWindowStart,
  shouldCancelCalendarResizeRestore,
  shouldPositionCalendarTarget,
} from "./calendar-window.ts";

test("the calendar window keeps three weeks on each side of the active week", () => {
  const windowStart = getCalendarWindowStart("2026-08-05");
  const dates = getCalendarWindowDates(windowStart);

  assert.equal(windowStart, "2026-07-13");
  assert.equal(dates.length, CALENDAR_WINDOW_DAY_COUNT);
  assert.equal(dates.at(-1), "2026-08-30");
});

test("a distant Day target gets the correct Week window on its first render", () => {
  assert.equal(
    resolveCalendarWindowStart("2026-07-13", "2027-02-18"),
    "2027-01-25",
  );
  assert.equal(
    resolveCalendarWindowStart("2026-07-13", "2026-08-05"),
    "2026-07-13",
  );
});

test("Day to Week uses the displayed day instead of an older selected date", () => {
  assert.equal(
    getCalendarViewTransitionTarget({
      activeDate: "2026-07-29",
      currentView: "day",
      nextView: "week",
      visibleStartDate: "2026-08-04",
    }),
    "2026-08-03",
  );
});

test("Week positioning uses the rendered column width", () => {
  const windowStart = "2026-07-13";
  const dayColumnWidth = getRenderedCalendarDayColumnWidth({
    dayCount: CALENDAR_WINDOW_DAY_COUNT,
    scrollWidth:
      CALENDAR_TIME_COLUMN_WIDTH +
      CALENDAR_WINDOW_DAY_COUNT * 275,
  });
  const scrollLeft = getDateScrollLeft({
    windowStart,
    targetDate: "2026-08-03",
    dayColumnWidth,
  });

  assert.equal(dayColumnWidth, 275);
  assert.equal(
    getVisibleCalendarRange({
      windowStart,
      scrollLeft,
      dayColumnWidth,
    }).startDate,
    "2026-08-03",
  );
});

test("seven complete dates fit the available viewport without a trailing gap", () => {
  const windowStart = getCalendarWindowStart("2026-08-05");
  const viewportWidth = 1100;
  const dayColumnWidth = getCalendarDayColumnWidth(viewportWidth);
  const scrollLeft = getDateScrollLeft({
    windowStart,
    targetDate: "2026-08-04",
    dayColumnWidth,
  });

  assert.equal(
    CALENDAR_TIME_COLUMN_WIDTH + dayColumnWidth * 7,
    viewportWidth,
  );
  assert.deepEqual(
    getVisibleCalendarRange({
      windowStart,
      scrollLeft,
      dayColumnWidth,
    }),
    {
      startDate: "2026-08-04",
      endDate: "2026-08-10",
    },
  );
});

test("the week canvas width follows its scroll container without a React measurement", () => {
  assert.equal(
    getCalendarCanvasWidthStyle(CALENDAR_WINDOW_DAY_COUNT),
    "max(4668px, calc(700cqw - 372px))",
  );
});

test("stretching calendar columns keeps the same rendered date anchored", () => {
  const windowStart = "2026-07-13";
  const initialDayColumnWidth = 184.75;
  const resizedDayColumnWidth = 279.5;
  const anchoredDayOffset = 21;
  const initialScrollLeft = getCalendarDateColumnScrollLeft(
    CALENDAR_TIME_COLUMN_WIDTH + anchoredDayOffset * initialDayColumnWidth,
  );
  const resizedScrollLeft = getCalendarDateColumnScrollLeft(
    CALENDAR_TIME_COLUMN_WIDTH + anchoredDayOffset * resizedDayColumnWidth,
  );

  assert.equal(initialScrollLeft, anchoredDayOffset * initialDayColumnWidth);
  assert.equal(resizedScrollLeft, anchoredDayOffset * resizedDayColumnWidth);
  assert.deepEqual(
    getVisibleCalendarRange({
      windowStart,
      scrollLeft: resizedScrollLeft,
      dayColumnWidth: resizedDayColumnWidth,
    }),
    {
      startDate: "2026-08-03",
      endDate: "2026-08-09",
    },
  );
});

test("calendar navigation wins over an in-flight sidebar resize restore", () => {
  assert.equal(
    shouldCancelCalendarResizeRestore({
      targetDate: "2026-07-27",
      visibleStartDate: "2026-08-03",
      forcePosition: false,
    }),
    true,
  );
  assert.equal(
    shouldCancelCalendarResizeRestore({
      targetDate: "2026-08-03",
      visibleStartDate: "2026-08-03",
      forcePosition: true,
    }),
    true,
  );
  assert.equal(
    shouldCancelCalendarResizeRestore({
      targetDate: "2026-08-03",
      visibleStartDate: "2026-08-03",
      forcePosition: false,
    }),
    false,
  );
});

test("a thin edge sliver does not add an eighth highlighted date", () => {
  const windowStart = "2026-07-13";
  const viewportWidth = 1100;
  const dayColumnWidth = getCalendarDayColumnWidth(viewportWidth);

  assert.deepEqual(
    getVisibleCalendarRange({
      windowStart,
      scrollLeft: dayColumnWidth * 8.1,
      dayColumnWidth,
    }),
    {
      startDate: "2026-07-21",
      endDate: "2026-07-27",
    },
  );
});

test("the highlighted range advances after the next day is mostly visible", () => {
  const windowStart = "2026-07-13";
  const viewportWidth = 1100;
  const dayColumnWidth = getCalendarDayColumnWidth(viewportWidth);

  assert.deepEqual(
    getVisibleCalendarRange({
      windowStart,
      scrollLeft: dayColumnWidth * 8.6,
      dayColumnWidth,
    }),
    {
      startDate: "2026-07-22",
      endDate: "2026-07-28",
    },
  );
});

test("a gesture-reported target does not recenter to the page-load date", () => {
  assert.equal(
    shouldPositionCalendarTarget({
      lastPositionedTarget: "2026-08-03",
      targetDate: "2026-03-10",
      visibleStartDate: "2026-03-10",
    }),
    false,
  );
  assert.equal(
    shouldPositionCalendarTarget({
      lastPositionedTarget: "2026-08-03",
      targetDate: "2026-03-17",
      visibleStartDate: "2026-03-10",
    }),
    true,
  );
  assert.equal(
    shouldPositionCalendarTarget({
      lastPositionedTarget: "2026-08-03",
      targetDate: "2026-08-03",
      visibleStartDate: "2026-07-30",
      forcePosition: true,
    }),
    true,
  );
});

test("window recycling starts within the two-week edge buffers", () => {
  const windowStart = "2026-07-13";

  assert.equal(
    getCalendarWindowShiftDirection({
      windowStart,
      visibleStartDate: "2026-07-20",
    }),
    -1,
  );
  assert.equal(
    getCalendarWindowShiftDirection({
      windowStart,
      visibleStartDate: "2026-08-03",
    }),
    0,
  );
  assert.equal(
    getCalendarWindowShiftDirection({
      windowStart,
      visibleStartDate: "2026-08-17",
    }),
    1,
  );
});
