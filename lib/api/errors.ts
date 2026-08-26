export type ApiErrorCode =
  | "not_found"
  | "already_taken"
  | "hold_expired"
  | "cutoff_passed"
  | "invalid_input"
  | "internal";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "internal", message: "Something went wrong. Please try again." } },
    { status: 500 }
  );
}

export function invalidInput(message: string): never {
  throw new ApiError("invalid_input", message, 400);
}
