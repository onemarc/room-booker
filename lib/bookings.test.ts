import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_COLORS,
  DEFAULT_BOOKING_COLOR,
  isBookingColor,
} from "./bookings.ts";

test("booking colors expose the persisted default and accepted palette", () => {
  assert.equal(DEFAULT_BOOKING_COLOR, "sage");
  assert.deepEqual(BOOKING_COLORS, [
    "sage",
    "blue",
    "violet",
    "amber",
    "rose",
    "slate",
  ]);

  for (const color of BOOKING_COLORS) {
    assert.equal(isBookingColor(color), true);
  }
});

test("booking color validation rejects values outside the palette", () => {
  assert.equal(isBookingColor("green"), false);
  assert.equal(isBookingColor(""), false);
  assert.equal(isBookingColor(null), false);
  assert.equal(isBookingColor(1), false);
});
