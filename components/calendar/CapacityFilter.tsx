"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FiChevronDown } from "react-icons/fi";

const CAPACITY_OPTIONS = [1, 4, 6, 8, 10, 12, 16];

function formatCapacity(capacity: number) {
  return capacity === 1 ? "Any" : `${capacity}+`;
}

export function CapacityFilter({
  value,
  compact = false,
  onChange,
}: {
  value: number;
  compact?: boolean;
  onChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, CAPACITY_OPTIONS.indexOf(value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const labelId = useId();
  const listId = useId();
  const selectedCapacity = CAPACITY_OPTIONS[selectedIndex];

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
      document.removeEventListener("pointerdown", dismissOnOutsidePointer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Move focus into the list after it mounts so keyboard selection starts
    // on the same option that the trigger displays.
    const frame = requestAnimationFrame(() => {
      optionRefs.current[activeIndex]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, isOpen]);

  function closeAndRestoreFocus() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function selectCapacity(capacity: number) {
    onChange(capacity);
    closeAndRestoreFocus();
  }

  function moveFocus(index: number) {
    const nextIndex =
      (index + CAPACITY_OPTIONS.length) % CAPACITY_OPTIONS.length;
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(selectedIndex);
      setIsOpen(true);
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(CAPACITY_OPTIONS.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCapacity(CAPACITY_OPTIONS[index]);
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
        "relative flex min-w-0 items-center gap-1.5 text-xs font-[620] text-[#657168]",
        compact ? "max-[880px]:sr-only" : "",
        !compact
          ? "max-[1060px]:flex-1 max-[1060px]:justify-between"
          : "",
      ].join(" ")}
      ref={rootRef}
    >
      <span className="shrink-0 whitespace-nowrap" id={labelId}>
        Minimum seats
      </span>

      <button
        className="flex h-8 min-w-[64px] cursor-pointer items-center justify-between gap-1 rounded-lg border border-[#ccd4ce] bg-white px-2 text-xs font-normal text-[#344138] outline-none hover:border-[#aebbb1] focus-visible:border-[#6b927f] focus-visible:ring-3 focus-visible:ring-[rgba(37,91,67,0.12)]"
        type="button"
        ref={triggerRef}
        aria-label={`Room capacity: ${formatCapacity(selectedCapacity)}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() =>
          isOpen ? setIsOpen(false) : setIsOpen(true)
        }
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{formatCapacity(selectedCapacity)}</span>
        <FiChevronDown aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          className="absolute top-[calc(100%+6px)] right-0 z-50 grid min-w-[84px] gap-px rounded-[10px] border border-[#d1d9d2] bg-[var(--surface)] p-1 shadow-[0_12px_28px_rgba(28,43,34,0.16)]"
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
        >
          {CAPACITY_OPTIONS.map((capacity, index) => {
            const isSelected = capacity === value;

            return (
              <button
                className={[
                  "w-full cursor-pointer rounded-md border-0 px-2.5 py-1.5 text-left text-xs text-[#344138] hover:bg-[#f0f4f1]",
                  isSelected || index === activeIndex
                    ? "bg-[#e8f0eb] font-[650]"
                    : "bg-transparent",
                ].join(" ")}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={index === activeIndex ? 0 : -1}
                key={capacity}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) =>
                  handleOptionKeyDown(event, index)
                }
                onClick={() => selectCapacity(capacity)}
              >
                {formatCapacity(capacity)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
