import { validateLoginInput } from "@/lib/server/auth-validation";
import {
  handleRouteError,
  HttpError,
  jsonResponse,
} from "@/lib/server/http";
import {
  verifyAgainstDummyPassword,
  verifyPassword,
} from "@/lib/server/password";
import {
  assertStateChangingRequest,
  readJsonObject,
} from "@/lib/server/request-security";
import {
  assertSessionConfiguration,
  createSession,
} from "@/lib/server/session";
import { findUserForAuthentication } from "@/lib/server/users";

export const runtime = "nodejs";

const INVALID_CREDENTIALS = "Email or password is incorrect.";

export async function POST(request: Request) {
  try {
    assertStateChangingRequest(request);
    assertSessionConfiguration();

    const input = validateLoginInput(await readJsonObject(request));
    const user = await findUserForAuthentication(input.email);

    if (!user) {
      // Match the bcrypt work performed for known users to reduce email timing leaks.
      await verifyAgainstDummyPassword(input.password);
      throw new HttpError(INVALID_CREDENTIALS, 401);
    }

    const passwordMatches = await verifyPassword(
      input.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new HttpError(INVALID_CREDENTIALS, 401);
    }

    await createSession(user.id);

    return jsonResponse({
      user: {
        id: user.id,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
