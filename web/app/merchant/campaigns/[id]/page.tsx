import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CloseCampaign } from "@/components/close-campaign";
import { ApiError } from "@/lib/api";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requireRole } from "@/lib/staff";
import type { MerchantCampaign } from "@/lib/staff-contract";
import { staffError, statusLabels, formatMoney } from "@/lib/staff-ui";
import { formatDate, formatNumber } from "@/lib/ui";

export const metadata: Metadata = { title: "تفاصيل الحملة" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("merchant");
  const { id } = await params;
  if (!/^[0-9a-f-]{8,64}$/i.test(id)) notFound();
  let c: MerchantCampaign;
  try {
    c = await authenticatedRequest<MerchantCampaign>(`/merchant/campaigns/${encodeURIComponent(id)}`);
  } catch (error) {
    expiredRedirect(error, "merchant");
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <div className="page-wrap space-y-4 py-7 sm:py-12">
        <h1 className="page-title">تفاصيل الحملة</h1>
        <p role="alert" className="notice-error max-w-lg">{staffError(error)}</p>
        <a href={`/merchant/campaigns/${encodeURIComponent(id)}`} className="button-secondary">إعادة المحاولة</a>
      </div>
    );
  }
  const u = c.usage;
  const stats: [string, string][] = [
    ["القطع المباعة", u.maxItems === null ? formatNumber(u.itemsSold) : `${formatNumber(u.itemsSold)} من ${formatNumber(u.maxItems)}`],
    ["العمولات المدفوعة", formatMoney(u.commissionsPaidSyp)], ["رسوم المنصة المدفوعة", formatMoney(u.platformFeesPaidSyp)],
    ["الاحتياطي الأقصى", formatMoney(u.worstCaseReserveSyp)],
  ];
  return (
    <div className="page-wrap space-y-6 py-7 sm:py-12">
      <div>
        <h1 className="page-title">{c.productName}</h1>
        <p className="mt-1 text-muted">{statusLabels[c.status]} · ينتهي {formatDate(c.endsAt)}</p>
      </div>
      <dl className="grid overflow-hidden rounded-xl border border-rule sm:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-ink p-5 text-white sm:p-7">
          <dt className="text-sm font-semibold">الاحتياطي المحجوز حالياً</dt>
          <dd className="mt-3 text-3xl font-bold tabular-nums sm:text-4xl">{formatMoney(u.lockedBudgetSyp)}</dd>
        </div>
        <div className="bg-mauve p-5 sm:p-7">
          <dt className="text-sm font-semibold">سعر البيع للزبون</dt>
          <dd className="mt-3 text-2xl font-bold tabular-nums">{c.finalPriceSyp === null ? "—" : formatMoney(c.finalPriceSyp)}</dd>
        </div>
      </dl>
      <dl className="surface grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        {stats.map(([l, v]) => <div key={l}><dt className="text-sm text-muted">{l}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}
      </dl>
      <section className="surface grid gap-3 p-5 sm:p-6" aria-labelledby="close-title">
        <h2 id="close-title" className="text-xl font-bold">إغلاق الحملة</h2>
        {c.status === "ended" ? <p className="notice">هذه الحملة منتهية، وتم فكّ الاحتياطي غير المستخدم.</p> : <CloseCampaign id={c.id} />}
      </section>
      <Link href="/merchant/campaigns" className="text-link">كل الحملات</Link>
    </div>
  );
}
