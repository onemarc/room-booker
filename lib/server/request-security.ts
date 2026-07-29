import "server-only";

import { HttpError } from "@/lib/server/http";

function getExpectedOrigin(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return new URL(request.url).origin;
  }

  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    throw new Error("APP_URL is required in production.");
  }

  return new URL(appUrl).origin;
}

export function assertStateChangingRequest(request: Request) {
  // Fetch Metadata rejects obvious cross-site browser requests before parsing input.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new HttpError("Cross-site requests are not allowed.", 403);
  }

  const origin = request.headers.get("origin");
  // Origin validation also protects login and registration from session-swapping CSRF.
  if (origin && origin !== getExpectedOrigin(request)) {
    throw new HttpError("Request origin is not allowed.", 403);
  }

  const contentType = request.headers.get("content-type");
  // Requiring JSON prevents classic cross-origin HTML forms from reaching mutations.
  if (!contentType?.toLowerCase().startsWith("application/json")) {
    throw new HttpError("Content-Type must be application/json.", 415);
  }
}

export async function readJsonObject(request: Request) {
  try {
    const value: unknown = await request.json();

    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value)
    ) {
      throw new Error("Expected a JSON object.");
    }

    return value as Record<string, unknown>;
  } catch {
    throw new HttpError("The request body must be valid JSON.", 400);
  }
}
