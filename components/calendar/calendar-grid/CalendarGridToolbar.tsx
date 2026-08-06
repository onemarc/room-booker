import { FiPlus } from "react-icons/fi";
import { CapacityFilter } from "@/components/calendar/CapacityFilter";
import { RoomSelector } from "@/components/calendar/RoomSelector";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { canonicalizeTimeZone } from "@/lib/time";
import type { RoomAvailability } from "@/lib/rooms";

// The toolbar only presents room context and actions; calendar state remains
// in the grid shell so changing its layout cannot change selection behavior.
export function CalendarGridToolbar({
  selectedRoom,
  rooms,
  selectedRoomId,
  timeZone,
  showRoomSelector,
  isRoomsLoading,
  minimumCapacity,
  canBook,
  onSelectRoom,
  onMinimumCapacityChange,
  onOpenBooking,
}: {
  selectedRoom?: RoomAvailability;
  rooms: RoomAvailability[];
  selectedRoomId: string;
  timeZone: string;
  showRoomSelector: boolean;
  isRoomsLoading: boolean;
  minimumCapacity: number;
  canBook: boolean;
  onSelectRoom: (roomId: string) => void;
  onMinimumCapacityChange: (value: number) => void;
  onOpenBooking: () => void;
}) {
  const canonicalUserZone = canonicalizeTimeZone(timeZone);
  const canonicalOfficeZone = canonicalizeTimeZone(OFFICE_TIME_ZONE);

  return (
    <div className="flex h-[61px] flex-none items-center justify-between gap-[18px]
                    border-b border-[var(--line)] py-1.5 pr-[15px] pl-3.5">
      <div className="grid gap-px">
        {showRoomSelector ? 
          <RoomSelector
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            timeZone={timeZone}
            isLoading={isRoomsLoading}
            onSelectRoom={onSelectRoom}
          /> :
          <strong className="text-[13px] font-bold text-[#29352e]">
            {selectedRoom?.name ?? "Select a room"}
          </strong>
        }
        {selectedRoom && !showRoomSelector ?
          <span className="text-[11px] text-[#778179]">
            Floor {selectedRoom.floor} · {selectedRoom.capacity} people
          </span> : null}
      </div>
      <div className="flex items-center gap-3">
        {showRoomSelector ? (
          <CapacityFilter
            value={minimumCapacity}
            compact
            onChange={onMinimumCapacityChange}
          />
        ) : null}
        <p className="m-0 text-right text-xs text-[#778179] max-[820px]:hidden">
          {canonicalUserZone === canonicalOfficeZone ? 
            `${canonicalOfficeZone} office time` : `Times shown in ${canonicalUserZone} · Office ${canonicalOfficeZone}`
          }
        </p>
        <button className="flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--accent)] bg-[var(--accent)] 
                          px-3 text-xs font-[680] text-white hover:bg-[#1f503a] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4"
                type="button"
                disabled={!selectedRoom || !canBook}
                title={
                  canBook
                    ? "Create a booking"
                    : "Confirm your email before booking"
                }
                onClick={onOpenBooking}>
          <FiPlus aria-hidden="true" /> Book room
        </button>
      </div>
    </div>
  );
}
