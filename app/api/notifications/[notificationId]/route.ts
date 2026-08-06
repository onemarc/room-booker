import { handleRouteError, HttpError, jsonResponse } from "@/lib/server/http";
import { acknowledgeNotification } from "@/lib/server/notifications";
import { assertStateChangingRequest } from "@/lib/server/request-security";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    assertStateChangingRequest(request);
    const user = await requireUser();
    const { notificationId } = await params;
    const acknowledged = await acknowledgeNotification({
      notificationId,
      currentUserId: user.id,
    });
    if (!acknowledged) {
      throw new HttpError(
        "The notification could not be dismissed.",
        404,
      );
    }
    return jsonResponse({ acknowledged: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
