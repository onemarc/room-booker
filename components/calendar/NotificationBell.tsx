"use client";

import { useCallback, useEffect, useState } from "react";
import { FiBell, FiX } from "react-icons/fi";
import { formatUtcInstant } from "@/lib/time";
import { Toast } from "@/components/ui/Toast";
import type {
  BookingEndNotification,
  NotificationsResponse,
} from "@/lib/notification-types";

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
        <Toast
          title="Your booking ends soon"
          icon={<FiBell aria-hidden="true" />}
          variant="info"
          errorText={error}
          onDismiss={() => void dismiss(activeNotification)}
          description={
            <>
              <span
                className="font-[650] text-[#28342c] [overflow-wrap:anywhere]"
                title={activeNotification.title}
              >
                {activeNotification.title}
              </span>{" "}in {activeNotification.roomName}
              {" ends at "}
              {formatUtcInstant(activeNotification.endsAt, timeZone, {
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              })}
              {activeNotification.nextBookingTitle ? (
                <>
                  {". Your next booking, "}
                  <span
                    className="font-[650] text-[#28342c] [overflow-wrap:anywhere]"
                    title={activeNotification.nextBookingTitle}
                  >
                    “{activeNotification.nextBookingTitle}”
                  </span>
                  {" starts immediately after this one."}
                </>
              ) : (
                ". The next room slot is occupied."
              )}
            </>
          }
        />
      ) : null}
    </>
  );
}
