"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { FiAlertCircle, FiBell, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";

export type ToastVariant = "info" | "warning" | "error" | "success";

export type ToastProps = {
  /** Title header for the toast card */
  title?: string;
  /** Primary message or description body */
  description?: ReactNode;
  /** Optional custom icon; defaults based on variant */
  icon?: ReactNode;
  /** Toast visual theme variant */
  variant?: ToastVariant;
  /** Error message to render at the bottom of the toast card */
  errorText?: string;
  /** Callback fired when user dismisses the toast */
  onDismiss?: () => void;
  /** Optional custom container CSS classes */
  className?: string;
};

export type ToastOptions = {
  title?: string;
  message: ReactNode;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextType = {
  showToast: (options: string | ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Shared Toast UI component mirroring exact styling, accessibility markup,
 * and layout structure from the notification bell toast card.
 */
export function Toast({
  title,
  description,
  icon,
  variant = "info",
  errorText,
  onDismiss,
  className,
}: ToastProps) {
  // Determine icon background and text styles based on toast variant
  const variantStyles = {
    info: "bg-[var(--accent-soft)] text-[var(--accent)]",
    warning: "bg-[#fff7e6] text-[#b46d14]",
    error: "bg-[#fde8e8] text-[#9c3d3d]",
    success: "bg-[#eaf5ed] text-[#2b6e49]",
  }[variant];

  // Default icon based on variant if no custom icon was provided
  const renderedIcon =
    icon ??
    (variant === "warning" ? (
      <FiAlertCircle aria-hidden="true" />
    ) : variant === "error" ? (
      <FiAlertCircle aria-hidden="true" />
    ) : variant === "success" ? (
      <FiCheckCircle aria-hidden="true" />
    ) : (
      <FiBell aria-hidden="true" />
    ));

  return (
    <aside
      className={[
        "fixed right-4 bottom-4 z-100 w-[min(380px,calc(100vw-24px))] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-[#cad5cc] bg-white p-4 shadow-[0_22px_70px_rgba(20,35,26,0.24)] max-[640px]:right-3 max-[640px]:bottom-3 transition-all duration-200 ease-out",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-9 flex-none place-items-center rounded-full ${variantStyles} [&>svg]:size-[17px]`}
        >
          {renderedIcon}
        </span>
        <div className="min-w-0 flex-1">
          {title ? (
            <strong className="block text-sm font-[720] text-[#28342c]">
              {title}
            </strong>
          ) : null}
          {description ? (
            <div
              className={`${
                title ? "mt-1 mb-0" : "m-0"
              } text-xs leading-5 text-[#657168] [overflow-wrap:anywhere]`}
            >
              {description}
            </div>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            className="grid size-8 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#68736b] hover:bg-[#eef2ef] [&>svg]:size-4"
            type="button"
            aria-label="Dismiss notification"
            onClick={onDismiss}
          >
            <FiX aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {errorText ? (
        <p className="mt-2 mb-0 text-[11px] text-[#963f3f]" role="alert">
          {errorText}
        </p>
      ) : null}
    </aside>
  );
}

type ToastItem = {
  id: string;
  title?: string;
  message: ReactNode;
  variant: ToastVariant;
  duration: number;
};

/**
 * ToastProvider manages app-wide toast notifications.
 * It enforces single-toast presentation so multiple rapid triggers (mouse clicks on past calendar slots)
 * replace/refresh the single visible toast instead of stacking multiple cards
 * underneath each other and causing performance lag.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);

  const removeToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const showToast = useCallback((options: string | ToastOptions) => {
    const title = typeof options === "string" ? undefined : options.title;
    const message = typeof options === "string" ? options : options.message;
    const variant = typeof options === "string" ? "warning" : (options.variant ?? "warning");
    const duration = typeof options === "string" ? 4000 : (options.duration ?? 4000);

    setActiveToast((current) => {
      // If the currently visible toast matches the message, keep its identity
      // to avoid unmounting/remounting DOM elements and rendering stacked box-shadow artifacts.
      if (
        current &&
        current.message === message &&
        current.title === title &&
        current.variant === variant
      ) {
        return current;
      }

      return {
        id: Math.random().toString(36).substring(2, 9),
        title,
        message,
        variant,
        duration,
      };
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {activeToast ? (
        <AutoDismissToast
          key={activeToast.id}
          toast={activeToast}
          onDismiss={removeToast}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

function AutoDismissToast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  return (
    <Toast
      title={toast.title}
      description={toast.message}
      variant={toast.variant}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Hook to trigger toast notifications across the application.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
