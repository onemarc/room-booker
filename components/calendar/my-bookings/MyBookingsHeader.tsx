import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/calendar/NotificationBell";
import { formatCalendarTimeZoneNotice } from "@/lib/time";

const NORMAL_LINK_CLASS = [
  "inline-flex h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border-0 bg-transparent px-[9px]",
  "text-lg font-[700] text-[#2d3731] no-underline hover:bg-[#f0f3f0] hover:text-[var(--ink)] [&>svg]:size-5",
  "max-[640px]:px-1",
].join(" ");

const DISPLAY_NAME_CLASS = [
  "inline-flex h-[34px] min-w-0 max-w-[150px] items-center overflow-hidden rounded-lg px-[9px]",
  "text-base font-[500] text-ellipsis whitespace-nowrap text-[#2d3731]",
  "max-[640px]:hidden",
].join(" ");

export function MyBookingsHeader({
  calendarHref,
  displayName,
  timeZone,
}: {
  calendarHref: string;
  displayName: string;
  timeZone: string;
}) {
  const timeZoneNotice = formatCalendarTimeZoneNotice(timeZone);

  return (
    <header className="flex min-h-[58px] flex-none items-center justify-between gap-4
                      border-b border-[var(--line)] bg-[var(--surface)] px-6 max-[640px]:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          className={NORMAL_LINK_CLASS + " flex-none"}
          href={calendarHref}
        >
          <FiArrowLeft aria-hidden="true" />
          <span className="max-[640px]:hidden">Calendar</span>
        </Link>
        <span
          className="h-[23px] w-px flex-none bg-[#d7ddd8]"
          aria-hidden="true"
        />
        <h1 className="m-0 overflow-hidden text-lg font-[700] text-ellipsis whitespace-nowrap text-[#2d3731]">
          My bookings
        </h1>
      </div>

      <div className="flex flex-none items-center gap-1 text-[11px] text-[#778179] max-[640px]:gap-0.5">
        <span
          className="max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap px-1
                    text-[13px] text-[#6c776f] max-[640px]:max-w-[110px] max-[640px]:text-[11px]"
          title={timeZoneNotice}
        >
          {timeZoneNotice}
        </span>
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
        <NotificationBell timeZone={timeZone} />
        <LogoutButton />
      </div>
    </header>
  );
}
