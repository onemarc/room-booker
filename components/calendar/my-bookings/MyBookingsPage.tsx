"use client";

import { useState, useSyncExternalStore } from "react";
import { BookingRow } from "./BookingRow";
import { useRouter } from "next/navigation";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import { MyBookingsHeader } from "./MyBookingsHeader";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { detectBrowserTimeZone, getZonedDateIso, type CalendarView } from "@/lib/time";
import {
  groupBookingsByMonth,
  subscribeToBrowserTimeZone,
  type BookingSection,
} from "./myBookingsUtils";
import { useCancelBooking } from "./useCancelBooking";
import { useMyBookings } from "./useMyBookings";

export function MyBookingsPage({
  calendarHref,
  displayName,
  emailConfirmed = true,
  view,
}: {
  calendarHref: string;
  displayName: string;
  emailConfirmed?: boolean;
  view: CalendarView;
}) {
  const router = useRouter();
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  async function resendConfirmation() {
    setIsResendingConfirmation(true);
    setConfirmationMessage("");

    try {
      const response = await fetch("/api/auth/confirm/resend", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const data = (await response.json()) as {
        error?: { message?: string };
      };
      setConfirmationMessage(
        response.ok
          ? "A fresh confirmation link was printed to the server log."
          : (data.error?.message ?? "A new link could not be issued."),
      );
    } catch {
      setConfirmationMessage("A new confirmation link could not be issued.");
    } finally {
      setIsResendingConfirmation(false);
    }
  }

  // Detect and synchronize current browser time zone, falling back to default office time zone.
  const timeZone = useSyncExternalStore(
    subscribeToBrowserTimeZone,
    detectBrowserTimeZone,
    () => OFFICE_TIME_ZONE,
  );

  const [section, setSection] = useState<BookingSection>("upcoming");

  // Custom hook managing initial data loading, pagination, and list mutation.
  const {
    upcoming,
    past,
    upcomingCursor,
    pastCursor,
    isLoading,
    isLoadingMore,
    loadError,
    loadMoreBookings,
    removeCancelledBooking,
    refetch,
  } = useMyBookings();

  // Custom hook managing cancellation modal state and API requests.
  const {
    bookingToCancel,
    isCancelling,
    cancellationError,
    cancellationScope,
    setCancellationScope,
    requestCancellation,
    dismissCancellation,
    confirmCancellation,
  } = useCancelBooking(removeCancelledBooking);

  const visibleBookings = section === "upcoming" ? upcoming : past;
  const bookingGroups = groupBookingsByMonth(visibleBookings, timeZone);
  const firstUpcomingBookingId = upcoming[0]?.id;
  const currentCursor = section === "upcoming" ? upcomingCursor : pastCursor;

  return (
    <main className="flex min-h-screen flex-col bg-[var(--surface-soft)]">
      <MyBookingsHeader
        calendarHref={calendarHref}
        displayName={displayName}
        timeZone={timeZone}
      />
      {!emailConfirmed ? (
        <div
          className="flex flex-none items-center justify-between gap-3 border-b border-[#e5d3aa] bg-[#fffaf0] px-6 py-2 text-xs text-[#745b25] max-[640px]:items-start max-[640px]:px-4"
          role="status"
        >
          <span>
            {confirmationMessage ||
              "Confirm your email using the development link in the server log before booking a room."}
          </span>
          <button
            className="h-8 flex-none cursor-pointer rounded-lg border border-[#d8c38e] bg-white px-3 text-[11px] font-bold text-[#745b25] hover:bg-[#fffdf8] disabled:cursor-wait disabled:opacity-55"
            type="button"
            disabled={isResendingConfirmation}
            onClick={() => void resendConfirmation()}
          >
            {isResendingConfirmation ? "Issuing…" : "Print new link"}
          </button>
        </div>
      ) : null}

      <section className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 
                        flex-col px-6 py-7 max-[640px]:px-3 max-[640px]:py-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px]
                      border border-[#d7ddd8] bg-[var(--surface)] shadow-[0_14px_42px_rgba(20,35,26,0.07)]">
          {/* Section Selection Tabs */}
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

          {/* Booking List Container */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin] max-[640px]:px-4">
            <div key={section} className="booking-tab-panel-enter">
              {isLoading ? (
                /* Loading Skeleton */
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
                /* Empty Error State */
                <div
                  className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-[#d4dbd6] bg-[#fafcfa] p-6 text-center"
                  role="alert"
                >
                  <div>
                    <p className="m-0 text-sm font-[650] text-[#3e4a42]">
                      {loadError}
                    </p>
                    <button
                      className="mt-3 h-9 cursor-pointer rounded-lg border border-[#ccd4ce] 
                                bg-white px-3 text-xs font-bold text-[var(--accent)] hover:bg-[#f3f7f4]"
                      type="button"
                      onClick={refetch}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : visibleBookings.length === 0 ? (
                /* Empty Bookings State */
                <div className="grid min-h-[220px] place-items-center rounded-xl
                              border border-dashed border-[#d4dbd6] bg-[#fafcfa] p-6 text-center">
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
                /* Grouped Bookings List */
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
                            onRequestCancellation={requestCancellation}
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

                  {currentCursor ? (
                    <button
                      className="mx-auto mt-2 h-9 cursor-pointer rounded-lg border border-[#ccd4ce] bg-white px-4 text-xs 
                                font-bold text-[var(--accent)] hover:bg-[#f3f7f4] disabled:cursor-wait disabled:opacity-55"
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

          {/* Cancellation Confirmation Dialog */}
          {bookingToCancel ? (
            <ConfirmationDialog
              booking={bookingToCancel}
              timeZone={timeZone}
              isPending={isCancelling}
              error={cancellationError}
              scope={cancellationScope}
              onCancel={dismissCancellation}
              onConfirm={() => void confirmCancellation()}
              onScopeChange={setCancellationScope}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
