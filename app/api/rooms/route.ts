import { handleRouteError, HttpError, jsonResponse } from "@/lib/server/http";
import { listRoomsWithAvailability } from "@/lib/server/rooms";
import { requireUser } from "@/lib/server/session";
import { canonicalizeTimeZone, parseCalendarDate } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireUser();

    const searchParams = new URL(request.url).searchParams;
    const activeDate = searchParams.get("date");
    const requestedTimeZone = searchParams.get("timeZone");
    const requestedMinimumCapacity = searchParams.get("minCapacity");

    if (!activeDate || !requestedTimeZone) {
      throw new HttpError(
        "Both date and timeZone query parameters are required.",
        400,
      );
    }

    try {
      parseCalendarDate(activeDate);
      const timeZone = canonicalizeTimeZone(requestedTimeZone);
      const minimumCapacity = requestedMinimumCapacity
        ? Number(requestedMinimumCapacity)
        : 1;
      const rooms = await listRoomsWithAvailability({
        activeDate,
        timeZone,
        minimumCapacity,
      });

      return jsonResponse({
        activeDate,
        timeZone,
        minimumCapacity,
        rooms,
      });
    } catch (error) {
      if (error instanceof RangeError) {
        throw new HttpError(error.message, 400);
      }

      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
