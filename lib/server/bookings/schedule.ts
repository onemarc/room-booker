import "server-only";

import type { ScheduleBooking } from "@/lib/bookings";
import { query } from "@/lib/server/database";
import { HttpError } from "@/lib/server/http";
import { serializeUtcInstant } from "@/lib/time";
import { isUuid } from "./identifiers";
import type { ScheduleRow } from "./types";

// Schedule reads use half-open ranges: adjacent bookings do not overlap, but
// every booking sharing any instant with the requested period is returned.
export async function listRoomSchedule({
  roomId,
  rangeStart,
  rangeEnd,
  currentUserId,
}: {
  roomId: string;
  rangeStart: Date;
  rangeEnd: Date;
  currentUserId: string;
}): Promise<ScheduleBooking[]> {
  if (
    !isUuid(roomId) ||
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime()) ||
    rangeStart >= rangeEnd ||
    rangeEnd.getTime() - rangeStart.getTime() > 8 * 24 * 60 * 60 * 1000
  ) {
    throw new HttpError("The requested schedule range is invalid.", 400, undefined, "invalid_schedule_range");
  }

  const result = await query<ScheduleRow>(
    `
      SELECT rooms.id AS room_id, bookings.id AS booking_id, bookings.title,
        users.display_name AS author_display_name, bookings.start_at,
        bookings.end_at, bookings.color, bookings.author_id = $4 AS is_owner,
        bookings.series_id AS series_id
      FROM rooms
      LEFT JOIN bookings ON bookings.room_id = rooms.id
        AND bookings.start_at < $3
        AND bookings.end_at > $2
      LEFT JOIN users ON users.id = bookings.author_id
      WHERE rooms.id = $1
      ORDER BY bookings.start_at ASC, bookings.id ASC
    `,
    [roomId, rangeStart, rangeEnd, currentUserId],
  );

  if (result.rows.length === 0) {
    throw new HttpError("The selected room was not found.", 404, undefined, "room_not_found");
  }

  return result.rows.flatMap((row) =>
    row.booking_id && row.title && row.author_display_name && row.start_at && row.end_at && row.color
      ? [{
          id: row.booking_id,
          title: row.title,
          authorDisplayName: row.author_display_name,
          startAt: serializeUtcInstant(row.start_at),
          endAt: serializeUtcInstant(row.end_at),
          color: row.color,
          isOwner: Boolean(row.is_owner),
          seriesId: row.series_id ?? null,
        }]
      : [],
  );
}
