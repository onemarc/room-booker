"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FiX } from "react-icons/fi";
import { DEFAULT_BOOKING_COLOR, type BookingColor, type BookingFieldErrors, type CreateBookingResponse, type ScheduleBooking } from "@/lib/bookings";
import { formatCalendarDay, formatTimeInZone, getZonedDateIso } from "@/lib/time";
import { BOOKING_COLOR_OPTIONS } from "@/components/calendar/booking-colors";
import { FieldError, getBookingTimeOptions } from "@/components/calendar/shared/booking-form-utils";

export type BookingAnchor = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type BookingEditorTarget =
  | {
      mode: "create";
      roomId: string;
      roomName: string;
      startAt: string;
      endAt: string;
      anchor: BookingAnchor;
    }
  | {
      mode: "edit";
      roomId: string;
      roomName: string;
      booking: ScheduleBooking;
      anchor: BookingAnchor;
    };


export function BookingPopover({
  target,
  timeZone,
  onClose,
  onSaved,
}: {
  target: BookingEditorTarget;
  timeZone: string;
  onClose: () => void;
  onSaved: (details: {
    booking: ScheduleBooking;
    mode: BookingEditorTarget["mode"];
  }) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const sourceBooking =
    target.mode === "edit" ? target.booking : undefined;
  const sourceStartAt =
    sourceBooking?.startAt ??
    (target.mode === "create" ? target.startAt : "");
  const sourceEndAt =
    sourceBooking?.endAt ??
    (target.mode === "create" ? target.endAt : "");
  const startDate = getZonedDateIso(sourceStartAt, timeZone);
  // Keep the end date from the selected interval: a timezone conversion can
  // place a valid office-hours booking across the user's local midnight.
  const initialEndDate = getZonedDateIso(sourceEndAt, timeZone);
  const [title, setTitle] = useState(sourceBooking?.title ?? "");
  const [startTime, setStartTime] = useState(
    formatTimeInZone(sourceStartAt, timeZone),
  );
  const [endTime, setEndTime] = useState(
    formatTimeInZone(sourceEndAt, timeZone),
  );
  const [color, setColor] = useState<BookingColor>(
    sourceBooking?.color ?? DEFAULT_BOOKING_COLOR,
  );
  const [recurrenceCount, setRecurrenceCount] = useState(1);
  const [fieldErrors, setFieldErrors] =
    useState<BookingFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeOptions = useMemo(
    () => getBookingTimeOptions(startDate, timeZone),
    [startDate, timeZone],
  );
  const startOptions = timeOptions.includes(startTime)
    ? timeOptions
    : [startTime, ...timeOptions].sort();
  const endOptions = timeOptions.includes(endTime)
    ? timeOptions
    : [endTime, ...timeOptions].sort();
  const viewportWidth =
    typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const preferredLeft = target.anchor.right + 12;
  const left =
    preferredLeft + 352 <= viewportWidth
      ? preferredLeft
      : Math.max(12, target.anchor.left - 352);
  // Clamp the anchored editor to the viewport instead of letting a selection
  // near the bottom/right edge create an unreachable form.
  const top = Math.max(
    12,
    Math.min(target.anchor.top, viewportHeight - 540),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLInputElement>("[data-autofocus]")
        ?.focus();
    });

    function handlePointerDown(event: PointerEvent) {
      const clickedDraft =
        event.target instanceof Element &&
        event.target.closest("[data-booking-draft]");

      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        !clickedDraft
      ) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmittingRef.current) {
        event.preventDefault();
        onClose();
      }
    }

    // The draft card is part of the editor interaction even though it lives in
    // the grid; moving or resizing it must not dismiss the anchored popover.
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setFieldErrors({});
    setFormError("");

    try {
      const isEdit = target.mode === "edit";
      const endpoint = isEdit
        ? `/api/bookings/${encodeURIComponent(target.booking.id)}`
        : "/api/bookings";
      const response = await fetch(endpoint, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isEdit ? {} : { roomId: target.roomId }),
          title,
          date: startDate,
          endDate: initialEndDate,
          startTime,
          endTime,
          color,
          ...(isEdit ? {} : { recurrenceCount }),
          timeZone,
        }),
      });
      const data = (await response.json()) as CreateBookingResponse;

      if (!response.ok || !data.booking) {
        setFieldErrors(data.error?.fieldErrors ?? {});
        setFormError(
          data.error?.message ??
            `The booking could not be ${isEdit ? "updated" : "created"}.`,
        );
        return;
      }

      onSaved({ booking: data.booking, mode: target.mode });
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
    <div
      className="fixed z-90 w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[15px] border border-[#cfd8d1] bg-white shadow-[0_20px_60px_rgba(24,39,30,0.22)]"
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={target.mode === "edit" ? "Edit booking" : "Create booking"}
      style={{ left, top }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
        <div className="min-w-0">
          <strong className="block text-[15px] font-[720] text-[#263129]">
            {target.mode === "edit" ? "Edit booking" : "New booking"}
          </strong>
          <span className="mt-0.5 block overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-[#78837b]">
            {target.roomName} ·{" "}
            {formatCalendarDay(startDate, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <button
          className="grid size-7 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#667169] hover:bg-[#eef2ef] [&>svg]:size-4"
          type="button"
          aria-label="Close booking editor"
          disabled={isSubmitting}
          onClick={onClose}
        >
          <FiX aria-hidden="true" />
        </button>
      </div>

      <form
        className="grid max-h-[calc(100vh-110px)] gap-3.5 overflow-y-auto px-4 py-4"
        onSubmit={handleSubmit}
      >
        {formError ? (
          <p
            className="m-0 rounded-lg border border-[#ebcece] bg-[#fff8f8] px-3 py-2 text-xs leading-4 text-[#8d3d3d]"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        <label className="grid gap-1 text-xs font-[650] text-[#3a463e]">
          Title
          <input
            className="h-10 rounded-[9px] border border-[#ccd4ce] bg-white px-3 text-[13px] font-normal text-[#263129] outline-none placeholder:text-[#9aa39d] focus:border-[#6b927f] focus:ring-3 focus:ring-[rgba(37,91,67,0.12)]"
            type="text"
            value={title}
            maxLength={100}
            placeholder="Meeting title"
            data-autofocus
            aria-invalid={Boolean(fieldErrors.title)}
            onChange={(event) => setTitle(event.target.value)}
          />
          <FieldError message={fieldErrors.title} className="text-[11px]" />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="grid gap-1 text-xs font-[650] text-[#3a463e]">
            Start
            <select
              className="h-10 rounded-[9px] border border-[#ccd4ce] bg-white px-2.5 text-[13px] font-normal text-[#263129] outline-none focus:border-[#6b927f] focus:ring-3 focus:ring-[rgba(37,91,67,0.12)]"
              value={startTime}
              aria-invalid={Boolean(fieldErrors.startTime)}
              onChange={(event) => setStartTime(event.target.value)}
            >
              {startOptions.map((time) => (
                <option value={time} key={time}>
                  {time}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.startTime} className="text-[11px]" />
          </label>
          <label className="grid gap-1 text-xs font-[650] text-[#3a463e]">
            End
            <select
              className="h-10 rounded-[9px] border border-[#ccd4ce] bg-white px-2.5 text-[13px] font-normal text-[#263129] outline-none focus:border-[#6b927f] focus:ring-3 focus:ring-[rgba(37,91,67,0.12)]"
              value={endTime}
              aria-invalid={Boolean(fieldErrors.endTime)}
              onChange={(event) => setEndTime(event.target.value)}
            >
              {endOptions.map((time) => (
                <option value={time} key={time}>
                  {time}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.endTime} className="text-[11px]" />
          </label>
        </div>

        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="p-0 text-xs font-[650] text-[#3a463e]">
            Color
          </legend>
          <div className="flex flex-wrap gap-2">
            {BOOKING_COLOR_OPTIONS.map((option) => (
              <button
                className="grid size-7 cursor-pointer place-items-center rounded-full border-2 transition-transform hover:scale-105"
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
          <FieldError message={fieldErrors.color} className="text-[11px]" />
        </fieldset>

        {target.mode === "create" ? (
          <label className="grid gap-1 text-xs font-[650] text-[#3a463e]">
            Weekly occurrences
            <input
              className="h-10 rounded-[9px] border border-[#ccd4ce] bg-white px-3 text-[13px] font-normal text-[#263129] outline-none focus:border-[#6b927f] focus:ring-3 focus:ring-[rgba(37,91,67,0.12)]"
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
            <FieldError
              message={fieldErrors.recurrenceCount}
              className="text-[11px]"
            />
          </label>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
          <button
            className="h-9 cursor-pointer rounded-lg border border-[#ccd4ce] bg-white px-3 text-xs font-[650] text-[#4c5850] hover:bg-[#f4f7f4] disabled:opacity-50"
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="h-9 cursor-pointer rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-[680] text-white hover:bg-[#1f503a] disabled:cursor-wait disabled:opacity-55"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? target.mode === "edit"
                ? "Saving…"
                : "Creating…"
              : target.mode === "edit"
                ? "Save changes"
                : "Create booking"}
          </button>
        </div>
      </form>
    </div>
  );
}
