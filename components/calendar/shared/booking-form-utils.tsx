import {
  formatTimeInZone,
  getDayRangeUtc,
  getOfficeSlotStartsWithinRange,
  getZonedDateIso,
  intervalsOverlap,
  localDateTimeToUtc,
} from "@/lib/time";

export type BookingInterval = {
  id?: string;
  startAt: string | Date;
  endAt: string | Date;
};

// Office-slot boundaries are calculated from UTC instants, then formatted for
// the viewer's local date so daylight-saving changes cannot create fake slots.
export function getBookingTimeOptions(date: string, timeZone: string) {
  try {
    const range = getDayRangeUtc(date, timeZone);
    const starts = getOfficeSlotStartsWithinRange(range.start, range.end);
    const boundaries = [
      ...starts,
      ...(starts.length
        ? [new Date(starts[starts.length - 1].getTime() + 30 * 60 * 1000)]
        : []),
    ];
    return [
      ...new Set(
        boundaries
          .filter((instant) => getZonedDateIso(instant, timeZone) === date)
          .map((instant) => formatTimeInZone(instant, timeZone)),
      ),
    ].sort();
  } catch {
    return [];
  }
}

/**
 * Calculates start and end time options filtered by:
 * - Past slots on the current date
 * - Occupied intervals in the chosen room
 * - Duration constraints (30m to 4h)
 */
export function getFilteredBookingTimeOptions({
  date,
  timeZone,
  existingBookings = [],
  excludeBookingId,
  now = new Date(),
}: {
  date: string;
  timeZone: string;
  existingBookings?: BookingInterval[];
  excludeBookingId?: string;
  now?: Date;
}) {
  const allBoundaries = getBookingTimeOptions(date, timeZone);
  if (allBoundaries.length < 2) {
    return {
      allBoundaries: [],
      startOptions: [],
      getValidEndOptions: () => [],
    };
  }

  const activeBookings = existingBookings.filter(
    (b) => !excludeBookingId || b.id !== excludeBookingId,
  );

  const isPastStart = (time: string) => {
    try {
      const instant = localDateTimeToUtc(date, time, timeZone);
      return instant.getTime() <= now.getTime();
    } catch {
      return false;
    }
  };

  const isSlotOccupied = (time: string) => {
    try {
      const start = localDateTimeToUtc(date, time, timeZone);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return activeBookings.some((b) =>
        intervalsOverlap(start, end, b.startAt, b.endAt),
      );
    } catch {
      return false;
    }
  };

  const startOptions = allBoundaries
    .slice(0, -1)
    .filter((time) => !isPastStart(time) && !isSlotOccupied(time));

  const getValidEndOptions = (startTime: string) => {
    if (!startTime) return [];
    try {
      const startInstant = localDateTimeToUtc(date, startTime, timeZone);
      const maxDurationInstant = new Date(
        startInstant.getTime() + 4 * 60 * 60 * 1000,
      );

      const upcomingBookings = activeBookings
        .map((b) => ({ ...b, startInstant: new Date(b.startAt) }))
        .filter((b) => b.startInstant.getTime() >= startInstant.getTime())
        .sort((a, b) => a.startInstant.getTime() - b.startInstant.getTime());

      const nextBookingStart = upcomingBookings[0]?.startInstant;
      const maxAllowedEnd = nextBookingStart
        ? Math.min(maxDurationInstant.getTime(), nextBookingStart.getTime())
        : maxDurationInstant.getTime();

      return allBoundaries.filter((time) => {
        try {
          const endInstant = localDateTimeToUtc(date, time, timeZone);
          return (
            endInstant.getTime() > startInstant.getTime() &&
            endInstant.getTime() <= maxAllowedEnd
          );
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  };

  return {
    allBoundaries,
    startOptions,
    getValidEndOptions,
  };
}

// Field errors are announced immediately beside their related input.
export function FieldError({
  message,
  className = "text-xs",
}: {
  message?: string;
  className?: string;
}) {
  return message ? (
    <span className={`${className} leading-4 text-[var(--danger)]`} role="alert">
      {message}
    </span>
  ) : null;
}
