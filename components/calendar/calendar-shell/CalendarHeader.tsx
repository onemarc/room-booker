import { FiChevronLeft, FiChevronRight, FiMenu } from "react-icons/fi";
import { LogoutButton } from "@/components/LogoutButton";
import type { CalendarView } from "@/lib/time";

const HEADER_CLASS = [
  "z-30 flex min-h-[58px] flex-none items-center justify-between",
  "gap-[18px] border-b border-[var(--line)] bg-[var(--surface)] px-[13px]",
  "max-[1060px]:gap-2 max-[1060px]:px-2 max-[760px]:min-w-[700px]",
].join(" ");

const TEXT_BUTTON_CLASS = [
  "h-[34px] cursor-pointer whitespace-nowrap rounded-lg border-0 bg-transparent px-[9px]",
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
  "max-w-[125px] overflow-hidden text-[13px] font-[620]",
  "text-ellipsis whitespace-nowrap text-[#4b5750]",
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
  view: CalendarView;
  onOpenSidebar: () => void;
  onToday: () => void;
  onNavigate: (direction: -1 | 1) => void;
  onChangeView: (view: CalendarView) => void;
  onOpenMyBookings: () => void;
};

// Header controls delegate every state transition to CalendarShell, keeping
// date/view changes consistent with the editor-closing policy in one place.
export function CalendarHeader({
  isSidebarOpen,
  displayName,
  periodLabel,
  view,
  onOpenSidebar,
  onToday,
  onNavigate,
  onChangeView,
  onOpenMyBookings,
}: CalendarHeaderProps) {
  return (
    <header className={HEADER_CLASS}>
      <div className="flex min-w-0 flex-[1_1_auto] items-center gap-[7px] max-[1060px]:gap-[3px]">
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
            <span className="whitespace-nowrap text-base font-[710] tracking-[-0.02em] text-[#202923]">
              Room Booker
            </span>
            <span
              className="h-[23px] w-px flex-none bg-[#d7ddd8]"
              aria-hidden="true"
            />
          </>
        ) : null}
        <strong className="overflow-hidden text-[17px] font-[680] text-ellipsis whitespace-nowrap text-[#2d3731]">
          {periodLabel}
        </strong>
      </div>

      <div className="flex min-w-0 flex-none items-center gap-[7px] max-[1060px]:gap-[3px]">
        <button className={TEXT_BUTTON_CLASS} type="button" onClick={onToday}>
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
          onClick={onOpenMyBookings}
        >
          My Bookings
        </button>
        <span
          className="h-[23px] w-px flex-none bg-[#d7ddd8]"
          aria-hidden="true"
        />
        <span
          className={DISPLAY_NAME_CLASS}
          title={displayName}
        >
          {displayName}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
