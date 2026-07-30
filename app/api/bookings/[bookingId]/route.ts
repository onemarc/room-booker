import {
  cancelUpcomingBooking,
  updateUpcomingBooking,
} from "@/lib/server/bookings";
import {
  handleRouteError,
  HttpError,
  jsonResponse,
} from "@/lib/server/http";
import {
  assertStateChangingRequest,
  readJsonObject,
} from "@/lib/server/request-security";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    assertStateChangingRequest(request);
    const user = await requireUser();
    const { bookingId } = await params;
    const input = await readJsonObject(request);
    const booking = await updateUpcomingBooking({
      bookingId,
      currentUserId: user.id,
      input: {
        title: input.title,
        date: input.date,
        endDate: input.endDate,
        startTime: input.startTime,
        endTime: input.endTime,
        timeZone: input.timeZone,
        color: input.color,
      },
    });

    if (!booking) {
      throw new HttpError(
        "The booking could not be edited.",
        404,
        undefined,
        "booking_not_editable",
      );
    }

    return jsonResponse({ booking });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    assertStateChangingRequest(request);
    const user = await requireUser();
    const { bookingId } = await params;
    const cancelled = await cancelUpcomingBooking({
      bookingId,
      currentUserId: user.id,
    });

    if (!cancelled) {
      throw new HttpError(
        "The booking could not be cancelled.",
        404,
        undefined,
        "booking_not_cancellable",
      );
    }

    return jsonResponse({ cancelled });
  } catch (error) {
    return handleRouteError(error);
  }
}
