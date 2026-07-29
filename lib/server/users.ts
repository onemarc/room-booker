import "server-only";

import { query } from "@/lib/server/database";

type UserRow = {
  id: string;
  display_name: string;
};

type AuthenticationUserRow = UserRow & {
  password_hash: string;
};

export type AuthenticatedUser = {
  id: string;
  displayName: string;
};

// Return an explicit safe DTO instead of passing database rows into React.
function toAuthenticatedUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    displayName: row.display_name,
  };
}

export async function createUser(input: {
  displayName: string;
  email: string;
  passwordHash: string;
}) {
  const result = await query<UserRow>(
    `
      INSERT INTO users (display_name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, display_name
    `,
    [input.displayName, input.email, input.passwordHash],
  );

  return toAuthenticatedUser(result.rows[0]);
}

export async function findUserForAuthentication(email: string) {
  const result = await query<AuthenticationUserRow>(
    `
      SELECT id, display_name, password_hash
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
