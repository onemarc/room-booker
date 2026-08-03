import {
  DEFAULT_BOOKING_COLOR,
  isAllowedWeeklyOccurrenceCount,
  isBookingColor,
  type BookingFieldErrors,
} from "@/lib/bookings";
import { HttpError } from "@/lib/server/http";
import {
  canonicalizeTimeZone,
  getBookingTimeViolation,
  localDateTimeToUtc,
  parseCalendarDate,
} from "@/lib/time";
import { isUuid } from "./identifiers";
import type { CreateBookingInput } from "./types";

const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINIMUM_DURATION_MINUTES = 30;
const MAXIMUM_DURATION_MINUTES = 4 * 60;

function requireString(
  value: unknown,
  field: keyof BookingFieldErrors,
  fieldErrors: BookingFieldErrors,
) {
  if (typeof value !== "string" || !value.trim()) {
    fieldErrors[field] = "This field is required.";
    return "";
  }

  return value.trim();
}

// Form input is checked before timezone conversion so callers receive precise
// field errors instead of a generic failure from a downstream date utility.
export function validateBookingInput(input: CreateBookingInput, now: Date) {
  const fieldErrors: BookingFieldErrors = {};
  const roomId = requireString(input.roomId, "roomId", fieldErrors);
  const title = requireString(input.title, "title", fieldErrors);
  const date = requireString(input.date, "date", fieldErrors);
  const endDate =
    typeof input.endDate === "string" && input.endDate.trim()
      ? input.endDate.trim()
      : date;
  const startTime = requireString(input.startTime, "startTime", fieldErrors);
  const endTime = requireString(input.endTime, "endTime", fieldErrors);
  const requestedTimeZone = requireString(
    input.timeZone,
    "timeZone",
    fieldErrors,
  );
  const requestedColor =
    input.color === undefined ? DEFAULT_BOOKING_COLOR : input.color;
  const recurrenceCount = input.recurrenceCount ?? 1;

  if (roomId && !isUuid(roomId)) fieldErrors.roomId = "Select an existing room.";
  if ([...title].length > 100) fieldErrors.title = "Use 100 characters or fewer.";

  for (const [value, field, message] of [
    [date, "date", "Choose a valid date."],
    [endDate, "endDate", "Choose a valid end date."],
  ] as const) {
    if (value) {
      try {
        parseCalendarDate(value);
      } catch {
        fieldErrors[field] = message;
      }
    }
  }

  if (startTime && !LOCAL_TIME_PATTERN.test(startTime)) {
    fieldErrors.startTime = "Choose a valid start time.";
  }
  if (endTime && !LOCAL_TIME_PATTERN.test(endTime)) {
    fieldErrors.endTime = "Choose a valid end time.";
  }

  let timeZone = "";
  if (requestedTimeZone) {
    try {
      timeZone = canonicalizeTimeZone(requestedTimeZone);
    } catch {
      fieldErrors.timeZone = "The selected timezone is invalid.";
    }
  }
  if (!isBookingColor(requestedColor)) {
    fieldErrors.color = "Choose an available booking color.";
  }
  if (!isAllowedWeeklyOccurrenceCount(recurrenceCount)) {
    fieldErrors.recurrenceCount =
      "Choose from 1 through 52 weekly occurrences.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new HttpError("Check the highlighted booking fields.", 400, fieldErrors, "validation_failed");
  }

  let startAt: Date;
  let endAt: Date;
  try {
    startAt = localDateTimeToUtc(date, startTime, timeZone);
  } catch {
    throw new HttpError("Check the highlighted booking fields.", 400, { startTime: "This local start time does not exist in the selected timezone." }, "validation_failed");
  }
  try {
    // The later occurrence on a DST fallback keeps a selected interval positive.
    endAt = localDateTimeToUtc(endDate, endTime, timeZone, "later");
  } catch {
    throw new HttpError("Check the highlighted booking fields.", 400, { endTime: "This local end time does not exist in the selected timezone." }, "validation_failed");
  }

  const timeViolation = getBookingTimeViolation(startAt, endAt, now);
  const violations = {
    invalid_order: ["The booking end must be after its start.", { endTime: "Choose an end time after the start time." }, "invalid_time_order"],
    not_on_slot_boundary: ["Bookings must begin and end on a 30-minute office boundary.", { startTime: "Choose a 30-minute office boundary.", endTime: "Choose a 30-minute office boundary." }, "invalid_slot_boundary"],
    outside_working_hours: ["Bookings must stay inside 09:00–19:00 Europe/Kyiv office hours.", { startTime: "Choose a time inside office hours.", endTime: "Choose a time inside office hours." }, "outside_working_hours"],
    not_in_future: ["Bookings must start in the future.", { startTime: "Choose a future start time." }, "time_in_past"],
  } as const;
  if (timeViolation) {
    const [message, errors, code] = violations[timeViolation];
    throw new HttpError(message, 400, errors, code);
  }

  const durationMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;
  if (durationMinutes < MINIMUM_DURATION_MINUTES || durationMinutes > MAXIMUM_DURATION_MINUTES) {
    throw new HttpError("Bookings must last from 30 minutes through 4 hours.", 400, { endTime: "Choose a duration from 30 minutes through 4 hours." }, "invalid_duration");
  }

  return {
    roomId,
    title,
    startAt,
    endAt,
    color: requestedColor,
    recurrenceCount: Number(recurrenceCount),
    date,
    endDate,
    startTime,
    endTime,
    timeZone,
  };
}
