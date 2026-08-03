import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSessionIdentity,
  isResourceOwner,
  normalizeEmail,
} from "./auth.ts";

test("email normalization trims and canonicalizes casing", () => {
  assert.equal(
    normalizeEmail("  Employee.Name@Example.COM  "),
    "employee.name@example.com",
  );
});

test("session identity is derived from the verified safe session fields", () => {
  const databaseUser = {
    id: "session-user",
    displayName: "Paul Johnson",
    emailConfirmed: true,
    email: "private@example.com",
    passwordHash: "never-serialize",
  };

  assert.deepEqual(deriveSessionIdentity(databaseUser), {
    id: "session-user",
    displayName: "Paul Johnson",
    emailConfirmed: true,
  });
  assert.equal(deriveSessionIdentity(null), null);
});

test("ownership requires the session user and resource owner to match", () => {
  assert.equal(isResourceOwner("user-a", "user-a"), true);
  assert.equal(isResourceOwner("user-a", "user-b"), false);
});
