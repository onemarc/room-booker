import "server-only";

import { normalizeEmail } from "@/lib/auth";
import { HttpError, type FieldErrors } from "@/lib/server/http";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;
const MAX_DISPLAY_NAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

function characterCount(value: string) {
  return Array.from(value).length;
}

function readString(
  input: Record<string, unknown>,
  key: string,
) {
  return typeof input[key] === "string" ? input[key] : "";
}

function validateEmail(
  input: Record<string, unknown>,
  errors: FieldErrors,
) {
  const email = normalizeEmail(readString(input, "email"));

  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    errors.email = "Enter a valid email address.";
  }

  return email;
}

export function validateRegistrationInput(
  input: Record<string, unknown>,
) {
  const displayName = readString(input, "displayName").trim();
  const email = normalizeEmail(readString(input, "email"));
  const password = readString(input, "password");
  const errors: FieldErrors = {};

  if (!displayName) {
    errors.displayName = "Enter your name.";
  } else if (characterCount(displayName) > MAX_DISPLAY_NAME_LENGTH) {
    errors.displayName = "Name must be 100 characters or fewer.";
  }

  validateEmail(input, errors);

  const passwordLength = characterCount(password);
  if (
    passwordLength < MIN_PASSWORD_LENGTH ||
    passwordLength > MAX_PASSWORD_LENGTH
  ) {
    errors.password = "Password must be 8–72 characters.";
  } else if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_LENGTH) {
    // Bcrypt truncates after 72 bytes, so reject rather than hash ambiguous input.
    errors.password =
      "Password must be no more than 72 bytes when encoded.";
  }

  if (Object.keys(errors).length) {
    throw new HttpError(
      "Check the highlighted fields and try again.",
      400,
      errors,
    );
  }

  return { displayName, email, password };
}

export function validateLoginInput(input: Record<string, unknown>) {
  const errors: FieldErrors = {};
  const email = validateEmail(input, errors);
  const password = readString(input, "password");

  const passwordLength = characterCount(password);
  if (!password) {
    errors.password = "Enter your password.";
  } else if (
    passwordLength > MAX_PASSWORD_LENGTH ||
    Buffer.byteLength(password, "utf8") > MAX_PASSWORD_LENGTH
  ) {
    errors.password = "Password must be 72 characters or fewer.";
  }

  if (Object.keys(errors).length) {
    throw new HttpError(
      "Check the highlighted fields and try again.",
      400,
      errors,
    );
  }

  return { email, password };
}
