"use client";
import { useCallback, useEffect, useState } from "react";


export function useAttemptKey() {
  const [key, setKey] = useState("");
  const renew = useCallback(() => setKey(crypto.randomUUID()), []);

  useEffect(renew, [renew]);
  return [key, renew, setKey] as const;
}
