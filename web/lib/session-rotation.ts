import "server-only";

import { apiRequest } from "./api";
import type { AuthSession } from "./contract";

type Rotation = {
  users: number;
  signingOut: boolean;
  rotate: () => Promise<AuthSession>;
};

// Next can load the action and the route handler in separate server bundles.
const server = globalThis as typeof globalThis & { mardoodSessionRotations?: Map<string, Rotation> };
const activeRotations = server.mardoodSessionRotations ??= new Map();

export async function withSessionRotation<T>(refreshToken: string, run: (rotation: Rotation) => Promise<T>) {
  let rotation = activeRotations.get(refreshToken);
  if (!rotation) {
    let exchange: Promise<AuthSession> | undefined;
    rotation = {
      users: 0,
      signingOut: false,
      rotate: () => exchange ??= apiRequest<AuthSession>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
      }),
    };
    activeRotations.set(refreshToken, rotation);
  }
  rotation.users++;
  try {
    return await run(rotation);
  } finally {
    if (--rotation.users === 0) activeRotations.delete(refreshToken);
  }
}
