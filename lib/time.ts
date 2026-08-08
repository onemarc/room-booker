import {
  OFFICE_CLOSE_HOUR,
  OFFICE_OPEN_HOUR,
  OFFICE_TIME_ZONE,
} from "./office.mjs";

export type CalendarView = "day" | "week";

export type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

export type ZonedDateTimeParts = CalendarDateParts & {
  hour: number;
  minute: number;
  second: number;
};

export type BookingTimeViolation =
  | "invalid_order"
  | "not_on_slot_boundary"
  | "outside_working_hours"
  | "not_in_future";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SLOT_MINUTES = 30;
const MINUTE_IN_MILLISECONDS = 60_000;
const DAY_IN_MILLISECONDS = 24 * 60 * MINUTE_IN_MILLISECONDS;
const ZONE_NAME_PATTERN = /^[A-Za-z0-9_+\-/]+$/;
const zonedPartsFormatters = new Map<string, Intl.DateTimeFormat>();
const canonicalTimeZones = new Map<string, string>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  const optionEntries = Object.entries(options).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const key = JSON.stringify([locale, optionEntries]);
  const cached = dateTimeFormatters.get(key);

  if (cached) {
    return cached;
  }

  // Calendar renders repeat a small set of formats across hundreds of cells.
  // Reusing Intl formatters avoids rebuilding ICU state for every label.
  const formatter = new Intl.DateTimeFormat(locale, options);
  dateTimeFormatters.set(key, formatter);
  return formatter;
}

function utcEpoch(parts: ZonedDateTimeParts) {
  const value = new Date(0);
  value.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  value.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return value.getTime();
}

function isSameDateTime(
  left: ZonedDateTimeParts,
  right: ZonedDateTimeParts,
) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function assertValidInstant(value: Date | string) {
  const instant =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("The timestamp must identify a valid instant.");
  }

  return instant;
}

function getZonedPartsFormatter(timeZone: string) {
  const cached = zonedPartsFormatters.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  zonedPartsFormatters.set(timeZone, formatter);
  return formatter;
}

function getOffsetAtInstant(timeZone: string, instant: Date) {
  const parts = getZonedDateTimeParts(instant, timeZone);
  const instantWithoutMilliseconds =
    Math.trunc(instant.getTime() / 1000) * 1000;

  return utcEpoch(parts) - instantWithoutMilliseconds;
}

export function canonicalizeTimeZone(value: string) {
  const timeZone = value.trim();

  if (
    !timeZone ||
    timeZone.length > 100 ||
    !ZONE_NAME_PATTERN.test(timeZone)
  ) {
    throw new RangeError("The timezone must be a valid IANA timezone.");
  }

  const cached = canonicalTimeZones.get(timeZone);
  if (cached) {
    return cached;
  }

  try {
    const resolved = new Intl.DateTimeFormat("en", {
      timeZone,
    }).resolvedOptions().timeZone;

    // Older ICU data reports the legacy alias even when the product's
    // canonical office identifier is Europe/Kyiv.
    const canonical =
      resolved === "Europe/Kiev" ? OFFICE_TIME_ZONE : resolved;
    canonicalTimeZones.set(timeZone, canonical);
    return canonical;
  } catch {
    throw new RangeError("The timezone must be a valid IANA timezone.");
  }
}

export function isValidIanaTimeZone(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  try {
    canonicalizeTimeZone(value);
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(
  value: unknown,
  fallback = OFFICE_TIME_ZONE,
) {
  return isValidIanaTimeZone(value)
    ? canonicalizeTimeZone(value)
    : canonicalizeTimeZone(fallback);
}

export function detectBrowserTimeZone() {
  try {
    return resolveTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      OFFICE_TIME_ZONE,
    );
  } catch {
    return OFFICE_TIME_ZONE;
  }
}

export function formatGmtOffset(
  timeZone: string,
  value: Date | string = new Date(),
) {
  const formatter = getDateTimeFormatter("en", {
    timeZone: canonicalizeTimeZone(timeZone),
    timeZoneName: "shortOffset",
  });
  const offset = formatter
    .formatToParts(assertValidInstant(value))
    .find((part) => part.type === "timeZoneName")?.value;

  return offset ?? "GMT";
}

export function formatCalendarTimeZoneNotice(
  timeZone: string,
  value: Date | string = new Date(),
) {
  const userTimeZone = canonicalizeTimeZone(timeZone);
  const officeTimeZone = canonicalizeTimeZone(OFFICE_TIME_ZONE);
  const userOffset = formatGmtOffset(userTimeZone, value);

  if (userTimeZone === officeTimeZone) {
    return userOffset;
  }

  return `${userOffset} · Office ${formatGmtOffset(officeTimeZone, value)}`;
}

export function parseCalendarDate(value: string): CalendarDateParts {
  const match = ISO_DATE_PATTERN.exec(value);

  if (!match) {
    throw new RangeError("The date must use YYYY-MM-DD format.");
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const probe = new Date(0);
  probe.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  probe.setUTCHours(0, 0, 0, 0);

  if (
    probe.getUTCFullYear() !== parts.year ||
    probe.getUTCMonth() !== parts.month - 1 ||
    probe.getUTCDate() !== parts.day
  ) {
    throw new RangeError("The date must identify a real calendar day.");
  }

  return parts;
}

export function calendarDateToIso(parts: CalendarDateParts) {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function addCalendarDays(value: string, amount: number) {
  const parts = parseCalendarDate(value);
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day + amount);
  date.setUTCHours(0, 0, 0, 0);

  return calendarDateToIso({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function addCalendarMonths(value: string, amount: number) {
  const parts = parseCalendarDate(value);
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1 + amount, 1);
  date.setUTCHours(0, 0, 0, 0);

  return calendarDateToIso({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: 1,
  });
}

export function startOfCalendarMonth(value: string) {
  const parts = parseCalendarDate(value);
  return calendarDateToIso({ ...parts, day: 1 });
}

export function getMondayStart(value: string) {
  const parts = parseCalendarDate(value);
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addCalendarDays(value, -mondayOffset);
}

export function getMonthCalendarDates(value: string) {
  const monthStart = startOfCalendarMonth(value);
  const gridStart = getMondayStart(monthStart);

  return Array.from({ length: 42 }, (_, index) =>
    addCalendarDays(gridStart, index),
  );
}

export function getZonedDateTimeParts(
  value: Date | string,
  timeZone: string,
): ZonedDateTimeParts {
  const instant = assertValidInstant(value);
  const canonicalTimeZone = canonicalizeTimeZone(timeZone);
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};

  for (const part of getZonedPartsFormatter(
    canonicalTimeZone,
  ).formatToParts(instant)) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
  };
}

export function getZonedDateIso(value: Date | string, timeZone: string) {
  return calendarDateToIso(getZonedDateTimeParts(value, timeZone));
}

export function zonedDateTimeToUtc(
  parts: ZonedDateTimeParts,
  timeZone: string,
  disambiguation: "earlier" | "later" = "earlier",
) {
  const date = calendarDateToIso(parts);
  parseCalendarDate(date);

  if (
    !Number.isInteger(parts.hour) ||
    !Number.isInteger(parts.minute) ||
    !Number.isInteger(parts.second) ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    parts.second < 0 ||
    parts.second > 59
  ) {
    throw new RangeError("The local time is invalid.");
  }

  const canonicalTimeZone = canonicalizeTimeZone(timeZone);
  const localEpoch = utcEpoch(parts);
  const offsets = new Set<number>();

  // Sampling both sides of the requested wall time captures offsets around
  // daylight-saving transitions without comparing formatted strings.
  for (
    let probe = localEpoch - 36 * 60 * MINUTE_IN_MILLISECONDS;
    probe <= localEpoch + 36 * 60 * MINUTE_IN_MILLISECONDS;
    probe += 6 * 60 * MINUTE_IN_MILLISECONDS
  ) {
    offsets.add(
      getOffsetAtInstant(canonicalTimeZone, new Date(probe)),
    );
  }

  const matches = [...offsets]
    .map((offset) => new Date(localEpoch - offset))
    .filter((candidate) =>
      isSameDateTime(
        getZonedDateTimeParts(candidate, canonicalTimeZone),
        parts,
      ),
    )
    .sort((left, right) => left.getTime() - right.getTime());

  if (matches.length === 0) {
    throw new RangeError(
      "The local time does not exist in the selected timezone.",
    );
  }

  return disambiguation === "later"
    ? matches[matches.length - 1]
    : matches[0];
}

export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
  disambiguation: "earlier" | "later" = "earlier",
) {
  const dateParts = parseCalendarDate(date);
  const match = LOCAL_TIME_PATTERN.exec(time);

  if (!match) {
    throw new RangeError("The time must use HH:mm format.");
  }

  return zonedDateTimeToUtc(
    {
      ...dateParts,
      hour: Number(match[1]),
      minute: Number(match[2]),
      second: 0,
    },
    timeZone,
    disambiguation,
  );
}

export function serializeUtcInstant(value: Date | string) {
  return assertValidInstant(value).toISOString();
}

export function formatUtcInstant(
  value: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-GB",
) {
  return getDateTimeFormatter(locale, {
    ...options,
    timeZone: canonicalizeTimeZone(timeZone),
  }).format(assertValidInstant(value));
}

export function formatTimeInZone(value: Date | string, timeZone: string) {
  return formatUtcInstant(
    value,
    timeZone,
    {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    "en-GB",
  );
}

export function getDayRangeUtc(date: string, timeZone: string) {
  return {
    start: localDateTimeToUtc(date, "00:00", timeZone),
    end: localDateTimeToUtc(
      addCalendarDays(date, 1),
      "00:00",
      timeZone,
    ),
  };
}

export function getWeekRangeUtc(date: string, timeZone: string) {
  const startDate = getMondayStart(date);

  return {
    start: localDateTimeToUtc(startDate, "00:00", timeZone),
    end: localDateTimeToUtc(
      addCalendarDays(startDate, 7),
      "00:00",
      timeZone,
    ),
  };
}

export function getPeriodRangeUtc(
  date: string,
  timeZone: string,
  view: CalendarView,
) {
  return view === "week"
    ? getWeekRangeUtc(date, timeZone)
    : getDayRangeUtc(date, timeZone);
}

export function getViewDates(date: string, view: CalendarView) {
  const start = view === "week" ? getMondayStart(date) : date;
  const count = view === "week" ? 7 : 1;

  return Array.from({ length: count }, (_, index) =>
    addCalendarDays(start, index),
  );
}

export function generateSlotBoundaries(
  start: Date | string,
  end: Date | string,
  stepMinutes = SLOT_MINUTES,
) {
  const startInstant = assertValidInstant(start);
  const endInstant = assertValidInstant(end);

  if (
    !Number.isInteger(stepMinutes) ||
    stepMinutes < 1 ||
    startInstant >= endInstant
  ) {
    throw new RangeError("The slot range is invalid.");
  }

  const step = stepMinutes * MINUTE_IN_MILLISECONDS;
  const boundaries: Date[] = [];

  for (
    let timestamp = startInstant.getTime();
    timestamp <= endInstant.getTime();
    timestamp += step
  ) {
    boundaries.push(new Date(timestamp));
  }

  return boundaries;
}

export function intervalsOverlap(
  start: Date | string,
  end: Date | string,
  otherStart: Date | string,
  otherEnd: Date | string,
) {
  const startTime = assertValidInstant(start).getTime();
  const endTime = assertValidInstant(end).getTime();
  const otherStartTime = assertValidInstant(otherStart).getTime();
  const otherEndTime = assertValidInstant(otherEnd).getTime();

  return startTime < otherEndTime && endTime > otherStartTime;
}

export function isOfficeSlotBoundary(value: Date | string) {
  const instant = assertValidInstant(value);
  const parts = getZonedDateTimeParts(instant, OFFICE_TIME_ZONE);
  return (
    instant.getUTCMilliseconds() === 0 &&
    parts.second === 0 &&
    parts.minute % SLOT_MINUTES === 0
  );
}

export function isWithinOfficeWindow(
  start: Date | string,
  end: Date | string,
) {
  const startParts = getZonedDateTimeParts(start, OFFICE_TIME_ZONE);
  const endParts = getZonedDateTimeParts(end, OFFICE_TIME_ZONE);
  const sameOfficeDate =
    startParts.year === endParts.year &&
    startParts.month === endParts.month &&
    startParts.day === endParts.day;
  const startMinutes = startParts.hour * 60 + startParts.minute;
  const endMinutes = endParts.hour * 60 + endParts.minute;

  return (
    sameOfficeDate &&
    startMinutes >= OFFICE_OPEN_HOUR * 60 &&
    endMinutes <= OFFICE_CLOSE_HOUR * 60
  );
}

export function getBookingTimeViolation(
  start: Date | string,
  end: Date | string,
  serverNow = new Date(),
): BookingTimeViolation | null {
  const startInstant = assertValidInstant(start);
  const endInstant = assertValidInstant(end);

  if (startInstant >= endInstant) {
    return "invalid_order";
  }

  if (
    !isOfficeSlotBoundary(startInstant) ||
    !isOfficeSlotBoundary(endInstant)
  ) {
    return "not_on_slot_boundary";
  }

  if (!isWithinOfficeWindow(startInstant, endInstant)) {
    return "outside_working_hours";
  }

  if (startInstant <= assertValidInstant(serverNow)) {
    return "not_in_future";
  }

  return null;
}

export function getOfficeSlotStartsWithinRange(
  start: Date | string,
  end: Date | string,
) {
  const rangeStart = assertValidInstant(start);
  const rangeEnd = assertValidInstant(end);

  if (rangeStart >= rangeEnd) {
    throw new RangeError("The availability range is invalid.");
  }

  const step = SLOT_MINUTES * MINUTE_IN_MILLISECONDS;
  const firstBoundary = Math.ceil(rangeStart.getTime() / step) * step;
  const starts: Date[] = [];

  for (
    let timestamp = firstBoundary;
    timestamp + step <= rangeEnd.getTime();
    timestamp += step
  ) {
    const slotStart = new Date(timestamp);
    const slotEnd = new Date(timestamp + step);

    if (
      isOfficeSlotBoundary(slotStart) &&
      isWithinOfficeWindow(slotStart, slotEnd)
    ) {
      starts.push(slotStart);
    }
  }

  return starts;
}

export function formatCalendarMonth(value: string) {
  const parts = parseCalendarDate(value);
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, 1);
  date.setUTCHours(12, 0, 0, 0);

  return getDateTimeFormatter("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatCalendarDay(
  value: string,
  options: Intl.DateTimeFormatOptions,
) {
  const parts = parseCalendarDate(value);
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(12, 0, 0, 0);

  return getDateTimeFormatter("en", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

export function formatPeriodLabel(value: string, view: CalendarView) {
  const dates = getViewDates(value, view);
  const first = parseCalendarDate(dates[0]);
  const last = parseCalendarDate(dates[dates.length - 1]);

  if (first.year === last.year && first.month === last.month) {
    return formatCalendarDay(dates[0], {
      month: "long",
      year: "numeric",
    });
  }

  if (first.year === last.year) {
    const firstMonth = formatCalendarDay(dates[0], { month: "short" });
    const lastMonth = formatCalendarDay(dates[dates.length - 1], {
      month: "short",
    });
    return `${firstMonth} – ${lastMonth} ${first.year}`;
  }

  const firstMonth = formatCalendarDay(dates[0], {
    month: "short",
    year: "numeric",
  });
  const lastMonth = formatCalendarDay(dates[dates.length - 1], {
    month: "short",
    year: "numeric",
  });
  return `${firstMonth} – ${lastMonth}`;
}

export const CALENDAR_SLOT_MINUTES = SLOT_MINUTES;
export const MILLISECONDS_PER_DAY = DAY_IN_MILLISECONDS;
