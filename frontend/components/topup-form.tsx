"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { topUp } from "@/app/staff-actions";
import { formatSyp } from "@/lib/ui";
import { fieldClass, paymentLabels } from "@/lib/staff-ui";
import type { AdminMerchant, PaymentMethod } from "@/lib/staff-contract";
import { Field } from "./field";
import { useAttemptKey } from "./use-attempt-key";
import { useFocusError } from "./use-focus-error";

const empty = { merchantId: "", amount: "", paymentMethod: "cash", note: "" };

export function TopupForm({ merchants }: { merchants: AdminMerchant[] }) {
  const id = useId();
  const [state, submit, pending] = useActionState(topUp, {});
  const [key, renewKey] = useAttemptKey();
  const [v, setV] = useState(empty);
  const [review, setReview] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const errors = { ...state.errors, ...local };
  const formRef = useRef<HTMLFormElement>(null);
  useFocusError(formRef, state);
  useFocusError(formRef, local);
  const merchant = merchants.find((m) => m.id === v.merchantId);
  const set = (name: keyof typeof empty, value: string) => {
    setV((old) => ({ ...old, [name]: value }));
    setLocal({});
    renewKey(); // body changed, so this is a new attempt
  };
  useEffect(() => { if (state.errors) setReview(false); }, [state]);

  if (state.result) {
    const r = state.result;
    return (
      <section aria-labelledby={`${id}-done`} className="surface p-5 sm:p-6">
        <h2 id={`${id}-done`} tabIndex={-1} ref={(el) => el?.focus()} className="text-xl font-bold">تم شحن الرصيد</h2>
        <dl className="mt-4 grid overflow-hidden rounded-xl border border-rule sm:grid-cols-2">
          <div className="bg-ink p-5 text-white">
            <dt className="text-sm font-semibold">رصيد {r.shopName} المتاح الآن</dt>
            <dd className="mt-2 text-3xl font-bold tabular-nums">{formatSyp(r.merchantNewAvailableBalanceSyp)}</dd>
          </div>
          <div className="bg-mauve p-5">
            <dt className="text-sm font-semibold">المبلغ المشحون</dt>
            <dd className="mt-2 text-2xl font-bold tabular-nums">{formatSyp(r.amountSyp)}</dd>
            <dd className="mt-1 text-sm text-muted">{paymentLabels[r.paymentMethod]} · <bdi dir="ltr">{r.referenceNote}</bdi></dd>
          </div>
        </dl>
        <button type="button" className="button-secondary mt-5" onClick={() => { setV(empty); setReview(false); renewKey(); }}>شحن جديد</button>
      </section>
    );
  }

  const goReview = () => {
    const found: Record<string, string> = {};
    if (!v.merchantId) found.merchantId = "اختر التاجر.";
    if (!/^[0-9٠-٩]+$/.test(v.amount) || /^[0٠]+$/.test(v.amount)) found.amount = "أدخل مبلغاً صحيحاً أكبر من صفر.";
    if (!v.note.trim()) found.note = "أدخل مرجع الدفع.";
    setLocal(found);
    if (!Object.keys(found).length) setReview(true);
  };

  return (
    <form ref={formRef} action={submit} aria-busy={pending} className="surface grid gap-4 p-5 sm:p-6">
      <input type="hidden" name="key" value={key} />
      {(["merchantId", "amount", "paymentMethod", "note"] as const).map((n) => <input key={n} type="hidden" name={n} value={v[n]} />)}
      {review ? (
        <>
          <h2 className="text-xl font-bold">راجع الشحن قبل التأكيد</h2>
          <dl className="grid gap-3 rounded-lg bg-mauve p-4">
            <div><dt className="text-sm text-muted">التاجر</dt><dd className="font-semibold">{merchant?.merchant.name}</dd></div>
            <div><dt className="text-sm text-muted">المبلغ</dt><dd className="text-2xl font-bold tabular-nums">{formatSyp(Number(v.amount.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))))}</dd></div>
            <div><dt className="text-sm text-muted">طريقة الدفع والمرجع</dt><dd>{paymentLabels[v.paymentMethod as PaymentMethod]} · <bdi dir="ltr">{v.note}</bdi></dd></div>
          </dl>
          {state.error && <p role="alert" className="notice-error">{state.error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="button-primary" disabled={pending || !key}>{pending ? "جارٍ الشحن…" : state.error ? "إعادة المحاولة" : "تأكيد الشحن"}</button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => setReview(false)}>تعديل</button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold">شحن رصيد تاجر</h2>
          <Field id={`${id}-m`} label="التاجر" error={errors.merchantId}>
            <select id={`${id}-m`} className={fieldClass} value={v.merchantId} aria-invalid={Boolean(errors.merchantId)} aria-describedby={errors.merchantId ? `${id}-m-error` : undefined} onChange={(e) => set("merchantId", e.target.value)}>
              <option value="">اختر تاجراً موثّقاً</option>
              {merchants.map((m) => <option key={m.id} value={m.id}>{m.merchant.name}</option>)}
            </select>
          </Field>
          {merchant && <p className="notice">الرصيد المتاح حالياً: {formatSyp(merchant.wallet.availableBalanceSyp)}</p>}
          <Field id={`${id}-a`} label="المبلغ (ل.س.)" error={errors.amount}>
            <input id={`${id}-a`} className={fieldClass} dir="ltr" inputMode="numeric" value={v.amount} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? `${id}-a-error` : undefined} onChange={(e) => set("amount", e.target.value)} />
          </Field>
          <Field id={`${id}-p`} label="طريقة الدفع">
            <select id={`${id}-p`} className={fieldClass} value={v.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
              {Object.entries(paymentLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field id={`${id}-n`} label="مرجع الدفع" error={errors.note} hint="رقم الحوالة أو إيصال الاستلام.">
            <input id={`${id}-n`} className={fieldClass} value={v.note} maxLength={200} aria-invalid={Boolean(errors.note)} aria-describedby={`${id}-n-${errors.note ? "error" : "hint"}`} onChange={(e) => set("note", e.target.value)} />
          </Field>
          {state.error && <p role="alert" className="notice-error">{state.error}</p>}
          <button type="button" className="button-primary" onClick={goReview}>مراجعة الشحن</button>
        </>
      )}
    </form>
  );
}
