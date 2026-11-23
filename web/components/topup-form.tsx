"use client";

import { useI18n } from "@/components/i18n-provider";
import { useActionState, useId, useRef, useState } from "react";
import { topUp } from "@/app/staff-actions";
import { fieldClass, paymentLabels, parseMoney } from "@/lib/staff-ui";
import type { AdminMerchant, PaymentMethod } from "@/lib/staff-contract";
import { Field } from "./field";
import { useAttemptKey } from "./use-attempt-key";
import { useFocusError } from "./use-focus-error";

const empty = { merchantId: "", amount: "", paymentMethod: "cash", note: "" };

export function TopupForm({ merchants }: { merchants: AdminMerchant[] }) {
  const [attempt, setAttempt] = useState("");
  return <TopupAttempt key={attempt} merchants={merchants} onNewTopup={() => setAttempt(crypto.randomUUID())} />;
}

function TopupAttempt({ merchants, onNewTopup }: { merchants: AdminMerchant[]; onNewTopup: () => void }) {
  const { t, formatSyp: formatMoney } = useI18n();
  const id = useId();
  const [state, submit, pending] = useActionState(topUp, {});
  const [key, renewKey] = useAttemptKey();
  const [v, setV] = useState(empty);
  const [reviewAt, setReviewAt] = useState<{ errors: typeof state.errors } | null>(null);

  const review = reviewAt !== null && reviewAt.errors === state.errors;
  const [local, setLocal] = useState<Record<string, string>>({});
  const errors = { ...state.errors, ...local };
  const formRef = useRef<HTMLFormElement>(null);
  useFocusError(formRef, state);
  useFocusError(formRef, local);
  const merchant = merchants.find((m) => m.id === v.merchantId);
  const set = (name: keyof typeof empty, value: string) => {
    setV((old) => ({ ...old, [name]: value }));
    setLocal({});
    renewKey();
  };

  if (state.result) {
    const r = state.result;
    return (
      <section aria-labelledby={`${id}-done`} className="surface p-5 sm:p-6">
        <h2 id={`${id}-done`} tabIndex={-1} ref={(el) => el?.focus()} className="text-xl font-bold">{t("admin.balanceToppedUp")}</h2>
        <dl className="mt-4 grid overflow-hidden rounded-xl border border-rule sm:grid-cols-2">
          <div className="bg-ink p-5 text-white">
            <dt className="text-sm font-semibold">{t("admin.availableBalanceFor", { store: r.shopName })}</dt>
            <dd className="mt-2 text-3xl font-bold tabular-nums">{formatMoney(r.merchantNewAvailableBalanceSyp)}</dd>
          </div>
          <div className="bg-mauve p-5">
            <dt className="text-sm font-semibold">{t("admin.topUpAmount")}</dt>
            <dd className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(r.amountSyp)}</dd>
            <dd className="mt-1 text-sm text-muted">{t(paymentLabels[r.paymentMethod])} · <bdi dir="ltr">{r.referenceNote}</bdi></dd>
          </div>
        </dl>
        <button type="button" className="button-secondary mt-5" onClick={onNewTopup}>{t("admin.newTopUp")}</button>
      </section>
    );
  }

  const goReview = () => {
    const found: Record<string, string> = {};
    if (!v.merchantId) found.merchantId = t("validation.selectAMerchant");
    if (!parseMoney(v.amount) ) found.amount = t("admin.enterAnAmountGreaterThanZero");
    if (!v.note.trim()) found.note = t("validation.enterAPaymentReference");
    setLocal(found);
    if (!Object.keys(found).length) {
      if (!key) renewKey();
      setReviewAt({ errors: state.errors });
    }
  };

  return (
    <form ref={formRef} action={submit} aria-busy={pending} className="surface grid gap-4 p-5 sm:p-6">
      <input type="hidden" name="key" value={key} />
      {(["merchantId", "amount", "paymentMethod", "note"] as const).map((n) => <input key={n} type="hidden" name={n} value={v[n]} />)}
      {review ? (
        <>
          <h2 className="text-xl font-bold">{t("admin.reviewTheTopUp")}</h2>
          <dl className="grid gap-3 rounded-lg bg-mauve p-4">
            <div><dt className="text-sm text-muted">{t("admin.merchant")}</dt><dd className="font-semibold">{merchant?.merchant.name}</dd></div>
            <div><dt className="text-sm text-muted">{t("admin.amount")}</dt><dd className="text-2xl font-bold tabular-nums">{formatMoney(parseMoney(v.amount) ?? 0)}</dd></div>
            <div><dt className="text-sm text-muted">{t("admin.paymentMethodAndReference")}</dt><dd>{t(paymentLabels[v.paymentMethod as PaymentMethod])} · <bdi dir="ltr">{v.note}</bdi></dd></div>
          </dl>
          {state.error && <p role="alert" className="notice-error">{state.error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="button-primary" disabled={pending || !key}>{pending ? t("admin.toppingUp") : state.error ? t("common.tryAgain") : t("admin.confirmTopUp")}</button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => setReviewAt(null)}>{t("admin.edit")}</button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold">{t("admin.topUpAMerchant")}</h2>
          <Field id={`${id}-m`} label={t("admin.merchant")} error={errors.merchantId}>
            <select id={`${id}-m`} className={fieldClass} value={v.merchantId} aria-invalid={Boolean(errors.merchantId)} aria-describedby={errors.merchantId ? `${id}-m-error` : undefined} onChange={(e) => set("merchantId", e.target.value)}>
              <option value="">{t("admin.selectAVerifiedMerchant")}</option>
              {merchants.map((m) => <option key={m.id} value={m.id}>{m.merchant.name}</option>)}
            </select>
          </Field>
          {merchant && <p className="notice">{t("admin.currentAvailableBalance")}{" "}{formatMoney(merchant.wallet.availableBalanceSyp)}</p>}
          <Field id={`${id}-a`} label={t("admin.amountSyp")} hint={t("admin.example50000")} error={errors.amount}>
            <input id={`${id}-a`} className={fieldClass} dir="ltr" inputMode="decimal" value={v.amount} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? `${id}-a-error` : undefined} onChange={(e) => set("amount", e.target.value)} />
          </Field>
          <Field id={`${id}-p`} label={t("admin.paymentMethod")}>
            <select id={`${id}-p`} className={fieldClass} value={v.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
              {Object.entries(paymentLabels).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
            </select>
          </Field>
          <Field id={`${id}-n`} label={t("admin.paymentReference")} error={errors.note} hint={t("admin.transferNumberOrReceiptReference")}>
            <input id={`${id}-n`} className={fieldClass} value={v.note} maxLength={200} aria-invalid={Boolean(errors.note)} aria-describedby={`${id}-n-${errors.note ? "error" : "hint"}`} onChange={(e) => set("note", e.target.value)} />
          </Field>
          {state.error && <p role="alert" className="notice-error">{state.error}</p>}
          <button type="button" className="button-primary" onClick={goReview}>{t("admin.reviewTopUp")}</button>
        </>
      )}
    </form>
  );
}
