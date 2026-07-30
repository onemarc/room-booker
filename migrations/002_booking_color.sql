ALTER TABLE bookings
  ADD COLUMN color varchar(20) NOT NULL DEFAULT 'sage';

ALTER TABLE bookings
  ADD CONSTRAINT bookings_color_check
  CHECK (color IN ('sage', 'blue', 'violet', 'amber', 'rose', 'slate'));
