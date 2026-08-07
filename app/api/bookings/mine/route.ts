import { listPastBookings, listUpcomingBookings } from "@/lib/server/bookings";
import { handleRouteError, HttpError, jsonResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const searchParams = new URL(request.url).searchParams;
    const section = searchParams.get("section");

    if (section === "upcoming") {
      const result = await listUpcomingBookings({
        currentUserId: user.id,
        cursor: searchParams.get("cursor") ?? undefined,
      });
      return jsonResponse(result);
    }

    if (section === "past") {
      const result = await listPastBookings({
        currentUserId: user.id,
        cursor: searchParams.get("cursor") ?? undefined,
      });
      return jsonResponse(result);
    }

    throw new HttpError(
      "The booking section must be upcoming or past.",
      400,
      undefined,
      "invalid_booking_section",
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
