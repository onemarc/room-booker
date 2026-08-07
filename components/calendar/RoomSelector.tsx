"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FiChevronDown } from "react-icons/fi";
import { CapacityFilter } from "@/components/calendar/CapacityFilter";
import { RoomSummary } from "@/components/calendar/RoomSummary";
import type { RoomAvailability } from "@/lib/rooms";

type RoomMenuPosition = {
  top: number;
  left: number;
  width: number;
};

export function RoomSelector({
  rooms,
  selectedRoomId,
  timeZone,
  compactOnSmallScreen = false,
  isLoading,
  minimumCapacity,
  onSelectRoom,
  onMinimumCapacityChange,
}: {
  rooms: RoomAvailability[];
  selectedRoomId: string;
  timeZone: string;
  compactOnSmallScreen?: boolean;
  isLoading: boolean;
  minimumCapacity: number;
  onSelectRoom: (roomId: string) => void;
  onMinimumCapacityChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<RoomMenuPosition | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    rooms.findIndex((room) => room.id === selectedRoomId),
  );
  const selectedRoom = rooms[selectedIndex];

  // The phone header scrolls horizontally, so the menu uses viewport coordinates
  // and is portaled to body instead of being clipped by that scroll container.
  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const triggerBounds = trigger.getBoundingClientRect();
    const width = Math.max(0, Math.min(360, window.innerWidth - 28));
    const maxLeft = Math.max(14, window.innerWidth - width - 14);

    setMenuPosition({
      top: triggerBounds.bottom + 9,
      left: Math.min(Math.max(14, triggerBounds.left), maxLeft),
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();
    const frame = requestAnimationFrame(updateMenuPosition);
    const handleScroll = () => updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function dismissOnOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    return () =>
      document.removeEventListener(
        "pointerdown",
        dismissOnOutsidePointer,
      );
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      optionRefs.current[activeIndex]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, isOpen]);

  function closeAndRestoreFocus() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function openAt(index: number) {
    setActiveIndex(index);
    setIsOpen(true);
  }

  function moveFocus(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), rooms.length - 1);
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      openAt(
        Math.min(
          Math.max(selectedIndex + offset, 0),
          rooms.length - 1,
        ),
      );
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(index === rooms.length - 1 ? 0 : index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(index === 0 ? rooms.length - 1 : index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(rooms.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  return (
    <div
      className={[
        "relative w-fit min-w-0 max-w-[240px]",
        compactOnSmallScreen
          ? "max-[1200px]:max-w-[180px] max-[1200px]:shrink-0"
          : "",
      ].join(" ")}
      ref={rootRef}
    >
      <button
        className={[
          "group flex min-h-12 w-auto max-w-full cursor-pointer items-center justify-start gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-[#36433a] transition-colors duration-150 hover:bg-[#f0f3f0] focus-visible:bg-[#f0f3f0] aria-expanded:bg-[#edf2ee]",
          compactOnSmallScreen
            ? "max-[1200px]:gap-1.5 max-[1200px]:px-1.5"
            : "",
        ].join(" ")}
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        disabled={rooms.length === 0}
        onClick={() =>
          isOpen ? setIsOpen(false) : openAt(selectedIndex)
        }
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="grid min-w-0 flex-[0_1_auto] gap-0.5 text-left">
          <strong className="overflow-hidden text-[13px] font-[720] text-ellipsis whitespace-nowrap text-[#263129]">
            {selectedRoom?.name ?? "No rooms"}
          </strong>
          {selectedRoom ? (
            <small
              className={[
                "overflow-hidden text-[10px] font-normal tracking-[0.01em] text-ellipsis whitespace-nowrap text-[#7b857d]",
                compactOnSmallScreen ? "max-[760px]:hidden" : "",
              ].join(" ")}
            >
              Floor {selectedRoom.floor} · {selectedRoom.capacity}{" "}
              {selectedRoom.capacity === 1 ? "seat" : "seats"}
            </small>
          ) : null}
        </span>
        {isLoading ? (
          <span
            className="size-[13px] flex-none animate-spin rounded-full border-2 border-[#c6cec8] border-t-[var(--accent)]"
            aria-label="Updating rooms"
          />
        ) : (
          <span className="grid size-6 flex-none place-items-center rounded-full bg-[#e8ede9] text-[#667169] transition-transform group-aria-expanded:rotate-180 [&>svg]:size-3.5">
            <FiChevronDown aria-hidden="true" />
          </span>
        )}
      </button>

      {isOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-100 overflow-hidden rounded-[14px] border border-[#d5ddd6] bg-[var(--surface)] shadow-[0_20px_55px_rgba(28,43,34,0.16)]"
              ref={menuRef}
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
            >
          <div className="flex items-center justify-between gap-4 border-b border-[#e4e9e5] px-3.5 py-2.5">
            <span className="text-sm font-[700] text-[#2c3730]">
              Choose a room
            </span>
            <CapacityFilter
              value={minimumCapacity}
              compact
              onChange={onMinimumCapacityChange}
            />
          </div>
          <div
            className="max-h-[min(430px,calc(100vh-140px))] overflow-y-auto [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:size-[9px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#aab4ac] [&::-webkit-scrollbar-thumb]:bg-clip-padding"
            id={listId}
            role="listbox"
            aria-label="Select a room"
          >
            {rooms.map((room, index) => {
              const isSelected = room.id === selectedRoomId;

            return (
              <button
                className={[
                  "flex w-full cursor-pointer items-start gap-3 border-b border-[#e7ebe7] px-3.5 py-3 text-left text-[#303a34] transition-colors duration-150 last:border-b-0",
                  isSelected
                    ? "bg-[#edf3ef]"
                    : index === activeIndex
                      ? "bg-[#f5f8f6]"
                      : "bg-transparent hover:bg-[#f5f8f6]",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={index === activeIndex ? 0 : -1}
                key={room.id}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) =>
                  handleOptionKeyDown(event, index)
                }
                onClick={() => {
                  onSelectRoom(room.id);
                  closeAndRestoreFocus();
                }}
              >
                <RoomSummary room={room} timeZone={timeZone} />
              </button>
            );
            })}
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
