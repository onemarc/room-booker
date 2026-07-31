import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  deriveSessionIdentity,
  isResourceOwner,
} from "@/lib/auth";
import { query } from "@/lib/server/database";
import { HttpError } from "@/lib/server/http";
import type { AuthenticatedUser } from "@/lib/server/users";

const SESSION_COOKIE_NAME = "room_booker_session";
const DEFAULT_SESSION_TTL_DAYS = 7;

type SessionUserRow = {
  id: string;
  display_name: string;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must contain at least 32 characters.",
    );
  }

  return secret;
}

function getSessionTtlMilliseconds() {
  const ttlDays = Number(
    process.env.SESSION_TTL_DAYS ?? DEFAULT_SESSION_TTL_DAYS,
  );

  if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 30) {
    throw new Error("SESSION_TTL_DAYS must be an integer from 1 to 30.");
  }

  return ttlDays * 24 * 60 * 60 * 1000;
}

export function assertSessionConfiguration() {
  getSessionSecret();
  getSessionTtlMilliseconds();
}

function hashSessionToken(token: string) {
  // A database leak must not reveal bearer tokens that can be replayed as cookies.
  return createHmac("sha256", getSessionSecret())
    .update(token)
    .digest("hex");
}

async function findUserBySessionToken(
  token: string,
): Promise<AuthenticatedUser | null> {
  const result = await query<SessionUserRow>(
    `
      SELECT users.id, users.display_name
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1
        AND sessions.expires_at > now()
      LIMIT 1
    `,
    [hashSessionToken(token)],
  );
  const user = result.rows[0];

  return deriveSessionIdentity(
    user
      ? {
          id: user.id,
          displayName: user.display_name,
        }
      : null,
  );
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + getSessionTtlMilliseconds());
  const cookieStore = await cookies();
  const previousToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (previousToken) {
    // Rotate an existing browser session instead of accumulating active tokens.
    await query("DELETE FROM sessions WHERE token_hash = $1", [
      hashSessionToken(previousToken),
    ]);
  }

  await query(
    `
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, hashSessionToken(token), expiresAt],
  );

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  cookieStore.delete(SESSION_COOKIE_NAME);

  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [
      hashSessionToken(token),
    ]);
  }
}

export const getCurrentUser = cache(
  async (): Promise<AuthenticatedUser | null> => {
    // React cache deduplicates repeated session checks within one server render.
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    return token ? findUserBySessionToken(token) : null;
  },
);

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new HttpError("Authentication is required.", 401);
  }

  return user;
}

export async function requirePageUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export function assertOwnership(
  currentUserId: string,
  resourceOwnerId: string,
) {
  // Keep ownership enforcement available to both Route Handlers and the DAL.
  if (!isResourceOwner(currentUserId, resourceOwnerId)) {
    throw new HttpError(
      "You do not have permission to change this resource.",
      403,
    );
  }
}
