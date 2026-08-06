import {
  CalendarGridSkeleton,
  CalendarHeaderSkeleton,
  CalendarSidebarSkeleton,
} from "@/components/calendar/CalendarSurfaceSkeleton";

export default function CalendarLoading() {
  return (
    <main
      className="flex h-screen min-h-[560px] w-full overflow-hidden bg-[var(--surface)] supports-[height:100dvh]:h-dvh"
      role="status"
      aria-label="Loading calendar"
    >
      <span className="sr-only">Loading calendar</span>
      <CalendarSidebarSkeleton />
      <section className="flex min-w-0 flex-1 flex-col">
        <CalendarHeaderSkeleton />
        <CalendarGridSkeleton />
      </section>
    </main>
  );
}
