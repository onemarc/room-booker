import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { query, withTransaction } from "@/lib/server/database";

const CONFIRMATION_TTL_HOURS = 24;

function hashConfirmationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isEmailConfirmationRequired() {
  const configured = process.env.EMAIL_CONFIRMATION_REQUIRED;
  if (configured === undefined) {
    return process.env.NODE_ENV !== "production";
  }
  if (configured !== "true" && configured !== "false") {
    throw new Error("EMAIL_CONFIRMATION_REQUIRED must be true or false.");
  }
  return configured === "true";
}

export async function issueEmailConfirmation({
  userId,
  email,
  requestOrigin,
}: {
  userId: string;
  email: string;
  requestOrigin: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + CONFIRMATION_TTL_HOURS * 60 * 60 * 1000,
  );

  await query(
    `
      INSERT INTO email_confirmation_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE
      SET token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        created_at = now()
    `,
    [userId, hashConfirmationToken(token), expiresAt],
  );

  const link = new URL("/api/auth/confirm", requestOrigin);
  link.searchParams.set("token", token);
  // This is deliberately a development delivery mechanism, not an SMTP claim.
  console.info(`[Room Booker] Confirm ${email}: ${link.toString()}`);
}

export async function confirmEmail(token: string) {
  if (!token || token.length > 128) {
    return false;
  }

  return withTransaction(async (client) => {
    const result = await client.query<{ user_id: string }>(
      `
        DELETE FROM email_confirmation_tokens
        WHERE token_hash = $1 AND expires_at > now()
        RETURNING user_id
      `,
      [hashConfirmationToken(token)],
    );
    const userId = result.rows[0]?.user_id;
    if (!userId) {
      return false;
    }

    await client.query(
      `UPDATE users SET email_confirmed_at = now(), updated_at = now()
       WHERE id = $1`,
      [userId],
    );
    return true;
  });
}

export async function reissueEmailConfirmation({
  currentUserId,
  requestOrigin,
}: {
  currentUserId: string;
  requestOrigin: string;
}) {
  const result = await query<{ email: string }>(
    `SELECT email FROM users
     WHERE id = $1 AND email_confirmed_at IS NULL
     LIMIT 1`,
    [currentUserId],
  );
  const email = result.rows[0]?.email;
  if (!email) {
    return false;
  }
  await issueEmailConfirmation({
    userId: currentUserId,
    email,
    requestOrigin,
  });
  return true;
}
