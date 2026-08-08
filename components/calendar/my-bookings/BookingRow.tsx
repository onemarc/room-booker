import { FiArrowRight } from "react-icons/fi";
import { HiOutlinePencilSquare } from "react-icons/hi2";
import { LuClock4, LuDoorOpen } from "react-icons/lu";
import { TbCalendarCancel } from "react-icons/tb";
import type { OwnedBooking } from "@/lib/bookings";
import {
  formatBookingDay,
  formatBookingTime,
  formatBookingWeekday,
} from "./myBookingsUtils";

export function BookingRow({
  booking,
  timeZone,
  isUpcoming,
  isHighlighted,
  cancellationPending,
  onNavigate,
  onRequestCancellation,
}: {
  booking: OwnedBooking;
  timeZone: string;
  isUpcoming: boolean;
  isHighlighted: boolean;
  cancellationPending: boolean;
  onNavigate: (booking: OwnedBooking) => void;
  onRequestCancellation: (booking: OwnedBooking) => void;
}) {
  const detailTextClass = isHighlighted
    ? "text-[#4f5b53]"
    : "text-[#969a97]";

  return (
    <article
      className="group relative overflow-hidden rounded-[13px] border bg-white
                transition-colors hover:border-[#315b46] focus-within:border-[#315b46]"
      style={{
        borderColor: isHighlighted ? "#315b46" : "#c9ceca",
      }}
    >
      <button
        className="grid min-h-[94px] w-full cursor-pointer grid-cols-[100px_minmax(0,1fr)] items-stretch
                  border-0 bg-transparent p-0 text-left max-[900px]:grid-cols-[88px_minmax(0,1fr)]
                  max-[640px]:grid-cols-[68px_minmax(0,1fr)] max-[640px]:min-h-[72px]"
        type="button"
        onClick={() => onNavigate(booking)}
      >
        <span
          className={[
            "grid place-content-center justify-items-center border-r px-2.5 py-3 text-center",
            isHighlighted ? "border-white" : "border-[#edf0ee]",
            "max-[900px]:px-2 max-[640px]:grid-cols-1 max-[640px]:gap-0 max-[640px]:border-r max-[640px]:border-b-0 max-[640px]:px-1.5 max-[640px]:py-2",
          ].join(" ")}
        >
          <span
            className={[
              "text-[16px] leading-none font-[500]",
              isHighlighted ? "text-[#3d624e]" : "text-[#b7b9b8]",
              "max-[900px]:text-[15px] max-[640px]:text-[12px]",
            ].join(" ")}
          >
            {formatBookingWeekday(booking, timeZone)}
          </span>
          <strong
            className={[
              "text-[38px] leading-[0.95] font-[650] tracking-[-0.055em]",
              isHighlighted ? "text-[#3d624e]" : "text-[#b7b9b8]",
              "max-[900px]:text-[34px] max-[640px]:text-[26px]",
            ].join(" ")}
          >
            {formatBookingDay(booking, timeZone)}
          </strong>
        </span>
        <span className="grid min-w-0 grid-cols-[minmax(100px,0.82fr)_minmax(100px,0.9fr)_minmax(130px,1.2fr)_auto] items-center 
                        gap-x-4 pr-3.5 pl-5 max-[1100px]:grid-cols-[repeat(3,minmax(0,1fr))_auto] max-[900px]:grid-cols-2 
                        max-[900px]:gap-x-3 max-[900px]:gap-y-2.5 max-[640px]:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] 
                        max-[640px]:gap-x-2 max-[640px]:gap-y-0 max-[640px]:px-2.5 max-[640px]:py-2">
          <span className={`flex min-w-0 items-center gap-2 text-[15px] leading-tight font-[500] 
                          ${detailTextClass} max-[1100px]:text-[14px] max-[640px]:gap-1 max-[640px]:text-[11px]`}>
            <LuClock4
              className="size-[21px] flex-none text-[#151918] max-[1100px]:size-[19px] max-[640px]:size-[15px]"
              aria-hidden="true"
            />
            <span className="truncate">{formatBookingTime(booking, timeZone)}</span>
          </span>
          <span className={`flex min-w-0 items-center gap-2 text-[15px] leading-tight font-[500]
                          ${detailTextClass} max-[1100px]:text-[14px] max-[640px]:gap-1 max-[640px]:text-[11px]`}>
            <LuDoorOpen
              className="size-[21px] flex-none text-[#151918] max-[1100px]:size-[19px] max-[640px]:size-[15px]"
              aria-hidden="true"
            />
            <span className="truncate">{booking.roomName}</span>
          </span>
          <span className={`flex min-w-0 items-center gap-2 overflow-hidden pr-[48px] text-[15px] leading-tight font-[500]
                          ${detailTextClass} max-[1100px]:text-[14px] max-[640px]:gap-1 max-[640px]:pr-1 max-[640px]:text-[11px]`}>
            <HiOutlinePencilSquare
              className="size-[21px] flex-none text-[#151918] max-[1100px]:size-[19px] max-[640px]:size-[15px]"
              aria-hidden="true"
            />
            <span className="truncate">
              {booking.title}
              {booking.seriesId ? (
                <small className="ml-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-[680] text-[var(--accent)]">
                  Weekly
                </small>
              ) : null}
            </span>
          </span>
          <FiArrowRight
            className="size-[20px] justify-self-end text-[#87918b] max-[1100px]:size-[19px]
                      max-[900px]:row-span-2 max-[900px]:row-start-1 max-[640px]:row-span-1 max-[640px]:size-[15px]"
            aria-hidden="true"
          />
        </span>
      </button>
      {isUpcoming ? (
        <button
          className="pointer-events-none absolute top-1/2 right-[42px] grid size-8 -translate-y-1/2 cursor-pointer
                    place-items-center rounded-lg border-0 bg-[#fff5f5] text-[#8a4646] opacity-0 transition-opacity
                    group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100
                    disabled:cursor-wait disabled:opacity-50 [&>svg]:size-[20px]"
          type="button"
          aria-label={`Cancel ${booking.title}`}
          disabled={cancellationPending}
          onClick={() => onRequestCancellation(booking)}
        >
          <TbCalendarCancel aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}
