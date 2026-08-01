export const BOOKING_COLORS = [
  "sage",
  "blue",
  "violet",
  "amber",
  "rose",
  "slate",
] as const;

export type BookingColor = (typeof BOOKING_COLORS)[number];

export const DEFAULT_BOOKING_COLOR: BookingColor = "sage";
export const MINIMUM_BOOKING_DURATION_MINUTES = 30;
export const MAXIMUM_BOOKING_DURATION_MINUTES = 4 * 60;
export const MAXIMUM_WEEKLY_OCCURRENCES = 52;

export function isBookingColor(value: unknown): value is BookingColor {
  return (
    typeof value === "string" &&
    (BOOKING_COLORS as readonly string[]).includes(value)
  );
}

export function isAllowedBookingDuration(
  start: Date | string,
  end: Date | string,
) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const durationMinutes = (endTime - startTime) / 60_000;

  return (
    Number.isFinite(durationMinutes) &&
    durationMinutes >= MINIMUM_BOOKING_DURATION_MINUTES &&
    durationMinutes <= MAXIMUM_BOOKING_DURATION_MINUTES
  );
}

export function isAllowedWeeklyOccurrenceCount(value: unknown) {
  return (
    Number.isInteger(value) &&
    Number(value) >= 1 &&
    Number(value) <= MAXIMUM_WEEKLY_OCCURRENCES
  );
}

export type ScheduleBooking = {
  id: string;
  title: string;
  authorDisplayName: string;
  startAt: string;
  endAt: string;
  color: BookingColor;
  isOwner: boolean;
};

export type OwnedBooking = {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  startAt: string;
  endAt: string;
  color: BookingColor;
  seriesId: string | null;
};

export type BookingFieldErrors = Partial<
  Record<
    | "roomId"
    | "title"
    | "date"
    | "endDate"
    | "startTime"
    | "endTime"
    | "timeZone"
    | "color"
    | "recurrenceCount",
    string
  >
>;

export type ScheduleResponse = {
  roomId?: string;
  range?: {
    start: string;
    end: string;
  };
  bookings?: ScheduleBooking[];
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: BookingFieldErrors;
  };
};

export type CreateBookingResponse = {
  booking?: ScheduleBooking;
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: BookingFieldErrors;
  };
};

export type MyBookingsResponse = {
  bookings?: OwnedBooking[];
  nextCursor?: string | null;
  error?: {
    code?: string;
    message?: string;
  };
};
