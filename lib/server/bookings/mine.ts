import "server-only";

import type { OwnedBooking } from "@/lib/bookings";
import { query } from "@/lib/server/database";
import { decodeCursor, encodeCursor } from "./cursors";
import { toOwnedBooking } from "./serializers";
import type { OwnedBookingRow } from "./types";

const PAST_PAGE_SIZE = 10;

const OWNED_BOOKING_SELECT = `
  SELECT bookings.id, bookings.room_id, rooms.name AS room_name,
    bookings.title, bookings.start_at, bookings.end_at, bookings.color
  FROM bookings
  INNER JOIN rooms ON rooms.id = bookings.room_id
`;

// Owned-booking history is keyset paginated by the same tuple used in SQL,
// preventing duplicates or gaps caused by offset pagination during updates.
export async function listUpcomingBookings({
  currentUserId,
  now = new Date(),
}: {
  currentUserId: string;
  now?: Date;
}): Promise<OwnedBooking[]> {
  const result = await query<OwnedBookingRow>(
    `${OWNED_BOOKING_SELECT}
     WHERE bookings.author_id = $1 AND bookings.start_at > $2
     ORDER BY bookings.start_at ASC, bookings.id ASC`,
    [currentUserId, now],
  );
  return result.rows.map(toOwnedBooking);
}

export async function listPastBookings({
  currentUserId,
  cursor,
  now = new Date(),
}: {
  currentUserId: string;
  cursor?: string;
  now?: Date;
}) {
  const decodedCursor = cursor ? decodeCursor(cursor) : null;
  const values: unknown[] = [currentUserId, now];
  let cursorClause = "";
  if (decodedCursor) {
    values.push(decodedCursor.startAt, decodedCursor.id);
    cursorClause = "AND (bookings.start_at, bookings.id) < ($3::timestamptz, $4::uuid)";
  }
  values.push(PAST_PAGE_SIZE + 1);
  const result = await query<OwnedBookingRow>(
    `${OWNED_BOOKING_SELECT}
     WHERE bookings.author_id = $1 AND bookings.start_at <= $2
       ${cursorClause}
     ORDER BY bookings.start_at DESC, bookings.id DESC
     LIMIT $${values.length}`,
    values,
  );
  const hasMore = result.rows.length > PAST_PAGE_SIZE;
  const rows = result.rows.slice(0, PAST_PAGE_SIZE);
  return {
    bookings: rows.map(toOwnedBooking),
    nextCursor: hasMore && rows.length > 0 ? encodeCursor(rows[rows.length - 1]) : null,
  };
}
