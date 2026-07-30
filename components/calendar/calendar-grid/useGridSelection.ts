import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { RoomAvailability } from "@/lib/rooms";
import { CALENDAR_SLOT_MINUTES, localDateTimeToUtc, serializeUtcInstant } from "@/lib/time";
import type { BookingAnchor } from "@/components/calendar/booking-popover/BookingPopover";
import { getSelectionBounds, MAX_SELECTION_SLOTS } from "./calendar-grid-utils";
import type { BookingSelection, DragSelection } from "./types";

type CompletedGridSelection = {
  date: string;
  startIndex: number;
  endIndex: number;
};

// Pointer tracking lives outside the visual timeline so pointer-up outside a
// cell can still anchor the moving draft event at its last hovered slot.
export function useGridSelection({
  rows,
  timeZone,
  selectedRoom,
  onCreateSelection,
  onUpdateSelection,
}: {
  rows: Array<{ label: string }>;
  timeZone: string;
  selectedRoom?: RoomAvailability;
  onCreateSelection: (selection: BookingSelection) => void;
  onUpdateSelection: (selection: BookingSelection) => void;
}) {
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [movingDraft, setMovingDraft] = useState<{
    origin: CompletedGridSelection;
    current: CompletedGridSelection;
  } | null>(null);
  const dragSelectionRef = useRef<DragSelection | null>(null);
  const slotRefs = useRef(new Map<string, HTMLButtonElement>());
  const moveAnimationFrameRef = useRef<number | null>(null);
  const pendingMovingDraftRef = useRef<{
    origin: CompletedGridSelection;
    current: CompletedGridSelection;
  } | null>(null);

  const scheduleMovingDraft = useCallback((nextMovingDraft: {
    origin: CompletedGridSelection;
    current: CompletedGridSelection;
  }) => {
    pendingMovingDraftRef.current = nextMovingDraft;
    if (moveAnimationFrameRef.current !== null) {
      return;
    }

    // Pointer events can arrive faster than the display refreshes. Rendering
    // the latest valid position once per frame keeps the card responsive
    // without re-rendering the entire calendar for every event.
    moveAnimationFrameRef.current = requestAnimationFrame(() => {
      moveAnimationFrameRef.current = null;
      if (pendingMovingDraftRef.current) {
        setMovingDraft(pendingMovingDraftRef.current);
      }
    });
  }, []);

  const buildSelection = useCallback(({ date, startIndex, endIndex, anchor }: {
    date: string;
    startIndex: number;
    endIndex: number;
    anchor: BookingAnchor;
  }) => {
    if (!selectedRoom) return;
    // Convert the displayed start before adding duration so intervals stay
    // contiguous even where the viewer's local date changes mid-booking.
    const start = localDateTimeToUtc(date, rows[startIndex].label, timeZone);
    // The editor can adjust an interval after it is selected, so every entry
    // point goes through this guard instead of only disabling old grid cells.
    if (start.getTime() < Date.now()) return;
    const end = new Date(start.getTime() + (endIndex - startIndex) * CALENDAR_SLOT_MINUTES * 60_000);
    return {
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      startAt: serializeUtcInstant(start),
      endAt: serializeUtcInstant(end),
      anchor,
      gridSelection: { date, startIndex, endIndex },
    };
  }, [rows, selectedRoom, timeZone]);

  const isPastStart = useCallback((date: string, startIndex: number) => (
    localDateTimeToUtc(date, rows[startIndex].label, timeZone).getTime() <
    Date.now()
  ), [rows, timeZone]);

  const openSelection = useCallback((selection: {
    date: string;
    startIndex: number;
    endIndex: number;
    anchor: BookingAnchor;
  }) => {
    const bookingSelection = buildSelection(selection);
    if (bookingSelection) {
      onCreateSelection(bookingSelection);
    }
  }, [buildSelection, onCreateSelection]);

  const updateSelection = useCallback((selection: {
    date: string;
    startIndex: number;
    endIndex: number;
    anchor: BookingAnchor;
  }) => {
    const bookingSelection = buildSelection(selection);
    if (bookingSelection) {
      onUpdateSelection(bookingSelection);
    }
  }, [buildSelection, onUpdateSelection]);

  const getSelectionAnchor = useCallback((
    date: string,
    startIndex: number,
    endIndex: number,
  ) => {
    const firstCell = slotRefs.current.get(`${date}:${startIndex}`);
    const lastCell = slotRefs.current.get(`${date}:${endIndex - 1}`);
    if (!firstCell || !lastCell) {
      return null;
    }

    const firstRect = firstCell.getBoundingClientRect();
    const lastRect = lastCell.getBoundingClientRect();
    return {
      top: firstRect.top,
      right: Math.max(firstRect.right, lastRect.right),
      bottom: lastRect.bottom,
      left: Math.min(firstRect.left, lastRect.left),
    };
  }, []);

  const getRowIndexAtPointer = useCallback((date: string, clientY: number) => {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const cell = slotRefs.current.get(`${date}:${rowIndex}`);
      if (!cell) {
        continue;
      }

      const rect = cell.getBoundingClientRect();
      if (clientY < rect.bottom) {
        return rowIndex;
      }
    }

    return rows.length - 1;
  }, [rows.length]);

  const getSlotAtPointer = useCallback((clientX: number, clientY: number) => {
    for (const [key, cell] of slotRefs.current) {
      const rect = cell.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        const separatorIndex = key.lastIndexOf(":");
        return {
          date: key.slice(0, separatorIndex),
          rowIndex: Number(key.slice(separatorIndex + 1)),
        };
      }
    }

    return null;
  }, []);

  const trackPointer = useCallback((
    onMove: (event: PointerEvent) => void,
    onFinish?: (wasCancelled: boolean) => void,
  ) => {
    const finish = (event: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      onFinish?.(event.type === "pointercancel");
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  }, []);

  useEffect(() => {
    function finishSelection() {
      const selection = dragSelectionRef.current;
      if (!selection) return;
      const { startIndex, endIndex } = getSelectionBounds(selection);
      dragSelectionRef.current = null;
      setDragSelection(null);
      const anchor = getSelectionAnchor(selection.date, startIndex, endIndex);
      if (!anchor) return;
      openSelection({
        date: selection.date,
        startIndex,
        endIndex,
        anchor,
      });
    }
    function cancelSelection() {
      dragSelectionRef.current = null;
      setDragSelection(null);
    }
    window.addEventListener("pointerup", finishSelection);
    window.addEventListener("pointercancel", cancelSelection);
    return () => {
      window.removeEventListener("pointerup", finishSelection);
      window.removeEventListener("pointercancel", cancelSelection);
    };
  }, [getSelectionAnchor, openSelection]);

  useEffect(() => () => {
    if (moveAnimationFrameRef.current !== null) {
      cancelAnimationFrame(moveAnimationFrameRef.current);
    }
  }, []);

  function startSelection(event: ReactPointerEvent<HTMLButtonElement>, date: string, rowIndex: number) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !selectedRoom) return;
    event.preventDefault();
    const selection = { date, anchorIndex: rowIndex, currentIndex: rowIndex };
    dragSelectionRef.current = selection;
    setDragSelection(selection);
  }

  function extendSelection(date: string, rowIndex: number) {
    const current = dragSelectionRef.current;
    if (!current || current.date !== date) return;
    const next = { ...current, currentIndex: rowIndex };
    dragSelectionRef.current = next;
    setDragSelection(next);
  }

  function selectSlotWithKeyboard(event: ReactMouseEvent<HTMLButtonElement>, date: string, rowIndex: number) {
    if (event.detail !== 0 || !selectedRoom) return;
    const rect = event.currentTarget.getBoundingClientRect();
    openSelection({ date, startIndex: rowIndex, endIndex: rowIndex + 1, anchor: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left } });
  }

  function moveSelection(
    event: ReactPointerEvent<HTMLDivElement>,
    selection: { date: string; startIndex: number; endIndex: number },
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const pointerStartSlot =
      getSlotAtPointer(event.clientX, event.clientY) ?? {
        date: selection.date,
        rowIndex: selection.startIndex,
      };
    const duration = selection.endIndex - selection.startIndex;
    let previousSelectionKey = `${selection.date}:${selection.startIndex}`;
    let currentSelection: CompletedGridSelection = selection;
    setMovingDraft({ origin: selection, current: selection });
    trackPointer((pointerEvent) => {
      const pointerSlot = getSlotAtPointer(
        pointerEvent.clientX,
        pointerEvent.clientY,
      );
      if (!pointerSlot) {
        return;
      }

      const delta =
        pointerSlot.rowIndex - pointerStartSlot.rowIndex;
      const startIndex = Math.max(
        0,
        Math.min(rows.length - duration, selection.startIndex + delta),
      );
      const selectionKey = `${pointerSlot.date}:${startIndex}`;
      if (
        selectionKey === previousSelectionKey ||
        isPastStart(pointerSlot.date, startIndex)
      ) {
        return;
      }

      previousSelectionKey = selectionKey;
      const endIndex = startIndex + duration;
      currentSelection = {
        date: pointerSlot.date,
        startIndex,
        endIndex,
      };
      scheduleMovingDraft({ origin: selection, current: currentSelection });
    }, (wasCancelled) => {
      if (moveAnimationFrameRef.current !== null) {
        cancelAnimationFrame(moveAnimationFrameRef.current);
        moveAnimationFrameRef.current = null;
      }
      pendingMovingDraftRef.current = null;
      setMovingDraft(null);
      if (wasCancelled || currentSelection === selection) {
        return;
      }

      const anchor = getSelectionAnchor(
        currentSelection.date,
        currentSelection.startIndex,
        currentSelection.endIndex,
      );
      if (anchor) {
        updateSelection({ ...currentSelection, anchor });
      }
    });
  }

  function resizeSelection(
    event: ReactPointerEvent<HTMLButtonElement>,
    selection: { date: string; startIndex: number; endIndex: number },
    edge: "start" | "end",
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    let previousRange = `${selection.startIndex}:${selection.endIndex}`;
    trackPointer((pointerEvent) => {
      const rowIndex = getRowIndexAtPointer(selection.date, pointerEvent.clientY);
      const nextRange =
        edge === "start"
          ? {
              startIndex: Math.max(
                Math.max(0, selection.endIndex - MAX_SELECTION_SLOTS),
                Math.min(rowIndex, selection.endIndex - 1),
              ),
              endIndex: selection.endIndex,
            }
          : {
              startIndex: selection.startIndex,
              endIndex: Math.min(
                Math.min(rows.length, selection.startIndex + MAX_SELECTION_SLOTS),
                Math.max(rowIndex + 1, selection.startIndex + 1),
              ),
            };
      const rangeKey = `${nextRange.startIndex}:${nextRange.endIndex}`;
      if (rangeKey === previousRange) {
        return;
      }

      previousRange = rangeKey;
      const anchor = getSelectionAnchor(
        selection.date,
        nextRange.startIndex,
        nextRange.endIndex,
      );
      if (anchor) {
        updateSelection({ date: selection.date, ...nextRange, anchor });
      }
    });
  }

  return {
    dragSelection,
    movingDraft,
    slotRefs,
    startSelection,
    extendSelection,
    selectSlotWithKeyboard,
    moveSelection,
    resizeSelection,
  };
}
