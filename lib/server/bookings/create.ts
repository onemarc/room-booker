import "server-only";

import { randomUUID } from "node:crypto";
import { addCalendarDays } from "@/lib/time";
import { toScheduleBooking } from "./serializers";
import { validateBookingInput } from "./validation";
import { withTransaction } from "@/lib/server/database";
import { HttpError, isPostgresExclusionViolation } from "@/lib/server/http";
import type { ScheduleBooking } from "@/lib/bookings";
import type { CreatedBookingRow, CreateBookingInput } from "./types";

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

      // Batch-check all occurrence intervals in a single query. The database's
      // exclusion constraint (bookings_no_room_overlap) is the final safety net,
      // but checking upfront gives the user a precise error before insertion.
      const conflict = await client.query<{ has_conflict: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM bookings b
          INNER JOIN unnest($2::timestamptz[], $3::timestamptz[])
            AS occ(occ_start, occ_end) ON true
          WHERE b.room_id = $1
            AND b.start_at < occ.occ_end
            AND b.end_at > occ.occ_start
        ) AS has_conflict`,
        [
          first.roomId,
          occurrences.map((o) => o.startAt),
          occurrences.map((o) => o.endAt),
        ],
      );
      if (conflict.rows[0]?.has_conflict) {
        throw new HttpError(
          "One of the requested times is already occupied. Choose another interval.",
          409,
          undefined,
          "slot_occupied",
        );
      }

      // Insert all occurrences in a single multi-row statement. Only the first
      // occurrence is returned to the caller for immediate UI feedback.
      const result = await client.query<CreatedBookingRow>(
        `
          WITH inserted AS (
            INSERT INTO bookings (
              room_id, author_id, title, start_at, end_at, color,
              series_id, recurrence_index
            )
            SELECT $1, $2,
              unnest($3::text[]),
              unnest($4::timestamptz[]),
              unnest($5::timestamptz[]),
              unnest($6::text[]),
              $7,
              unnest($8::int[])
            RETURNING id, author_id, title, start_at, end_at, color, series_id
          )
          SELECT i.id, i.title,
            u.display_name AS author_display_name,
            i.start_at, i.end_at, i.color, i.series_id
          FROM inserted i
          INNER JOIN users u ON u.id = i.author_id
          ORDER BY i.start_at
          LIMIT 1
        `,
        [
          first.roomId,
          currentUserId,
          occurrences.map((o) => o.title),
          occurrences.map((o) => o.startAt),
          occurrences.map((o) => o.endAt),
          occurrences.map((o) => o.color),
          seriesId,
          occurrences.map((_, i) => (seriesId ? i : null)),
        ],
      );

      return toScheduleBooking(result.rows[0]!);
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
