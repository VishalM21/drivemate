// Centralized error types. Every function converts these into the
// { success:false, error:{ code, message } } envelope via response.ts.
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (m = "Bad request") => new ApiError(400, "BAD_REQUEST", m);
export const unauthorized = (m = "Unauthorized") => new ApiError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "Forbidden") => new ApiError(403, "FORBIDDEN", m);
export const notFound = (m = "Not found") => new ApiError(404, "NOT_FOUND", m);
export const conflict = (m = "Conflict") => new ApiError(409, "CONFLICT", m);
export const serverError = (m = "Internal server error") => new ApiError(500, "SERVER_ERROR", m);
