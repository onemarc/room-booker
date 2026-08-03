import {
  handleRouteError,
  jsonResponse,
} from "@/lib/server/http";
import { materializeAndListNotifications } from "@/lib/server/notifications";
import { assertStateChangingRequest } from "@/lib/server/request-security";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertStateChangingRequest(request);
    const user = await requireUser();
    const notifications = await materializeAndListNotifications(user.id);
    return jsonResponse({ notifications });
  } catch (error) {
    return handleRouteError(error);
  }
}
