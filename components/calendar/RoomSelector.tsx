"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FiChevronDown } from "react-icons/fi";
import { RoomSummary } from "@/components/calendar/RoomSummary";
import type { RoomAvailability } from "@/lib/rooms";

export function RoomSelector({
  rooms,
  selectedRoomId,
  timeZone,
  isLoading,
  onSelectRoom,
}: {
  rooms: RoomAvailability[];
  selectedRoomId: string;
  timeZone: string;
  isLoading: boolean;
  onSelectRoom: (roomId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    rooms.findIndex((room) => room.id === selectedRoomId),
  );
  const selectedRoom = rooms[selectedIndex];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function dismissOnOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
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
      className="relative w-fit min-w-0 max-w-[220px]"
      ref={rootRef}
    >
      <button
        className="flex min-h-12 w-auto cursor-pointer items-center justify-start gap-3 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-[13px] font-[670] text-[#36433a] transition-colors duration-120 hover:bg-[#eef2ef] focus-visible:bg-[#eef2ef] aria-expanded:bg-[#eef2ef] [&>svg]:size-[15px] [&>svg]:flex-none"
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
        <span className="grid min-w-0 flex-[0_1_auto] gap-px text-left">
          <strong className="overflow-hidden text-[13px] font-bold text-ellipsis whitespace-nowrap text-[#29352e]">
            {selectedRoom?.name ?? "No rooms"}
          </strong>
          {selectedRoom ? (
            <small className="overflow-hidden text-[11px] font-normal text-ellipsis whitespace-nowrap text-[#778179]">
              Floor {selectedRoom.floor} · {selectedRoom.capacity} people
            </small>
          ) : null}
        </span>
        {isLoading ? (
          <span
            className="size-[13px] flex-none animate-spin rounded-full border-2 border-[#c6cec8] border-t-[var(--accent)]"
            aria-label="Updating rooms"
          />
        ) : (
          <FiChevronDown aria-hidden="true" />
        )}
      </button>

      {isOpen ? (
        <div
          className="absolute top-[calc(100%+9px)] left-0 z-100 grid max-h-[min(430px,calc(100vh-90px))] w-[min(350px,calc(100vw-28px))] gap-[7px] overflow-y-auto rounded-[13px] border border-[#d1d9d2] bg-[var(--surface)] p-2 shadow-[0_18px_48px_rgba(28,43,34,0.16)] [scrollbar-color:#aab4ac_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:size-[9px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#aab4ac] [&::-webkit-scrollbar-thumb]:bg-clip-padding"
          id={listId}
          role="listbox"
          aria-label="Select a room"
        >
          {rooms.map((room, index) => {
            const isSelected = room.id === selectedRoomId;

            return (
              <button
                className={[
                  "w-full cursor-pointer rounded-[11px] border px-[11px] py-2.5 text-left text-[#303a34]",
                  isSelected
                    ? "border-[#4e8068] bg-[var(--accent-soft)] shadow-[inset_3px_0_0_var(--accent)] hover:border-[#4e8068] hover:bg-[var(--accent-soft)]"
                    : index === activeIndex
                    ? "border-[#aebbb1] bg-[#f7faf8]"
                    : "border-[#d5dbd6] bg-[var(--surface)] hover:border-[#aebbb1] hover:bg-[#f7faf8]",
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
      ) : null}
    </div>
  );
}
