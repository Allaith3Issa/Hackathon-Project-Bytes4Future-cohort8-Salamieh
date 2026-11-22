import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import type { CustomerDashboard, CustomerPurchase, Page } from "@/lib/contract";
import { authenticatedRequest, sessionTokens } from "@/lib/session";
import { errorMessage, formatDate, formatNumber, formatSyp } from "@/lib/ui";

export const metadata: Metadata = { title: "الكاش باك" };

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { accessToken, refreshToken } = await sessionTokens();
  if (!accessToken) {
    if (!refreshToken) redirect("/login");
    return (
      <div className="page-wrap py-12">
        <h1 className="page-title">الكاش باك</h1>
        <p role="status" className="notice mt-4 max-w-lg">جارٍ تجديد الجلسة…</p>
        <Link href="/login" className="text-link mt-4 inline-block">تسجيل الدخول</Link>
      </div>
    );
  }

  const { page } = await searchParams;
  const purchasePage = typeof page === "string" && /^[1-9][0-9]{0,7}$/.test(page) ? page : "1";
  let dashboard: CustomerDashboard;
  let purchases: Page<CustomerPurchase>;
  try {
    [dashboard, purchases] = await Promise.all([
      authenticatedRequest<CustomerDashboard>("/customer/dashboard"),
      authenticatedRequest<Page<CustomerPurchase>>(`/customer/purchases?page=${purchasePage}`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?expired=1");
    return (
      <div className="page-wrap py-12">
        <h1 className="page-title">الكاش باك</h1>
        <p role="alert" className="notice-error mt-4 max-w-lg">{errorMessage(error)}</p>
        <a href={`/customer?page=${purchasePage}`} className="button-secondary mt-4">إعادة المحاولة</a>
      </div>
    );
  }

  return (
    <div className="page-wrap space-y-6 py-7 sm:space-y-8 sm:py-12">
      <h1 className="page-title">الكاش باك</h1>
      <dl className="grid overflow-hidden rounded-xl border border-rule sm:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-ink p-5 text-white sm:p-7">
          <dt className="text-sm font-semibold">الرصيد المتاح</dt>
          <dd className="mt-3 text-3xl font-bold leading-tight tabular-nums sm:text-4xl">{formatSyp(dashboard.availableCashbackSyp)}</dd>
        </div>
        <div className="bg-mauve p-5 sm:p-7">
          <dt className="text-sm font-semibold">الرصيد المجمّد</dt>
          <dd className="mt-3 text-2xl font-bold leading-tight tabular-nums sm:text-3xl">{formatSyp(dashboard.lockedCashbackSyp)}</dd>
          <dd className="mt-1 text-sm text-muted">يصبح متاحاً عند اكتمال شروط الدورة.</dd>
        </div>
      </dl>
      <section aria-labelledby="milestone-title" className="surface p-5 sm:p-6">
        <h2 id="milestone-title" className="text-xl font-bold">التقدّم نحو فتح الرصيد</h2>
        <p className="mt-1 text-sm leading-7 text-muted">لفتح الرصيد، أكمل العدد المطلوب من المشتريات والحد الأدنى للإنفاق.</p>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <dt id="purchase-progress" className="text-muted">المشتريات في الدورة الحالية</dt>
            <dd className="mt-1 font-semibold">{formatNumber(dashboard.milestonePurchaseCount)} من {formatNumber(dashboard.milestonePurchasesRequired)}</dd>
            <dd className="mt-2">
              <progress className="milestone-meter" aria-labelledby="purchase-progress" value={dashboard.milestonePurchaseCount} max={dashboard.milestonePurchasesRequired} />
            </dd>
          </div>
          <div>
            <dt id="spend-progress" className="text-muted">الإنفاق في الدورة الحالية</dt>
            <dd className="mt-1 font-semibold">{formatSyp(dashboard.milestoneSpendSyp)} من {formatSyp(dashboard.milestoneSpendRequiredSyp)}</dd>
            <dd className="mt-2">
              <progress className="milestone-meter" aria-labelledby="spend-progress" value={dashboard.milestoneSpendSyp} max={dashboard.milestoneSpendRequiredSyp} />
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="purchases-title" className="surface overflow-hidden">
        <div className="border-b border-rule px-5 py-4 sm:px-6">
          <h2 id="purchases-title" className="text-xl font-bold">المشتريات المسجّلة</h2>
          <p className="mt-1 text-sm text-muted">إجمالي المشتريات: {formatNumber(dashboard.verifiedPurchaseCount)}</p>
        </div>
        {purchases.items.length === 0 ? (
          <p className="px-5 py-5 leading-7 text-muted sm:px-6">
            {purchases.total === 0 ? "ستظهر مشترياتك هنا بعد أن يؤكد التاجر استخدام بطاقة الخصم." : "لا توجد مشتريات في هذه الصفحة."}
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {purchases.items.map((purchase) => (
              <li key={purchase.saleId} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6 sm:px-6">
                <div className="min-w-0">
                  <p className="font-semibold wrap-break-word">{purchase.productName}</p>
                  <p className="mt-1 text-sm text-muted">{purchase.shopName} · {formatDate(purchase.scannedAt)}</p>
                </div>
                <div className="text-sm tabular-nums sm:text-end">
                  <p className="font-semibold">المدفوع: {formatSyp(purchase.customerPaidCashSyp)}</p>
                  <p className="mt-1 text-success">الكاش باك: {formatSyp(purchase.cashbackEarnedSyp)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(purchases.previousPage !== null || purchases.nextPage !== null) && (
          <nav aria-label="صفحات المشتريات" className="flex flex-wrap gap-3 border-t border-rule px-5 py-4 sm:px-6">
            {purchases.previousPage !== null && <Link className="button-secondary" href={`/customer?page=${purchases.previousPage}`}>الصفحة السابقة</Link>}
            {purchases.nextPage !== null && <Link className="button-secondary" href={`/customer?page=${purchases.nextPage}`}>الصفحة التالية</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}
