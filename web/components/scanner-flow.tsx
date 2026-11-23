"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { lookupOffer, redeemOffer } from "@/app/staff-actions";
import { formatSyp } from "@/lib/ui";
import { statusLabels, fieldClass } from "@/lib/staff-ui";
import type { OfferRedeemResult, ScannerLookup } from "@/lib/staff-contract";
import { Field } from "./field";
import { useAttemptKey } from "./use-attempt-key";

type Offer = Extract<ScannerLookup, { kind: "offer_qr" }>;
type Phase = { step: "input" } | { step: "confirm"; offer: Offer } | { step: "done"; result: OfferRedeemResult };

export function ScannerFlow() {
  const id = useId();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "input" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [key, renewKey] = useAttemptKey();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [phase.step]);

  const reset = () => { setCode(""); setError(undefined); setPhase({ step: "input" }); renewKey(); };
  const lookup = () => start(async () => {
    setError(undefined);
    const r = await lookupOffer(code);
    if (r.error) return setError(r.error);
    if (r.lookup?.kind !== "offer_qr") return setError("هذا رمز قسيمة كاش باك وليس بطاقة خصم. تأكيد القسائم غير متاح في هذه النسخة.");
    renewKey();
    setPhase({ step: "confirm", offer: r.lookup });
  });
  const redeem = (offer: Offer) => start(async () => {
    setError(undefined);
    const r = await redeemOffer(code, key); // same key on retry; renewed only after a new lookup
    if (r.result) return setPhase({ step: "done", result: r.result });
    setError(r.error);
    if (r.terminal) setPhase({ step: "input" }); // terminal failure: code unusable, start over
    else setPhase({ step: "confirm", offer });
  });

  if (phase.step === "done") {
    const r = phase.result;
    const rows: [string, number][] = [
      ["استلمت من الزبون نقداً", r.customerPaidCashSyp], ["عمولة المسوّق", r.marketerCommissionSyp],
      ["رسوم المنصة الإجمالية", r.platformTotalFeeSyp], ["كاش باك الزبون", r.customerCashbackSyp],
      ["صافي رسوم المنصة", r.platformNetFeeSyp], ["الاحتياطي المتبقي للحملة", r.remainingLockedBudgetSyp],
    ];
    return (
      <section className="surface p-5 sm:p-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">تم تسجيل البيع</h2>
        <p role="status" className="mt-1 text-success">{r.productName} · حالة الحملة: {statusLabels[r.campaignStatusAfterSale]}</p>
        <dl className="mt-4 divide-y divide-rule rounded-xl border border-rule">
          {rows.map(([l, n], i) => (
            <div key={l} className={`flex justify-between gap-4 px-4 py-3 ${i === 0 ? "bg-ink text-white" : ""}`}>
              <dt>{l}</dt><dd className="font-bold tabular-nums">{formatSyp(n)}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="button-primary mt-5" onClick={reset}>رمز جديد</button>
      </section>
    );
  }

  if (phase.step === "confirm") {
    const o = phase.offer;
    const due = o.availableQuantityOptions.find((q) => q.quantity === 1)?.customerPaidCashSyp ?? o.finalPriceSyp;
    return (
      <section className="surface grid gap-4 p-5 sm:p-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">تأكيد البيع</h2>
        <p>{o.productName} · الزبون: {o.customerName}</p>
        <div className="rounded-lg bg-ink p-5 text-white">
          <p className="text-sm font-semibold">المبلغ المستحق نقداً من الزبون</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{due === null ? "—" : formatSyp(due)}</p>
        </div>
        <p className="text-sm text-muted">استلم المبلغ نقداً قبل التأكيد. لا يمكن تأكيد الرمز نفسه مرتين.</p>
        {error && <p role="alert" className="notice-error">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="button-primary" disabled={pending || !key} onClick={() => redeem(o)}>
            {pending ? "جارٍ التأكيد…" : error ? "إعادة المحاولة" : "تأكيد استلام المبلغ"}
          </button>
          <button type="button" className="button-secondary" disabled={pending} onClick={reset}>إلغاء</button>
        </div>
      </section>
    );
  }

  return (
    <form className="surface grid gap-4 p-5 sm:p-6" aria-busy={pending} onSubmit={(e) => { e.preventDefault(); lookup(); }}>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">أدخل رمز بطاقة الخصم</h2>
      <Field id={id} label="الرمز" hint="الرمز المكتوب تحت الـ QR على هاتف الزبون." error={undefined}>
        <input id={id} className={fieldClass} dir="ltr" autoComplete="off" autoCapitalize="characters" value={code}
          aria-describedby={`${id}-hint`} onChange={(e) => setCode(e.target.value)} />
      </Field>
      {error && <p role="alert" className="notice-error">{error}</p>}
      <button type="submit" className="button-primary" disabled={pending || !code.trim()}>{pending ? "جارٍ البحث…" : "عرض المبلغ المستحق"}</button>
    </form>
  );
}
