import { formatUtcInstant, getZonedDateIso } from "@/lib/time";
import type { MyBookingsResponse, OwnedBooking } from "@/lib/bookings";

export type BookingSection = "upcoming" | "past";
export type CancellationScope = "occurrence" | "series";

export type BookingMonthGroup = {
  key: string;
  label: string;
  bookings: OwnedBooking[];
};

export function subscribeToBrowserTimeZone() {
  return () => {};
}

/**
 * Formats a booking date into readable short weekday, numeric day, short month, and numeric year.
 * Example: "Mon, 12 Oct 2026"
 */
export function formatBookingDate(booking: OwnedBooking, timeZone: string): string {
  return formatUtcInstant(
    booking.startAt,
    timeZone,
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    },
    "en-GB",
  );
}

/**
 * Formats start and end times into 24h format HH:mm-HH:mm.
 * Example: "09:00-10:00"
 */
export function formatBookingTime(booking: OwnedBooking, timeZone: string): string {
  const formatterOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  return `${formatUtcInstant(
    booking.startAt,
    timeZone,
    formatterOptions,
  )}-${formatUtcInstant(booking.endAt, timeZone, formatterOptions)}`;
}

export function formatBookingMonth(booking: OwnedBooking, timeZone: string): string {
  return formatUtcInstant(
    booking.startAt,
    timeZone,
    { month: "long", year: "numeric" },
    "en-GB",
  );
}

export function formatBookingWeekday(booking: OwnedBooking, timeZone: string): string {
  return formatUtcInstant(
    booking.startAt,
    timeZone,
    { weekday: "short" },
    "en-GB",
  );
}

export function formatBookingDay(booking: OwnedBooking, timeZone: string): string {
  return formatUtcInstant(
    booking.startAt,
    timeZone,
    { day: "2-digit" },
    "en-GB",
  );
}

/**
 * Merges newly loaded pagination pages with existing bookings while avoiding duplicates by ID.
 */
export function mergeBookingPages(
  current: OwnedBooking[],
  additions: OwnedBooking[],
): OwnedBooking[] {
  const merged = new Map(current.map((booking) => [booking.id, booking]));
  for (const booking of additions) {
    merged.set(booking.id, booking);
  }
  return [...merged.values()];
}

/**
 * Groups a chronological list of bookings by month according to the selected time zone.
 * Inserts a section header whenever a booking crosses a month boundary.
 */
export function groupBookingsByMonth(
  bookings: OwnedBooking[],
  timeZone: string,
): BookingMonthGroup[] {
  const groups: BookingMonthGroup[] = [];

  for (const booking of bookings) {
    const key = getZonedDateIso(booking.startAt, timeZone).slice(0, 7);
    const currentGroup = groups.at(-1);

    if (!currentGroup || currentGroup.key !== key) {
      groups.push({
        key,
        label: formatBookingMonth(booking, timeZone),
        bookings: [booking],
      });
    } else {
      currentGroup.bookings.push(booking);
    }
  }

  return groups;
}

/**
 * Fetches upcoming or past bookings from the API endpoint.
 * Supports cancellation signals and cursor-based pagination.
 */
export async function requestBookingSection(
  section: BookingSection,
  signal: AbortSignal,
  cursor?: string,
): Promise<MyBookingsResponse> {
  const searchParams = new URLSearchParams({ section });
  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  const response = await fetch(`/api/bookings/mine?${searchParams}`, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });
  const data = (await response.json()) as MyBookingsResponse;

  if (!response.ok || !data.bookings) {
    throw new Error(
      data.error?.message ?? "Your bookings could not be loaded.",
    );
  }

  return data;
}
