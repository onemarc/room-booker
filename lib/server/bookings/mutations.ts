import "server-only";

import type { ScheduleBooking } from "@/lib/bookings";
import { query, withTransaction } from "@/lib/server/database";
import { HttpError } from "@/lib/server/http";
import { serializeUtcInstant } from "@/lib/time";
import { isUuid } from "./identifiers";
import { toScheduleBooking } from "./serializers";
import type { CreatedBookingRow, CreateBookingInput } from "./types";
import { validateBookingInput } from "./validation";

// Updates lock the owned future booking first, ensuring a cancellation and an
// edit cannot both modify the same booking concurrently.
export async function updateUpcomingBooking({
  bookingId,
  currentUserId,
  input,
  now = new Date(),
}: {
  bookingId: string;
  currentUserId: string;
  input: Omit<CreateBookingInput, "roomId">;
  now?: Date;
}): Promise<ScheduleBooking | null> {
  if (!isUuid(bookingId)) return null;

  return withTransaction(async (client) => {
    const ownedBooking = await client.query<{ room_id: string }>(
      `SELECT room_id FROM bookings
       WHERE id = $1 AND author_id = $2 AND start_at > $3
       LIMIT 1 FOR UPDATE`,
      [bookingId, currentUserId, now],
    );
    const roomId = ownedBooking.rows[0]?.room_id;
    if (!roomId) return null;

    const validated = validateBookingInput({ ...input, roomId }, now);
    const conflict = await client.query<{ id: string }>(
      `SELECT id FROM bookings
       WHERE room_id = $1 AND id <> $2 AND start_at < $4 AND end_at > $3
       LIMIT 1`,
      [roomId, bookingId, validated.startAt, validated.endAt],
    );
    if (conflict.rows.length > 0) {
      throw new HttpError("That time is already occupied. Choose another interval.", 409, undefined, "slot_occupied");
    }

    const result = await client.query<CreatedBookingRow>(
      `
        WITH updated_booking AS (
          UPDATE bookings SET title = $3, start_at = $4, end_at = $5,
            color = $6, updated_at = now()
          WHERE id = $1 AND author_id = $2
          RETURNING id, author_id, title, start_at, end_at, color
        )
        SELECT updated_booking.id, updated_booking.title,
          users.display_name AS author_display_name, updated_booking.start_at,
          updated_booking.end_at, updated_booking.color
        FROM updated_booking
        INNER JOIN users ON users.id = updated_booking.author_id
      `,
      [bookingId, currentUserId, validated.title, validated.startAt, validated.endAt, validated.color],
    );
    return result.rows[0] ? toScheduleBooking(result.rows[0]) : null;
  });
}

// Cancellation only deletes a future booking owned by the caller; SQL keeps
// this ownership rule authoritative even if a client request is forged.
export async function cancelUpcomingBooking({
  bookingId,
  currentUserId,
}: {
  bookingId: string;
  currentUserId: string;
}) {
  if (!isUuid(bookingId)) return null;
  const result = await query<{ room_id: string; start_at: Date; end_at: Date }>(
    `DELETE FROM bookings
     WHERE id = $1 AND author_id = $2 AND start_at > now()
     RETURNING room_id, start_at, end_at`,
    [bookingId, currentUserId],
  );
  const cancelled = result.rows[0];
  return cancelled
    ? {
        roomId: cancelled.room_id,
        startAt: serializeUtcInstant(cancelled.start_at),
        endAt: serializeUtcInstant(cancelled.end_at),
      }
    : null;
}
