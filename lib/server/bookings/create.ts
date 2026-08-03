import "server-only";

import { randomUUID } from "node:crypto";
import type { ScheduleBooking } from "@/lib/bookings";
import { withTransaction } from "@/lib/server/database";
import {
  HttpError,
  isPostgresExclusionViolation,
} from "@/lib/server/http";
import { addCalendarDays } from "@/lib/time";
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
  const first = validateBookingInput(input, now);
  const occurrences = Array.from(
    { length: first.recurrenceCount },
    (_, recurrenceIndex) =>
      recurrenceIndex === 0
        ? first
        : validateBookingInput(
            {
              ...input,
              date: addCalendarDays(first.date, recurrenceIndex * 7),
              endDate: addCalendarDays(
                first.endDate,
                recurrenceIndex * 7,
              ),
              recurrenceCount: 1,
            },
            now,
          ),
  );
  const seriesId = occurrences.length > 1 ? randomUUID() : null;

  try {
    return await withTransaction(async (client) => {
      const room = await client.query<{ id: string }>(
        "SELECT id FROM rooms WHERE id = $1 LIMIT 1",
        [first.roomId],
      );
      if (room.rows.length === 0) {
        throw new HttpError(
          "The selected room was not found.",
          400,
          { roomId: "Select an existing room." },
          "room_not_found",
        );
      }

      for (const occurrence of occurrences) {
        const conflict = await client.query<{ id: string }>(
          `SELECT id FROM bookings
           WHERE room_id = $1 AND start_at < $3 AND end_at > $2
           LIMIT 1`,
          [first.roomId, occurrence.startAt, occurrence.endAt],
        );
        if (conflict.rows.length > 0) {
          throw new HttpError(
            "One of the requested times is already occupied. Choose another interval.",
            409,
            undefined,
            "slot_occupied",
          );
        }
      }

      let firstCreated: CreatedBookingRow | undefined;
      for (const [recurrenceIndex, occurrence] of occurrences.entries()) {
        const result = await client.query<CreatedBookingRow>(
          `
            WITH inserted_booking AS (
              INSERT INTO bookings (
                room_id, author_id, title, start_at, end_at, color,
                series_id, recurrence_index
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING id, author_id, title, start_at, end_at, color
            )
            SELECT inserted_booking.id, inserted_booking.title,
              users.display_name AS author_display_name,
              inserted_booking.start_at, inserted_booking.end_at,
              inserted_booking.color
            FROM inserted_booking
            INNER JOIN users ON users.id = inserted_booking.author_id
          `,
          [
            first.roomId,
            currentUserId,
            occurrence.title,
            occurrence.startAt,
            occurrence.endAt,
            occurrence.color,
            seriesId,
            seriesId ? recurrenceIndex : null,
          ],
        );
        firstCreated ??= result.rows[0];
      }

      return toScheduleBooking(firstCreated!);
    });
  } catch (error) {
    if (isPostgresExclusionViolation(error)) {
      throw new HttpError(
        "That time was just booked by someone else. Choose another interval.",
        409,
        undefined,
        "slot_occupied",
      );
    }
    throw error;
  }
}
