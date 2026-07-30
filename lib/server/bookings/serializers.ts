import type { OwnedBooking, ScheduleBooking } from "@/lib/bookings";
import { serializeUtcInstant } from "@/lib/time";
import type { CreatedBookingRow, OwnedBookingRow } from "./types";

// Database timestamps are converted at this boundary so client-facing models
// consistently use UTC ISO strings rather than driver-specific Date objects.
export function toScheduleBooking(
  row: CreatedBookingRow,
): ScheduleBooking {
  return {
    id: row.id,
    title: row.title,
    authorDisplayName: row.author_display_name,
    startAt: serializeUtcInstant(row.start_at),
    endAt: serializeUtcInstant(row.end_at),
    color: row.color,
    isOwner: true,
  };
}

export function toOwnedBooking(row: OwnedBookingRow): OwnedBooking {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    title: row.title,
    startAt: serializeUtcInstant(row.start_at),
    endAt: serializeUtcInstant(row.end_at),
    color: row.color,
  };
}
