"use client";

import { useI18n } from "@/components/i18n-provider";
import { useActionState, useState } from "react";
import { closeCampaign } from "@/app/staff-actions";
import { statusLabels } from "@/lib/staff-ui";

export function CloseCampaign({ id }: { id: string }) {
  const { t, formatSyp: formatMoney } = useI18n();
  const [state, submit, pending] = useActionState(closeCampaign.bind(null, id), {});
  const [confirming, setConfirming] = useState(false);
  if (state.campaign) {
    const c = state.campaign;
    return (
      <div role="status" className="rounded-lg bg-success-bg p-4 text-success">
        <p className="font-bold">{t("campaigns.campaignStatus")}{" "}{t(statusLabels[c.status])}</p>
        <p className="mt-1">{t("campaigns.remainingLockedReserve")}{" "}<span className="font-semibold tabular-nums">{formatMoney(c.usage.lockedBudgetSyp)}</span></p>
      </div>
    );
  }
  return (
    <form action={submit} aria-busy={pending} className="grid gap-3">
      {state.error && <p role="alert" className="notice-error">{state.error}</p>}
      {confirming ? (
        <>
          <p className="notice">{t("campaigns.theOfferWillEndAndThe")}</p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="button-primary" disabled={pending}>{pending ? t("campaigns.closing") : t("campaigns.confirmClosure")}</button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => setConfirming(false)}>{t("campaigns.goBack")}</button>
          </div>
        </>
      ) : <button type="button" className="button-secondary" onClick={() => setConfirming(true)}>{t("campaigns.closeCampaign")}</button>}
    </form>
  );
}
