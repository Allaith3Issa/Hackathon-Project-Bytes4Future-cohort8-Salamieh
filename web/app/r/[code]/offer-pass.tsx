"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { issueOfferPass, recordReferralClick } from "@/app/actions";

export function OfferVisit({ code }: { code: string }) {
  const recorded = useRef<string>(null);
  useEffect(() => {
    if (recorded.current === code) return;
    recorded.current = code;
    void recordReferralClick(code).catch(() => {});
  }, [code]);
  return null;
}

export function OfferPass({ code }: { code: string }) {
  const [state, submit, pending] = useActionState(issueOfferPass.bind(null, code), {});
  const [copyStatus, setCopyStatus] = useState<"copied" | "selected" | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const passTitle = useRef<HTMLHeadingElement>(null);
  const hasPass = Boolean(state.pass);
  useEffect(() => {
    if (hasPass) passTitle.current?.focus();
  }, [hasPass]);

  if (!state.pass) {
    return (
      <form action={submit} aria-busy={pending} className="grid gap-3">
        {state.error && <p role="alert" className="notice-error">{state.error}</p>}
        <button className="button-primary w-full sm:w-fit" type="submit" disabled={pending}>
          {pending ? "جارٍ إصدار الرمز…" : "إصدار بطاقة الخصم"}
        </button>
        <p className="text-sm text-muted">أبرز البطاقة للتاجر عند الدفع نقداً.</p>
      </form>
    );
  }

  const { code: passCode, image } = state.pass;
  async function copy() {
    try {
      await navigator.clipboard.writeText(passCode);
      setCopyStatus("copied");
    } catch {
      field.current?.focus();
      field.current?.select();
      setCopyStatus("selected");
    }
  }

  return (
    <section className="surface overflow-hidden" aria-labelledby="offer-pass-title">
      <div className="border-b border-rule bg-mauve px-5 py-4 sm:px-6">
        <h2 id="offer-pass-title" ref={passTitle} tabIndex={-1} className="text-xl font-bold">بطاقة الخصم جاهزة</h2>
        <p className="mt-1 text-sm leading-7 text-muted">
          أبرز الرمز للتاجر عند الدفع نقداً ليُحتسب الخصم و<span className="whitespace-nowrap">الكاش باك</span>.
        </p>
      </div>
      <div className="px-5 py-4 sm:px-6">
        {image ? (
       
          <img src={image} width={256} height={256} alt="رمز مسح بطاقة الخصم" className="mx-auto mb-4 h-auto max-w-full" />
        ) : <p className="notice mb-4">أعطِ التاجر الرمز اليدوي أدناه لإدخاله عند الدفع.</p>}
        <label htmlFor="pass-code" className="block">رمز الإدخال اليدوي</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="pass-code" ref={field} readOnly dir="ltr" value={passCode} className="min-w-0 flex-1 text-center font-mono" />
          <button type="button" className="button-secondary" onClick={copy}>نسخ الرمز</button>
        </div>
        <p role="status" className={copyStatus === "copied" ? "text-sm text-success" : "text-sm text-muted"}>
          {copyStatus === "copied" && <span className="mt-2 block">تم نسخ الرمز.</span>}
          {copyStatus === "selected" && <span className="mt-2 block">تم تحديد الرمز. يمكنك نسخه يدوياً.</span>}
        </p>
      </div>
    </section>
  );
}
