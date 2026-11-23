"use client";

import { useActionState, useEffect, useRef, useState, type MouseEvent } from "react";
import { verifyMerchant, type MerchantVerificationState } from "@/app/staff-actions";
import type { AdminMerchant, MerchantVerificationDecision, MerchantVerificationStatus } from "@/lib/staff-contract";
import { useI18n } from "./i18n-provider";

type Selection = { id: string; decision: MerchantVerificationDecision };
const statusColors = {
  pending: "bg-info-bg text-info",
  verified: "bg-success-bg text-success",
  rejected: "bg-mauve text-danger",
};

export function MerchantVerificationList({
  status, merchants, total,
}: {
  status: MerchantVerificationStatus;
  merchants: AdminMerchant[];
  total: number;
}) {
  const { t, formatDate, formatNumber } = useI18n();
  const [selection, setSelection] = useState<Selection | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const [state, submit, pending] = useActionState(async (_: MerchantVerificationState, data: FormData) => {
    const response = await verifyMerchant(data);
    if (response.result) setSelection(null);
    return response;
  }, {});

  useEffect(() => { confirmation.current?.focus(); }, [selection]);
  useEffect(() => { feedback.current?.focus(); }, [state]);

  function choose(event: MouseEvent<HTMLButtonElement>, id: string, decision: MerchantVerificationDecision) {
    trigger.current = event.currentTarget;
    setSelection({ id, decision });
  }

  function cancel() {
    setSelection(null);
    trigger.current?.focus();
  }

  return (
    <section aria-label={t("verification.results")} className="space-y-4">
      {state.result && (
        <p ref={feedback} tabIndex={-1} role="status" className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">
          {t(state.result.status === "verified" ? "verification.approvedStore" : "verification.rejectedStore", { store: state.result.name })}
        </p>
      )}
      {state.error && <p ref={feedback} tabIndex={-1} role="alert" className="notice-error">{state.error}</p>}
      {merchants.length > 0 ? (
        <>
          <p className="text-sm text-muted">{t("verification.total", { count: formatNumber(total) })}</p>
          <ul className="surface divide-y divide-rule">
            {merchants.map(({ id, name, phone, createdAt, merchant }) => {
              const selected = selection?.id === id ? selection : null;
              const decision = selected?.decision;
              return (
                <li key={id} className="space-y-4 p-4 sm:p-6">
                  <article aria-labelledby={`merchant-${id}`} className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id={`merchant-${id}`} className="wrap-anywhere text-lg font-bold">{merchant.name}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[merchant.verificationStatus]}`}>
                          {t(`verification.${merchant.verificationStatus}`)}
                        </span>
                      </div>
                      <p className="wrap-anywhere text-sm text-muted">
                        <bdi>{name}</bdi>{" · "}<bdi dir="ltr">{phone}</bdi>{" · "}<bdi>{formatDate(createdAt)}</bdi>
                      </p>
                      <p className="wrap-anywhere whitespace-pre-wrap pt-1 text-sm leading-6">{merchant.details}</p>
                      {merchant.contractReference && (
                        <p className="wrap-anywhere text-sm text-muted">{t("verification.reference")} <bdi>{merchant.contractReference}</bdi></p>
                      )}
                    </div>
                    {merchant.verificationStatus === "pending" && (
                      <div className="flex flex-wrap gap-2 text-sm">
                        <button type="button" disabled={pending} onClick={(event) => choose(event, id, "verified")}
                          aria-expanded={decision === "verified"} className="button-primary">
                          {t("verification.approve")}
                        </button>
                        <button type="button" disabled={pending} onClick={(event) => choose(event, id, "rejected")}
                          aria-expanded={decision === "rejected"} className="button-secondary text-danger disabled:opacity-65">
                          {t("verification.reject")}
                        </button>
                      </div>
                    )}
                  </article>
                  {selected && merchant.verificationStatus === "pending" && (
                    <form action={submit} aria-busy={pending} className="space-y-3 rounded-lg bg-canvas p-4">
                      <input type="hidden" name="merchantId" value={id} />
                      <input type="hidden" name="status" value={selected.decision} />
                      <div>
                        <h3 ref={confirmation} tabIndex={-1} className="wrap-anywhere font-bold">
                          {t(decision === "verified" ? "verification.confirmApprove" : "verification.confirmReject", { store: merchant.name })}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {t(decision === "verified" ? "verification.approveDescription" : "verification.rejectDescription")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <button type="submit" disabled={pending} className="button-primary">
                          {pending ? t("verification.saving") : t(decision === "verified" ? "verification.confirmApproval" : "verification.confirmRejection")}
                        </button>
                        <button type="button" disabled={pending} onClick={cancel} className="button-secondary disabled:opacity-65">
                          {t("common.cancel")}
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="surface px-4 py-5 text-sm text-muted sm:px-6">
          {t(total > 0 ? "verification.emptyPage" : `verification.empty_${status}`)}
        </p>
      )}
    </section>
  );
}
