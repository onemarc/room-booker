import "server-only";

import { query } from "@/lib/server/database";

type UserRow = {
  id: string;
  display_name: string;
  email_confirmed: boolean;
};

type AuthenticationUserRow = UserRow & {
  password_hash: string;
};

export type AuthenticatedUser = {
  id: string;
  displayName: string;
  emailConfirmed: boolean;
};

// Return an explicit safe DTO instead of passing database rows into React.
function toAuthenticatedUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    displayName: row.display_name,
    emailConfirmed: row.email_confirmed,
  };
}

export async function createUser(input: {
  displayName: string;
  email: string;
  passwordHash: string;
  emailConfirmed: boolean;
}) {
  const result = await query<UserRow>(
    `
      INSERT INTO users (
        display_name,
        email,
        password_hash,
        email_confirmed_at
      )
      VALUES ($1, $2, $3, CASE WHEN $4 THEN now() ELSE NULL END)
      RETURNING id, display_name, email_confirmed_at IS NOT NULL AS email_confirmed
    `,
    [
      input.displayName,
      input.email,
      input.passwordHash,
      input.emailConfirmed,
    ],
  );

  return toAuthenticatedUser(result.rows[0]);
}

export async function findUserForAuthentication(email: string) {
  const result = await query<AuthenticationUserRow>(
    `
      SELECT id, display_name, password_hash,
        email_confirmed_at IS NOT NULL AS email_confirmed
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  );
  const user = result.rows[0];

  if (!user) {
    return null;
  }

  return {
    ...toAuthenticatedUser(user),
    passwordHash: user.password_hash,
  };
}
