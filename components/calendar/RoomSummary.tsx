import type { RoomAvailability } from "@/lib/rooms";
import { CALENDAR_SLOT_MINUTES, formatTimeInZone } from "@/lib/time";

const MINUTE_IN_MILLISECONDS = 60_000;

function formatAvailabilityWindows(
  availableStarts: string[],
  timeZone: string,
) {
  const slotLength = CALENDAR_SLOT_MINUTES * MINUTE_IN_MILLISECONDS;
  const starts = [...new Set(availableStarts)]
    .map((instant) => new Date(instant))
    .filter((instant) => !Number.isNaN(instant.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  const windows: Array<{ start: Date; end: Date }> = [];

  // Consecutive 30-minute starts are more useful as one free window than as
  // a long comma-separated list, while gaps still reveal every busy period.
  for (const start of starts) {
    const end = new Date(start.getTime() + slotLength);
    const currentWindow = windows.at(-1);

    if (currentWindow && start.getTime() <= currentWindow.end.getTime()) {
      if (end.getTime() > currentWindow.end.getTime()) {
        currentWindow.end = end;
      }
      continue;
    }

    windows.push({ start, end });
  }

  return windows.map(
    ({ start, end }) =>
      `${formatTimeInZone(start, timeZone)}–${formatTimeInZone(end, timeZone)}`,
  );
}

export function RoomSummary({
  room,
  timeZone,
}: {
  room: RoomAvailability;
  timeZone: string;
}) {
  const availabilityWindows = formatAvailabilityWindows(
    room.availableStarts,
    timeZone,
  );

  return (
    <span className="grid min-w-0 flex-1 gap-2 text-xs leading-[1.35]">
      <span className="flex min-w-0 items-baseline justify-between gap-3">
        <strong className="overflow-hidden text-[14px] font-[720] text-ellipsis whitespace-nowrap text-[#202a24]">
          {room.name}
        </strong>
        <span className="flex-none text-[12px] text-[#778179]">
          Floor {room.floor}
        </span>
      </span>
      <span className="text-[12px] text-[#667169]">
        {room.capacity} {room.capacity === 1 ? "seat" : "seats"}
      </span>
      <span className="flex min-w-0 items-start gap-2 border-t border-[#e5e9e5] pt-2 text-[12px] leading-[1.45] text-[#4e5b53]">
        <span
          className={[
            "mt-[5px] size-1.5 flex-none rounded-full",
            availabilityWindows.length > 0
              ? "bg-[#4f8068]"
              : "bg-[#a8afa9]",
          ].join(" ")}
          aria-hidden="true"
        />
        <span className="min-w-0 wrap-anywhere">
          {availabilityWindows.length > 0 ? (
            <>
              <strong className="font-[680] text-[#426c57]">Free</strong>{" "}
              <span className="font-medium tracking-[-0.01em] tabular-nums">
                {availabilityWindows.join(" · ")}
              </span>
            </>
          ) : (
            "No available slots on this date"
          )}
        </span>
      </span>
    </span>
  );
}
