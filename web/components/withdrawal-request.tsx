"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestWithdrawal } from "@/app/payout-actions";
import { useI18n } from "@/components/i18n-provider";
import { validWithdrawal, type WithdrawalAttempt } from "@/lib/payouts";

export function WithdrawalRequest({ accountId, balance, pendingBalance, available }: {
  accountId: string; balance: number; pendingBalance: number; available: boolean;
}) {
  const { t, formatSyp } = useI18n();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef(false);
  const title = useId();
  const key = `mardood-withdrawal:${accountId}`;
  const [restored, setRestored] = useState(false);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState<WithdrawalAttempt | null>(null);
  const [amount, setAmount] = useState(balance);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (validWithdrawal(saved)) setAttempt(saved);
    } catch { /* The in-page attempt still works if browser storage is unavailable. */ }
    setRestored(true);
  }, [key]);

  function remember(value: WithdrawalAttempt | null) {
    setAttempt(value);
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
    } catch { /* Keep the in-memory attempt. */ }
  }

  function confirm() {
    if (running.current || pending || !restored) return;
    if (!attempt && (!available || pendingBalance > 0 || amount <= 0 || amount !== balance)) {
      dialog.current?.close();
      setMessage({ text: t("payouts.amountChanged"), error: true });
      start(() => router.refresh());
      return;
    }
    running.current = true;
    const submission = attempt ?? { key: crypto.randomUUID(), expectedAmountSyp: amount };
    remember(submission);
    setMessage(undefined);
    start(async () => {
      try {
        const result = await requestWithdrawal(accountId, submission);
        if (result.outcome === "retry") {
          setMessage({ text: result.error, error: true });
          return;
        }
        remember(null);
        dialog.current?.close();
        setMessage(result.outcome === "success" ? { text: t("payouts.requestRecorded") } : { text: result.error, error: true });
        router.refresh();
      } catch {
        setMessage({ text: t("payouts.retryWithdrawal"), error: true });
      } finally {
        running.current = false;
      }
    });
  }

  return (
    <div className="surface space-y-3 p-5">
      <p className="text-sm text-muted">{t("payouts.simulation")}</p>
      {attempt && <p className="notice">{t("payouts.attemptStored")}</p>}
      <button type="button" className="button-primary" disabled={!restored || pending || (!attempt && (!available || balance <= 0 || pendingBalance > 0))}
        onClick={() => {
          setMessage(undefined);
          setAmount(attempt?.expectedAmountSyp ?? balance);
          dialog.current?.showModal();
          setOpen(true);
        }}>
        {t(attempt ? "payouts.retryOriginal" : "payouts.withdraw")}
      </button>
      {!attempt && pendingBalance > 0 && <p className="text-sm text-muted">{t("payouts.alreadyPending")}</p>}
      {message && !open && <p role={message.error ? "alert" : "status"} className={message.error ? "notice-error" : "notice"}>{message.text}</p>}
      <dialog ref={dialog} aria-labelledby={title} onClose={() => setOpen(false)} onCancel={(event) => { if (pending) event.preventDefault(); }}
        className="surface m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg space-y-4 overflow-y-auto p-5 text-ink backdrop:bg-ink/45 sm:p-7">
        <h2 id={title} className="text-xl font-bold">{t("payouts.confirmWithdrawal")}</h2>
        <p className="text-2xl font-bold"><bdi>{formatSyp(attempt?.expectedAmountSyp ?? amount)}</bdi></p>
        <p className="leading-7 text-muted">{t(attempt ? "payouts.attemptStored" : "payouts.fullBalance")}</p>
        {open && message?.error && <p role="alert" className="notice-error">{message.text}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={confirm} disabled={pending} className="button-primary">
            {t(pending ? "payouts.processing" : attempt ? "payouts.retryOriginal" : "payouts.confirmRequest")}
          </button>
          <button type="button" className="button-secondary" disabled={pending} onClick={() => dialog.current?.close()}>{t("common.cancel")}</button>
        </div>
      </dialog>
    </div>
  );
}
