"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { decidePayout, type AdminDecision } from "@/app/payout-actions";
import { useI18n } from "@/components/i18n-provider";
import { localizedPath } from "@/lib/locale";
import type { AdminPayout } from "@/lib/payouts";

export function AdminPayoutDecision({ payout, adminId }: { payout: Pick<AdminPayout, "id" | "amountSyp" | "marketerName">; adminId: string }) {
  const { t, locale, formatSyp } = useI18n();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef(false);
  const title = useId();
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [retry, setRetry] = useState<AdminDecision | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function open(next: "approve" | "reject") {
    if (running.current || (retry && retry.action !== next)) return;
    setAction(next);
    if (!retry) { setError(undefined); setReason(""); }
    dialog.current?.showModal();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || pending) return;
    const decision = retry ?? (action === "approve" ? { action } : { action, reason: reason.trim() });
    if (decision.action === "reject" && (!decision.reason || decision.reason.length > 500)) {
      setError(t("payouts.reasonRequired"));
      return;
    }
    running.current = true;
    setRetry(decision);
    setError(undefined);
    start(async () => {
      try {
        const result = await decidePayout(adminId, payout.id, decision);
        if (result.outcome === "success") {
          setRetry(null);
          dialog.current?.close();
          router.replace(localizedPath(`/admin/payouts?status=${result.status}`, locale));
          router.refresh();
          return;
        }
        setError(result.error);
        if (result.outcome !== "retry") setRetry(null);
        if (result.outcome === "conflict") {
          dialog.current?.close();
          router.replace(localizedPath("/admin/payouts?status=all&decision=conflict", locale));
          router.refresh();
        }
      } catch {
        setError(t("payouts.retryDecision"));
      } finally {
        running.current = false;
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="button-primary" disabled={pending || retry?.action === "reject"} onClick={() => open("approve")}>{t("payouts.approve")}</button>
      <button type="button" className="button-secondary" disabled={pending || retry?.action === "approve"} onClick={() => open("reject")}>{t("payouts.reject")}</button>
      <dialog ref={dialog} aria-labelledby={title} onCancel={(event) => { if (pending) event.preventDefault(); }}
        className="surface m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto p-5 text-ink backdrop:bg-ink/45 sm:p-7">
        <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
          <h3 id={title} className="text-xl font-bold">{t(action === "approve" ? "payouts.approveTitle" : "payouts.rejectTitle")}</h3>
          <p className="font-semibold wrap-anywhere"><bdi>{payout.marketerName}</bdi> · <bdi>{formatSyp(payout.amountSyp)}</bdi></p>
          <p className="leading-7 text-muted">{t(action === "approve" ? "payouts.approveHelp" : "payouts.rejectHelp")}</p>
          {action === "reject" && <label className="grid gap-2">
            {t("payouts.reason")}
            <textarea rows={3} maxLength={500} required readOnly={!!retry} value={reason}
              onChange={(event) => setReason(event.target.value)} className="rounded-lg border border-control px-3 py-2" />
          </label>}
          {error && <p role="alert" className="notice-error">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="button-primary" disabled={pending}>{t(pending ? "payouts.processing" : retry ? "common.tryAgain" : "payouts.confirmDecision")}</button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => dialog.current?.close()}>{t("common.cancel")}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
