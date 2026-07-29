import { LogoutButton } from "@/components/LogoutButton";
import { requirePageUser } from "@/lib/server/session";

export const metadata = {
  title: "Calendar",
};

export default async function CalendarPage() {
  const user = await requirePageUser();

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>Room Booker</span>
        </div>
        <div className="user-menu">
          <span>{user.displayName}</span>
          <LogoutButton />
        </div>
      </header>

      <section className="foundation-state">
        <h1>The room calendar starts here.</h1>
        <p>
          Authentication and the persistent room-booking foundation are
          connected.
        </p>
      </section>
    </main>
  );
}
