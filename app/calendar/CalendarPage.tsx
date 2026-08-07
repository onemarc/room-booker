import { CalendarShell } from "@/components/calendar/calendar-shell/CalendarShell";
import { getCalendarEventPrefetchPeriodDates } from "@/components/calendar/calendar-grid/calendar-window";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { listRoomSchedule } from "@/lib/server/bookings";
import { listRoomsWithAvailability } from "@/lib/server/rooms";
import { requirePageUser } from "@/lib/server/session";
import {
  getPeriodRangeUtc,
  getZonedDateIso,
  parseCalendarDate,
  serializeUtcInstant,
  type CalendarView,
} from "@/lib/time";

export const metadata = {
  title: "Calendar",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    confirmation?: string;
    date?: string;
    roomId?: string;
    view?: string;
  }>;
}) {
  const requestedParams = await searchParams;
  const requestedConfirmation = requestedParams.confirmation;
  const user = await requirePageUser();
  const now = new Date();
  const today = getZonedDateIso(now, OFFICE_TIME_ZONE);
  let initialActiveDate = today;
  if (requestedParams.date) {
    try {
      parseCalendarDate(requestedParams.date);
      initialActiveDate = requestedParams.date;
    } catch {
      // Ignore malformed navigation state and keep the calendar on today.
    }
  }
  const initialView: CalendarView =
    requestedParams.view === "day" ? "day" : "week";
  const initialRooms = await listRoomsWithAvailability({
    activeDate: initialActiveDate,
    timeZone: OFFICE_TIME_ZONE,
    now,
  });
  const initialRoomId =
    initialRooms.find((room) => room.id === requestedParams.roomId)?.id ??
    initialRooms[0]?.id;
  const initialSchedulePeriodDates = getCalendarEventPrefetchPeriodDates({
    visibleStartDate: initialActiveDate,
    visibleEndDate: initialActiveDate,
  });
  // Match the client's initial schedule signature so it can hydrate with the
  // real first-room schedule without issuing a duplicate request on mount.
  const initialBookings = initialRoomId
    ? Array.from(
        new Map(
          (
            await Promise.all(
              initialSchedulePeriodDates.map(async (periodDate) => {
                const range = getPeriodRangeUtc(
                  periodDate,
                  OFFICE_TIME_ZONE,
                  "week",
                );
                return listRoomSchedule({
                  roomId: initialRoomId,
                  rangeStart: range.start,
                  rangeEnd: range.end,
                  currentUserId: user.id,
                });
              }),
            )
          )
            .flat()
            .map((booking) => [booking.id, booking] as const),
        ).values(),
      )
    : [];

  return (
    <CalendarShell
      displayName={user.displayName}
      emailConfirmed={user.emailConfirmed}
      confirmationStatus={
        requestedConfirmation === "success" ||
        requestedConfirmation === "invalid"
          ? requestedConfirmation
          : null
      }
      initialNow={serializeUtcInstant(now)}
      initialActiveDate={initialActiveDate}
      initialView={initialView}
      initialRoomId={initialRoomId}
      initialRooms={initialRooms}
      initialBookings={initialBookings}
    />
  );
}
