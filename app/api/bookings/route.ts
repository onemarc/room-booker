import {
  handleRouteError,
  HttpError,
  jsonResponse,
} from "@/lib/server/http";
import {
  createBooking,
  listRoomSchedule,
} from "@/lib/server/bookings";
import {
  assertStateChangingRequest,
  readJsonObject,
} from "@/lib/server/request-security";
import { requireUser } from "@/lib/server/session";
import {
  canonicalizeTimeZone,
  getPeriodRangeUtc,
  parseCalendarDate,
  serializeUtcInstant,
  type CalendarView,
} from "@/lib/time";

export const runtime = "nodejs";

function parseScheduleRequest(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const roomId = searchParams.get("roomId");
  const activeDate = searchParams.get("date");
  const requestedView = searchParams.get("view");
  const requestedTimeZone = searchParams.get("timeZone");

  if (!roomId || !activeDate || !requestedView || !requestedTimeZone) {
    throw new HttpError(
      "roomId, date, view, and timeZone query parameters are required.",
      400,
      undefined,
      "missing_schedule_parameters",
    );
  }

  if (requestedView !== "day" && requestedView !== "week") {
    throw new HttpError(
      "The calendar view must be day or week.",
      400,
      undefined,
      "invalid_calendar_view",
    );
  }

  try {
    parseCalendarDate(activeDate);
    const timeZone = canonicalizeTimeZone(requestedTimeZone);
    const view: CalendarView = requestedView;

    return {
      roomId,
      range: getPeriodRangeUtc(activeDate, timeZone, view),
    };
  } catch (error) {
    if (error instanceof RangeError) {
      throw new HttpError(
        error.message,
        400,
        undefined,
        "invalid_schedule_parameters",
      );
    }

    throw error;
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { roomId, range } = parseScheduleRequest(request);
    const bookings = await listRoomSchedule({
      roomId,
      rangeStart: range.start,
      rangeEnd: range.end,
      currentUserId: user.id,
    });

    return jsonResponse({
      roomId,
      range: {
        start: serializeUtcInstant(range.start),
        end: serializeUtcInstant(range.end),
      },
      bookings,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertStateChangingRequest(request);
    const user = await requireUser();
    const input = await readJsonObject(request);
    const booking = await createBooking({
      currentUserId: user.id,
      input: {
        roomId: input.roomId,
        title: input.title,
        date: input.date,
        endDate: input.endDate,
        startTime: input.startTime,
        endTime: input.endTime,
        timeZone: input.timeZone,
        color: input.color,
      },
    });

    return jsonResponse({ booking }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
