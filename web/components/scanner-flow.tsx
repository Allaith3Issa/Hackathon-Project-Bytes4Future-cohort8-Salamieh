"use client";

import { useI18n } from "@/components/i18n-provider";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { lookupOffer, redeemOffer, redeemVoucher } from "@/app/staff-actions";
import { fieldClass, parsePositiveMoney, statusLabels } from "@/lib/staff-ui";
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
const restoredMessage = "scanner.theLastRedemptionHasnTBeen";
const storageError = "scanner.weCouldnTSaveTheRedemption";

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
  const { formatSyp: formatMoney } = useI18n();
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
  const { t } = useI18n();
  // The saved attempt is available only after hydration.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  if (!hydrated) return <p role="status" className="notice">{t("scanner.preparingTheScanner")}</p>;

  return <Scanner storageKey={`mardood-pending-voucher:${merchantId}`} />;
}

function Scanner({ storageKey }: { storageKey: string }) {
  const { t, formatSyp: formatMoney } = useI18n();
  const id = useId();
  const [attempt, setAttempt] = useState(() => readAttempt(storageKey));
  const [code, setCode] = useState(attempt?.code ?? "");
  const [bill, setBill] = useState(attempt?.bill ?? "");
  const [phase, setPhase] = useState<Phase>(attempt ? { step: "voucher", voucher: { amountSyp: attempt.amountSyp } } : { step: "input" });
  const [error, setError] = useState<string | undefined>(attempt ? t(restoredMessage) : undefined);
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
      setError(t(storageError));
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
        setError(t(restoredMessage));
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
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">{t("scanner.saleRecorded")}</h2>
        <p role="status" className="mt-1 text-success">{r.productName}{" "}{t("scanner.campaignStatus")}{" "}{t(statusLabels[r.campaignStatusAfterSale])}</p>
        <Rows rows={[
          [t("scanner.cashCollectedFromCustomer"), r.customerPaidCashSyp], [t("scanner.marketerCommission"), r.marketerCommissionSyp],
          [t("scanner.grossPlatformFee"), r.platformTotalFeeSyp], [t("scanner.customerCashback"), r.customerCashbackSyp],
          [t("scanner.netPlatformFee"), r.platformNetFeeSyp], [t("scanner.remainingCampaignReserve"), r.remainingLockedBudgetSyp],
        ]} />
        <button type="button" className="button-primary mt-5" onClick={reset}>{t("scanner.scanAnotherCode")}</button>
      </section>
    );
  }

  if (phase.step === "voucher-done") {
    const r = phase.result;
    return (
      <section className="surface p-5 sm:p-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">{t("scanner.voucherRedeemed")}</h2>
        <p role="status" className="mt-1 text-success">{t("scanner.collectTheCashAmountShownBelow")}</p>
        <Rows rows={[
          [t("scanner.cashDueFromCustomer"), r.customerPaidCashSyp], [t("scanner.billTotal"), r.billTotalSyp],
          [t("scanner.voucherCreditAddedToYourStore"), r.amountSyp], [t("scanner.yourAvailableBalanceNow"), r.merchantNewAvailableBalanceSyp],
        ]} />
        <button type="button" className="button-primary mt-5" onClick={reset}>{t("scanner.scanAnotherCode")}</button>
      </section>
    );
  }

  if (phase.step === "voucher") {
    const v = phase.voucher;
    const valid = parsePositiveMoney(bill) !== null;
    const locked = pending || attempt !== null;
    return (
      <form className="surface grid gap-4 p-5 sm:p-6" aria-busy={pending} onSubmit={(e) => { e.preventDefault(); redeemV(v); }}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">{t("scanner.redeemCashbackVoucher")}</h2>
        {v.customerName && <p>{t("scanner.customer")}{" "}{v.customerName}</p>}
        <div className="rounded-lg bg-mauve p-5">
          <p className="text-sm font-semibold">{t("scanner.voucherValue")}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatMoney(v.amountSyp)}</p>
        </div>
        <Field id={`${id}-bill`} label={t("scanner.billTotalSyp")} hint={t("scanner.theTotalAfterStoreDiscountsAnd")}>
          <input id={`${id}-bill`} className={fieldClass} dir="ltr" inputMode="decimal" value={attempt?.bill ?? bill} autoComplete="off" readOnly={locked}
            aria-invalid={Boolean(error) && !locked} aria-describedby={`${id}-bill-hint`}
            onChange={(e) => {
              if (locked || voucherInFlight.current) return;
              setBill(e.target.value);
              setError(undefined);
            }} />
        </Field>
        <p className="text-sm text-muted">{t("scanner.theServerCalculatesTheCashDue")}</p>
        {attempt && !pending && <p className="notice">{t("scanner.theBillIsLockedWhileThe")}</p>}
        {alertEl}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="button-primary" disabled={pending || !valid}>{pending ? t("scanner.confirming") : attempt ? t("common.tryAgain") : t("scanner.confirmRedemption")}</button>
          {!locked && <button type="button" className="button-secondary" onClick={reset}>{t("common.cancel")}</button>}
        </div>
      </form>
    );
  }

  if (phase.step === "offer") {
    const o = phase.offer;
    const due = o.availableQuantityOptions.find((q) => q.quantity === 1)?.customerPaidCashSyp ?? o.finalPriceSyp;
    return (
      <section className="surface grid gap-4 p-5 sm:p-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">{t("scanner.confirmSale")}</h2>
        <p>{o.productName}{" "}{t("scanner.customer2")}{" "}{o.customerName}</p>
        <div className="rounded-lg bg-ink p-5 text-white">
          <p className="text-sm font-semibold">{t("scanner.cashDueFromCustomer")}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{due === null ? "—" : formatMoney(due)}</p>
        </div>
        <p className="text-sm text-muted">{t("scanner.collectTheCashBeforeConfirmingEach")}</p>
        {alertEl}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="button-primary" disabled={pending || !key} onClick={redeem}>
            {pending ? t("scanner.confirming") : error ? t("common.tryAgain") : t("scanner.confirmCashReceived")}
          </button>
          <button type="button" className="button-secondary" disabled={pending} onClick={reset}>{t("common.cancel")}</button>
        </div>
      </section>
    );
  }

  return (
    <form className="surface grid gap-4 p-5 sm:p-6" aria-busy={pending} onSubmit={(e) => { e.preventDefault(); lookup(); }}>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">{t("scanner.enterADiscountPassOrVoucher")}</h2>
      <Field id={id} label={t("scanner.code")} hint={t("scanner.enterTheCodeBelowTheQr")}>
        <input id={id} className={fieldClass} dir="ltr" autoComplete="off" autoCapitalize="characters" value={code}
          aria-describedby={`${id}-hint`} onChange={(e) => setCode(e.target.value)} />
      </Field>
      {alertEl}
      <button type="submit" className="button-primary" disabled={pending || !code.trim()}>{pending ? t("scanner.searching") : t("scanner.search")}</button>
    </form>
  );
}
