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

// A single day has a much wider column than Week view. Keep its placeholder
// events narrow and tall so the transition still reads like the real vertical
// booking shapes instead of stretching a Week-view pill across the page.
const DAY_LOADING_GHOST_BOOKINGS = [
  { top: "13%", height: "19%", left: "12%", right: "70%" },
  { top: "53%", height: "14%", left: "70%", right: "12%" },
];

export function CalendarLoadingOverlay({
  dates,
  label = "Loading schedule",
  className = "",
  style,
}: {
  dates: readonly string[];
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const gridStyle = {
    "--calendar-columns": dates.length,
  } as CSSProperties;
  const isDayView = dates.length === 1;

  return (
    <div
      className={[
        "pointer-events-none absolute inset-0 z-6 grid grid-cols-[62px_repeat(var(--calendar-columns),minmax(94px,1fr))]",
        "bg-[rgba(255,255,255,0.76)] backdrop-blur-[2px]",
        className,
      ].join(" ")}
      style={{ ...gridStyle, ...style }}
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div
        className="border-r border-[var(--grid-line)] bg-[rgba(255,255,255,0.9)]"
        aria-hidden="true"
      />
      {dates.map((date, dayIndex) => (
        <div
          className="relative min-w-0 border-r border-[var(--grid-line)] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_55px,var(--grid-line)_55px,var(--grid-line)_56px)]"
          key={date}
        >
          {isDayView
            ? DAY_LOADING_GHOST_BOOKINGS.map((booking) => (
                <div
                  className="absolute animate-pulse rounded-[7px] border border-[#d4e0d7] bg-[#edf3ef] p-2 shadow-[0_2px_8px_rgba(34,53,42,0.08)] motion-reduce:animate-none"
                  key={`${date}:${booking.top}`}
                  style={{
                    top: booking.top,
                    height: booking.height,
                    // Bound both sides to the cell
                    left: booking.left,
                    right: booking.right,
                  }}
                >
                  <div className="h-2.5 w-3/4 rounded-sm bg-[#cbded0]" />
                  <div className="mt-1 h-2 w-1/2 rounded-sm bg-[#d8e5da]" />
                </div>
              ))
            : LOADING_GHOST_BOOKINGS.filter(
                // Repeat the weekday pattern across recycled windows so the
                // visible week always has representative event shapes.
                (booking) => booking.day === dayIndex % 7,
              ).map((booking) => (
                <div
                  className="absolute animate-pulse rounded-[7px] border border-[#d4e0d7] bg-[#edf3ef] p-2 shadow-[0_2px_8px_rgba(34,53,42,0.08)] motion-reduce:animate-none"
                  key={`${date}:${booking.top}`}
                  style={{
                    top: booking.top,
                    height: booking.height,
                    left: `${booking.offset}%`,
                    width: `${booking.width}%`,
                  }}
                >
                  <div
                    className="h-2.5 rounded-sm bg-[#cbded0]"
                    style={{ width: `${Math.max(42, booking.width - 18)}%` }}
                  />
                  <div className="mt-1 h-2 w-1/2 rounded-sm bg-[#d8e5da]" />
                </div>
              ))}
        </div>
      ))}
    </div>
  );
}
