import { query } from "@/lib/server/database";
import { handleRouteError, jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await query("SELECT 1");
    return jsonResponse({ status: "ok" });
  } catch (error) {
    return handleRouteError(error);
  }
}
