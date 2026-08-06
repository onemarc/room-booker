import type { BookingColor, ScheduleBooking } from "@/lib/bookings";
import type { RoomAvailability } from "@/lib/rooms";
import type { CalendarView } from "@/lib/time";
import type { BookingAnchor } from "@/components/calendar/booking-popover/BookingPopover";
import type { VisibleCalendarRange } from "./calendar-window";

// These contracts keep the interactive grid shell independent from its
// selection helpers and make the event payloads explicit for parent state.
export type DragSelection = {
  date: string;
  anchorIndex: number;
  currentIndex: number;
};

export type CalendarGridSelection = {
  date: string;
  startIndex: number;
  endIndex: number;
};

export type BookingSelection = {
  roomId: string;
  roomName: string;
  startAt: string;
  endAt: string;
  anchor: BookingAnchor;
  gridSelection: CalendarGridSelection;
};

export type EditableBookingSelection = {
  roomId: string;
  roomName: string;
  booking: ScheduleBooking;
  anchor: BookingAnchor;
};

export type CalendarGridProps = {
  activeDate: string;
  targetDate: string;
  view: CalendarView;
  isSidebarOpen: boolean;
  positionRequestId: number;
  stopScrollRequestId: number;
  isViewPositioning: boolean;
  timeZone: string;
  displayName: string;
  selectedRoom?: RoomAvailability;
  bookings: ScheduleBooking[];
  draftColor: BookingColor;
  previewBookingColor: { bookingId: string; color: BookingColor } | null;
  canBook: boolean;
  isScheduleLoading: boolean;
  scheduleError: string;
  onVisibleRangeChange: (range: VisibleCalendarRange) => void;
  onViewPositioned: () => void;
  onRetrySchedule: () => void;
  onCreateSelection: (selection: BookingSelection) => void;
  onUpdateSelection: (selection: BookingSelection) => void;
  onEditBooking: (selection: EditableBookingSelection) => void;
  selectedGridSelection: CalendarGridSelection | null;
};
