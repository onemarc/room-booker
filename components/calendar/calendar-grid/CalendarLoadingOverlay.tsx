import type { CSSProperties } from "react";

const LOADING_GHOST_BOOKINGS = [
  { day: 0, top: "8%", height: "11%", width: 72, offset: 8 },
  { day: 0, top: "34%", height: "8%", width: 54, offset: 24 },
  { day: 1, top: "19%", height: "14%", width: 78, offset: 10 },
  { day: 2, top: "47%", height: "9%", width: 46, offset: 18 },
  { day: 2, top: "64%", height: "13%", width: 68, offset: 6 },
  { day: 4, top: "13%", height: "10%", width: 62, offset: 21 },
  { day: 4, top: "54%", height: "12%", width: 76, offset: 8 },
  { day: 5, top: "29%", height: "9%", width: 56, offset: 16 },
  { day: 6, top: "20%", height: "15%", width: 66, offset: 12 },
];

export function CalendarLoadingOverlay({
  dates,
  label = "Loading schedule",
}: {
  dates: readonly string[];
  label?: string;
}) {
  const gridStyle = {
    "--calendar-columns": dates.length,
  } as CSSProperties;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-6 grid grid-cols-[62px_repeat(var(--calendar-columns),minmax(94px,1fr))]
                bg-[rgba(255,255,255,0.88)] backdrop-blur-[3px]"
      style={gridStyle}
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" />
      {dates.map((date, dayIndex) => (
        <div className="relative min-w-0" key={date}>
          {LOADING_GHOST_BOOKINGS.filter(
            // Repeat the weekday pattern across recycled windows so the
            // visible week always has representative event shapes.
            (booking) => booking.day === dayIndex % 7,
          ).map((booking) => (
            <div
              className="absolute rounded-[7px] border border-[#d4e0d7] bg-[#edf3ef] p-2 shadow-[0_2px_8px_rgba(34,53,42,0.08)]"
              key={`${date}:${booking.top}`}
              style={{
                top: booking.top,
                height: booking.height,
                left: `${booking.offset}%`,
                width: `${booking.width}%`,
              }}
            >
              <div
                className="h-2.5 animate-pulse rounded-sm bg-[#cbded0]"
                style={{ width: `${Math.max(42, booking.width - 18)}%` }}
              />
              <div className="mt-1 h-2 w-1/2 animate-pulse rounded-sm bg-[#d8e5da]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
