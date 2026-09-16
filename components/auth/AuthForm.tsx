"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FiCheck } from "react-icons/fi";

type AuthMode = "login" | "register";
type FieldName = "displayName" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

type ErrorResponse = {
  error?: {
    message?: string;
    fieldErrors?: FieldErrors;
  };
};

/**
 * Password validation rules for new registrations.
 * Evaluated live as the user types so indicators turn green as requirements are satisfied.
 */
type PasswordRequirement = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "length",
    label: "8–72 characters",
    test: (value: string) => value.length >= 8 && value.length <= 72,
  },
  {
    id: "letter",
    label: "At least one letter",
    test: (value: string) => /[a-zA-Z]/.test(value),
  },
  {
    id: "number",
    label: "At least one number",
    test: (value: string) => /[0-9]/.test(value),
  },
];

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [passwordValue, setPasswordValue] = useState("");
  const isRegistration = mode === "register";

  function handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPasswordValue(event.target.value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.password;
        return next;
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const payload = {
      ...(isRegistration
        ? { displayName: formData.get("displayName") }
        : {}),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    if (isRegistration) {
      const allMet = PASSWORD_REQUIREMENTS.every((req) =>
        req.test(String(payload.password ?? "")),
      );
      if (!allMet) {
        setFieldErrors((prev) => ({
          ...prev,
          password: "Password must satisfy all requirements.",
        }));
        setMessage("Check the highlighted fields and try again.");
        setPending(false);
        return;
      }
    }

    try {
      // Route handlers remain the validation authority; the client only presents their field errors.
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ErrorResponse;

      if (!response.ok) {
        setMessage(
          data.error?.message ??
            "The request could not be completed. Please try again.",
        );
        setFieldErrors(data.error?.fieldErrors ?? {});
        return;
      }

      router.replace("/calendar");
      router.refresh();
    } catch {
      setMessage(
        "Room Booker is unavailable right now. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-[21px]"
      onSubmit={handleSubmit}
      noValidate
    >
      {isRegistration ? (
        <FormField
          id="displayName"
          label="Name"
          autoComplete="name"
          placeholder="Your full name"
          error={fieldErrors.displayName}
        />
      ) : null}

      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={fieldErrors.email}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        value={passwordValue}
        onChange={handlePasswordChange}
        autoComplete={
          isRegistration ? "new-password" : "current-password"
        }
        placeholder={
          isRegistration ? "8–72 characters" : "Your password"
        }
        error={fieldErrors.password}
      >
        {isRegistration ? (
          <ul
            className="m-0 mt-1 grid gap-1.5 p-0 list-none text-xs"
            aria-label="Password requirements"
          >
            {PASSWORD_REQUIREMENTS.map((req) => {
              const isMet = req.test(passwordValue);
              return (
                <li
                  key={req.id}
                  className={`flex items-center gap-2 transition-colors duration-150 ${
                    isMet
                      ? "font-[620] text-[#255b43]"
                      : "text-[#667069]"
                  }`}
                >
                  <span
                    className={`grid size-4 flex-none place-items-center rounded-full transition-colors duration-150 ${
                      isMet
                        ? "bg-[#255b43] text-white"
                        : "border border-[#ccd3cd] bg-white text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    <FiCheck className="size-2.5 stroke-[3]" />
                  </span>
                  <span>{req.label}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </FormField>

      {message ? (
        <p
          className="m-0 border-l-[3px] border-[#c75a5a] py-0.5 pl-[11px] text-[13px] leading-[1.45] text-[#a13838]"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <button
        className="inline-flex h-12 cursor-pointer items-center justify-center rounded-[9px] border-0 bg-[#255b43] text-sm font-[660] text-white transition-[background-color,transform] duration-150 enabled:hover:bg-[#1d4a36] enabled:active:translate-y-px disabled:cursor-wait disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending
          ? isRegistration
            ? "Creating account…"
            : "Signing in…"
          : isRegistration
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="m-0 mt-0.5 text-center text-[13px] text-[#667069]">
        {isRegistration
          ? "Already have an account?"
          : "New to Room Booker?"}{" "}
        <Link
          className="font-[650] text-[#255b43] underline-offset-[3px]"
          href={isRegistration ? "/login" : "/register"}
        >
          {isRegistration ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
  children,
}: {
  id: FieldName;
  label: string;
  type?: "text" | "email" | "password";
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  placeholder: string;
  error?: string;
  children?: React.ReactNode;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-2">
      <label
        className="text-[13px] font-[620] text-[#313a34]"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        className="h-12 w-full rounded-[9px] border border-[#ccd3cd] bg-white px-3.5 text-[#17201b] transition-[border-color,box-shadow] duration-150 placeholder:text-[#939b95] hover:border-[#aeb8b0] focus:border-[#255b43] focus:shadow-[0_0_0_3px_rgba(37,91,67,0.1)] focus:outline-none aria-invalid:border-[#bd6262]"
        id={id}
        name={id}
        type={type}
        {...(value !== undefined ? { value, onChange } : {})}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        required
      />
      {error ? (
        <p
          id={errorId}
          className="m-0 text-xs leading-[1.45] text-[#a13838]"
        >
          {error}
        </p>
      ) : null}
      {children}
    </div>
  );
}
