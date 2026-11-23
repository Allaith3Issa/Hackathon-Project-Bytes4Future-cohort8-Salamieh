"use client";

import { useActionState, useState } from "react";
import { closeCampaign } from "@/app/staff-actions";
import { statusLabels, formatMoney } from "@/lib/staff-ui";

export function CloseCampaign({ id }: { id: string }) {
  const [state, submit, pending] = useActionState(closeCampaign.bind(null, id), {});
  const [confirming, setConfirming] = useState(false);
  if (state.campaign) {
    const c = state.campaign;
    return (
      <div role="status" className="rounded-lg bg-success-bg p-4 text-success">
        <p className="font-bold">حالة الحملة: {statusLabels[c.status]}</p>
        <p className="mt-1">الاحتياطي المتبقي المحجوز: <span className="font-semibold tabular-nums">{formatMoney(c.usage.lockedBudgetSyp)}</span></p>
      </div>
    );
  }
  return (
    <form action={submit} aria-busy={pending} className="grid gap-3">
      {state.error && <p role="alert" className="notice-error">{state.error}</p>}
      {confirming ? (
        <>
          <p className="notice">سيُنهى العرض ويُفكّ حجز الاحتياطي غير المستخدم. هل تريد المتابعة؟</p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="button-primary" disabled={pending}>{pending ? "جارٍ الإغلاق…" : "تأكيد الإغلاق"}</button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => setConfirming(false)}>تراجع</button>
          </div>
        </>
      ) : <button type="button" className="button-secondary" onClick={() => setConfirming(true)}>إغلاق الحملة</button>}
    </form>
  );
}
