"use client";

import { useMemo, useRef, useState, type SyntheticEvent } from "react";
import {
  DEFAULT_BOOKING_COLOR,
  BookingFieldErrors,
  type CreateBookingResponse,
  type BookingColor,
  type ScheduleBooking,
} from "@/lib/bookings";
import { formatCalendarTimeZoneNotice, formatTimeInZone, getDayRangeUtc, getOfficeSlotStartsWithinRange, getZonedDateIso } from "@/lib/time";
import { Modal } from "@/components/calendar/Modal";
import { BOOKING_COLOR_OPTIONS } from "@/components/calendar/booking-colors";
import { BookingSelect } from "@/components/calendar/shared/BookingSelect";
import { FieldError, getBookingTimeOptions } from "@/components/calendar/shared/booking-form-utils";
import type { RoomAvailability } from "@/lib/rooms";

function getInitialTimes({
  room,
  activeDate,
  timeZone,
}: {
  room?: RoomAvailability;
  activeDate: string;
  timeZone: string;
}) {
  const availableStart = room?.availableStarts.find(
    (instant) => getZonedDateIso(instant, timeZone) === activeDate,
  );

  if (!availableStart) {
    const fallbackRange = getDayRangeUtc(activeDate, timeZone);
    const fallbackStart = getOfficeSlotStartsWithinRange(
      fallbackRange.start,
      fallbackRange.end,
    )[0];

    if (fallbackStart) {
      const fallbackEnd = new Date(
        fallbackStart.getTime() + 30 * 60 * 1000,
      );
      return {
        startTime: formatTimeInZone(fallbackStart, timeZone),
        endTime: formatTimeInZone(fallbackEnd, timeZone),
      };
    }

    return {
      startTime: "09:00",
      endTime: "09:30",
    };
  }

  const start = new Date(availableStart);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    startTime: formatTimeInZone(start, timeZone),
    endTime: formatTimeInZone(end, timeZone),
  };
}


export function BookingFormModal({
  rooms,
  selectedRoomId,
  activeDate,
  timeZone,
  onClose,
  onCreated,
}: {
  rooms: RoomAvailability[];
  selectedRoomId: string;
  activeDate: string;
  timeZone: string;
  onClose: () => void;
  onCreated: (details: {
    booking: ScheduleBooking;
    roomId: string;
    date: string;
  }) => void;
}) {
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const initialTimes = useMemo(
    () =>
      getInitialTimes({
        room: selectedRoom,
        activeDate,
        timeZone,
      }),
    [activeDate, selectedRoom, timeZone],
  );
  const [roomId, setRoomId] = useState(selectedRoomId);
  const [date, setDate] = useState(activeDate);
  const [startTime, setStartTime] = useState(initialTimes.startTime);
  const [endTime, setEndTime] = useState(initialTimes.endTime);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<BookingColor>(
    DEFAULT_BOOKING_COLOR,
  );
  const [recurrenceCount, setRecurrenceCount] = useState(1);
  const [fieldErrors, setFieldErrors] =
    useState<BookingFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const timeOptions = useMemo(
    () => getBookingTimeOptions(date, timeZone),
    [date, timeZone],
  );
  const startTimeOptions = timeOptions.includes(startTime)
    ? timeOptions
    : [startTime, ...timeOptions].sort();
  const endTimeOptions = timeOptions.includes(endTime)
    ? timeOptions
    : [endTime, ...timeOptions].sort();
  const roomOptions = rooms.map((room) => ({
    value: room.id,
    label: room.name,
    description: `Floor ${room.floor} · ${room.capacity} people`,
  }));
  const startOptions = startTimeOptions.map((time) => ({
    value: time,
    label: time,
  }));
  const endOptions = endTimeOptions.map((time) => ({
    value: time,
    label: time,
  }));

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setFieldErrors({});
    setFormError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          date,
          endDate: date,
          startTime,
          endTime,
          title,
          color,
          recurrenceCount,
          timeZone,
        }),
      });
      const data = (await response.json()) as CreateBookingResponse;

      if (!response.ok || !data.booking) {
        setFieldErrors(data.error?.fieldErrors ?? {});
        setFormError(
          data.error?.message ?? "The booking could not be created.",
        );
        return;
      }

      onCreated({ booking: data.booking, roomId, date });
    } catch {
      setFormError(
        "The booking service is unavailable. Check your connection and try again.",
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title="Book a room"
      description={formatCalendarTimeZoneNotice(timeZone)}
      size="small"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <form
        className="grid min-h-0 gap-5 overflow-y-auto px-6 py-5 max-[640px]:px-4"
        onSubmit={handleSubmit}
      >
        {formError ? (
          <div
            className="rounded-xl border border-[#ebcece] bg-[#fff8f8] px-3.5 py-3 text-sm leading-5 text-[#8d3d3d]"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <div className="grid gap-1.5 text-sm font-[650] text-[#334039]">
          <span>Room</span>
          <BookingSelect
            value={roomId}
            options={roomOptions}
            ariaLabel="Room"
            isInvalid={Boolean(fieldErrors.roomId)}
            onChange={setRoomId}
          />
          <FieldError message={fieldErrors.roomId} />
        </div>

        <label className="grid gap-1.5 text-sm font-[650] text-[#334039]">
          Date
          <input
            className="h-11 w-full rounded-[10px] border border-[#ccd4ce] bg-white px-3 text-[15px] font-normal
                      text-[#263129] outline-none focus:border-[#6b927f] focus:ring-3 focus:ring-[rgba(37,91,67,0.12)]"
            type="date"
            value={date}
            aria-invalid={Boolean(fieldErrors.date)}
            onChange={(event) => {
              const nextDate = event.target.value;
              const nextTimeOptions = getBookingTimeOptions(
                nextDate,
                timeZone,
              );
              setDate(nextDate);
              if (nextTimeOptions.length >= 2) {
                setStartTime(nextTimeOptions[0]);
                setEndTime(nextTimeOptions[1]);
              }
            }}
          />
          <FieldError message={fieldErrors.date} />
        </label>

        <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
          <div className="grid gap-1.5 text-sm font-[650] text-[#334039]">
            <span>Start</span>
            <BookingSelect
              value={startTime}
              options={startOptions}
              ariaLabel="Start time"
              isInvalid={Boolean(fieldErrors.startTime)}
              onChange={setStartTime}
            />
            <FieldError message={fieldErrors.startTime} />
          </div>

          <div className="grid gap-1.5 text-sm font-[650] text-[#334039]">
            <span>End</span>
            <BookingSelect
              value={endTime}
              options={endOptions}
              ariaLabel="End time"
              isInvalid={Boolean(fieldErrors.endTime)}
              onChange={setEndTime}
            />
            <FieldError message={fieldErrors.endTime} />
          </div>
        </div>

        <label className="grid gap-1.5 text-sm font-[650] text-[#334039]">
          <span className="flex items-baseline justify-between gap-3">
            <span>Booking title</span>
            <span className="text-[13px] font-normal text-[#8a948d]">
              {title.length}/100
            </span>
          </span>
          <input
            className="h-11 w-full rounded-[10px] border border-[#ccd4ce] bg-white px-3 text-[15px] font-normal text-[#263129]
                      outline-none placeholder:text-[#9aa39d] focus:border-[#6b927f] focus:ring-3 focus:ring-[rgba(37,91,67,0.12)]"
            type="text"
            value={title}
            maxLength={100}
            placeholder="What is this meeting for?"
            data-autofocus
            aria-invalid={Boolean(fieldErrors.title)}
            onChange={(event) => setTitle(event.target.value)}
          />
          <FieldError message={fieldErrors.title} />
        </label>

        <label className="grid gap-1.5 text-sm font-[650] text-[#334039]">
          Weekly occurrences
          <input
            className="h-11 w-full rounded-[10px] border border-[#ccd4ce] bg-white px-3 text-[15px] font-normal
                      text-[#263129] outline-none focus:border-[#6b927f] focus:ring-3 focus:ring-[rgba(37,91,67,0.12)]"
            type="number"
            min={1}
            max={52}
            step={1}
            value={recurrenceCount}
            aria-invalid={Boolean(fieldErrors.recurrenceCount)}
            onChange={(event) =>
              setRecurrenceCount(event.currentTarget.valueAsNumber)
            }
          />
          <span className="text-[13px] font-normal text-[#7b867f]">
            Use 1 for a single booking, or repeat weekly up to 52 times.
          </span>
          <FieldError message={fieldErrors.recurrenceCount} />
        </label>

        <fieldset className="m-0 grid gap-3 border-0 p-1">
          <legend className="p-0 text-sm font-[650] text-[#334039]">
            Color
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {BOOKING_COLOR_OPTIONS.map((option) => (
              <button
                className="grid size-8 cursor-pointer place-items-center rounded-full border-2 transition-transform hover:scale-105"
                type="button"
                title={option.label}
                aria-label={`${option.label} booking color`}
                aria-pressed={color === option.value}
                key={option.value}
                style={{
                  backgroundColor: option.surface,
                  borderColor:
                    color === option.value ? option.text : option.border,
                  boxShadow:
                    color === option.value
                      ? `0 0 0 2px white, 0 0 0 4px ${option.border}`
                      : "none",
                }}
                onClick={() => setColor(option.value)}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: option.text }}
                />
              </button>
            ))}
          </div>
          <FieldError message={fieldErrors.color} />
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
          <button
            className="h-10 cursor-pointer rounded-[9px] border border-[#ccd4ce] bg-white px-4 text-sm
                      font-[650] text-[#4c5850] hover:bg-[#f4f7f4] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="h-10 cursor-pointer rounded-[9px] border border-[var(--accent)] bg-[var(--accent)] px-4
                      text-sm font-[680] text-white hover:bg-[#1f503a] disabled:cursor-not-allowed disabled:opacity-55"
            type="submit"
            disabled={isSubmitting || rooms.length === 0}
          >
            {isSubmitting ? "Creating…" : "Create booking"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
