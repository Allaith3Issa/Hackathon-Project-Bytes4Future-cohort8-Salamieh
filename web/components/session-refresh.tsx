"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition, type FormEvent } from "react";

const recoveryEvent = "mardood-session-recovery";
const sessionLock = "affiliate-session-refresh";

export function SessionSignOut({ signOutAction, label }: { signOutAction: () => Promise<never>; label: string }) {
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    if (!navigator.locks) return;
    event.preventDefault();
    if (!pending) startTransition(async () => {
      await navigator.locks.request(sessionLock, async () => { await signOutAction(); });
    });
  }
  return (
    <form action={signOutAction} onSubmit={submit}>
      <button className="button-secondary" type="submit" disabled={pending}>{label}</button>
    </form>
  );
}

export function RequestSessionRecovery() {
  useEffect(() => {
    window.dispatchEvent(new Event(recoveryEvent));
  }, []);
  return null;
}

export function SessionRefresh({ needsRefresh }: { needsRefresh: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    let pending = false;
    let refreshView = false;
    async function refresh(immediate = false) {
      if (!active) return;
      refreshView ||= immediate;
      if (pending) return;
      pending = true;
      try {
        const run = async () => {
          const response = await fetch("/session/refresh", { method: "POST", signal: AbortSignal.timeout(15000) });
          if (active && (response.status === 401 || (refreshView && response.ok))) router.refresh();
        };
        if (navigator.locks) {
          await navigator.locks.request(sessionLock, { ifAvailable: true }, async (lock) => {
            if (lock) await run();
            else if (refreshView) {
              await navigator.locks.request(sessionLock, () => {
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
        refreshView = false;
      }
    }
    const recover = () => void refresh(true);
    window.addEventListener(recoveryEvent, recover);
    if (needsRefresh) void refresh(true);
    const timer = window.setInterval(() => void refresh(), 900000);
    return () => {
      active = false;
      window.removeEventListener(recoveryEvent, recover);
      window.clearInterval(timer);
    };
  }, [needsRefresh, router]);
  return null;
}
