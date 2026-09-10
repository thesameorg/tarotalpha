/** The `/api/*` JSON contract: bodies come in as objects, failures go out as `{ error, message }` with a status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  response(): Response {
    return Response.json({ error: this.code, message: this.message, ...this.extra }, { status: this.status });
  }
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "bad_request", "body must be a JSON object");
  }
  return body as Record<string, unknown>;
}
