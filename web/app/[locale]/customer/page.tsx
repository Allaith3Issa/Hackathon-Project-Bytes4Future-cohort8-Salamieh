import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { RecoveringSession } from "@/components/recovering-session";
import type { CustomerDashboard, CustomerPurchase, Page } from "@/lib/contract";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import { errorMessage } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("common.cashback") };
}

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t, locale, formatSyp, formatNumber, formatDate } = await getI18n();
  if (!(await requirePageRole("customer"))) return <RecoveringSession />;

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
    await expiredRedirect(error, "customer");
    return (
      <div className="page-wrap py-12">
        <h1 className="page-title">{t("common.cashback")}</h1>
        <p role="alert" className="notice-error mt-4 max-w-lg">{errorMessage(error, t)}</p>
        <a href={localizedPath(`/customer?page=${purchasePage}`, locale)} className="button-secondary mt-4">{t("common.tryAgain")}</a>
      </div>
    );
  }

  return (
    <div className="page-wrap space-y-6 py-7 sm:space-y-8 sm:py-12">
      <h1 className="page-title">{t("common.cashback")}</h1>
      <dl className="grid overflow-hidden rounded-xl border border-rule sm:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-ink p-5 text-white sm:p-7">
          <dt className="text-sm font-semibold">{t("customer.availableBalance")}</dt>
          <dd className="mt-3 text-3xl font-bold leading-tight tabular-nums sm:text-4xl">{formatSyp(dashboard.availableCashbackSyp)}</dd>
        </div>
        <div className="bg-mauve p-5 sm:p-7">
          <dt className="text-sm font-semibold">{t("customer.lockedBalance")}</dt>
          <dd className="mt-3 text-2xl font-bold leading-tight tabular-nums sm:text-3xl">{formatSyp(dashboard.lockedCashbackSyp)}</dd>
          <dd className="mt-1 text-sm text-muted">{t("customer.thisBalanceBecomesAvailableWhenYou")}</dd>
        </div>
      </dl>
      <section aria-labelledby="milestone-title" className="surface p-5 sm:p-6">
        <h2 id="milestone-title" className="text-xl font-bold">{t("customer.progressTowardUnlockingCashback")}</h2>
        <p className="mt-1 text-sm leading-7 text-muted">{t("customer.toUnlockCashbackReachBothThe")}</p>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <dt id="purchase-progress" className="text-muted">{t("customer.purchasesThisCycle")}</dt>
            <dd className="mt-1 font-semibold">{t("customer.progress", { current: formatNumber(dashboard.milestonePurchaseCount), total: formatNumber(dashboard.milestonePurchasesRequired) })}</dd>
            <dd className="mt-2">
              <progress className="milestone-meter" aria-labelledby="purchase-progress" value={dashboard.milestonePurchaseCount} max={dashboard.milestonePurchasesRequired} />
            </dd>
          </div>
          <div>
            <dt id="spend-progress" className="text-muted">{t("customer.spendingThisCycle")}</dt>
            <dd className="mt-1 font-semibold">{t("customer.progress", { current: formatSyp(dashboard.milestoneSpendSyp), total: formatSyp(dashboard.milestoneSpendRequiredSyp) })}</dd>
            <dd className="mt-2">
              <progress className="milestone-meter" aria-labelledby="spend-progress" value={dashboard.milestoneSpendSyp} max={dashboard.milestoneSpendRequiredSyp} />
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="purchases-title" className="surface overflow-hidden">
        <div className="border-b border-rule px-5 py-4 sm:px-6">
          <h2 id="purchases-title" className="text-xl font-bold">{t("customer.purchaseHistory")}</h2>
          <p className="mt-1 text-sm text-muted">{t("customer.totalPurchases")}{" "}{formatNumber(dashboard.verifiedPurchaseCount)}</p>
        </div>
        {purchases.items.length === 0 ? (
          <p className="px-5 py-5 leading-7 text-muted sm:px-6">
            {purchases.total === 0 ? t("customer.yourPurchasesWillAppearHereAfter") : t("customer.thereAreNoPurchasesOnThis")}
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
                  <p className="font-semibold">{t("customer.paid")}{" "}{formatSyp(purchase.customerPaidCashSyp)}</p>
                  <p className="mt-1 text-success">{t("customer.cashback")}{" "}{formatSyp(purchase.cashbackEarnedSyp)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(purchases.previousPage !== null || purchases.nextPage !== null) && (
          <nav aria-label={t("customer.purchaseHistoryPages")} className="flex flex-wrap gap-3 border-t border-rule px-5 py-4 sm:px-6">
            {purchases.previousPage !== null && <Link className="button-secondary" href={`/customer?page=${purchases.previousPage}`}>{t("common.previousPage")}</Link>}
            {purchases.nextPage !== null && <Link className="button-secondary" href={`/customer?page=${purchases.nextPage}`}>{t("common.nextPage")}</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}
