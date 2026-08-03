import type { BookingColor } from "@/lib/bookings";

// These types describe database rows and untrusted route payloads at the
// persistence boundary, before values are converted into public API models.
export type ScheduleRow = {
  room_id: string;
  booking_id: string | null;
  title: string | null;
  author_display_name: string | null;
  start_at: Date | null;
  end_at: Date | null;
  color: BookingColor | null;
  is_owner: boolean | null;
};

export type CreatedBookingRow = {
  id: string;
  title: string;
  author_display_name: string;
  start_at: Date;
  end_at: Date;
  color: BookingColor;
};

export type OwnedBookingRow = {
  id: string;
  room_id: string;
  room_name: string;
  title: string;
  start_at: Date;
  end_at: Date;
  color: BookingColor;
  series_id: string | null;
};

export type BookingCursor = {
  startAt: string;
  id: string;
};

export type CreateBookingInput = {
  roomId: unknown;
  title: unknown;
  date: unknown;
  endDate?: unknown;
  startTime: unknown;
  endTime: unknown;
  timeZone: unknown;
  color?: unknown;
  recurrenceCount?: unknown;
};
