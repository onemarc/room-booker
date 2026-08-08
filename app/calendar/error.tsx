"use client";

import { useEffect } from "react";
import { FiRefreshCw } from "react-icons/fi";
import {
  CalendarGridSkeleton,
  CalendarHeaderSkeleton,
  CalendarSidebarSkeleton,
} from "@/components/calendar/CalendarSurfaceSkeleton";
import { StatePanel } from "@/components/ui/AsyncState";

export default function CalendarError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-screen min-h-[560px] w-full overflow-hidden bg-[var(--surface)] supports-[height:100dvh]:h-dvh">
      {/* Keep the fallback sidebar as a direct flex item so its room surface
          fills the viewport even while this route segment is in an error state. */}
      <CalendarSidebarSkeleton className="hidden min-[761px]:flex" />
      <section className="flex min-w-0 flex-1 flex-col">
        <CalendarHeaderSkeleton />
        <CalendarGridSkeleton
          overlay={
            <StatePanel
              className="min-h-[220px] w-full max-w-[560px] bg-[rgba(255,250,250,0.96)] max-[760px]:min-h-[180px] max-[760px]:p-4"
              title="The calendar could not be loaded"
              description="The server or database may be temporarily unavailable. Your existing bookings have not been changed."
              tone="danger"
              role="alert"
              action={
                <button
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#d7c9c9] bg-white px-4 text-xs font-bold text-[#8b3e3e] hover:bg-[#fff6f6] [&>svg]:size-4"
                  type="button"
                  onClick={unstable_retry}
                >
                  <FiRefreshCw aria-hidden="true" />
                  Try again
                </button>
              }
            />
          }
        />
      </section>
    </main>
  );
}
