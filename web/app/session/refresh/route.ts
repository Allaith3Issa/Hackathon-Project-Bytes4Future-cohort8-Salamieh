import { apiRequest, ApiError } from "@/lib/api";
import type { AuthSession } from "@/lib/contract";
import { clearSession, saveSession, sessionTokens } from "@/lib/session";

const pending = new Map<string, Promise<AuthSession>>();

export async function POST(request: Request) {
  const host = request.headers.get("host");
  const protocol = new URL(request.url).protocol;
  const origin = request.headers.get("origin");
  if (!host || origin !== `${protocol}//${host}`) {
    return new Response(null, { status: 403 });
  }
  const { refreshToken } = await sessionTokens();
  if (!refreshToken) {
    await clearSession();
    return new Response(null, { status: 401 });
  }

  let exchange = pending.get(refreshToken);
  if (!exchange) {
    exchange = apiRequest<AuthSession>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
    pending.set(refreshToken, exchange);
  }

  try {
    await saveSession(await exchange);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession();
      return new Response(null, { status: 401 });
    }
    return new Response(null, { status: 503 });
  } finally {
    pending.delete(refreshToken);
  }
}
