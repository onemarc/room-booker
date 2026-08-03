-- A nullable series identifier groups weekly occurrences without changing the
-- ownership and room relationships already enforced on each booking row.
ALTER TABLE bookings
  ADD COLUMN series_id uuid,
  ADD COLUMN recurrence_index integer,
  ADD CONSTRAINT bookings_recurrence_pair_check
    CHECK (
      (series_id IS NULL AND recurrence_index IS NULL)
      OR
      (
        series_id IS NOT NULL
        AND recurrence_index IS NOT NULL
        AND recurrence_index >= 0
      )
    );

CREATE UNIQUE INDEX bookings_series_occurrence_key
  ON bookings (series_id, recurrence_index)
  WHERE series_id IS NOT NULL;

CREATE INDEX bookings_series_id_idx
  ON bookings (series_id)
  WHERE series_id IS NOT NULL;
