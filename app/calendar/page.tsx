import { CalendarShell } from "@/components/calendar/calendar-shell/CalendarShell";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { listRoomSchedule } from "@/lib/server/bookings";
import { listRoomsWithAvailability } from "@/lib/server/rooms";
import { requirePageUser } from "@/lib/server/session";
import {
  getPeriodRangeUtc,
  getZonedDateIso,
  serializeUtcInstant,
} from "@/lib/time";

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
  const initialRange = getPeriodRangeUtc(
    initialActiveDate,
    OFFICE_TIME_ZONE,
    "week",
  );
  // Match the client's initial schedule signature so it can hydrate with the
  // real first-room schedule without issuing a duplicate request on mount.
  const initialBookings = initialRoomId
    ? await listRoomSchedule({
        roomId: initialRoomId,
        rangeStart: initialRange.start,
        rangeEnd: initialRange.end,
        currentUserId: user.id,
      })
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
