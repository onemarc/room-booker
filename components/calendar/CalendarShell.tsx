"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FiChevronLeft, FiChevronRight, FiMenu } from "react-icons/fi";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { MiniCalendar } from "@/components/calendar/MiniCalendar";
import { RoomList } from "@/components/calendar/RoomList";
import { LogoutButton } from "@/components/LogoutButton";
import { OFFICE_TIME_ZONE } from "@/lib/office.mjs";
import type { RoomAvailability } from "@/lib/rooms";
import {
  addCalendarDays,
  detectBrowserTimeZone,
  formatPeriodLabel,
  getZonedDateIso,
  startOfCalendarMonth,
  type CalendarView,
} from "@/lib/time";

type RoomsResponse = {
  rooms?: RoomAvailability[];
  error?: {
    message?: string;
  };
};

function subscribeToBrowserTimeZone() {
  return () => {};
}

export function CalendarShell({
  displayName,
  initialNow,
  initialActiveDate,
  initialRooms,
}: {
  displayName: string;
  initialNow: string;
  initialActiveDate: string;
  initialRooms: RoomAvailability[];
}) {
  const timeZone = useSyncExternalStore(
    subscribeToBrowserTimeZone,
    detectBrowserTimeZone,
    () => OFFICE_TIME_ZONE,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleMiniCalendarMonth, setVisibleMiniCalendarMonth] =
    useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [rooms, setRooms] = useState(initialRooms);
  const [minimumCapacity, setMinimumCapacity] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState(
    initialRooms[0]?.id ?? "",
  );
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const initialRequestKey = `${OFFICE_TIME_ZONE}:${initialActiveDate}:1`;
  const loadedRequestKey = useRef(initialRequestKey);
  const activeDate =
    selectedDate ?? getZonedDateIso(initialNow, timeZone);
  const today = getZonedDateIso(new Date(), timeZone);
  const requestKey = `${timeZone}:${activeDate}:${minimumCapacity}`;

  useEffect(() => {
    if (loadedRequestKey.current === requestKey && retryVersion === 0) {
      return;
    }

    const controller = new AbortController();

    async function loadRooms() {
      setIsRoomsLoading(true);
      setRoomError("");

      try {
        const searchParams = new URLSearchParams({
          date: activeDate,
          timeZone,
          minCapacity: String(minimumCapacity),
        });
        const response = await fetch(`/api/rooms?${searchParams}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });
        const data = (await response.json()) as RoomsResponse;

        if (!response.ok || !data.rooms) {
          throw new Error(
            data.error?.message ??
              "Room availability could not be loaded.",
          );
        }

        setRooms(data.rooms);
        setSelectedRoomId((current) =>
          data.rooms!.some((room) => room.id === current)
            ? current
            : (data.rooms![0]?.id ?? ""),
        );
        loadedRequestKey.current = requestKey;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setRoomError(
          error instanceof Error
            ? error.message
            : "Room availability could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsRoomsLoading(false);
        }
      }
    }

    void loadRooms();
    return () => controller.abort();
  }, [activeDate, minimumCapacity, requestKey, retryVersion, timeZone]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId),
    [rooms, selectedRoomId],
  );
  const periodLabel = formatPeriodLabel(activeDate, view);

  function navigatePeriod(direction: -1 | 1) {
    const nextDate = addCalendarDays(
      activeDate,
      direction * (view === "week" ? 7 : 1),
    );
    setSelectedDate(nextDate);
    setVisibleMiniCalendarMonth(startOfCalendarMonth(nextDate));
  }

  function goToToday() {
    setSelectedDate(today);
    setVisibleMiniCalendarMonth(startOfCalendarMonth(today));
  }

  function selectActiveDate(date: string) {
    setSelectedDate(date);
    setVisibleMiniCalendarMonth(startOfCalendarMonth(date));
  }

  return (
    <main className="flex h-screen min-h-[560px] w-full overflow-hidden bg-[var(--surface)] supports-[height:100dvh]:h-dvh">
      {isSidebarOpen ? (
        <aside className="flex w-[clamp(260px,23vw,304px)] min-w-[260px] flex-none flex-col overflow-hidden border-r border-[var(--line)] bg-[#f8faf8] max-[1060px]:w-[250px] max-[1060px]:min-w-[250px] max-[760px]:w-[min(86vw,290px)] max-[760px]:min-w-[min(86vw,290px)]">
          <div className="flex min-h-[58px] items-center gap-2.5 border-b border-[var(--line)] px-3.5">
            <button
              className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-5"
              type="button"
              aria-label="Collapse room sidebar"
              onClick={() => setIsSidebarOpen(false)}
            >
              <FiMenu aria-hidden="true" />
            </button>
            <span className="whitespace-nowrap text-base font-[710] tracking-[-0.02em] text-[#202923]">
              Room Booker
            </span>
          </div>

          <MiniCalendar
            activeDate={activeDate}
            visibleMonth={
              visibleMiniCalendarMonth ??
              startOfCalendarMonth(activeDate)
            }
            timeZone={timeZone}
            onSelectDate={selectActiveDate}
            onVisibleMonthChange={setVisibleMiniCalendarMonth}
          />

          <RoomList
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            timeZone={timeZone}
            isLoading={isRoomsLoading}
            error={roomError}
            minimumCapacity={minimumCapacity}
            onSelectRoom={setSelectedRoomId}
            onRetry={() => setRetryVersion((current) => current + 1)}
            onMinimumCapacityChange={setMinimumCapacity}
          />
        </aside>
      ) : null}

      <section
        className={[
          "flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--surface)] max-[760px]:overflow-x-auto",
          isSidebarOpen ? "max-[760px]:min-w-[460px]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className="z-30 flex min-h-[58px] flex-none items-center justify-between gap-[18px] border-b border-[var(--line)] bg-[var(--surface)] px-[13px] max-[1060px]:gap-2 max-[1060px]:px-2 max-[760px]:min-w-[700px]">
          <div className="flex min-w-0 flex-[1_1_auto] items-center gap-[7px] max-[1060px]:gap-[3px]">
            {!isSidebarOpen ? (
              <>
                <button
                  className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-5"
                  type="button"
                  aria-label="Open room sidebar"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <FiMenu aria-hidden="true" />
                </button>
                <span className="whitespace-nowrap text-base font-[710] tracking-[-0.02em] text-[#202923]">
                  Room Booker
                </span>
                <span
                  className="h-[23px] w-px flex-none bg-[#d7ddd8]"
                  aria-hidden="true"
                />
              </>
            ) : null}

            <strong className="overflow-hidden text-[17px] font-[680] text-ellipsis whitespace-nowrap text-[#2d3731]">
              {periodLabel}
            </strong>
          </div>

          <div className="flex min-w-0 flex-none items-center gap-[7px] max-[1060px]:gap-[3px]">
            <button
              className="h-[34px] cursor-pointer whitespace-nowrap rounded-lg border-0 bg-transparent px-[9px] text-[13px] font-[620] text-[#4b5750] hover:bg-[#f0f3f0] hover:text-[var(--ink)] max-[1060px]:px-[7px]"
              type="button"
              onClick={goToToday}
            >
              Today
            </button>

            <div
              className="flex items-center"
              role="group"
              aria-label="Calendar period"
            >
              <button
                className="grid h-[34px] w-[30px] flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-4"
                type="button"
                aria-label={`Previous ${view}`}
                onClick={() => navigatePeriod(-1)}
              >
                <FiChevronLeft aria-hidden="true" />
              </button>
              <button
                className="grid h-[34px] w-[30px] flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#526058] hover:bg-[#edf1ed] hover:text-[var(--ink)] [&>svg]:size-4"
                type="button"
                aria-label={`Next ${view}`}
                onClick={() => navigatePeriod(1)}
              >
                <FiChevronRight aria-hidden="true" />
              </button>
            </div>

            <div
              className="flex items-center gap-0.5 rounded-[9px] border border-[#d8ded9] p-0.5"
              role="group"
              aria-label="Calendar view"
            >
              {(["day", "week"] as const).map((mode) => (
                <button
                  className={[
                    "h-7 cursor-pointer whitespace-nowrap rounded-lg border-0 px-2 text-[13px] font-[620] max-[1060px]:px-[7px]",
                    view === mode
                      ? "bg-[var(--accent-soft)] text-[#204f39] hover:bg-[var(--accent-soft)] hover:text-[#204f39]"
                      : "bg-transparent text-[#4b5750] hover:bg-[#f0f3f0] hover:text-[var(--ink)]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  key={mode}
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                >
                  {mode === "day" ? "Day" : "Week"}
                </button>
              ))}
            </div>

            <button
              className="h-[34px] cursor-default whitespace-nowrap rounded-lg border-0 bg-transparent px-[9px] text-[13px] font-[620] text-[#4b5750] opacity-100 max-[1060px]:px-[7px]"
              type="button"
              disabled
            >
              My Bookings
            </button>

            <span
              className="h-[23px] w-px flex-none bg-[#d7ddd8]"
              aria-hidden="true"
            />
            <span
              className="max-w-[125px] overflow-hidden text-[13px] font-[620] text-ellipsis whitespace-nowrap text-[#4b5750] max-[1060px]:max-w-[86px]"
              title={displayName}
            >
              {displayName}
            </span>
            <LogoutButton />
          </div>
        </header>

        {roomError && !isSidebarOpen ? (
          <div
            className="flex items-center justify-between gap-3 border-b border-[#ecd2d2] bg-[#fff8f8] px-3.5 py-2 text-[13px] text-[#8c3d3d]"
            role="alert"
          >
            <span>{roomError}</span>
            <button
              className="m-0 cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-[var(--accent)]"
              type="button"
              onClick={() => setRetryVersion((current) => current + 1)}
            >
              Retry
            </button>
          </div>
        ) : null}

        <CalendarGrid
          activeDate={activeDate}
          view={view}
          timeZone={timeZone}
          selectedRoom={selectedRoom}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          isRoomsLoading={isRoomsLoading}
          showRoomSelector={!isSidebarOpen}
          onSelectRoom={setSelectedRoomId}
        />
      </section>
    </main>
  );
}
