"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FiArrowRight, FiTrash2 } from "react-icons/fi";
import { BOOKING_COLOR_STYLES } from "@/components/calendar/booking-colors";
import { Modal } from "@/components/calendar/Modal";
import { formatUtcInstant, getZonedDateIso, type CalendarView } from "@/lib/time";
import type { MyBookingsResponse, OwnedBooking } from "@/lib/bookings";

type BookingSection = "upcoming" | "past";
type CancellationScope = "occurrence" | "series";

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
  )}–${formatUtcInstant(booking.endAt, timeZone, formatterOptions)}`;
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
  cancellationPending,
  onNavigate,
  onRequestCancellation,
}: {
  booking: OwnedBooking;
  timeZone: string;
  isUpcoming: boolean;
  cancellationPending: boolean;
  onNavigate: (booking: OwnedBooking) => void;
  onRequestCancellation: (booking: OwnedBooking) => void;
}) {
  const color = BOOKING_COLOR_STYLES[booking.color];

  return (
    <article
      className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch overflow-hidden rounded-xl border border-[#dce2dd] border-l-4 bg-white hover:border-[#b9c5bc]"
      style={{ borderLeftColor: color.border }}
    >
      <button
        className="grid min-w-0 cursor-pointer grid-cols-[minmax(150px,0.8fr)_minmax(130px,0.65fr)_minmax(180px,1.35fr)_auto] items-center gap-4 border-0 bg-transparent px-4 py-3.5 text-left max-[720px]:grid-cols-1 max-[720px]:gap-1.5"
        type="button"
        onClick={() => onNavigate(booking)}
      >
        <span className="grid gap-0.5">
          <strong className="text-[13px] font-[690] text-[#2d3931]">
            {formatBookingDate(booking, timeZone)}
          </strong>
          <span className="text-xs text-[#748078]">
            {formatBookingTime(booking, timeZone)}
          </span>
        </span>
        <span className="text-[13px] font-[620] text-[#536057]">
          {booking.roomName}
        </span>
        <span className="overflow-hidden text-[13px] font-[650] text-ellipsis whitespace-nowrap text-[#263129]">
          {booking.title}
          {booking.seriesId ? (
            <small className="ml-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-[680] text-[var(--accent)]">
              Weekly
            </small>
          ) : null}
        </span>
        <FiArrowRight
          className="size-4 text-[#7a857d] max-[720px]:hidden"
          aria-hidden="true"
        />
      </button>
      {isUpcoming ? (
        <button
          className="grid w-12 cursor-pointer place-items-center border-0 border-l border-[#e2e7e3] bg-transparent text-[#8a4646] hover:bg-[#fff5f5] disabled:cursor-wait disabled:opacity-50 [&>svg]:size-[17px]"
          type="button"
          aria-label={`Cancel ${booking.title}`}
          disabled={cancellationPending}
          onClick={() => onRequestCancellation(booking)}
        >
          <FiTrash2 aria-hidden="true" />
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
      className="absolute inset-0 z-20 grid place-items-center bg-[rgba(23,32,27,0.42)] p-5 backdrop-blur-[2px]"
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
          className="mt-2 mb-0 text-[13px] leading-5 text-[#647068]"
          id="cancel-booking-description"
        >
          <strong className="font-[690] text-[#354139]">
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

export function MyBookingsModal({
  timeZone,
  view,
  onClose,
  onNavigate,
  onCancelled,
}: {
  timeZone: string;
  view: CalendarView;
  onClose: () => void;
  onNavigate: (details: {
    roomId: string;
    date: string;
    view: CalendarView;
  }) => void;
  onCancelled: (booking: OwnedBooking) => void;
}) {
  const [section, setSection] =
    useState<BookingSection>("upcoming");
  const [upcoming, setUpcoming] = useState<OwnedBooking[]>([]);
  const [past, setPast] = useState<OwnedBooking[]>([]);
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
        // The two independent sections can load together when the modal opens.
        const [upcomingData, pastData] = await Promise.all([
          requestBookingSection("upcoming", controller.signal),
          requestBookingSection("past", controller.signal),
        ]);

        setUpcoming(upcomingData.bookings ?? []);
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

  async function loadMorePast() {
    if (!pastCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadError("");
    const controller = new AbortController();

    try {
      const data = await requestBookingSection(
        "past",
        controller.signal,
        pastCursor,
      );
      setPast((current) => {
        // Cursor pages can overlap after a booking changes; de-duplicate by ID
        // before appending so the history list remains stable.
        const merged = new Map(
          current.map((booking) => [booking.id, booking]),
        );
        for (const booking of data.bookings ?? []) {
          merged.set(booking.id, booking);
        }
        return [...merged.values()];
      });
      setPastCursor(data.nextCursor ?? null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Past bookings could not be loaded.",
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
      onCancelled(bookingToCancel);
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

  return (
    <Modal
      title="My Bookings"
      description={`Dates and times are shown in ${timeZone}.`}
      closeDisabled={isCancelling}
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col">
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
                  : "text-[#6c776f] hover:text-[#344139]",
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
                  {item === "past" && pastCursor ? "+" : ""}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin] max-[640px]:px-4">
          {isLoading ? (
            <div className="grid gap-2.5" role="status">
              <span className="sr-only">Loading your bookings</span>
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  className="h-[70px] animate-pulse rounded-xl border border-[#e3e8e4] bg-[#f4f7f4]"
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
            <div className="grid gap-2.5">
              {visibleBookings.map((booking) => (
                <BookingRow
                  booking={booking}
                  timeZone={timeZone}
                  isUpcoming={section === "upcoming"}
                  cancellationPending={
                    isCancelling && bookingToCancel?.id === booking.id
                  }
                  key={booking.id}
                  onNavigate={(selectedBooking) => {
                    onNavigate({
                      roomId: selectedBooking.roomId,
                      date: getZonedDateIso(
                        selectedBooking.startAt,
                        timeZone,
                      ),
                      view,
                    });
                  }}
                  onRequestCancellation={(selectedBooking) => {
                    setCancellationError("");
                    setCancellationScope("occurrence");
                    setBookingToCancel(selectedBooking);
                  }}
                />
              ))}

              {loadError ? (
                <p
                  className="m-0 rounded-lg bg-[#fff7f7] px-3 py-2 text-xs text-[#934141]"
                  role="alert"
                >
                  {loadError}
                </p>
              ) : null}

              {section === "past" && pastCursor ? (
                <button
                  className="mx-auto mt-2 h-9 cursor-pointer rounded-lg border border-[#ccd4ce] bg-white px-4 text-xs font-bold text-[var(--accent)] hover:bg-[#f3f7f4] disabled:cursor-wait disabled:opacity-55"
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => void loadMorePast()}
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
    </Modal>
  );
}
