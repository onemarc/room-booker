import { confirmEmail } from "@/lib/server/email-confirmation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const confirmed = await confirmEmail(url.searchParams.get("token") ?? "");
  // Keep the result on a public page so an expired browser session cannot
  // swallow the activation feedback behind the protected calendar redirect.
  const destination = new URL("/email-confirmation", url.origin);
  destination.searchParams.set("status", confirmed ? "success" : "failed");
  return Response.redirect(destination, 303);
}
