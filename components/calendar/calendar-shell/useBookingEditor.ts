"use client";

import { useCallback, useRef, useState } from "react";
import {
  DEFAULT_BOOKING_COLOR,
  type BookingColor,
  type ScheduleBooking,
} from "@/lib/bookings";
import type { BookingEditorTarget } from "@/components/calendar/booking-popover/BookingPopover";
import type {
  BookingSelection,
  CalendarGridSelection,
  EditableBookingSelection,
} from "@/components/calendar/calendar-grid/types";
import type { ScheduleLoadingMode } from "./useCalendarData";

// Encapsulates the booking editor lifecycle: draft creation via grid
// click/drag, existing-booking editing via popover, color previews, and
// the full-form modal. CalendarShell delegates all booking-mutation UI
// state here so its own body stays focused on navigation and layout.
export function useBookingEditor({
  timeZone,
  emailConfirmed,
  selectGridDate,
  setSelectedRoomId,
  replaceScheduleBooking,
  removeScheduleBooking,
  requestScheduleRefresh,
  requestRoomsRefresh,
  getZonedDateIso,
  startOfCalendarMonth,
  setSelectedDate,
  setVisibleMiniCalendarMonth,
}: {
  timeZone: string;
  emailConfirmed: boolean;
  selectGridDate: (date: string) => void;
  setSelectedRoomId: (roomId: string) => void;
  replaceScheduleBooking: (booking: ScheduleBooking) => void;
  removeScheduleBooking: (bookingId: string) => void;
  requestScheduleRefresh: (mode: ScheduleLoadingMode) => void;
  requestRoomsRefresh: () => void;
  getZonedDateIso: (date: Date, timeZone: string) => string;
  startOfCalendarMonth: (date: string) => string;
  setSelectedDate: (date: string) => void;
  setVisibleMiniCalendarMonth: (month: string) => void;
}) {
  // selectActiveDate depends on bookingEditor.close(), creating a circular
  // declaration dependency. CalendarShell registers this handler via
  // registerSelectActiveDate.
  const selectActiveDateRef = useRef<((date: string) => void) | null>(null);
  const registerSelectActiveDate = useCallback(
    (handler: (date: string) => void) => {
      selectActiveDateRef.current = handler;
    },
    [],
  );
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [bookingEditorTarget, setBookingEditorTarget] =
    useState<BookingEditorTarget | null>(null);
  const [draftColor, setDraftColor] =
    useState<BookingColor>(DEFAULT_BOOKING_COLOR);
  const [previewBookingColor, setPreviewBookingColor] = useState<{
    bookingId: string;
    color: BookingColor;
  } | null>(null);
  // The completed range is separate from the popover target so the grid can
  // keep its selection treatment visible while the editor is open.
  const [selectedGridSelection, setSelectedGridSelection] =
    useState<CalendarGridSelection | null>(null);

  const close = useCallback(() => {
    setBookingEditorTarget(null);
    setSelectedGridSelection(null);
    setDraftColor(DEFAULT_BOOKING_COLOR);
    setPreviewBookingColor(null);
  }, [
    setBookingEditorTarget,
    setDraftColor,
    setPreviewBookingColor,
    setSelectedGridSelection,
  ]);

  const cancelDraft = useCallback(() => {
    if (bookingEditorTarget?.mode === "create") {
      // A grid click temporarily makes the draft date active. Cancelling the
      // unsaved editor must return both controlled MiniCalendar values to the
      // real current day instead of leaving the draft date selected.
      const currentDate = getZonedDateIso(new Date(), timeZone);
      setSelectedDate(currentDate);
      setVisibleMiniCalendarMonth(startOfCalendarMonth(currentDate));
    }
    close();
  }, [
    bookingEditorTarget,
    close,
    getZonedDateIso,
    setSelectedDate,
    setVisibleMiniCalendarMonth,
    startOfCalendarMonth,
    timeZone,
  ]);

  const handleCreated = useCallback(
    ({
      booking,
      roomId,
      date,
    }: {
      booking: ScheduleBooking;
      roomId: string;
      date: string;
    }) => {
      setSelectedRoomId(roomId);
      replaceScheduleBooking(booking);
      selectActiveDateRef.current?.(date);
      requestScheduleRefresh("blocking");
      requestRoomsRefresh();
      setIsBookingFormOpen(false);
    },
    [
      replaceScheduleBooking,
      requestRoomsRefresh,
      requestScheduleRefresh,
      setSelectedRoomId,
    ],
  );

  const handleSaved = useCallback(
    ({
      booking,
    }: {
      booking: ScheduleBooking;
      mode: BookingEditorTarget["mode"];
    }) => {
      // Apply the server response directly so a successful edit never replaces
      // the visible schedule with a full loading state.
      replaceScheduleBooking(booking);
      requestScheduleRefresh("background");
      requestRoomsRefresh();
      close();
    },
    [close, replaceScheduleBooking, requestRoomsRefresh, requestScheduleRefresh],
  );

  const handleDeleted = useCallback(
    (bookingId: string) => {
      removeScheduleBooking(bookingId);
      requestScheduleRefresh("background");
      requestRoomsRefresh();
      close();
    },
    [close, removeScheduleBooking, requestRoomsRefresh, requestScheduleRefresh],
  );

  const handleCreateSelection = useCallback(
    ({ gridSelection, ...selection }: BookingSelection) => {
      selectGridDate(gridSelection.date);
      setSelectedGridSelection(gridSelection);
      setBookingEditorTarget({
        mode: "create",
        ...selection,
      });
    },
    [selectGridDate],
  );

  const handleUpdateSelection = useCallback(
    ({ gridSelection, ...selection }: BookingSelection) => {
      selectGridDate(gridSelection.date);
      setSelectedGridSelection(gridSelection);
      setBookingEditorTarget((current) =>
        current?.mode === "create"
          ? {
              ...current,
              ...selection,
            }
          : current,
      );
    },
    [selectGridDate],
  );

  const handleEditBooking = useCallback(
    (selection: EditableBookingSelection) => {
      setIsBookingFormOpen(false);
      setDraftColor(selection.booking.color);
      setPreviewBookingColor(null);
      setSelectedGridSelection(null);
      setBookingEditorTarget({
        mode: "edit",
        ...selection,
      });
    },
    [],
  );

  const handleColorChange = useCallback(
    (color: BookingColor) => {
      if (bookingEditorTarget?.mode === "edit") {
        setPreviewBookingColor({
          bookingId: bookingEditorTarget.booking.id,
          color,
        });
      } else {
        setDraftColor(color);
      }
    },
    [bookingEditorTarget],
  );

  const openBookingForm = useCallback(() => {
    if (!emailConfirmed) return;
    close();
    setIsBookingFormOpen(true);
  }, [close, emailConfirmed]);

  return {
    isBookingFormOpen,
    bookingEditorTarget,
    draftColor,
    previewBookingColor,
    selectedGridSelection,
    close,
    cancelDraft,
    handleCreated,
    handleSaved,
    handleDeleted,
    handleCreateSelection,
    handleUpdateSelection,
    handleEditBooking,
    handleColorChange,
    openBookingForm,
    setIsBookingFormOpen,
    registerSelectActiveDate,
  };
}
