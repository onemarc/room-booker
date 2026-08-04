"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiLogOut } from "react-icons/fi";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      });

      if (!response.ok) {
        throw new Error("Logout failed.");
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="logout-control">
      <button
        className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#526058]
                  hover:bg-[#edf1ed] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-[18px]"
        type="button"
        aria-label="Log out"
        title="Log out"
        disabled={pending}
        onClick={logout}
      >
        <FiLogOut aria-hidden="true" />
      </button>
      {error ? (
        <p className="logout-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
