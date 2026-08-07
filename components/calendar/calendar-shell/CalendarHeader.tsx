"use client";

import { useRouter } from "next/navigation";
import { FaDoorOpen } from "react-icons/fa6";
import { FiChevronLeft, FiChevronRight, FiMenu } from "react-icons/fi";
import { LogoutButton } from "@/components/LogoutButton";
import { RoomSelector } from "@/components/calendar/RoomSelector";
import { NotificationBell } from "@/components/calendar/NotificationBell";
import type { RoomAvailability } from "@/lib/rooms";
import type { CalendarView } from "@/lib/time";

const HEADER_CLASS = [
  "z-30 flex min-h-[58px] flex-none items-center justify-between",
  "gap-[18px] bg-[var(--surface)] px-[13px]",
  "max-[1060px]:gap-2 max-[1060px]:px-2",
  "max-[760px]:min-h-[98px] max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-1 max-[760px]:py-1.5",
].join(" ");

const TEXT_BUTTON_CLASS = [
  "inline-flex h-[34px] cursor-pointer appearance-none items-center whitespace-nowrap rounded-lg border-0 bg-transparent px-[9px]",
  "text-[13px] font-[620] text-[#4b5750] hover:bg-[#f0f3f0] hover:text-[var(--ink)]",
  "max-[1060px]:px-[7px]",
].join(" ");

const ICON_BUTTON_CLASS = [
  "grid h-[34px] w-[30px] flex-none cursor-pointer place-items-center rounded-lg border-0",
  "bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-4",
].join(" ");

const MENU_BUTTON_CLASS = [
  "grid size-[34px] flex-none cursor-pointer place-items-center rounded-lg border-0",
  "bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-5",
].join(" ");

const DISPLAY_NAME_CLASS = [
  "flex h-[34px] max-w-[125px] items-center overflow-hidden rounded-lg px-[9px]",
  "text-[13px] font-[620] text-ellipsis whitespace-nowrap text-[#4b5750]",
  "max-[1060px]:px-[7px]",
  "max-[1060px]:max-w-[86px]",
].join(" ");

const VIEW_BUTTON_CLASS = (isActive: boolean) =>
  [
    "h-7 cursor-pointer whitespace-nowrap rounded-lg border-0 px-2 text-[13px] font-[620]",
    "max-[1060px]:px-[7px]",
    isActive
      ? "bg-[var(--accent-soft)] text-[#204f39] hover:bg-[var(--accent-soft)] hover:text-[#204f39]"
      : "bg-transparent text-[#4b5750] hover:bg-[#f0f3f0] hover:text-[var(--ink)]",
  ].join(" ");

type CalendarHeaderProps = {
  isSidebarOpen: boolean;
  displayName: string;
  periodLabel: string;
  activeDate: string;
  view: CalendarView;
  timeZone: string;
  rooms: RoomAvailability[];
  selectedRoomId: string;
  isRoomsLoading: boolean;
  minimumCapacity: number;
  canBook: boolean;
  onOpenSidebar: () => void;
  onToday: () => void;
  onNavigate: (direction: -1 | 1) => void;
  onChangeView: (view: CalendarView) => void;
  onSelectRoom: (roomId: string) => void;
  onMinimumCapacityChange: (value: number) => void;
  onOpenBooking: () => void;
};

// Header controls delegate every state transition to CalendarShell, keeping
// date/view changes consistent with the editor-closing policy in one place.
export function CalendarHeader({
  isSidebarOpen,
  displayName,
  periodLabel,
  activeDate,
  view,
  timeZone,
  rooms,
  selectedRoomId,
  isRoomsLoading,
  minimumCapacity,
  canBook,
  onOpenSidebar,
  onToday,
  onNavigate,
  onChangeView,
  onSelectRoom,
  onMinimumCapacityChange,
  onOpenBooking,
}: CalendarHeaderProps) {
  const router = useRouter();
  const myBookingsHref =
    "/my-bookings?view=" +
    view +
    "&date=" +
    activeDate +
    "&roomId=" +
    selectedRoomId;

  return (
    <header className={HEADER_CLASS}>
      <div className="flex min-w-0 flex-[1_1_auto] items-center gap-[7px] max-[1060px]:gap-[3px] max-[760px]:flex-none">
        {!isSidebarOpen ? (
          <>
            <button
              className={MENU_BUTTON_CLASS}
              type="button"
              aria-label="Open room sidebar"
              onClick={onOpenSidebar}
            >
              <FiMenu aria-hidden="true" />
            </button>
          </>
        ) : null}
        <strong className="overflow-hidden text-[17px] font-[680] text-ellipsis whitespace-nowrap text-[#2d3731]">
          {periodLabel}
        </strong>
        {!isSidebarOpen ? (
          <>
            <span className="mx-1 h-[23px] w-px flex-none bg-[#d7ddd8]" aria-hidden="true" />
            <RoomSelector
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              timeZone={timeZone}
              isLoading={isRoomsLoading}
              minimumCapacity={minimumCapacity}
              onSelectRoom={onSelectRoom}
              onMinimumCapacityChange={onMinimumCapacityChange}
            />
          </>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-none items-center gap-[7px] overflow-x-auto max-[1060px]:gap-[3px] max-[760px]:w-full max-[760px]:pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="whitespace-nowrap text-[11px] text-[#778179]">
          GMT+3
        </span>
        <span className="h-[23px] w-px flex-none bg-[#d7ddd8]" aria-hidden="true" />
        <button
          className={TEXT_BUTTON_CLASS}
          type="button"
          onClick={onToday}
        >
          Today
        </button>

        <div className="flex items-center" role="group" aria-label="Calendar period">
          <button
            className={ICON_BUTTON_CLASS}
            type="button"
            aria-label={`Previous ${view}`}
            onClick={() => onNavigate(-1)}
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
          <button
            className={ICON_BUTTON_CLASS}
            type="button"
            aria-label={`Next ${view}`}
            onClick={() => onNavigate(1)}
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>

        <div
          className="flex items-center gap-0.5 rounded-[9px] border border-[#d8ded9] p-0.5"
          role="group"
          aria-label="Calendar view"
        >
          {(["day", "week"] as const).map((mode) => (
            <button
              className={VIEW_BUTTON_CLASS(view === mode)}
              type="button"
              key={mode}
              aria-pressed={view === mode}
              onClick={() => onChangeView(mode)}
            >
              {mode === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>

        <button
          className={TEXT_BUTTON_CLASS}
          type="button"
          onClick={() => router.push(myBookingsHref)}
        >
          My bookings
        </button>
        <button
          className="flex h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-[680] text-white hover:bg-[#1f503a] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4"
          type="button"
          disabled={!selectedRoomId || !canBook}
          title={canBook ? "Create a booking" : "Confirm your email before booking"}
          onClick={onOpenBooking}
        >
          <FaDoorOpen aria-hidden="true" /> Book room
        </button>
        <span
          className="h-[23px] w-px flex-none bg-[#d7ddd8]"
          aria-hidden="true"
        />
        <span
          className={`${DISPLAY_NAME_CLASS} max-[640px]:hidden`}
          title={displayName}
        >
          {displayName}
        </span>
        <NotificationBell timeZone={timeZone} />
        <LogoutButton />
      </div>
    </header>
  );
}
