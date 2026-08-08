"use client";

import { forwardRef, useImperativeHandle, type Ref } from "react";
import { CalendarGridSurface } from "./CalendarGridSurface";
import { useCalendarGridState } from "./useCalendarGridState";
import type { CalendarGridProps } from "./types";

export type { CalendarGridSelection } from "./types";

export type CalendarGridHandle = {
  captureSidebarLayoutAnchor: () => void;
};

export const CalendarGrid = forwardRef<CalendarGridHandle, CalendarGridProps>(
  function CalendarGrid(props, ref: Ref<CalendarGridHandle>) {
    const gridState = useCalendarGridState(props);

    useImperativeHandle(
      ref,
      () => ({
        captureSidebarLayoutAnchor: gridState.captureSidebarLayoutAnchor,
      }),
      [gridState.captureSidebarLayoutAnchor],
    );

    return <CalendarGridSurface {...props} gridState={gridState} />;
  },
);
