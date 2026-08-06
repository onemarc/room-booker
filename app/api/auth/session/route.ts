import { handleRouteError, jsonResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    // requireUser returns the minimal public session DTO, never the database row.
    const user = await requireUser();
    return jsonResponse({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
