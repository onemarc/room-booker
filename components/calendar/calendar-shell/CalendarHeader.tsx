"use client";

import { useRouter } from "next/navigation";
import { FaDoorOpen } from "react-icons/fa6";
import { FiChevronLeft, FiChevronRight, FiMenu } from "react-icons/fi";
import { RiArrowGoBackLine } from "react-icons/ri";
import { LogoutButton } from "@/components/LogoutButton";
import { RoomSelector } from "@/components/calendar/RoomSelector";
import { NotificationBell } from "@/components/calendar/NotificationBell";
import type { RoomAvailability } from "@/lib/rooms";
import type { CalendarView } from "@/lib/time";

const HEADER_CLASS = [
  "z-30 flex min-h-[58px] flex-none items-center justify-between",
  "gap-[18px] bg-[var(--surface)] px-[13px]",
  "max-[1200px]:gap-2 max-[1200px]:px-2",
  "max-[1060px]:gap-1 max-[1060px]:px-1.5",
  "max-[760px]:min-h-[58px] max-[760px]:flex-row max-[760px]:items-center max-[760px]:justify-between max-[760px]:gap-2 max-[760px]:overflow-x-auto max-[760px]:py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
].join(" ");

const TEXT_BUTTON_CLASS = [
  "inline-flex h-[34px] cursor-pointer appearance-none items-center whitespace-nowrap rounded-lg border-0 bg-transparent px-[9px]",
  "text-[13px] font-[620] text-[#4b5750] hover:bg-[#f0f3f0] hover:text-[var(--ink)]",
  "max-[1200px]:px-1.5 max-[1060px]:px-1",
].join(" ");

const ICON_BUTTON_CLASS = [
  "grid h-[34px] w-[30px] flex-none cursor-pointer place-items-center rounded-lg border-0",
  "bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-4",
  "max-[1200px]:h-8 max-[1200px]:w-7 max-[1060px]:h-[30px] max-[1060px]:w-[26px] max-[760px]:h-[34px] max-[760px]:w-[30px]",
].join(" ");

const MENU_BUTTON_CLASS = [
  "grid size-[34px] flex-none cursor-pointer place-items-center rounded-lg border-0",
  "bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-5",
  "max-[1200px]:size-8 max-[1060px]:size-[30px] max-[760px]:size-[34px]",
].join(" ");

const DISPLAY_NAME_CLASS = [
  "inline-flex h-[34px] min-w-0 max-w-[180px] items-center overflow-hidden rounded-lg px-[9px]",
  "text-base font-[500] text-ellipsis whitespace-nowrap text-[#2d3731]",
  "max-[1200px]:h-8 max-[1200px]:px-1.5",
  "max-[760px]:h-[34px]",
].join(" ");

const MY_BOOKINGS_BUTTON_CLASS = [
  "inline-flex h-[34px] cursor-pointer appearance-none items-center whitespace-nowrap rounded-lg border-0 bg-transparent px-[9px]",
  "text-lg font-[700] text-[#2d3731] hover:bg-[#f0f3f0] hover:text-[var(--ink)]",
  "max-[1200px]:px-1.5 max-[1060px]:px-1",
].join(" ");

const VIEW_BUTTON_CLASS = (isActive: boolean) =>
  [
    "h-7 cursor-pointer whitespace-nowrap rounded-lg border-0 px-2 text-[13px] font-[620]",
    "max-[1200px]:h-6 max-[1200px]:px-1.5 max-[1200px]:text-xs max-[1060px]:px-1 max-[760px]:h-7 max-[760px]:px-2 max-[760px]:text-[13px]",
    isActive
      ? "bg-[var(--accent-soft)] text-[#204f39] hover:bg-[var(--accent-soft)] hover:text-[#204f39]"
      : "bg-transparent text-[#4b5750] hover:bg-[#f0f3f0] hover:text-[var(--ink)]",
  ].join(" ");

const LONG_MONTH_NAME_PATTERN =
  /January|February|March|April|May|June|July|August|September|October|November|December/g;

function getCompactPeriodLabel(periodLabel: string) {
  return periodLabel.replace(
    LONG_MONTH_NAME_PATTERN,
    (monthName) => monthName.slice(0, 3),
  );
}

type CalendarHeaderProps = {
  isSidebarOpen: boolean;
  displayName: string;
  periodLabel: string;
  isTodayVisible: boolean;
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
  isTodayVisible,
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
  const compactPeriodLabel = getCompactPeriodLabel(periodLabel);

  return (
    <header className={HEADER_CLASS}>
      <div className="flex min-w-0 flex-[1_1_auto] items-center gap-[7px] overflow-hidden max-[1200px]:gap-1
                      max-[1060px]:gap-0.5 max-[760px]:min-w-max max-[760px]:flex-none max-[760px]:overflow-visible">
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
        <strong className="min-w-0 flex-[0_1_auto] overflow-hidden text-[17px] font-[680] 
                          text-ellipsis whitespace-nowrap text-[#2d3731] max-[760px]:text-[16px]">
          <span className="max-[760px]:hidden">{periodLabel}</span>
          <span className="hidden max-[760px]:inline">
            {compactPeriodLabel}
          </span>
        </strong>
        {!isSidebarOpen ? (
          <>
            <span className="mx-1 h-[23px] w-px flex-none bg-[#d7ddd8]" aria-hidden="true" />
            <RoomSelector
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              timeZone={timeZone}
              compactOnSmallScreen
              isLoading={isRoomsLoading}
              minimumCapacity={minimumCapacity}
              onSelectRoom={onSelectRoom}
              onMinimumCapacityChange={onMinimumCapacityChange}
            />
          </>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-none items-center gap-[7px] overflow-x-auto max-[1200px]:flex-[0_1_auto]
                      max-[1200px]:max-w-full max-[1200px]:gap-1 max-[1200px]:[scrollbar-width:none]
                      max-[1200px]:[&::-webkit-scrollbar]:hidden max-[1060px]:gap-0.5 max-[760px]:min-w-max
                      max-[760px]:ml-auto max-[760px]:w-auto max-[760px]:flex-none max-[760px]:max-w-none
                      max-[760px]:gap-0.5 max-[760px]:overflow-visible max-[760px]:pb-0">
        <button
          className={[
            `${TEXT_BUTTON_CLASS} max-[1200px]:h-8 max-[1200px]:text-xs max-[1060px]:h-7 max-[1060px]:px-1
            max-[760px]:h-[34px] max-[760px]:w-[30px] max-[760px]:justify-center max-[760px]:px-0 max-[760px]:text-[13px] [&>svg]:size-4`,
            isTodayVisible ? "max-[760px]:hidden" : "",
          ].join(" ")}
          type="button"
          aria-label="Back to today"
          title="Back to today"
          onClick={onToday}
        >
          <span className="max-[760px]:hidden">Today</span>
          <RiArrowGoBackLine
            className="hidden max-[760px]:block"
            aria-hidden="true"
          />
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
              aria-label={`${mode === "day" ? "Day" : "Week"} view`}
              aria-pressed={view === mode}
              onClick={() => onChangeView(mode)}
            >
              <span className="max-[760px]:hidden">
                {mode === "day" ? "Day" : "Week"}
              </span>
              <span className="hidden max-[760px]:inline">
                {mode === "day" ? "D" : "W"}
              </span>
            </button>
          ))}
        </div>

        <button
          className={MY_BOOKINGS_BUTTON_CLASS}
          type="button"
          aria-label="My bookings"
          title="My bookings"
          onClick={() => router.push(myBookingsHref)}
        >
          <span className="max-[760px]:hidden">My bookings</span>
          <span className="hidden max-[760px]:inline">My</span>
        </button>
        <button
          className="flex h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--accent)]
                    bg-[var(--accent)] px-3 text-xs font-[680] text-white hover:bg-[#1f503a] disabled:cursor-not-allowed disabled:opacity-50
                    [&>svg]:size-4 max-[1200px]:gap-1 max-[1200px]:px-2 max-[760px]:gap-1 max-[760px]:px-2"
          type="button"
          disabled={!selectedRoomId || !canBook}
          title={canBook ? "Create a booking" : "Confirm your email before booking"}
          onClick={onOpenBooking}
        >
          <FaDoorOpen className="max-[760px]:hidden" aria-hidden="true" />
          <span className="max-[760px]:hidden">Book room</span>
          <span className="hidden max-[760px]:inline">Book</span>
        </button>
        <span
          className="h-[23px] w-px flex-none bg-[#d7ddd8]"
          aria-hidden="true"
        />
        <div className="flex items-center gap-1 max-[760px]:gap-0.5">
          <span
            className={`${DISPLAY_NAME_CLASS} max-[1060px]:hidden`}
            title={displayName}
          >
            {displayName}
          </span>
          <NotificationBell timeZone={timeZone} />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
