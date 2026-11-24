import "server-only";

import { createHash } from "node:crypto";
import { apiRequest, ApiError } from "./api";
import { clearSession, sessionTokens } from "./session";
import { withSessionRotation } from "./session-rotation";
import type { AuthSession } from "./contract";

type Tokens = Awaited<ReturnType<typeof sessionTokens>>;
type LogoutScope = { sessionId?: string; refreshFingerprint?: string };
type LogoutResult = "signed-out" | "unconfirmed" | "session-changed";

// This claim only correlates a rendered logout form with its session. Nest verifies the JWT.
function accessSessionId(accessToken?: string) {
  const claims = accessToken?.split(".")[1];
  if (!claims) return undefined;
  try {
    const { sid } = JSON.parse(Buffer.from(claims, "base64url").toString("utf8")) as { sid?: unknown };
    return typeof sid === "string" ? sid : undefined;
  } catch {
    return undefined;
  }
}

export function logoutScope({ accessToken, refreshToken }: Tokens): LogoutScope {
  return {
    sessionId: accessSessionId(accessToken),
    refreshFingerprint: refreshToken ? createHash("sha256").update(refreshToken).digest("hex") : undefined,
  };
}

function sameSession(expected: LogoutScope, current: LogoutScope) {
  if (expected.sessionId && current.sessionId) return expected.sessionId === current.sessionId;
  return Boolean(expected.refreshFingerprint && expected.refreshFingerprint === current.refreshFingerprint);
}

function revoke(accessToken: string) {
  // The optional refresh token is unnecessary. The verified access token scopes the
  // revocation to its own backend session even if another tab just rotated the refresh token.
  return apiRequest<void>("/auth/logout", { method: "POST", accessToken, body: {} });
}

async function revokeSession(expected: LogoutScope, accessToken?: string, rotate?: () => Promise<AuthSession>): Promise<LogoutResult> {
  if (accessToken) {
    try {
      await revoke(accessToken);
      return "signed-out";
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) return "unconfirmed";
      if (error.code === "SESSION_EXPIRED") return "signed-out";
    }
  }
  if (!rotate) return accessToken ? "unconfirmed" : "signed-out";
  try {
    const session = await rotate();
    if (expected.sessionId && accessSessionId(session.accessToken) !== expected.sessionId) return "unconfirmed";
    await revoke(session.accessToken);
    return "signed-out";
  } catch (error) {
    return error instanceof ApiError && error.status === 401 && error.code === "SESSION_EXPIRED"
      ? "signed-out"
      : "unconfirmed";
  }
}

export async function endWebSession(expected: LogoutScope): Promise<LogoutResult> {
  const tokens = await sessionTokens();
  if ((tokens.accessToken || tokens.refreshToken) && !sameSession(expected, logoutScope(tokens))) {
    return "session-changed";
  }
  const signOut = async (rotate?: () => Promise<AuthSession>) => {
    try {
      return await revokeSession(expected, tokens.accessToken, rotate);
    } finally {
      await clearSession();
    }
  };

  if (!tokens.refreshToken) return signOut();
  return withSessionRotation(tokens.refreshToken, (rotation) => {
    rotation.signingOut = true;
    return signOut(rotation.rotate);
  });
}
