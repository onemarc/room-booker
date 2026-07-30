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

export function isBookingColor(value: unknown): value is BookingColor {
  return (
    typeof value === "string" &&
    (BOOKING_COLORS as readonly string[]).includes(value)
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
    | "color",
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
