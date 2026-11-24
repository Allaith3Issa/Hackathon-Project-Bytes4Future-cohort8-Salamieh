"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

export function ReferralActions({ url, ended }: { url: string; ended?: boolean }) {
  const { t } = useI18n();
  const field = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"copied" | "selected" | "shareFailed">();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      field.current?.focus();
      field.current?.select();
      setStatus("selected");
    }
  }

  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("shareFailed");
    }
  }

  return (
    <div className="grid min-w-0 gap-2 border-t border-rule pt-3">
      {ended && <p className="text-sm text-muted">{t("marketerCampaigns.referralUnavailable")}</p>}
      <label className="grid gap-1.5">
        {t("marketerCampaigns.referral")}
        <input readOnly dir="ltr" ref={field} value={url} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="button-secondary" type="button" onClick={copy}>{t("marketerCampaigns.copy")}</button>
        <button className="button-secondary" type="button" onClick={share}>{t("marketerCampaigns.share")}</button>
        {!ended && <a className="text-link inline-flex min-h-11 items-center px-2" href={url}>{t("marketerCampaigns.openReferral")}</a>}
      </div>
      {status && <p role="status" className="text-sm text-muted">{t(`marketerCampaigns.${status}`)}</p>}
    </div>
  );
}
