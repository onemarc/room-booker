"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { TbCalendarCancel } from "react-icons/tb";
import { HiOutlinePencilSquare } from "react-icons/hi2";
import { LuClock4, LuDoorOpen } from "react-icons/lu";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/calendar/NotificationBell";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { detectBrowserTimeZone, formatUtcInstant, getZonedDateIso, type CalendarView } from "@/lib/time";
import type { MyBookingsResponse, OwnedBooking } from "@/lib/bookings";

type BookingSection = "upcoming" | "past";
type CancellationScope = "occurrence" | "series";

const NORMAL_LINK_CLASS = [
  "inline-flex h-[34px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border-0 bg-transparent px-[9px]",
  "text-[13px] font-[620] text-[#4b5750] no-underline hover:bg-[#f0f3f0] hover:text-[var(--ink)]",
  "max-[640px]:px-[7px]",
].join(" ");

function subscribeToBrowserTimeZone() {
  return () => {};
}

function formatBookingDate(booking: OwnedBooking, timeZone: string) {
  return formatUtcInstant(
    booking.startAt,
    timeZone,
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    },
    "en-GB",
  );
}

function formatBookingTime(booking: OwnedBooking, timeZone: string) {
  const formatterOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  return `${formatUtcInstant(
    booking.startAt,
    timeZone,
    formatterOptions,
  )}-${formatUtcInstant(booking.endAt, timeZone, formatterOptions)}`;
}

function formatBookingMonth(booking: OwnedBooking, timeZone: string) {
  return formatUtcInstant(
    booking.startAt,
    timeZone,
    { month: "long", year: "numeric" },
    "en-GB",
  );
}

function formatBookingWeekday(booking: OwnedBooking, timeZone: string) {
  return formatUtcInstant(
    booking.startAt,
    timeZone,
    { weekday: "short" },
    "en-GB",
  );
}

function formatBookingDay(booking: OwnedBooking, timeZone: string) {
  return formatUtcInstant(
    booking.startAt,
    timeZone,
    { day: "2-digit" },
    "en-GB",
  );
}

type BookingMonthGroup = {
  key: string;
  label: string;
  bookings: OwnedBooking[];
};

function mergeBookingPages(
  current: OwnedBooking[],
  additions: OwnedBooking[],
) {
  const merged = new Map(current.map((booking) => [booking.id, booking]));
  for (const booking of additions) {
    merged.set(booking.id, booking);
  }
  return [...merged.values()];
}

function groupBookingsByMonth(
  bookings: OwnedBooking[],
  timeZone: string,
): BookingMonthGroup[] {
  const groups: BookingMonthGroup[] = [];

  // Keep the API's chronological ordering while inserting a heading only when
  // the booking crosses a month boundary in the user's selected time zone.
  for (const booking of bookings) {
    const key = getZonedDateIso(booking.startAt, timeZone).slice(0, 7);
    const currentGroup = groups.at(-1);

    if (!currentGroup || currentGroup.key !== key) {
      groups.push({
        key,
        label: formatBookingMonth(booking, timeZone),
        bookings: [booking],
      });
    } else {
      currentGroup.bookings.push(booking);
    }
  }

  return groups;
}

async function requestBookingSection(
  section: BookingSection,
  signal: AbortSignal,
  cursor?: string,
) {
  const searchParams = new URLSearchParams({ section });
  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  const response = await fetch(`/api/bookings/mine?${searchParams}`, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });
  const data = (await response.json()) as MyBookingsResponse;

  if (!response.ok || !data.bookings) {
    throw new Error(
      data.error?.message ?? "Your bookings could not be loaded.",
    );
  }

  return data;
}

function BookingRow({
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
      className="group relative overflow-hidden rounded-[13px] border bg-white transition-colors hover:border-[#315b46] focus-within:border-[#315b46]"
      style={{
        borderColor: isHighlighted ? "#315b46" : "#c9ceca",
      }}
    >
      <button
        className="grid min-h-[94px] w-full cursor-pointer grid-cols-[100px_minmax(0,1fr)] items-stretch border-0 bg-transparent p-0 text-left max-[900px]:grid-cols-[88px_minmax(0,1fr)] max-[640px]:grid-cols-[68px_minmax(0,1fr)] max-[640px]:min-h-[72px]"
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
        <span className="grid min-w-0 grid-cols-[minmax(100px,0.82fr)_minmax(100px,0.9fr)_minmax(130px,1.2fr)_auto] items-center gap-x-4 pr-3.5 pl-5 max-[1100px]:grid-cols-[repeat(3,minmax(0,1fr))_auto] max-[900px]:grid-cols-2 max-[900px]:gap-x-3 max-[900px]:gap-y-2.5 max-[640px]:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] max-[640px]:gap-x-2 max-[640px]:gap-y-0 max-[640px]:px-2.5 max-[640px]:py-2">
          <span className={`flex min-w-0 items-center gap-2 text-[15px] leading-tight font-[500] ${detailTextClass} max-[1100px]:text-[14px] max-[640px]:gap-1 max-[640px]:text-[11px]`}>
            <LuClock4
              className="size-[21px] flex-none text-[#151918] max-[1100px]:size-[19px] max-[640px]:size-[15px]"
              aria-hidden="true"
            />
            <span className="truncate">{formatBookingTime(booking, timeZone)}</span>
          </span>
          <span className={`flex min-w-0 items-center gap-2 text-[15px] leading-tight font-[500] ${detailTextClass} max-[1100px]:text-[14px] max-[640px]:gap-1 max-[640px]:text-[11px]`}>
            <LuDoorOpen
              className="size-[21px] flex-none text-[#151918] max-[1100px]:size-[19px] max-[640px]:size-[15px]"
              aria-hidden="true"
            />
            <span className="truncate">{booking.roomName}</span>
          </span>
          <span className={`flex min-w-0 items-center gap-2 overflow-hidden pr-[48px] text-[15px] leading-tight font-[500] ${detailTextClass} max-[1100px]:text-[14px] max-[640px]:gap-1 max-[640px]:pr-1 max-[640px]:text-[11px]`}>
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
            className="size-[20px] justify-self-end text-[#87918b] max-[1100px]:size-[19px] max-[900px]:row-span-2 max-[900px]:row-start-1 max-[640px]:row-span-1 max-[640px]:size-[15px]"
            aria-hidden="true"
          />
        </span>
      </button>
      {isUpcoming ? (
        <button
          className="pointer-events-none absolute top-1/2 right-[42px] grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg border-0 bg-[#fff5f5] text-[#8a4646] opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 disabled:cursor-wait disabled:opacity-50 [&>svg]:size-[20px]"
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

function ConfirmationDialog({
  booking,
  timeZone,
  isPending,
  error,
  scope,
  onCancel,
  onConfirm,
  onScopeChange,
}: {
  booking: OwnedBooking;
  timeZone: string;
  isPending: boolean;
  error: string;
  scope: CancellationScope;
  onCancel: () => void;
  onConfirm: () => void;
  onScopeChange: (scope: CancellationScope) => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !isPending) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }

    if (event.key === "Tab") {
      const buttons = [
        ...event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled])',
        ),
      ];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 grid place-items-center overflow-hidden bg-[rgba(23,32,27,0.42)] p-5 backdrop-blur-[2px] max-[640px]:p-3"
      role="presentation"
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-[430px] rounded-2xl border border-[#d5ddd7] bg-white p-5 shadow-[0_22px_70px_rgba(20,35,26,0.25)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        aria-describedby="cancel-booking-description"
      >
        <h3
          className="m-0 text-lg font-[720] text-[#273229]"
          id="cancel-booking-title"
        >
          Cancel this booking?
        </h3>
        <p
          className="mt-2 mb-0 text-[13px] leading-5 text-[#647068] [overflow-wrap:anywhere]"
          id="cancel-booking-description"
        >
          <strong className="font-[690] text-[#354139] [overflow-wrap:anywhere]">
            {booking.title}
          </strong>{" "}
          in {booking.roomName} on{" "}
          {formatBookingDate(booking, timeZone)} at{" "}
          {formatBookingTime(booking, timeZone)} will be removed.
        </p>
        {booking.seriesId ? (
          <fieldset className="mt-4 grid gap-2 rounded-xl border border-[#d8dfda] bg-[#f8faf8] p-3">
            <legend className="px-1 text-xs font-[680] text-[#3f4b43]">
              Recurring booking
            </legend>
            <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#56625a]">
              <input
                className="mt-1 accent-[var(--accent)]"
                type="radio"
                name="cancellation-scope"
                checked={scope === "occurrence"}
                disabled={isPending}
                onChange={() => onScopeChange("occurrence")}
              />
              Cancel only this occurrence
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#56625a]">
              <input
                className="mt-1 accent-[var(--accent)]"
                type="radio"
                name="cancellation-scope"
                checked={scope === "series"}
                disabled={isPending}
                onChange={() => onScopeChange("series")}
              />
              Cancel this and all future occurrences
            </label>
          </fieldset>
        ) : null}
        {error ? (
          <p
            className="mt-3 mb-0 rounded-lg bg-[#fff4f4] px-3 py-2 text-xs text-[#943e3e]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="h-10 cursor-pointer rounded-[9px] border border-[#ccd4ce] bg-white px-4 text-[13px] font-[650] text-[#4c5850] hover:bg-[#f4f7f4] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            ref={cancelButtonRef}
            disabled={isPending}
            onClick={onCancel}
          >
            Keep booking
          </button>
          <button
            className="h-10 cursor-pointer rounded-[9px] border border-[#9c3d3d] bg-[#9c3d3d] px-4 text-[13px] font-[680] text-white hover:bg-[#873434] disabled:cursor-wait disabled:opacity-55"
            type="button"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "Cancelling…" : "Cancel booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MyBookingsPage({
  calendarHref,
  displayName,
  view,
}: {
  calendarHref: string;
  displayName: string;
  view: CalendarView;
}) {
  const router = useRouter();
  const timeZone = useSyncExternalStore(
    subscribeToBrowserTimeZone,
    detectBrowserTimeZone,
    () => OFFICE_TIME_ZONE,
  );
  const [section, setSection] =
    useState<BookingSection>("upcoming");
  const [upcoming, setUpcoming] = useState<OwnedBooking[]>([]);
  const [past, setPast] = useState<OwnedBooking[]>([]);
  const [upcomingCursor, setUpcomingCursor] = useState<string | null>(null);
  const [pastCursor, setPastCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const [bookingToCancel, setBookingToCancel] =
    useState<OwnedBooking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancellingRef = useRef(false);
  const [cancellationError, setCancellationError] = useState("");
  const [cancellationScope, setCancellationScope] =
    useState<CancellationScope>("occurrence");

  useEffect(() => {
    const controller = new AbortController();

    async function loadBookings() {
      setIsLoading(true);
      setLoadError("");

      try {
        // The two independent sections can load together when the page opens.
        const [upcomingData, pastData] = await Promise.all([
          requestBookingSection("upcoming", controller.signal),
          requestBookingSection("past", controller.signal),
        ]);

        setUpcoming(upcomingData.bookings ?? []);
        setUpcomingCursor(upcomingData.nextCursor ?? null);
        setPast(pastData.bookings ?? []);
        setPastCursor(pastData.nextCursor ?? null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Your bookings could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadBookings();
    return () => controller.abort();
  }, [retryVersion]);

  async function loadMoreBookings(targetSection: BookingSection) {
    const cursor =
      targetSection === "upcoming" ? upcomingCursor : pastCursor;
    if (!cursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadError("");
    const controller = new AbortController();

    try {
      const data = await requestBookingSection(
        targetSection,
        controller.signal,
        cursor,
      );
      if (targetSection === "upcoming") {
        setUpcoming((current) =>
          mergeBookingPages(current, data.bookings ?? []),
        );
        setUpcomingCursor(data.nextCursor ?? null);
      } else {
        setPast((current) =>
          mergeBookingPages(current, data.bookings ?? []),
        );
        setPastCursor(data.nextCursor ?? null);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "More bookings could not be loaded.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function confirmCancellation() {
    if (!bookingToCancel || isCancellingRef.current) {
      return;
    }

    isCancellingRef.current = true;
    setIsCancelling(true);
    setCancellationError("");

    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(
          bookingToCancel.id,
        )}?scope=${cancellationScope}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      const data = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        setCancellationError(
          data.error?.message ?? "The booking could not be cancelled.",
        );
        return;
      }

      setUpcoming((current) =>
        current.filter((booking) =>
          cancellationScope === "series" && bookingToCancel.seriesId
            ? booking.seriesId !== bookingToCancel.seriesId
            : booking.id !== bookingToCancel.id,
        ),
      );
      setBookingToCancel(null);
    } catch {
      setCancellationError(
        "The booking service is unavailable. Check your connection and try again.",
      );
    } finally {
      isCancellingRef.current = false;
      setIsCancelling(false);
    }
  }

  const visibleBookings = section === "upcoming" ? upcoming : past;
  const bookingGroups = groupBookingsByMonth(visibleBookings, timeZone);
  const firstUpcomingBookingId = upcoming[0]?.id;

  return (
    <main className="flex min-h-screen flex-col bg-[var(--surface-soft)]">
      <header className="flex min-h-[58px] flex-none items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-6 max-[640px]:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            className={NORMAL_LINK_CLASS + " flex-none"}
            href={calendarHref}
          >
            <FiArrowLeft aria-hidden="true" />
            Calendar
          </Link>
          <span className="h-[23px] w-px flex-none bg-[#d7ddd8]" aria-hidden="true" />
          <h1 className="m-0 overflow-hidden text-lg font-[700] text-ellipsis whitespace-nowrap text-[#2d3731]">
            My bookings
          </h1>
        </div>

        <div className="flex flex-none items-center gap-2 text-[11px] text-[#778179] max-[640px]:gap-1">
          <span className="whitespace-nowrap">GMT+3</span>
          <span className="mx-1 h-[23px] w-px bg-[#d7ddd8] max-[640px]:hidden" aria-hidden="true" />
          <span
            className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[620] text-[#4b5750] max-[640px]:hidden"
            title={displayName}
          >
            {displayName}
          </span>
          <NotificationBell timeZone={timeZone} />
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col px-6 py-7 max-[640px]:px-3 max-[640px]:py-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-[#d7ddd8] bg-[var(--surface)] shadow-[0_14px_42px_rgba(20,35,26,0.07)]">
          <div className="flex flex-none items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5 max-[640px]:px-4 max-[640px]:py-4">
            <p className="m-0 text-[13px] leading-5 text-[#6c776f]">
              Dates and times are shown in {timeZone}.
            </p>
          </div>

        <div
          className="flex flex-none gap-1 border-b border-[var(--line)] px-6 pt-3 max-[640px]:px-4"
          role="tablist"
          aria-label="Booking sections"
        >
          {(["upcoming", "past"] as const).map((item) => (
            <button
              className={[
                "relative h-11 cursor-pointer border-0 bg-transparent px-3 text-[13px] font-[670]",
                section === item
                  ? "text-[var(--accent)] after:absolute after:right-2 after:bottom-0 after:left-2 after:h-0.5 after:rounded-full after:bg-[var(--accent)] after:content-['']"
                  : "text-[#7d8780] hover:text-[#344139]",
              ].join(" ")}
              type="button"
              role="tab"
              aria-selected={section === item}
              key={item}
              onClick={() => setSection(item)}
            >
              {item === "upcoming" ? "Upcoming" : "Past"}
              {!isLoading ? (
                <span className="ml-1.5 text-[11px] font-[650] text-[#8a948d]">
                  {item === "upcoming" ? upcoming.length : past.length}
                  {item === "upcoming" && upcomingCursor
                    ? "+"
                    : item === "past" && pastCursor
                      ? "+"
                      : ""}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin] max-[640px]:px-4">
          <div key={section} className="booking-tab-panel-enter">
          {isLoading ? (
            <div className="grid gap-2.5" role="status">
              <span className="sr-only">Loading your bookings</span>
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  className="h-[94px] animate-pulse rounded-[13px] border border-[#e3e8e4] bg-[#f4f7f4]"
                  key={index}
                />
              ))}
            </div>
          ) : loadError && visibleBookings.length === 0 ? (
            <div
              className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-[#d4dbd6] bg-[#fafcfa] p-6 text-center"
              role="alert"
            >
              <div>
                <p className="m-0 text-sm font-[650] text-[#3e4a42]">
                  {loadError}
                </p>
                <button
                  className="mt-3 h-9 cursor-pointer rounded-lg border border-[#ccd4ce] bg-white px-3 text-xs font-bold text-[var(--accent)] hover:bg-[#f3f7f4]"
                  type="button"
                  onClick={() =>
                    setRetryVersion((current) => current + 1)
                  }
                >
                  Retry
                </button>
              </div>
            </div>
          ) : visibleBookings.length === 0 ? (
            <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-[#d4dbd6] bg-[#fafcfa] p-6 text-center">
              <div>
                <p className="m-0 text-sm font-[680] text-[#3c4840]">
                  {section === "upcoming"
                    ? "No upcoming bookings"
                    : "No past bookings"}
                </p>
                <p className="mt-1.5 mb-0 text-xs leading-5 text-[#7a857d]">
                  {section === "upcoming"
                    ? "New bookings will appear here."
                    : "Completed bookings will appear here."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {bookingGroups.map((group) => (
                <section className="grid gap-2" key={group.key}>
                  <h3 className="m-0 text-base leading-tight font-[500] text-[#4f5551]">
                    {group.label}
                  </h3>
                  <div className="grid gap-2.5">
                    {group.bookings.map((booking) => (
                      <BookingRow
                        booking={booking}
                        timeZone={timeZone}
                        isUpcoming={section === "upcoming"}
                        isHighlighted={
                          section === "upcoming" &&
                          booking.id === firstUpcomingBookingId
                        }
                        cancellationPending={
                          isCancelling && bookingToCancel?.id === booking.id
                        }
                        key={booking.id}
                        onNavigate={(selectedBooking) => {
                          const searchParams = new URLSearchParams({
                            roomId: selectedBooking.roomId,
                            date: getZonedDateIso(
                              selectedBooking.startAt,
                              timeZone,
                            ),
                            view,
                          });
                          router.push(`/calendar?${searchParams.toString()}`);
                        }}
                        onRequestCancellation={(selectedBooking) => {
                          setCancellationError("");
                          setCancellationScope("occurrence");
                          setBookingToCancel(selectedBooking);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {loadError ? (
                <p
                  className="m-0 rounded-lg bg-[#fff7f7] px-3 py-2 text-xs text-[#934141]"
                  role="alert"
                >
                  {loadError}
                </p>
              ) : null}

              {(section === "upcoming" ? upcomingCursor : pastCursor) ? (
                <button
                  className="mx-auto mt-2 h-9 cursor-pointer rounded-lg border border-[#ccd4ce] bg-white px-4 text-xs font-bold text-[var(--accent)] hover:bg-[#f3f7f4] disabled:cursor-wait disabled:opacity-55"
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => void loadMoreBookings(section)}
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {bookingToCancel ? (
        <ConfirmationDialog
          booking={bookingToCancel}
          timeZone={timeZone}
          isPending={isCancelling}
          error={cancellationError}
          scope={cancellationScope}
          onCancel={() => {
            setCancellationError("");
            setBookingToCancel(null);
          }}
          onConfirm={() => void confirmCancellation()}
          onScopeChange={setCancellationScope}
        />
      ) : null}

        </div>
      </section>
    </main>
  );
}
