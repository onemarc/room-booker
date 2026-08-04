"use client";

import { useCallback, useEffect, useState } from "react";
import { FiBell, FiX } from "react-icons/fi";
import type {
  BookingEndNotification,
  NotificationsResponse,
} from "@/lib/notifications";
import { formatUtcInstant } from "@/lib/time";

const POLL_INTERVAL_MILLISECONDS = 30_000;

export function NotificationBell({ timeZone }: { timeZone: string }) {
  const [notifications, setNotifications] = useState<
    BookingEndNotification[]
  >([]);
  const [error, setError] = useState("");

  const poll = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const data = (await response.json()) as NotificationsResponse;
      if (!response.ok || !data.notifications) {
        throw new Error(
          data.error?.message ?? "Notifications could not be checked.",
        );
      }
      setNotifications(data.notifications);
      setError("");
    } catch (pollError) {
      if (pollError instanceof DOMException && pollError.name === "AbortError") {
        return;
      }
      setError(
        pollError instanceof Error
          ? pollError.message
          : "Notifications could not be checked.",
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialPollFrame = window.requestAnimationFrame(() => {
      void poll(controller.signal);
    });
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void poll(controller.signal);
      }
    }, POLL_INTERVAL_MILLISECONDS);

    return () => {
      controller.abort();
      window.cancelAnimationFrame(initialPollFrame);
      window.clearInterval(intervalId);
    };
  }, [poll]);

  async function dismiss(notification: BookingEndNotification) {
    try {
      const response = await fetch(
        `/api/notifications/${encodeURIComponent(notification.id)}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      if (!response.ok) {
        throw new Error("The notification could not be dismissed.");
      }
      setNotifications((current) =>
        current.filter((candidate) => candidate.id !== notification.id),
      );
    } catch (dismissError) {
      setError(
        dismissError instanceof Error
          ? dismissError.message
          : "The notification could not be dismissed.",
      );
    }
  }

  const activeNotification = notifications[0];

  return (
    <>
      <button
        className="relative grid size-[34px] flex-none cursor-pointer place-items-center rounded-lg border-0
                  bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-[18px]"
        type="button"
        aria-label={
          notifications.length > 0
            ? `${notifications.length} booking notification${
                notifications.length === 1 ? "" : "s"
              }`
            : error || "No booking notifications"
        }
        title={error || "Booking notifications"}
        onClick={() => void poll()}
      >
        <FiBell aria-hidden="true" />
        {notifications.length > 0 ? (
          <span className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-[#9c3d3d] text-[9px] font-bold text-white">
            {Math.min(notifications.length, 9)}
          </span>
        ) : null}
      </button>

      {activeNotification ? (
        <aside
          className="fixed right-4 bottom-4 z-100 w-[min(380px,calc(100vw-24px))] rounded-2xl border border-[#cad5cc]
                    bg-white p-4 shadow-[0_22px_70px_rgba(20,35,26,0.24)] max-[640px]:right-3 max-[640px]:bottom-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 flex-none place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] [&>svg]:size-[17px]">
              <FiBell aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block text-sm font-[720] text-[#28342c]">
                Your booking ends soon
              </strong>
              <p className="mt-1 mb-0 text-xs leading-5 text-[#657168]">
                {activeNotification.title} in {activeNotification.roomName}
                {" ends at "}
                {formatUtcInstant(activeNotification.endsAt, timeZone, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                })}
                . The next room slot is occupied.
              </p>
            </div>
            <button
              className="grid size-8 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#68736b] hover:bg-[#eef2ef] [&>svg]:size-4"
              type="button"
              aria-label="Dismiss booking notification"
              onClick={() => void dismiss(activeNotification)}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
          {error ? (
            <p className="mt-2 mb-0 text-[11px] text-[#963f3f]" role="alert">
              {error}
            </p>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
