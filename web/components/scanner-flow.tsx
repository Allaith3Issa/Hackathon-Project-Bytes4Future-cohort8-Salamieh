"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { lookupOffer, redeemOffer, redeemVoucher } from "@/app/staff-actions";
import { fieldClass, formatMoney, parseMoney, statusLabels } from "@/lib/staff-ui";
import type { OfferRedeemResult, ScannerLookup, VoucherRedeemResult } from "@/lib/staff-contract";
import { Field } from "./field";
import { useAttemptKey } from "./use-attempt-key";

type Offer = Extract<ScannerLookup, { kind: "offer_qr" }>;
type Voucher = Extract<ScannerLookup, { kind: "cashback_voucher" }>;
type Phase =
  | { step: "input" }
  | { step: "offer"; offer: Offer }
  | { step: "voucher"; voucher: Voucher }
  | { step: "offer-done"; result: OfferRedeemResult }
  | { step: "voucher-done"; result: VoucherRedeemResult };

function Rows({ rows }: { rows: [string, number][] }) {
  return (
    <dl className="mt-4 divide-y divide-rule rounded-xl border border-rule">
      {rows.map(([l, n], i) => (
        <div key={l} className={`flex justify-between gap-4 px-4 py-3 ${i === 0 ? "bg-ink text-white" : ""}`}>
          <dt>{l}</dt><dd className="font-bold tabular-nums">{formatMoney(n)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ScannerFlow() {
  const id = useId();
  const [code, setCode] = useState("");
  const [bill, setBill] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "input" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [key, renewKey] = useAttemptKey();
  const heading = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => { heading.current?.focus(); }, [phase.step]);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);

  const reset = () => { setCode(""); setBill(""); setError(undefined); setPhase({ step: "input" }); renewKey(); };
  const lookup = () => start(async () => {
    setError(undefined);
    const r = await lookupOffer(code);
    if (r.error || !r.lookup) return setError(r.error);
    renewKey();
    setPhase(r.lookup.kind === "offer_qr" ? { step: "offer", offer: r.lookup } : { step: "voucher", voucher: r.lookup });
  });
  const redeem = (offer: Offer) => start(async () => {
    setError(undefined);
    const r = await redeemOffer(code, key);
    if (r.result) return setPhase({ step: "offer-done", result: r.result });
    setError(r.error);
    if (r.terminal) setPhase({ step: "input" });
  });
  const redeemV = () => start(async () => {
    setError(undefined);
    const r = await redeemVoucher(code, bill, key);
    if (r.result) return setPhase({ step: "voucher-done", result: r.result });
    setError(r.error);
    if (r.terminal) setPhase({ step: "input" });
  });
  const alertEl = error && <p ref={alert} tabIndex={-1} role="alert" className="notice-error">{error}</p>;

  if (phase.step === "offer-done") {
    const r = phase.result;
    return (
      <section className="surface p-5 sm:p-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">تم تسجيل البيع</h2>
        <p role="status" className="mt-1 text-success">{r.productName} · حالة الحملة: {statusLabels[r.campaignStatusAfterSale]}</p>
        <Rows rows={[
          ["استلمت من الزبون نقداً", r.customerPaidCashSyp], ["عمولة المسوّق", r.marketerCommissionSyp],
          ["رسوم المنصة الإجمالية", r.platformTotalFeeSyp], ["كاش باك الزبون", r.customerCashbackSyp],
          ["صافي رسوم المنصة", r.platformNetFeeSyp], ["الاحتياطي المتبقي للحملة", r.remainingLockedBudgetSyp],
        ]} />
        <button type="button" className="button-primary mt-5" onClick={reset}>رمز جديد</button>
      </section>
    );
  }

  if (phase.step === "voucher-done") {
    const r = phase.result;
    return (
      <section className="surface p-5 sm:p-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">تم استرداد القسيمة</h2>
        <p role="status" className="mt-1 text-success">استلم من الزبون المبلغ النقدي أدناه.</p>
        <Rows rows={[
          ["المبلغ المستحق نقداً من الزبون", r.customerPaidCashSyp], ["إجمالي الفاتورة", r.billTotalSyp],
          ["رصيد القسيمة المضاف لمتجرك", r.amountSyp], ["رصيدك المتاح الآن", r.merchantNewAvailableBalanceSyp],
        ]} />
        <button type="button" className="button-primary mt-5" onClick={reset}>رمز جديد</button>
      </section>
    );
  }

  if (phase.step === "voucher") {
    const v = phase.voucher;
    const valid = parseMoney(bill) !== null;
    return (
      <form className="surface grid gap-4 p-5 sm:p-6" aria-busy={pending} onSubmit={(e) => { e.preventDefault(); redeemV(); }}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">استرداد قسيمة كاش باك</h2>
        <p>الزبون: {v.customerName}</p>
        <div className="rounded-lg bg-mauve p-5">
          <p className="text-sm font-semibold">قيمة القسيمة</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatMoney(v.amountSyp)}</p>
        </div>
        <Field id={`${id}-bill`} label="إجمالي الفاتورة (ل.س.)" hint="الإجمالي بعد خصومات المتجر وقبل خصم القسيمة. مثال: 200.00">
          <input id={`${id}-bill`} className={fieldClass} dir="ltr" inputMode="decimal" value={bill} autoComplete="off"
            aria-invalid={Boolean(error)} aria-describedby={`${id}-bill-hint`}
            onChange={(e) => { setBill(e.target.value); setError(undefined); renewKey(); }} />
        </Field>
        <p className="text-sm text-muted">سيظهر المبلغ النقدي المستحق بعد التأكيد، محسوباً من الخادم. لا يمكن استرداد القسيمة نفسها مرتين.</p>
        {alertEl}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="button-primary" disabled={pending || !key || !valid}>{pending ? "جارٍ التأكيد…" : "تأكيد الاسترداد"}</button>
          <button type="button" className="button-secondary" disabled={pending} onClick={reset}>إلغاء</button>
        </div>
      </form>
    );
  }

  if (phase.step === "offer") {
    const o = phase.offer;
    const due = o.availableQuantityOptions.find((q) => q.quantity === 1)?.customerPaidCashSyp ?? o.finalPriceSyp;
    return (
      <section className="surface grid gap-4 p-5 sm:p-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">تأكيد البيع</h2>
        <p>{o.productName} · الزبون: {o.customerName}</p>
        <div className="rounded-lg bg-ink p-5 text-white">
          <p className="text-sm font-semibold">المبلغ المستحق نقداً من الزبون</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{due === null ? "—" : formatMoney(due)}</p>
        </div>
        <p className="text-sm text-muted">استلم المبلغ نقداً قبل التأكيد. لا يمكن تأكيد الرمز نفسه مرتين.</p>
        {alertEl}
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
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">أدخل رمز بطاقة الخصم أو القسيمة</h2>
      <Field id={id} label="الرمز" hint="الرمز المكتوب تحت الـ QR على هاتف الزبون.">
        <input id={id} className={fieldClass} dir="ltr" autoComplete="off" autoCapitalize="characters" value={code}
          aria-describedby={`${id}-hint`} onChange={(e) => setCode(e.target.value)} />
      </Field>
      {alertEl}
      <button type="submit" className="button-primary" disabled={pending || !code.trim()}>{pending ? "جارٍ البحث…" : "بحث"}</button>
    </form>
  );
}
