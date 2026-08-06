"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FiCheck, FiChevronDown } from "react-icons/fi";

export type BookingSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function BookingSelect({
  value,
  options,
  onChange,
  ariaLabel,
  isInvalid = false,
}: {
  value: string;
  options: BookingSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  isInvalid?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[selectedIndex];
  const boundedActiveIndex = Math.min(
    activeIndex,
    Math.max(options.length - 1, 0),
  );

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

    // Keep keyboard focus inside the open listbox so arrow navigation remains
    // usable even though the selector is rendered inside a scrolling editor.
    const frame = requestAnimationFrame(() => {
      optionRefs.current[boundedActiveIndex]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [boundedActiveIndex, isOpen]);

  function closeAndRestoreFocus() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function openAt(index: number) {
    setActiveIndex(index);
    setIsOpen(true);
  }

  function moveFocus(index: number) {
    const nextIndex = Math.min(
      Math.max(index, 0),
      Math.max(options.length - 1, 0),
    );
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (options.length === 0) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      openAt(
        Math.min(
          Math.max(selectedIndex + offset, 0),
          options.length - 1,
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
      moveFocus(index === options.length - 1 ? 0 : index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(index === 0 ? options.length - 1 : index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        className={[
          "group flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border bg-white px-3 text-left text-[15px] font-normal text-[#263129] outline-none transition-colors",
          isInvalid
            ? "border-[#bd6262]"
            : "border-[#ccd4ce] focus:border-[#6b927f] focus:ring-3 focus:ring-[rgba(37,91,67,0.12)]",
        ].join(" ")}
        type="button"
        ref={triggerRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-invalid={isInvalid}
        disabled={options.length === 0}
        onClick={() =>
          isOpen ? setIsOpen(false) : openAt(selectedIndex)
        }
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="min-w-0 flex-1">
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
            {selectedOption?.label ?? "No options"}
          </span>
          {selectedOption?.description ? (
            <small className="block overflow-hidden text-[12px] leading-4 text-ellipsis whitespace-nowrap text-[#7b857d]">
              {selectedOption.description}
            </small>
          ) : null}
        </span>
        <FiChevronDown
          className="size-4 flex-none transition-transform group-aria-expanded:rotate-180"
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div className="absolute top-[calc(100%+6px)] left-0 z-100 w-full overflow-hidden rounded-[12px] border border-[#d5ddd6] bg-[var(--surface)] p-1 shadow-[0_20px_55px_rgba(28,43,34,0.16)]">
          <div
            className="max-h-[240px] overflow-y-auto"
            id={listId}
            role="listbox"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;

              return (
                <button
                  className={[
                    "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border-0 px-3 py-2.5 text-left text-[15px] text-[#303a34] transition-colors",
                    isSelected
                      ? "bg-[#edf3ef]"
                      : index === boundedActiveIndex
                        ? "bg-[#f5f8f6]"
                        : "bg-transparent hover:bg-[#f5f8f6]",
                  ].join(" ")}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={index === boundedActiveIndex ? 0 : -1}
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  onFocus={() => setActiveIndex(index)}
                  onKeyDown={(event) =>
                    handleOptionKeyDown(event, index)
                  }
                  onClick={() => {
                    onChange(option.value);
                    closeAndRestoreFocus();
                  }}
                >
                  <span className="min-w-0">
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                      {option.label}
                    </span>
                    {option.description ? (
                      <small className="block text-[12px] leading-4 text-[#7b857d]">
                        {option.description}
                      </small>
                    ) : null}
                  </span>
                  <span
                    className={[
                      "grid size-5 flex-none place-items-center rounded-full border",
                      isSelected
                        ? "border-[#6d9783] bg-[var(--accent)] text-white"
                        : "border-transparent text-transparent",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    <FiCheck className="size-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
