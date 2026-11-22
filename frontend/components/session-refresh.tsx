"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function SessionRefresh({ needsRefresh }: { needsRefresh: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    let pending = false;
    async function refresh(immediate = false) {
      if (!active || pending) return;
      pending = true;
      try {
        const run = async () => {
          const response = await fetch("/session/refresh", { method: "POST" });
          if (active && (response.status === 401 || (immediate && response.ok))) router.refresh();
        };
        if (navigator.locks) {
          const lockName = "affiliate-session-refresh";
          await navigator.locks.request(lockName, { ifAvailable: true }, async (lock) => {
            if (lock) await run();
            else if (immediate) {
              await navigator.locks.request(lockName, () => {
                if (active) router.refresh();
              });
            }
          });
        } else {
          await run();
        }
      } catch {
        // Keep the current session during a temporary connection failure.
      } finally {
        pending = false;
      }
    }
    if (needsRefresh) void refresh(true);
    const timer = window.setInterval(() => void refresh(), 900000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [needsRefresh, router]);
  return null;
}
