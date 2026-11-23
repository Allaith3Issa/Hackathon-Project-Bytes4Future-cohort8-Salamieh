"use client";

import { useActionState, useId, useRef, useState } from "react";
import { topUp } from "@/app/staff-actions";
import { fieldClass, paymentLabels, formatMoney, parseMoney } from "@/lib/staff-ui";
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
        <h2 id={`${id}-done`} tabIndex={-1} ref={(el) => el?.focus()} className="text-xl font-bold">تم شحن الرصيد</h2>
        <dl className="mt-4 grid overflow-hidden rounded-xl border border-rule sm:grid-cols-2">
          <div className="bg-ink p-5 text-white">
            <dt className="text-sm font-semibold">رصيد {r.shopName} المتاح الآن</dt>
            <dd className="mt-2 text-3xl font-bold tabular-nums">{formatMoney(r.merchantNewAvailableBalanceSyp)}</dd>
          </div>
          <div className="bg-mauve p-5">
            <dt className="text-sm font-semibold">المبلغ المشحون</dt>
            <dd className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(r.amountSyp)}</dd>
            <dd className="mt-1 text-sm text-muted">{paymentLabels[r.paymentMethod]} · <bdi dir="ltr">{r.referenceNote}</bdi></dd>
          </div>
        </dl>
        <button type="button" className="button-secondary mt-5" onClick={onNewTopup}>شحن جديد</button>
      </section>
    );
  }

  const goReview = () => {
    const found: Record<string, string> = {};
    if (!v.merchantId) found.merchantId = "اختر التاجر.";
    if (!parseMoney(v.amount) ) found.amount = "أدخل مبلغاً صحيحاً أكبر من صفر (حتى منزلتين عشريتين).";
    if (!v.note.trim()) found.note = "أدخل مرجع الدفع.";
    setLocal(found);
    if (!Object.keys(found).length) setReviewAt({ errors: state.errors });
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
            <div><dt className="text-sm text-muted">المبلغ</dt><dd className="text-2xl font-bold tabular-nums">{formatMoney(parseMoney(v.amount) ?? 0)}</dd></div>
            <div><dt className="text-sm text-muted">طريقة الدفع والمرجع</dt><dd>{paymentLabels[v.paymentMethod as PaymentMethod]} · <bdi dir="ltr">{v.note}</bdi></dd></div>
          </dl>
          {state.error && <p role="alert" className="notice-error">{state.error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="button-primary" disabled={pending || !key}>{pending ? "جارٍ الشحن…" : state.error ? "إعادة المحاولة" : "تأكيد الشحن"}</button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => setReviewAt(null)}>تعديل</button>
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
          {merchant && <p className="notice">الرصيد المتاح حالياً: {formatMoney(merchant.wallet.availableBalanceSyp)}</p>}
          <Field id={`${id}-a`} label="المبلغ (ل.س.)" hint="مثال: 500.00" error={errors.amount}>
            <input id={`${id}-a`} className={fieldClass} dir="ltr" inputMode="decimal" value={v.amount} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? `${id}-a-error` : undefined} onChange={(e) => set("amount", e.target.value)} />
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
