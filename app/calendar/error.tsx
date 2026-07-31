"use client";

import { useEffect } from "react";
import { FiRefreshCw } from "react-icons/fi";
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
      <aside className="hidden w-[clamp(260px,23vw,304px)] flex-none border-r border-[var(--line)] bg-[#f8faf8] min-[760px]:block" />
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-[58px] border-b border-[var(--line)] max-[1060px]:min-h-[98px]" />
        <div className="min-h-[55px] border-b border-[var(--line)]" />
        <div className="grid min-h-0 flex-1 place-items-center bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_27px,var(--grid-line)_28px)] p-6">
          <StatePanel
            className="min-h-[220px] w-full max-w-[560px] bg-[rgba(255,250,250,0.96)]"
            title="The calendar could not be loaded"
            description="The server or database may be temporarily unavailable. Your existing bookings have not been changed."
            tone="danger"
            role="alert"
            action={
              <button
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#d7c9c9] bg-white px-4 
                          text-xs font-bold text-[#8b3e3e] hover:bg-[#fff6f6] [&>svg]:size-4"
                type="button"
                onClick={unstable_retry}
              >
                <FiRefreshCw aria-hidden="true" />
                Try again
              </button>
            }
          />
        </div>
      </section>
    </main>
  );
}
