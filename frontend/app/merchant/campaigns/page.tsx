import type { Metadata } from "next";
import Link from "next/link";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requireRole } from "@/lib/staff";
import type { MerchantCampaign, Page } from "@/lib/staff-contract";
import { staffError, statusLabels } from "@/lib/staff-ui";
import { formatDate, formatSyp } from "@/lib/ui";

export const metadata: Metadata = { title: "حملاتي" };

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole("merchant");
  const { page } = await searchParams;
  const n = typeof page === "string" && /^[1-9][0-9]{0,7}$/.test(page) ? page : "1";
  let data: Page<MerchantCampaign>;
  try {
    data = await authenticatedRequest<Page<MerchantCampaign>>(`/merchant/campaigns?page=${n}`);
  } catch (error) {
    expiredRedirect(error, "merchant");
    return (
      <div className="page-wrap space-y-4 py-7 sm:py-12">
        <h1 className="page-title">حملاتي</h1>
        <p role="alert" className="notice-error max-w-lg">{staffError(error)}</p>
        <a href={`/merchant/campaigns?page=${n}`} className="button-secondary">إعادة المحاولة</a>
      </div>
    );
  }
  return (
    <div className="page-wrap space-y-6 py-7 sm:py-12">
      <h1 className="page-title">حملاتي</h1>
      {data.items.length === 0 ? (
        <p className="notice">لا توجد حملات بعد. <Link className="text-link" href="/merchant/campaigns/new">أطلق حملتك الأولى</Link>.</p>
      ) : (
        <ul className="surface divide-y divide-rule overflow-hidden">
          {data.items.map((c) => (
            <li key={c.id}>
              <Link href={`/merchant/campaigns/${encodeURIComponent(c.id)}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-mauve">
                <span><span className="block font-semibold">{c.productName}</span><span className="text-sm text-muted">ينتهي {formatDate(c.endsAt)}</span></span>
                <span className="text-sm tabular-nums">{c.finalPriceSyp === null ? "" : `${formatSyp(c.finalPriceSyp)} · `}{statusLabels[c.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(data.previousPage !== null || data.nextPage !== null) && (
        <nav aria-label="صفحات الحملات" className="flex gap-3">
          {data.previousPage !== null && <Link className="button-secondary" href={`/merchant/campaigns?page=${data.previousPage}`}>الصفحة السابقة</Link>}
          {data.nextPage !== null && <Link className="button-secondary" href={`/merchant/campaigns?page=${data.nextPage}`}>الصفحة التالية</Link>}
        </nav>
      )}
    </div>
  );
}
