"use client";
import { useCallback, useState } from "react";

export function useAttemptKey() {
  const [key, setKey] = useState("");
  const renew = useCallback(() => setKey(crypto.randomUUID()), []);

  return [key, renew] as const;
}
