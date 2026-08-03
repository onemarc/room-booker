-- Notification rows are durable delivery records. Cascading both booking
-- references ensures a cancelled current or next booking cannot notify.
CREATE TABLE booking_end_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  next_booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT booking_end_notifications_distinct_bookings_check
    CHECK (current_booking_id <> next_booking_id),
  CONSTRAINT booking_end_notifications_current_key UNIQUE (current_booking_id)
);

CREATE INDEX booking_end_notifications_unread_idx
  ON booking_end_notifications (recipient_id, created_at)
  WHERE read_at IS NULL;
