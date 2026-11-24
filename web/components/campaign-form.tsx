"use client";

import { useI18n } from "@/components/i18n-provider";
import { useActionState, useId, useRef, useState } from "react";
import type { CampaignState } from "@/app/staff-actions";
import { fieldClass } from "@/lib/staff-ui";
import { Field } from "./field";
import { useAttemptKey } from "./use-attempt-key";
import { useFocusError } from "./use-focus-error";
import { ProductImagePicker } from "./product-image-picker";


const empty = {
  productName: "", description: "", originalPriceSyp: "", discountPercent: "",
  commissionSyp: "", maxItems: "", endsAt: "",
};
type Values = typeof empty;

export function CampaignForm({ submitCampaign }: { submitCampaign: (state: CampaignState, data: FormData) => Promise<CampaignState> }) {
  const { t, formatSyp: formatMoney } = useI18n();
  const id = useId();
  const [state, submit, pending] = useActionState(submitCampaign, {});
  const [key, renewKey] = useAttemptKey();
  const [v, setV] = useState<Values>(empty);
  const [image, setImage] = useState<{ file: File; originalBytes: number } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [intent, setIntent] = useState<FormDataEntryValue | null>(null);
  const set = (name: keyof Values, value: string) => {
    setV((old) => ({ ...old, [name]: value }));
    renewKey();
  };
  const e = state.errors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  useFocusError(formRef, state);
  const p = state.preview?.key === key ? state.preview.values : undefined;
  const text = (name: keyof Values, label: string, extra: { numeric?: boolean; type?: string; hint?: string } = {}) => (
    <Field id={`${id}-${name}`} label={label} error={e[name]} hint={extra.hint}>
      <input id={`${id}-${name}`} name={name} value={v[name]} type={extra.type} className={fieldClass}
        dir={extra.numeric || extra.type ? "ltr" : undefined} inputMode={extra.numeric ? "decimal" : undefined}
        aria-invalid={Boolean(e[name])} aria-describedby={e[name] ? `${id}-${name}-error` : extra.hint ? `${id}-${name}-hint` : undefined}
        onChange={(ev) => set(name, ev.target.value)} />
    </Field>
  );
  return (
    <form ref={formRef} action={(data) => {
      const submitted = data.get("intent");
      setIntent(submitted);
      if (submitted === "launch" && image) data.set("file", image.file);
      submit(data);
    }} aria-busy={pending} className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <input type="hidden" name="key" value={key} />
      <div className="surface grid gap-4 p-5 sm:p-6">
        <h2 className="text-xl font-bold">{t("campaigns.campaignDetails")}</h2>
        {text("productName", t("campaigns.productName"))}
        <Field id={`${id}-description`} label={t("campaigns.description")} error={e.description}>
          <textarea id={`${id}-description`} name="description" rows={3} value={v.description} aria-invalid={Boolean(e.description)} aria-describedby={e.description ? `${id}-description-error` : undefined}
            className={`${fieldClass} py-2`} onChange={(ev) => set("description", ev.target.value)} />
        </Field>
        <ProductImagePicker selection={image} onChange={(next) => { setImage(next); renewKey(); }}
          onBusy={setCompressing} disabled={pending} error={state.imageErrorKey === key ? e.imageUrl : undefined} />
        <div className="grid gap-4 sm:grid-cols-2">
          {text("originalPriceSyp", t("campaigns.originalPriceSyp"), { numeric: true, hint: t("campaigns.example15000") })}
          {text("discountPercent", t("campaigns.discount"), { numeric: true })}
          {text("commissionSyp", t("campaigns.marketerCommissionPerItemSyp"), { numeric: true, hint: t("campaigns.fixedCommissionForExample1000") })}
          {text("maxItems", t("campaigns.maximumItems"), { numeric: true })}
        </div>
        {text("endsAt", t("campaigns.campaignEndDateAndTime"), { type: "datetime-local", hint: t("campaigns.damascusTime") })}
        <p className="notice">{t("campaigns.anyMarketerCanJoinThisCampaign")}</p>
      </div>
      <aside aria-labelledby={`${id}-preview`} className="surface grid gap-4 p-5 sm:p-6 lg:sticky lg:top-4">
        <h2 id={`${id}-preview`} className="text-xl font-bold">{t("campaigns.priceAndReserve")}</h2>
        {p ? (
          <>
            <dl className="grid gap-3">
              <div><dt className="text-sm text-muted">{t("campaigns.customerSalePrice")}</dt><dd className="font-semibold tabular-nums">{p.finalPriceSyp === null ? "—" : formatMoney(p.finalPriceSyp)}</dd></div>
              <div><dt className="text-sm text-muted">{t("campaigns.marketerCommissionPerItem")}</dt><dd className="font-semibold tabular-nums">{formatMoney(p.commissionPerUnitSyp)}</dd></div>
              <div className="rounded-lg bg-ink p-4 text-white"><dt className="text-sm font-semibold">{t("campaigns.reserveLockedAtLaunch")}</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(p.worstCaseReserveSyp)}</dd></div>
              <div><dt className="text-sm text-muted">{t("campaigns.yourAvailableBalance")}</dt><dd className="font-semibold tabular-nums">{formatMoney(p.merchantAvailableBalanceSyp)}</dd></div>
            </dl>
            {!p.isAffordableByMerchant && <p role="alert" className="notice-error">{t("campaigns.yourBalanceIsBelowTheRequired")}</p>}
          </>
        ) : (
          <p className="notice">{state.preview ? t("campaigns.theValuesHaveChangedSelectCalculate") : t("campaigns.selectCalculatePriceAndReserveTo")}</p>
        )}
        {state.error && <p role="alert" className="notice-error">{state.error}</p>}
        <div className="grid gap-3">
          <button type="submit" name="intent" value="preview" className="button-secondary" disabled={pending}>{t("campaigns.calculatePriceAndReserve")}</button>
          <button type="submit" name="intent" value="launch" className="button-primary" disabled={pending || compressing || !image || !key || !p || !p.isAffordableByMerchant}>
            {pending && intent === "launch" ? t("productImage.launching") : state.error || (state.imageErrorKey === key && e.imageUrl) ? t("campaigns.retryLaunch") : t("campaigns.launchCampaign")}
          </button>
        </div>
      </aside>
    </form>
  );
}
