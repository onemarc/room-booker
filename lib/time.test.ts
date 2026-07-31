import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTimeInZone,
  getBookingTimeViolation,
  getDayRangeUtc,
  intervalsOverlap,
  localDateTimeToUtc,
} from "./time.ts";

test("back-to-back intervals do not overlap", () => {
  assert.equal(
    intervalsOverlap(
      "2026-07-29T07:00:00.000Z",
      "2026-07-29T08:00:00.000Z",
      "2026-07-29T08:00:00.000Z",
      "2026-07-29T09:00:00.000Z",
    ),
    false,
  );
});

test("a partial overlap is rejected", () => {
  assert.equal(
    intervalsOverlap(
      "2026-07-29T07:00:00.000Z",
      "2026-07-29T08:00:00.000Z",
      "2026-07-29T07:30:00.000Z",
      "2026-07-29T08:30:00.000Z",
    ),
    true,
  );
});

test("an exact match overlaps", () => {
  assert.equal(
    intervalsOverlap(
      "2026-07-29T07:00:00.000Z",
      "2026-07-29T08:00:00.000Z",
      "2026-07-29T07:00:00.000Z",
      "2026-07-29T08:00:00.000Z",
    ),
    true,
  );
});

test("matching times on adjacent days do not overlap", () => {
  assert.equal(
    intervalsOverlap(
      "2026-07-29T07:00:00.000Z",
      "2026-07-29T08:00:00.000Z",
      "2026-07-30T07:00:00.000Z",
      "2026-07-30T08:00:00.000Z",
    ),
    false,
  );
});

test("user-local and Kyiv office times resolve to the same UTC instant", () => {
  const officeInstant = localDateTimeToUtc(
    "2026-07-30",
    "10:00",
    "Europe/Kyiv",
  );

  assert.equal(officeInstant.toISOString(), "2026-07-30T07:00:00.000Z");
  assert.equal(formatTimeInZone(officeInstant, "America/New_York"), "03:00");
});

test("a user-local day range converts to UTC across a daylight-saving boundary", () => {
  const range = getDayRangeUtc("2026-11-01", "America/New_York");

  assert.equal(range.start.toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-11-02T05:00:00.000Z");
});

test("booking time validation accepts exact Kyiv office boundaries", () => {
  assert.equal(
    getBookingTimeViolation(
      "2026-07-30T06:00:00.000Z",
      "2026-07-30T10:00:00.000Z",
      new Date("2026-07-30T05:59:59.000Z"),
    ),
    null,
  );
});

test("booking time validation rejects order, slot, office, and future violations", () => {
  assert.equal(
    getBookingTimeViolation(
      "2026-07-30T07:00:00.000Z",
      "2026-07-30T07:00:00.000Z",
      new Date("2026-07-30T05:00:00.000Z"),
    ),
    "invalid_order",
  );
  assert.equal(
    getBookingTimeViolation(
      "2026-07-30T06:15:00.000Z",
      "2026-07-30T06:45:00.000Z",
      new Date("2026-07-30T05:00:00.000Z"),
    ),
    "not_on_slot_boundary",
  );
  assert.equal(
    getBookingTimeViolation(
      "2026-07-30T15:30:00.000Z",
      "2026-07-30T16:30:00.000Z",
      new Date("2026-07-30T05:00:00.000Z"),
    ),
    "outside_working_hours",
  );
  assert.equal(
    getBookingTimeViolation(
      "2026-07-30T06:00:00.000Z",
      "2026-07-30T06:30:00.000Z",
      new Date("2026-07-30T06:00:00.000Z"),
    ),
    "not_in_future",
  );
});
