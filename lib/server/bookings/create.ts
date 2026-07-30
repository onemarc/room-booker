import "server-only";

import type { ScheduleBooking } from "@/lib/bookings";
import { withTransaction } from "@/lib/server/database";
import { HttpError } from "@/lib/server/http";
import { toScheduleBooking } from "./serializers";
import type { CreatedBookingRow, CreateBookingInput } from "./types";
import { validateBookingInput } from "./validation";

// Creation checks the room and its time conflict inside one transaction so the
// validation result and inserted booking are based on the same database state.
export async function createBooking({
  currentUserId,
  input,
  now = new Date(),
}: {
  currentUserId: string;
  input: CreateBookingInput;
  now?: Date;
}): Promise<ScheduleBooking> {
  const { roomId, title, startAt, endAt, color } = validateBookingInput(input, now);

  return withTransaction(async (client) => {
    const room = await client.query<{ id: string }>(
      "SELECT id FROM rooms WHERE id = $1 LIMIT 1",
      [roomId],
    );
    if (room.rows.length === 0) {
      throw new HttpError("The selected room was not found.", 400, { roomId: "Select an existing room." }, "room_not_found");
    }

    const conflict = await client.query<{ id: string }>(
      `SELECT id FROM bookings
       WHERE room_id = $1 AND start_at < $3 AND end_at > $2
       LIMIT 1`,
      [roomId, startAt, endAt],
    );
    if (conflict.rows.length > 0) {
      throw new HttpError("That time is already occupied. Choose another interval.", 409, undefined, "slot_occupied");
    }

    const result = await client.query<CreatedBookingRow>(
      `
        WITH inserted_booking AS (
          INSERT INTO bookings (room_id, author_id, title, start_at, end_at, color)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, author_id, title, start_at, end_at, color
        )
        SELECT inserted_booking.id, inserted_booking.title,
          users.display_name AS author_display_name, inserted_booking.start_at,
          inserted_booking.end_at, inserted_booking.color
        FROM inserted_booking
        INNER JOIN users ON users.id = inserted_booking.author_id
      `,
      [roomId, currentUserId, title, startAt, endAt, color],
    );
    return toScheduleBooking(result.rows[0]);
  });
}
