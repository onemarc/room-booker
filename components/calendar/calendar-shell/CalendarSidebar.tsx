import { FiMenu } from "react-icons/fi";
import { MiniCalendar } from "@/components/calendar/MiniCalendar";
import { RoomList } from "@/components/calendar/RoomList";
import type { RoomAvailability } from "@/lib/rooms";

const SIDEBAR_CLASS = [
  "flex w-[clamp(260px,23vw,304px)] min-w-[260px] flex-none flex-col",
  "overflow-hidden border-r border-[var(--line)] bg-[#f8faf8]",
  "max-[1060px]:w-[250px] max-[1060px]:min-w-[250px]",
  "max-[760px]:fixed max-[760px]:inset-y-0 max-[760px]:left-0 max-[760px]:z-60",
  "max-[760px]:w-[min(88vw,310px)] max-[760px]:min-w-0 max-[760px]:shadow-[18px_0_50px_rgba(24,39,30,0.2)]",
].join(" ");

const MENU_BUTTON_CLASS = [
  "grid size-[34px] flex-none cursor-pointer place-items-center rounded-lg border-0",
  "bg-transparent text-[#526058] hover:bg-[#edf1ed]",
  "hover:text-[var(--ink)] [&>svg]:size-5",
].join(" ");

type CalendarSidebarProps = {
  activeDate: string;
  visibleRangeStart: string;
  visibleRangeEnd: string;
  visibleMonth: string;
  timeZone: string;
  rooms: RoomAvailability[];
  selectedRoomId: string;
  isLoading: boolean;
  error: string;
  minimumCapacity: number;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  onVisibleMonthChange: (month: string) => void;
  onSelectRoom: (roomId: string) => void;
  onRetry: () => void;
  onMinimumCapacityChange: (value: number) => void;
};

// The sidebar is presentation-only: room data and navigation state are owned
// by CalendarShell so collapsing it cannot reset the selected schedule.
export function CalendarSidebar({
  activeDate,
  visibleRangeStart,
  visibleRangeEnd,
  visibleMonth,
  timeZone,
  rooms,
  selectedRoomId,
  isLoading,
  error,
  minimumCapacity,
  onClose,
  onSelectDate,
  onVisibleMonthChange,
  onSelectRoom,
  onRetry,
  onMinimumCapacityChange,
}: CalendarSidebarProps) {
  return (
    <aside className={SIDEBAR_CLASS}>
      <div className="flex min-h-[58px] items-center gap-2.5 border-b border-[var(--line)] px-3.5">
        <button
          className={MENU_BUTTON_CLASS}
          type="button"
          aria-label="Collapse room sidebar"
          onClick={onClose}
        >
          <FiMenu aria-hidden="true" />
        </button>
        <span className="whitespace-nowrap text-base font-[710] tracking-[-0.02em] text-[#202923]">
          Room Booker
        </span>
      </div>
      <MiniCalendar
        activeDate={activeDate}
        visibleRangeStart={visibleRangeStart}
        visibleRangeEnd={visibleRangeEnd}
        visibleMonth={visibleMonth}
        timeZone={timeZone}
        onSelectDate={onSelectDate}
        onVisibleMonthChange={onVisibleMonthChange}
      />
      <RoomList
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        timeZone={timeZone}
        isLoading={isLoading}
        error={error}
        minimumCapacity={minimumCapacity}
        onSelectRoom={onSelectRoom}
        onRetry={onRetry}
        onMinimumCapacityChange={onMinimumCapacityChange}
      />
    </aside>
  );
}
