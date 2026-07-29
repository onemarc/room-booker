import {
  handleRouteError,
  jsonResponse,
} from "@/lib/server/http";
import { assertStateChangingRequest } from "@/lib/server/request-security";
import {
  deleteSession,
  requireUser,
} from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertStateChangingRequest(request);
    // Authentication comes from the verified cookie, never a client-supplied user ID.
    await requireUser();
    await deleteSession();
    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
