import { validateRegistrationInput } from "@/lib/server/auth-validation";
import { handleRouteError, HttpError, isPostgresUniqueViolation, jsonResponse } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/password";
import { assertStateChangingRequest, readJsonObject } from "@/lib/server/request-security";
import { assertSessionConfiguration, createSession } from "@/lib/server/session";
import { createUser } from "@/lib/server/users";
import { isEmailConfirmationRequired, issueEmailConfirmation } from "@/lib/server/email-confirmation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertStateChangingRequest(request);
    // Fail before inserting a user if the server cannot issue a valid session.
    assertSessionConfiguration();

    const input = validateRegistrationInput(
      await readJsonObject(request),
    );
    const passwordHash = await hashPassword(input.password);
    const confirmationRequired = isEmailConfirmationRequired();
    const user = await createUser({
      displayName: input.displayName,
      email: input.email,
      passwordHash,
      emailConfirmed: !confirmationRequired,
    });

    if (confirmationRequired) {
      await issueEmailConfirmation({
        userId: user.id,
        email: input.email,
        requestOrigin: new URL(request.url).origin,
      });
    }

    await createSession(user.id);

    return jsonResponse({ user, confirmationRequired }, 201);
  } catch (error) {
    if (isPostgresUniqueViolation(error, "users_email_key")) {
      return handleRouteError(
        new HttpError(
          "An account with this email already exists.",
          409,
          {
            email: "Use a different email or sign in.",
          },
        ),
      );
    }

    return handleRouteError(error);
  }
}
