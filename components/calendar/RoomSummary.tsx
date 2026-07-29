import type { RoomAvailability } from "@/lib/rooms";
import { formatTimeInZone } from "@/lib/time";

export function RoomSummary({
  room,
  timeZone,
}: {
  room: RoomAvailability;
  timeZone: string;
}) {
  const availableTimes = room.availableStarts
    .map((instant) => formatTimeInZone(instant, timeZone))
    .join(", ");

  return (
    <span className="grid min-w-0 gap-1 text-xs leading-[1.35]">
      <span className="flex items-center justify-between gap-2.5">
        <strong className="overflow-hidden text-[13px] font-[720] text-ellipsis whitespace-nowrap text-[#233028]">
          {room.name}
        </strong>
        <span className="flex-none text-[#66736b]">
          Floor {room.floor}
        </span>
      </span>
      <span className="text-[#66736b]">
        Capacity: {room.capacity} people
      </span>
      <span className="wrap-anywhere text-[#455249]">
        {availableTimes ? (
          <>
            <strong className="font-[650] text-[#718078]">
              Available at
            </strong>{" "}
            {availableTimes}
          </>
        ) : (
          "No available 30-minute slots on this date"
        )}
      </span>
    </span>
  );
}
