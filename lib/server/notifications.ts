import "server-only";

import type { BookingEndNotification } from "@/lib/notifications";
import { query, withTransaction } from "@/lib/server/database";
import { serializeUtcInstant } from "@/lib/time";
import { isUuid } from "@/lib/server/bookings/identifiers";

const DEFAULT_NOTIFY_BEFORE_MINUTES = 10;

type NotificationRow = {
  id: string;
  title: string;
  room_name: string;
  ends_at: Date;
};

function getNotifyBeforeMinutes() {
  const minutes = Number(
    process.env.NOTIFY_BEFORE_MINUTES ?? DEFAULT_NOTIFY_BEFORE_MINUTES,
  );
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
    throw new Error("NOTIFY_BEFORE_MINUTES must be from 1 through 60.");
  }
  return minutes;
}

function toNotification(row: NotificationRow): BookingEndNotification {
  return {
    id: row.id,
    title: row.title,
    roomName: row.room_name,
    endsAt: serializeUtcInstant(row.ends_at),
  };
}

export async function materializeAndListNotifications(
  currentUserId: string,
) {
  const notifyBeforeMinutes = getNotifyBeforeMinutes();

  return withTransaction(async (client) => {
    // A unique current-booking key makes concurrent polls idempotent. Both
    // booking foreign keys cascade, so cancellation removes pending delivery.
    await client.query(
      `
        INSERT INTO booking_end_notifications (
          recipient_id,
          current_booking_id,
          next_booking_id
        )
        SELECT current_booking.author_id, current_booking.id, next_booking.id
        FROM bookings AS current_booking
        INNER JOIN bookings AS next_booking
          ON next_booking.room_id = current_booking.room_id
         AND next_booking.start_at = current_booking.end_at
        WHERE current_booking.author_id = $1
          AND current_booking.end_at > now()
          AND current_booking.end_at
            <= now() + make_interval(mins => $2::integer)
        ON CONFLICT (current_booking_id) DO NOTHING
      `,
      [currentUserId, notifyBeforeMinutes],
    );

    const result = await client.query<NotificationRow>(
      `
        SELECT notifications.id, current_booking.title,
          rooms.name AS room_name, current_booking.end_at AS ends_at
        FROM booking_end_notifications AS notifications
        INNER JOIN bookings AS current_booking
          ON current_booking.id = notifications.current_booking_id
        INNER JOIN bookings AS next_booking
          ON next_booking.id = notifications.next_booking_id
        INNER JOIN rooms ON rooms.id = current_booking.room_id
        WHERE notifications.recipient_id = $1
          AND notifications.read_at IS NULL
          AND current_booking.end_at > now()
          AND next_booking.start_at = current_booking.end_at
        ORDER BY current_booking.end_at ASC, notifications.id ASC
      `,
      [currentUserId],
    );

    return result.rows.map(toNotification);
  });
}

export async function acknowledgeNotification({
  notificationId,
  currentUserId,
}: {
  notificationId: string;
  currentUserId: string;
}) {
  if (!isUuid(notificationId)) {
    return false;
  }

  const result = await query(
    `
      UPDATE booking_end_notifications
      SET read_at = COALESCE(read_at, now())
      WHERE id = $1 AND recipient_id = $2
      RETURNING id
    `,
    [notificationId, currentUserId],
  );
  return result.rows.length > 0;
}
