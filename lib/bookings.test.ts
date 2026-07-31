import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_COLORS,
  DEFAULT_BOOKING_COLOR,
  isAllowedBookingDuration,
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

test("booking duration accepts the inclusive 30-minute through 4-hour range", () => {
  assert.equal(
    isAllowedBookingDuration(
      "2026-07-30T06:00:00.000Z",
      "2026-07-30T06:30:00.000Z",
    ),
    true,
  );
  assert.equal(
    isAllowedBookingDuration(
      "2026-07-30T06:00:00.000Z",
      "2026-07-30T10:00:00.000Z",
    ),
    true,
  );
});

test("booking duration rejects values outside its boundaries", () => {
  assert.equal(
    isAllowedBookingDuration(
      "2026-07-30T06:00:00.000Z",
      "2026-07-30T06:29:00.000Z",
    ),
    false,
  );
  assert.equal(
    isAllowedBookingDuration(
      "2026-07-30T06:00:00.000Z",
      "2026-07-30T10:30:00.000Z",
    ),
    false,
  );
  assert.equal(isAllowedBookingDuration("invalid", "also-invalid"), false);
});
