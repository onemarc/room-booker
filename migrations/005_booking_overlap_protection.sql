-- PostgreSQL becomes the final concurrency authority. The half-open range
-- keeps adjacent bookings valid while rejecting every true overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_room_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  );
