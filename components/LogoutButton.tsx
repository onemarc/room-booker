"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiLogOut } from "react-icons/fi";
import { useToast } from "@/components/ui/Toast";

export function LogoutButton() {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);

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
      // Display sign-out failures using the global toast notification system
      showToast({
        message: "Could not sign out. Please try again.",
        variant: "error",
      });
      setPending(false);
    }
  }

  return (
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
  );
}
