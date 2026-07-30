import assert from "node:assert/strict";
import test from "node:test";
import { intervalsOverlap } from "./time.ts";

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
