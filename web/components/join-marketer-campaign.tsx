"use client";

import { useActionState } from "react";
import type { JoinState } from "@/app/marketer-actions";
import { useI18n } from "@/components/i18n-provider";
import { ReferralActions } from "@/components/referral-actions";
import { publicReferral } from "@/lib/marketer-campaigns";

export function JoinMarketerCampaign({ join, resubmitting }: {
  join: (previous: JoinState) => Promise<JoinState>;
  resubmitting: boolean;
}) {
  const { t } = useI18n();
  const [state, submit, pending] = useActionState(join, {});
  const membership = state.membership;
  if (membership) {
    const referral = membership.status === "approved" ? publicReferral(membership.referralUrl) : null;
    return (
      <div className="surface grid gap-3 p-5">
        <p role="status">{t(`marketerCampaigns.${membership.status}`)}</p>
        {referral && <ReferralActions url={referral} />}
      </div>
    );
  }
  return (
    <form id="join-campaign" action={submit} aria-busy={pending} className="surface grid gap-3 p-5">
      {state.error && <p role="alert" className="notice-error">{state.error}</p>}
      <button className="button-primary w-fit" type="submit" disabled={pending}>
        {t(pending ? "marketerCampaigns.joining" : resubmitting ? "marketerCampaigns.rejoin" : "marketerCampaigns.join")}
      </button>
    </form>
  );
}
