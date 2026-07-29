import { CalendarShell } from "@/components/calendar/CalendarShell";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { listRoomsWithAvailability } from "@/lib/server/rooms";
import { requirePageUser } from "@/lib/server/session";
import {
  getZonedDateIso,
  serializeUtcInstant,
} from "@/lib/time";

export const metadata = {
  title: "Calendar",
};

export default async function CalendarPage() {
  const user = await requirePageUser();
  const now = new Date();
  const initialActiveDate = getZonedDateIso(now, OFFICE_TIME_ZONE);
  const initialRooms = await listRoomsWithAvailability({
    activeDate: initialActiveDate,
    timeZone: OFFICE_TIME_ZONE,
    now,
  });

  return (
    <CalendarShell
      displayName={user.displayName}
      initialNow={serializeUtcInstant(now)}
      initialActiveDate={initialActiveDate}
      initialRooms={initialRooms}
    />
  );
}
