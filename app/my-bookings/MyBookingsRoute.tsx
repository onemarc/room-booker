import { MyBookingsPage } from "@/components/calendar/my-bookings/MyBookingsPage";
import { requirePageUser } from "@/lib/server/session";
import type { CalendarView } from "@/lib/time";

export const metadata = {
  title: "My bookings",
};

export default async function MyBookingsRoute({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    roomId?: string;
    view?: string;
  }>;
}) {
  // Keep the route protected at the server boundary before the client starts
  // loading the user's booking history from the authenticated API.
  const requestedParams = await searchParams;
  const user = await requirePageUser();
  const view: CalendarView =
    requestedParams.view === "day" ? "day" : "week";
  const calendarParams = new URLSearchParams({ view });
  if (requestedParams.date) {
    calendarParams.set("date", requestedParams.date);
  }
  if (requestedParams.roomId) {
    calendarParams.set("roomId", requestedParams.roomId);
  }

  return (
    <MyBookingsPage
      calendarHref={"/calendar?" + calendarParams.toString()}
      displayName={user.displayName}
      view={view}
    />
  );
}
