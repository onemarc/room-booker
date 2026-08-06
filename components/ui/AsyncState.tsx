import type { ReactNode } from "react";

export function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`block animate-pulse rounded-lg bg-[#e7ece8] ${className}`}
      aria-hidden="true"
    />
  );
}

export function InlineLoading({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs text-[#748078] ${className}`}
      role="status"
    >
      <span
        className="size-3.5 flex-none animate-spin rounded-full border-2 border-[#c6cec8] border-t-[var(--accent)]"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function StatePanel({
  title,
  description,
  action,
  tone = "neutral",
  role,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  role?: "alert" | "status";
  className?: string;
}) {
  const isDanger = tone === "danger";

  return (
    <div
      className={[
        "grid place-items-center rounded-xl border border-dashed p-6 text-center",
        isDanger
          ? "border-[#e4aaaa] bg-[#fff5f5]"
          : "border-[#d4dbd6] bg-[#fafcfa]",
        className,
      ].join(" ")}
      role={role}
    >
      <div className="max-w-[420px]">
        <p
          className={[
            "m-0 text-sm font-[680]",
            isDanger ? "text-[#b43737]" : "text-[#3c4840]",
          ].join(" ")}
        >
          {title}
        </p>
        {description ? (
          <p className="mt-1.5 mb-0 text-xs leading-5 text-[#748078]">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
