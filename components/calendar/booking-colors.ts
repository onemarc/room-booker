import type { BookingColor } from "@/lib/bookings";

export const BOOKING_COLOR_OPTIONS: Array<{
  value: BookingColor;
  label: string;
  surface: string;
  border: string;
  text: string;
}> = [
  {
    value: "sage",
    label: "Sage",
    surface: "#dfece5",
    border: "#6f9a85",
    text: "#234735",
  },
  {
    value: "blue",
    label: "Blue",
    surface: "#e0eaf4",
    border: "#7192b2",
    text: "#294b69",
  },
  {
    value: "violet",
    label: "Violet",
    surface: "#e9e4f3",
    border: "#9281b1",
    text: "#51416f",
  },
  {
    value: "amber",
    label: "Amber",
    surface: "#f5ead2",
    border: "#bd9654",
    text: "#6d5225",
  },
  {
    value: "rose",
    label: "Rose",
    surface: "#f4e1e4",
    border: "#b87882",
    text: "#6f3942",
  },
  {
    value: "slate",
    label: "Slate",
    surface: "#e5e9e8",
    border: "#7f918b",
    text: "#364842",
  },
];

export const BOOKING_COLOR_STYLES = Object.fromEntries(
  BOOKING_COLOR_OPTIONS.map((option) => [option.value, option]),
) as Record<
  BookingColor,
  (typeof BOOKING_COLOR_OPTIONS)[number]
>;
