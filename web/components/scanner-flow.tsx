"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { lookupOffer, redeemOffer, redeemVoucher } from "@/app/staff-actions";
import { fieldClass, formatMoney, parsePositiveMoney, statusLabels } from "@/lib/staff-ui";
import type { OfferRedeemResult, ScannerLookup, VoucherRedeemResult } from "@/lib/staff-contract";
import { Field } from "./field";
import { useAttemptKey } from "./use-attempt-key";

type Offer = Extract<ScannerLookup, { kind: "offer_qr" }>;
type Voucher = { amountSyp: number; customerName?: string };
type VoucherAttempt = { code: string; bill: string; key: string; amountSyp: number };
type Phase =
  | { step: "input" }
  | { step: "offer"; offer: Offer }
  | { step: "voucher"; voucher: Voucher }
  | { step: "offer-done"; result: OfferRedeemResult }
  | { step: "voucher-done"; result: VoucherRedeemResult };

const subscribe = () => () => {};
const restoredMessage = "لم يصلنا تأكيد عملية استرداد سابقة. أعد المحاولة بنفس الفاتورة لنعرف نتيجتها.";
const storageError = "تعذّر حفظ محاولة الاسترداد. اسمح بتخزين بيانات الجلسة في المتصفح ثم حاول مرة أخرى.";

function readAttempt(storageKey: string): VoucherAttempt | null {
  try {
    const saved: Partial<VoucherAttempt> | null = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (typeof saved?.code !== "string" || !saved.code || typeof saved.key !== "string" || !saved.key
      || typeof saved.bill !== "string" || parsePositiveMoney(saved.bill) === null
      || typeof saved.amountSyp !== "number" || !Number.isSafeInteger(saved.amountSyp) || saved.amountSyp <= 0) {
      return null;
    }
    return { code: saved.code, bill: saved.bill, key: saved.key, amountSyp: saved.amountSyp };
  } catch {
    return null;
  }
}

function saveAttempt(storageKey: string, attempt: VoucherAttempt) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(attempt));
    return true;
  } catch {
    return false;
  }
}

function clearAttempt(storageKey: string, key: string) {
  try {
    if (readAttempt(storageKey)?.key === key) sessionStorage.removeItem(storageKey);
  } catch {
    // A saved attempt can still be retried safely with its original key.
  }
}

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

export function ScannerFlow({ merchantId }: { merchantId: string }) {
  // The saved attempt is available only after hydration.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  if (!hydrated) return <p role="status" className="notice">جارٍ تجهيز الماسح…</p>;

  return <Scanner storageKey={`mardood-pending-voucher:${merchantId}`} />;
}

function Scanner({ storageKey }: { storageKey: string }) {
  const id = useId();
  const [attempt, setAttempt] = useState(() => readAttempt(storageKey));
  const [code, setCode] = useState(attempt?.code ?? "");
  const [bill, setBill] = useState(attempt?.bill ?? "");
  const [phase, setPhase] = useState<Phase>(attempt ? { step: "voucher", voucher: { amountSyp: attempt.amountSyp } } : { step: "input" });
  const [error, setError] = useState<string | undefined>(attempt ? restoredMessage : undefined);
  const [pending, start] = useTransition();
  const [key, renewKey] = useAttemptKey();
  const voucherInFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => { heading.current?.focus(); }, [phase.step]);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  const reset = () => { setCode(""); setBill(""); setError(undefined); setPhase({ step: "input" }); };
  const lookup = () => start(async () => {
    setError(undefined);
    const r = await lookupOffer(code);
    if (r.error || !r.lookup) return setError(r.error);
    if (r.lookup.kind === "offer_qr") renewKey();
    setPhase(r.lookup.kind === "offer_qr" ? { step: "offer", offer: r.lookup } : { step: "voucher", voucher: r.lookup });
  });
  const redeem = () => start(async () => {
    setError(undefined);
    const r = await redeemOffer(code, key);
    if (r.result) return setPhase({ step: "offer-done", result: r.result });
    setError(r.error);
    if (r.terminal) setPhase({ step: "input" });
  });
  const redeemV = (voucher: Voucher) => {
    if (voucherInFlight.current || pending || parsePositiveMoney(bill) === null) return;
    const submitted = attempt ?? { code: code.trim(), bill, key: crypto.randomUUID(), amountSyp: voucher.amountSyp };
    if (!attempt && !saveAttempt(storageKey, submitted)) {
      setError(storageError);
      return;
    }
    voucherInFlight.current = true;
    setAttempt(submitted);
    setError(undefined);

    start(async () => {
      try {
        const r = await redeemVoucher(submitted.code, submitted.bill, submitted.key);
        if (r.result || r.outcome === "exceeds" || r.outcome === "rejected") {
          clearAttempt(storageKey, submitted.key);
          setAttempt(null);
        }
        if (r.result) setPhase({ step: "voucher-done", result: r.result });
        else {
          setError(r.error);
          if (r.outcome === "rejected") setPhase({ step: "input" });
        }
      } catch {
        setError(restoredMessage);
      } finally {
        voucherInFlight.current = false;
      }
    });
  };
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
    const valid = parsePositiveMoney(bill) !== null;
    const locked = pending || attempt !== null;
    return (
      <form className="surface grid gap-4 p-5 sm:p-6" aria-busy={pending} onSubmit={(e) => { e.preventDefault(); redeemV(v); }}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">استرداد قسيمة كاش باك</h2>
        {v.customerName && <p>الزبون: {v.customerName}</p>}
        <div className="rounded-lg bg-mauve p-5">
          <p className="text-sm font-semibold">قيمة القسيمة</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatMoney(v.amountSyp)}</p>
        </div>
        <Field id={`${id}-bill`} label="إجمالي الفاتورة (ل.س.)" hint="الإجمالي بعد خصومات المتجر وقبل خصم القسيمة. مثال: 200.00">
          <input id={`${id}-bill`} className={fieldClass} dir="ltr" inputMode="decimal" value={attempt?.bill ?? bill} autoComplete="off" readOnly={locked}
            aria-invalid={Boolean(error) && !locked} aria-describedby={`${id}-bill-hint`}
            onChange={(e) => {
              if (locked || voucherInFlight.current) return;
              setBill(e.target.value);
              setError(undefined);
            }} />
        </Field>
        <p className="text-sm text-muted">سيظهر المبلغ النقدي المستحق بعد التأكيد، محسوباً من الخادم. لا يمكن استرداد القسيمة نفسها مرتين.</p>
        {attempt && !pending && <p className="notice">الفاتورة مقفلة حتى نعرف نتيجة العملية. أعد المحاولة بنفس الفاتورة ولن تُسجَّل القسيمة مرتين.</p>}
        {alertEl}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="button-primary" disabled={pending || !valid}>{pending ? "جارٍ التأكيد…" : attempt ? "إعادة المحاولة" : "تأكيد الاسترداد"}</button>
          {!locked && <button type="button" className="button-secondary" onClick={reset}>إلغاء</button>}
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
          <button type="button" className="button-primary" disabled={pending || !key} onClick={redeem}>
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
