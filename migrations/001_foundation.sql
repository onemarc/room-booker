CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(100) NOT NULL,
  email varchar(320) NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_display_name_trimmed_check
    CHECK (
      display_name = btrim(display_name)
      AND char_length(display_name) BETWEEN 1 AND 100
    ),
  CONSTRAINT users_email_normalized_check
    CHECK (
      email = lower(btrim(email))
      AND char_length(email) BETWEEN 3 AND 320
    ),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  floor integer NOT NULL,
  capacity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rooms_name_trimmed_check
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT rooms_capacity_positive_check CHECK (capacity > 0)
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title varchar(100) NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_title_trimmed_check
    CHECK (
      title = btrim(title)
      AND char_length(title) BETWEEN 1 AND 100
    ),
  CONSTRAINT bookings_time_order_check CHECK (start_at < end_at)
);

CREATE INDEX bookings_room_schedule_idx
  ON bookings (room_id, start_at, end_at);

CREATE INDEX bookings_author_upcoming_idx
  ON bookings (author_id, start_at ASC);

CREATE INDEX bookings_author_past_idx
  ON bookings (author_id, end_at DESC);
