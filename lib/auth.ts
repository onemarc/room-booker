export type SessionIdentity = {
  id: string;
  displayName: string;
  emailConfirmed: boolean;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function deriveSessionIdentity(
  sessionUser: SessionIdentity | null,
): SessionIdentity | null {
  if (!sessionUser) {
    return null;
  }

  // Clone only the safe identity fields so database-only properties cannot
  // cross the session boundary into pages or Route Handler responses.
  return {
    id: sessionUser.id,
    displayName: sessionUser.displayName,
    emailConfirmed: sessionUser.emailConfirmed,
  };
}

export function isResourceOwner(
  currentUserId: string,
  resourceOwnerId: string,
) {
  return currentUserId === resourceOwnerId;
}
