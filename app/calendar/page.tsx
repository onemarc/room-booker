import { CalendarShell } from "@/components/calendar/calendar-shell/CalendarShell";
import { getCalendarEventPrefetchPeriodDates } from "@/components/calendar/calendar-grid/calendar-window";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { listRoomSchedule } from "@/lib/server/bookings";
import { listRoomsWithAvailability } from "@/lib/server/rooms";
import { requirePageUser } from "@/lib/server/session";
import { getPeriodRangeUtc, getZonedDateIso, serializeUtcInstant } from "@/lib/time";

export const metadata = {
  title: "Calendar",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const requestedConfirmation = (await searchParams).confirmation;
  const user = await requirePageUser();
  const now = new Date();
  const initialActiveDate = getZonedDateIso(now, OFFICE_TIME_ZONE);
  const initialRooms = await listRoomsWithAvailability({
    activeDate: initialActiveDate,
    timeZone: OFFICE_TIME_ZONE,
    now,
  });
  const initialRoomId = initialRooms[0]?.id;
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
      initialRooms={initialRooms}
      initialBookings={initialBookings}
    />
  );
}
