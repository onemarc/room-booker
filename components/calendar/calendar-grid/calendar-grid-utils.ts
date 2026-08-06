import { OFFICE_CLOSE_HOUR, OFFICE_OPEN_HOUR, OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { CALENDAR_SLOT_MINUTES, getZonedDateIso, getZonedDateTimeParts } from "@/lib/time";
import type { ScheduleBooking } from "@/lib/bookings";
import type { CalendarGridSelection, DragSelection } from "./types";

export const SLOT_COUNT = ((OFFICE_CLOSE_HOUR - OFFICE_OPEN_HOUR) * 60) / CALENDAR_SLOT_MINUTES;
export const OFFICE_WINDOW_MINUTES = (OFFICE_CLOSE_HOUR - OFFICE_OPEN_HOUR) * 60;
export const MAX_SELECTION_SLOTS = 8;

// A completed selection is normalized, while a live drag can extend in either
// direction and must be clamped to the API's four-hour maximum duration.
export function getSelectionBounds(selection: DragSelection | CalendarGridSelection) {
  if ("startIndex" in selection) return selection;
  let startIndex = Math.min(selection.anchorIndex, selection.currentIndex);
  let endIndex = Math.max(selection.anchorIndex, selection.currentIndex) + 1;
  if (endIndex - startIndex > MAX_SELECTION_SLOTS) {
    if (selection.currentIndex >= selection.anchorIndex) endIndex = startIndex + MAX_SELECTION_SLOTS;
    else startIndex = endIndex - MAX_SELECTION_SLOTS;
  }
  return { startIndex, endIndex };
}

export function getOfficeTime(rowIndex: number) {
  const totalMinutes = OFFICE_OPEN_HOUR * 60 + rowIndex * CALENDAR_SLOT_MINUTES;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Booking positions are calculated against office hours, then displayed under
// the calendar date in the viewer's timezone.
export function getBookingPosition(booking: ScheduleBooking, timeZone: string) {
  const start = getZonedDateTimeParts(booking.startAt, OFFICE_TIME_ZONE);
  const end = getZonedDateTimeParts(booking.endAt, OFFICE_TIME_ZONE);
  const startMinutes = start.hour * 60 + start.minute - OFFICE_OPEN_HOUR * 60;
  const endMinutes = end.hour * 60 + end.minute - OFFICE_OPEN_HOUR * 60;
  const clippedStart = Math.max(0, startMinutes);
  const clippedEnd = Math.min(OFFICE_WINDOW_MINUTES, endMinutes);
  return {
    date: getZonedDateIso(booking.startAt, timeZone),
    top: (clippedStart / OFFICE_WINDOW_MINUTES) * 100,
    height: (Math.max(0, clippedEnd - clippedStart) / OFFICE_WINDOW_MINUTES) * 100,
  };
}
