import { confirmEmail } from "@/lib/server/email-confirmation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const confirmed = await confirmEmail(url.searchParams.get("token") ?? "");
  const destination = new URL("/calendar", url.origin);
  destination.searchParams.set(
    "confirmation",
    confirmed ? "success" : "invalid",
  );
  return Response.redirect(destination, 303);
}
