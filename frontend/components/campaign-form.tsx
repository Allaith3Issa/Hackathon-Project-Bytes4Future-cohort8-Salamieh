"use client";

import { useActionState, useId, useRef, useState } from "react";
import { campaignAction } from "@/app/staff-actions";
import { formatSyp } from "@/lib/ui";
import { fieldClass } from "@/lib/staff-ui";
import { Field } from "./field";
import { useAttemptKey } from "./use-attempt-key";
import { useFocusError } from "./use-focus-error";


const empty = {
  productName: "", description: "", imageUrl: "", originalPriceSyp: "", discountPercent: "",
  commissionSyp: "", maxItems: "", endsAt: "",
};
type Values = typeof empty;

export function CampaignForm() {
  const id = useId();
  const [state, submit, pending] = useActionState(campaignAction, {});
  const [key, renewKey] = useAttemptKey();
  const [v, setV] = useState<Values>(empty);
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
        dir={extra.numeric || extra.type || name === "imageUrl" ? "ltr" : undefined} inputMode={extra.numeric ? "numeric" : undefined}
        aria-invalid={Boolean(e[name])} aria-describedby={e[name] ? `${id}-${name}-error` : extra.hint ? `${id}-${name}-hint` : undefined}
        onChange={(ev) => set(name, ev.target.value)} />
    </Field>
  );
  return (
    <form ref={formRef} action={submit} aria-busy={pending} className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <input type="hidden" name="key" value={key} />
      <div className="surface grid gap-4 p-5 sm:p-6">
        <h2 className="text-xl font-bold">تفاصيل الحملة</h2>
        {text("productName", "اسم المنتج")}
        <Field id={`${id}-description`} label="الوصف" error={e.description}>
          <textarea id={`${id}-description`} name="description" rows={3} value={v.description} aria-invalid={Boolean(e.description)} aria-describedby={e.description ? `${id}-description-error` : undefined}
            className={`${fieldClass} py-2`} onChange={(ev) => set("description", ev.target.value)} />
        </Field>
        {text("imageUrl", "رابط صورة المنتج", { hint: "رابط يبدأ بـ https." })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("originalPriceSyp", "السعر الأصلي (ل.س.)", { numeric: true })}
          {text("discountPercent", "نسبة الخصم %", { numeric: true })}
          {text("commissionSyp", "عمولة المسوّق لكل قطعة (ل.س.)", { numeric: true, hint: "عمولة ثابتة." })}
          {text("maxItems", "أقصى عدد قطع", { numeric: true })}
        </div>
        {text("endsAt", "موعد انتهاء الحملة", { type: "datetime-local", hint: "بتوقيت دمشق." })}
        <p className="notice">الانضمام للحملة مفتوح لكل المسوّقين.</p>
      </div>
      <aside aria-labelledby={`${id}-preview`} className="surface grid gap-4 p-5 sm:p-6 lg:sticky lg:top-4">
        <h2 id={`${id}-preview`} className="text-xl font-bold">السعر والاحتياطي</h2>
        {p ? (
          <>
            <dl className="grid gap-3">
              <div><dt className="text-sm text-muted">سعر البيع للزبون</dt><dd className="font-semibold tabular-nums">{p.finalPriceSyp === null ? "—" : formatSyp(p.finalPriceSyp)}</dd></div>
              <div><dt className="text-sm text-muted">عمولة المسوّق لكل قطعة</dt><dd className="font-semibold tabular-nums">{formatSyp(p.commissionPerUnitSyp)}</dd></div>
              <div className="rounded-lg bg-ink p-4 text-white"><dt className="text-sm font-semibold">الاحتياطي المحجوز عند الإطلاق</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{formatSyp(p.worstCaseReserveSyp)}</dd></div>
              <div><dt className="text-sm text-muted">رصيدك المتاح</dt><dd className="font-semibold tabular-nums">{formatSyp(p.merchantAvailableBalanceSyp)}</dd></div>
            </dl>
            {!p.isAffordableByMerchant && <p role="alert" className="notice-error">رصيدك المتاح أقل من الاحتياطي المطلوب. اطلب شحن الرصيد من الإدارة أو خفّض العدد.</p>}
          </>
        ) : (
          <p className="notice">{state.preview ? "تغيّرت القيم. اضغط «حساب السعر والاحتياطي» لتحديث الأرقام." : "اضغط «حساب السعر والاحتياطي» لتظهر الأرقام المحسوبة من الخادم."}</p>
        )}
        {state.error && <p role="alert" className="notice-error">{state.error}</p>}
        <div className="grid gap-3">
          <button type="submit" name="intent" value="preview" className="button-secondary" disabled={pending || !key}>حساب السعر والاحتياطي</button>
          <button type="submit" name="intent" value="launch" className="button-primary" disabled={pending || !key || !p || !p.isAffordableByMerchant}>
            {pending ? "جارٍ المعالجة…" : state.error ? "إعادة محاولة الإطلاق" : "إطلاق الحملة"}
          </button>
        </div>
      </aside>
    </form>
  );
}
