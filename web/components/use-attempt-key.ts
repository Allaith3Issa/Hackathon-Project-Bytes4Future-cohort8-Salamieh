"use client";
import { useCallback, useEffect, useState } from "react";

/** One Idempotency-Key per attempt. Call renew() only when the request body changes or after success. */
export function useAttemptKey() {
  const [key, setKey] = useState("");
  const renew = useCallback(() => setKey(crypto.randomUUID()), []);
  useEffect(renew, [renew]);
  return [key, renew] as const;
}
