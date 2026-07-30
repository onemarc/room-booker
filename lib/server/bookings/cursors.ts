import { serializeUtcInstant } from "@/lib/time";
import { HttpError } from "@/lib/server/http";
import { isUuid } from "./identifiers";
import type { BookingCursor, OwnedBookingRow } from "./types";

// Past-booking cursors carry the final sort tuple, making pagination stable
// when multiple bookings have the same start timestamp.
export function encodeCursor(row: OwnedBookingRow) {
  return Buffer.from(
    JSON.stringify({
      startAt: serializeUtcInstant(row.start_at),
      id: row.id,
    } satisfies BookingCursor),
  ).toString("base64url");
}

export function decodeCursor(value: string): BookingCursor {
  try {
    if (value.length > 512) {
      throw new Error("Invalid cursor.");
    }

    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("startAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.startAt !== "string" ||
      typeof parsed.id !== "string" ||
      !isUuid(parsed.id) ||
      Number.isNaN(new Date(parsed.startAt).getTime())
    ) {
      throw new Error("Invalid cursor.");
    }

    return { startAt: serializeUtcInstant(parsed.startAt), id: parsed.id };
  } catch {
    throw new HttpError(
      "The booking cursor is invalid.",
      400,
      undefined,
      "invalid_cursor",
    );
  }
}
