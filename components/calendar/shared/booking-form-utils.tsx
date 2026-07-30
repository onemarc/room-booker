import {
  formatTimeInZone,
  getDayRangeUtc,
  getOfficeSlotStartsWithinRange,
  getZonedDateIso,
} from "@/lib/time";

// Office-slot boundaries are calculated from UTC instants, then formatted for
// the viewer's local date so daylight-saving changes cannot create fake slots.
export function getBookingTimeOptions(date: string, timeZone: string) {
  try {
    const range = getDayRangeUtc(date, timeZone);
    const starts = getOfficeSlotStartsWithinRange(range.start, range.end);
    const boundaries = [...starts, ...(starts.length ? [new Date(starts[starts.length - 1].getTime() + 30 * 60 * 1000)] : [])];
    return [...new Set(boundaries.filter((instant) => getZonedDateIso(instant, timeZone) === date).map((instant) => formatTimeInZone(instant, timeZone)))].sort();
  } catch {
    return [];
  }
}

// Field errors are announced immediately beside their related input.
export function FieldError({ message, className = "text-xs" }: { message?: string; className?: string }) {
  return message ? <span className={`${className} leading-4 text-[var(--danger)]`} role="alert">{message}</span> : null;
}
