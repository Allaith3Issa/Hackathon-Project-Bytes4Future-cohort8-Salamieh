import { ApiError } from "@/lib/api";
import { clearSession, saveSession, sessionTokens } from "@/lib/session";
import { withSessionRotation } from "@/lib/session-rotation";

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

  return withSessionRotation(refreshToken, async (rotation) => {
    if (rotation.signingOut) return new Response(null, { status: 409 });
    try {
      const saved = await saveSession(await rotation.rotate(), () => !rotation.signingOut);
      return new Response(null, { status: saved ? 204 : 409 });
    } catch (error) {
      if (rotation.signingOut) return new Response(null, { status: 409 });
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
        return new Response(null, { status: 401 });
      }
      return new Response(null, { status: 503 });
    }
  });
}
