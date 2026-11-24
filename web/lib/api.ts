import "server-only";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(code);
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  accessToken?: string;
  idempotencyKey?: string;
}

export async function apiRequest<T>(
  path: `/${string}`,
  { method = "GET", body, accessToken, idempotencyKey }: ApiOptions = {},
): Promise<T> {
  const base = (process.env.API_BASE_URL || "http://localhost:3001/api/v1").replace(/\/+$/, "");
  const headers = new Headers({ Accept: "application/json" });
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: multipart ? body : body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(503, "API_UNAVAILABLE");
  }
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    throw new ApiError(response.status, failure?.code ?? "UNEXPECTED_ERROR", failure?.fieldErrors);
  }
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch {
    throw new ApiError(502, "UNEXPECTED_ERROR");
  }
}
