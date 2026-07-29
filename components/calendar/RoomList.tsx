"use client";

import type { RoomAvailability } from "@/lib/rooms";
import { RoomSummary } from "@/components/calendar/RoomSummary";

export function RoomList({
  rooms,
  selectedRoomId,
  timeZone,
  isLoading,
  error,
  onSelectRoom,
  onRetry,
}: {
  rooms: RoomAvailability[];
  selectedRoomId: string;
  timeZone: string;
  isLoading: boolean;
  error: string;
  onSelectRoom: (roomId: string) => void;
  onRetry: () => void;
}) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col pt-[18px] pr-2.5 pb-2.5 pl-3.5"
      aria-labelledby="room-list-title"
    >
      <div className="flex min-h-7 items-center justify-between pr-[7px]">
        <h2
          className="m-0 text-[15px] font-bold text-[#2d3831]"
          id="room-list-title"
        >
          Room list
        </h2>
        {isLoading ? (
          <span className="text-xs text-[#7c8880]" role="status">
            Updating…
          </span>
        ) : null}
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
          <p className="m-0">No rooms are available.</p>
        </div>
      ) : null}

      <div className="grid min-h-0 content-start gap-[7px] overflow-y-auto py-1 pr-1.5 [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:size-[9px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#aab4ac] [&::-webkit-scrollbar-thumb]:bg-clip-padding">
        {rooms.map((room) => (
          <button
            className={[
              "w-full cursor-pointer rounded-[11px] border px-[11px] py-2.5 text-left text-[#303a34]",
              room.id === selectedRoomId
                ? "border-[#4e8068] bg-[var(--accent-soft)] shadow-[inset_3px_0_0_var(--accent)] hover:border-[#4e8068] hover:bg-[var(--accent-soft)]"
                : "border-[#d5dbd6] bg-[var(--surface)] hover:border-[#aebbb1] hover:bg-[#f7faf8]",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            key={room.id}
            aria-pressed={room.id === selectedRoomId}
            onClick={() => onSelectRoom(room.id)}
          >
            <RoomSummary room={room} timeZone={timeZone} />
          </button>
        ))}
      </div>
    </section>
  );
}
