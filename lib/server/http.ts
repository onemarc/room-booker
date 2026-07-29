import "server-only";

export type FieldErrors = Partial<
  Record<"displayName" | "email" | "password", string>
>;

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        error: {
          message: error.message,
          fieldErrors: error.fieldErrors,
        },
      },
      error.status,
    );
  }

  // Unexpected internals are logged server-side but never serialized to clients.
  console.error("Unhandled route error.", error);
  return jsonResponse(
    {
      error: {
        message: "The server could not complete the request. Please try again.",
      },
    },
    500,
  );
}

export function isPostgresUniqueViolation(
  error: unknown,
  constraint: string,
) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === constraint
  );
}
