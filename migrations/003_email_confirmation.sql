-- Existing accounts predate confirmation and remain usable after this migration.
ALTER TABLE users
  ADD COLUMN email_confirmed_at timestamptz;

UPDATE users
SET email_confirmed_at = created_at
WHERE email_confirmed_at IS NULL;

CREATE TABLE email_confirmation_tokens (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_confirmation_tokens_expiry_check
    CHECK (expires_at > created_at)
);
