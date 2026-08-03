import { reissueEmailConfirmation } from "@/lib/server/email-confirmation";
import {
  handleRouteError,
  HttpError,
  jsonResponse,
} from "@/lib/server/http";
import { assertStateChangingRequest } from "@/lib/server/request-security";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertStateChangingRequest(request);
    const user = await requireUser();
    const issued = await reissueEmailConfirmation({
      currentUserId: user.id,
      requestOrigin: new URL(request.url).origin,
    });
    if (!issued) {
      throw new HttpError("This email is already confirmed.", 409);
    }
    return jsonResponse({ issued: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
