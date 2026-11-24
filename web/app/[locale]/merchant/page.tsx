import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { MerchantBalances } from "@/components/merchant-balances";
import { RecoveringSession } from "@/components/recovering-session";
import { ApiError } from "@/lib/api";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import type { MerchantDashboard } from "@/lib/staff-contract";
import { staffError } from "@/lib/staff-ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("navigation.merchantDashboard") };
}

export default async function MerchantIndex() {
  if (!(await requirePageRole("merchant"))) return <RecoveringSession />;
  const { t, locale, formatNumber, formatSyp, formatPercent } = await getI18n();
  let dashboard: MerchantDashboard;
  try {
    dashboard = await authenticatedRequest<MerchantDashboard>("/merchant/dashboard");
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    await expiredRedirect(error, "merchant");
    return (
      <div className="page-wrap space-y-4 py-7 sm:py-12">
        <h1 className="page-title">{t("navigation.merchantDashboard")}</h1>
        <p role="alert" className="notice-error">{staffError(error, t)}</p>
        <a href={localizedPath("/merchant", locale)} className="button-secondary">{t("common.tryAgain")}</a>
      </div>
    );
  }

  const { stats, topCampaign } = dashboard;
  const metrics = [
    [t("merchantReporting.activeCampaigns"), formatNumber(dashboard.activeCampaignsCount)],
    [t("merchantReporting.settledSales"), formatNumber(stats.salesCount)],
    [t("merchantReporting.grossCashSales"), formatSyp(stats.grossCashSalesSyp)],
    [t("merchantReporting.referralClicks"), formatNumber(stats.clicks)],
    [t("merchantReporting.conversionRate"), formatPercent(stats.conversionRatePercent)],
  ];

  return (
    <div className="page-wrap max-w-4xl space-y-6 py-7 sm:py-12">
      <header className="space-y-2">
        <h1 className="page-title">{t("navigation.merchantDashboard")}</h1>
        <p className="text-sm text-muted">{t("merchantReporting.verificationStatus")}{" "}
          <strong className="text-ink">{t(`verification.${dashboard.verificationStatus}`)}</strong>
        </p>
      </header>
      <MerchantBalances wallet={dashboard.wallet} />
      <section className="surface space-y-4 p-5 sm:p-7" aria-labelledby="merchant-performance">
        <h2 id="merchant-performance" className="text-xl font-bold">{t("merchantReporting.performance")}</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {metrics.map(([label, value]) => (
            <div className="min-w-0 border-t border-rule pt-3" key={label}>
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 font-bold tabular-nums wrap-anywhere"><bdi>{value}</bdi></dd>
            </div>
          ))}
        </dl>
        {topCampaign && (
          <p className="border-t border-rule pt-3 text-sm text-muted">
            {t("merchantReporting.topCampaign")}{" "}
            <Link className="text-link wrap-anywhere" href={`/merchant/campaigns/${encodeURIComponent(topCampaign.campaignId)}`}>{topCampaign.productName}</Link>
          </p>
        )}
      </section>
    </div>
  );
}
