"use client";

import type { RoomAvailability } from "@/lib/rooms";
import { CapacityFilter } from "@/components/calendar/CapacityFilter";
import { RoomSummary } from "@/components/calendar/RoomSummary";

export function RoomList({
  rooms,
  selectedRoomId,
  timeZone,
  isLoading,
  error,
  minimumCapacity,
  onSelectRoom,
  onRetry,
  onMinimumCapacityChange,
}: {
  rooms: RoomAvailability[];
  selectedRoomId: string;
  timeZone: string;
  isLoading: boolean;
  error: string;
  minimumCapacity: number;
  onSelectRoom: (roomId: string) => void;
  onRetry: () => void;
  onMinimumCapacityChange: (value: number) => void;
}) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col pt-[18px] pr-2.5 pb-2.5 pl-3.5"
      aria-labelledby="room-list-title"
    >
      <div className="pr-[7px]">
        <div className="flex items-center justify-between gap-2 max-[1060px]:flex-col max-[1060px]:items-stretch">
          <div className="flex items-baseline gap-2">
            <h2
              className="m-0 shrink-0 text-[15px] font-bold text-[#2d3831]"
              id="room-list-title"
            >
              Room list
            </h2>
            <span className="text-[11px] text-[#879088]">
              {rooms.length}
            </span>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-1.5 max-[1060px]:ml-0 max-[1060px]:w-full">
            <CapacityFilter
              value={minimumCapacity}
              onChange={onMinimumCapacityChange}
            />
            {isLoading ? (
              <span
                className="grid size-3 shrink-0 animate-spin place-items-center rounded-full border-2 border-[#c6cec8] border-t-[var(--accent)]"
                role="status"
                aria-label="Updating rooms"
              />
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div
          className="mt-1 mr-1.5 mb-2 rounded-[10px] border border-[#e0e5e0] bg-white p-2.5 text-xs text-[#657168]"
          role="alert"
        >
          <p className="m-0">{error}</p>
          <button
            className="mt-[7px] cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-[var(--accent)]"
            type="button"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!error && rooms.length === 0 ? (
        <div className="mt-1 mr-1.5 mb-2 rounded-[10px] border border-[#e0e5e0] bg-white p-2.5 text-xs text-[#657168]">
          <p className="m-0">No rooms match the selected capacity.</p>
        </div>
      ) : null}

      {rooms.length > 0 ? (
        <div className="mt-2 min-h-0 overflow-y-auto pr-1.5 [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:size-[9px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#aab4ac] [&::-webkit-scrollbar-thumb]:bg-clip-padding">
          <div className="overflow-hidden rounded-xl border border-[#dfe5df] bg-[var(--surface)]">
            {rooms.map((room) => {
              const isSelected = room.id === selectedRoomId;

              return (
                <button
                  className={[
                    "relative flex w-full cursor-pointer border-b border-[#e5e9e5] px-3 py-3 text-left text-[#303a34] transition-colors duration-150 last:border-b-0",
                    isSelected
                      ? "bg-[#edf3ef] shadow-[inset_3px_0_0_var(--accent)]"
                      : "bg-transparent hover:bg-[#f6f8f6]",
                  ].join(" ")}
                  type="button"
                  key={room.id}
                  aria-pressed={isSelected}
                  onClick={() => onSelectRoom(room.id)}
                >
                  <RoomSummary room={room} timeZone={timeZone} />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
