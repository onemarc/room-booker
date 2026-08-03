import "server-only";

import type { RoomAvailability } from "@/lib/rooms";
import { query } from "@/lib/server/database";
import {
  CALENDAR_SLOT_MINUTES,
  canonicalizeTimeZone,
  getDayRangeUtc,
  getOfficeSlotStartsWithinRange,
  intervalsOverlap,
  parseCalendarDate,
  serializeUtcInstant,
} from "@/lib/time";

type RoomScheduleRow = {
  room_id: string;
  room_name: string;
  floor: number;
  capacity: number;
  booking_start_at: Date | null;
  booking_end_at: Date | null;
};

type MutableRoomAvailability = Omit<
  RoomAvailability,
  "availableStarts"
> & {
  bookingIntervals: Array<{ start: Date; end: Date }>;
};

export async function listRoomsWithAvailability({
  activeDate,
  timeZone,
  minimumCapacity = 1,
  now = new Date(),
}: {
  activeDate: string;
  timeZone: string;
  minimumCapacity?: number;
  now?: Date;
}): Promise<RoomAvailability[]> {
  parseCalendarDate(activeDate);
  const canonicalTimeZone = canonicalizeTimeZone(timeZone);
  if (
    !Number.isInteger(minimumCapacity) ||
    minimumCapacity < 1 ||
    minimumCapacity > 1000
  ) {
    throw new RangeError("Room capacity must be from 1 through 1000.");
  }
  const range = getDayRangeUtc(activeDate, canonicalTimeZone);
  const result = await query<RoomScheduleRow>(
    `
      SELECT
        rooms.id AS room_id,
        rooms.name AS room_name,
        rooms.floor,
        rooms.capacity,
        bookings.start_at AS booking_start_at,
        bookings.end_at AS booking_end_at
      FROM rooms
      LEFT JOIN bookings
        ON bookings.room_id = rooms.id
       AND bookings.start_at < $2
       AND bookings.end_at > $1
      WHERE rooms.capacity >= $3
      ORDER BY rooms.name ASC, bookings.start_at ASC
    `,
    [range.start, range.end, minimumCapacity],
  );

  const rooms = new Map<string, MutableRoomAvailability>();

  for (const row of result.rows) {
    const room = rooms.get(row.room_id) ?? {
      id: row.room_id,
      name: row.room_name,
      floor: row.floor,
      capacity: row.capacity,
      bookingIntervals: [],
    };

    if (row.booking_start_at && row.booking_end_at) {
      room.bookingIntervals.push({
        start: new Date(row.booking_start_at),
        end: new Date(row.booking_end_at),
      });
    }

    rooms.set(row.room_id, room);
  }

  const possibleStarts = getOfficeSlotStartsWithinRange(
    range.start,
    range.end,
  ).filter((slotStart) => slotStart > now);
  // Availability is intentionally calculated as one free 30-minute interval;
  // longer bookings are chosen in the booking form and validated by the API.
  const slotLengthMilliseconds =
    CALENDAR_SLOT_MINUTES * 60 * 1000;

  return [...rooms.values()].map((room) => ({
    id: room.id,
    name: room.name,
    floor: room.floor,
    capacity: room.capacity,
    availableStarts: possibleStarts
      .filter((slotStart) => {
        const slotEnd = new Date(
          slotStart.getTime() + slotLengthMilliseconds,
        );

        return room.bookingIntervals.every(
          (booking) =>
            !intervalsOverlap(
              slotStart,
              slotEnd,
              booking.start,
              booking.end,
            ),
        );
      })
      .map(serializeUtcInstant),
  }));
}
