import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { RecoveringSession } from "@/components/recovering-session";
import { ApiError } from "@/lib/api";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import type { AdminMarketerEarnings, AdminRevenueSummary, Page } from "@/lib/staff-contract";
import { staffError } from "@/lib/staff-ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("earnings.dashboardTitle") };
}

const path = "/admin/revenue";
const pageHref = (page: number) => page === 1 ? path : `${path}?page=${page}`;
const columns = "md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.8fr)_minmax(0,1.1fr)]";

async function readReport<T>(endpoint: `/${string}`) {
  try {
    return { data: await authenticatedRequest<T>(endpoint) };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    await expiredRedirect(error, "admin");
    return { error };
  }
}

export default async function RevenueDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  if (!(await requirePageRole("admin"))) return <RecoveringSession />;
  const { t, locale, formatNumber, formatSyp } = await getI18n();
  const { page: requestedPage } = await searchParams;
  const page = typeof requestedPage === "string" && /^[1-9][0-9]{0,7}$/.test(requestedPage)
    ? Number(requestedPage)
    : 1;
  const [{ data: revenue, error: summaryError }, { data: marketers, error: marketersError }] = await Promise.all([
    readReport<AdminRevenueSummary>(`${path}/summary`),
    readReport<Page<AdminMarketerEarnings>>(`${path}/marketers?page=${page}`),
  ]);
  const lastPage = marketers ? Math.ceil(marketers.total / marketers.pageSize) : 0;
  const labels = [
    t("earnings.marketerName"),
    t("auth.phoneNumber"),
    t("earnings.settledSales"),
    t("earnings.commissionEarned"),
  ];
  const retryHref = localizedPath(pageHref(page), locale);

  return (
    <div className="page-wrap max-w-4xl space-y-6 py-7 sm:py-12">
      <header>
        <h1 className="page-title">{t("earnings.dashboardTitle")}</h1>
      </header>
      {revenue ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <section aria-labelledby="platform-revenue" className="min-w-0 rounded-xl bg-ink p-5 text-white sm:p-7">
            <h2 id="platform-revenue" className="text-lg font-bold">{t("earnings.platformTitle")}</h2>
            <dl className="mt-3">
              <dt className="text-sm font-semibold text-mauve">{t("earnings.netPlatformFees")}</dt>
              <dd className="mt-2 text-3xl font-bold leading-tight tabular-nums wrap-anywhere sm:text-4xl">
                <bdi>{formatSyp(revenue.netPlatformFeesSyp)}</bdi>
              </dd>
            </dl>
            <p className="mt-3 text-sm leading-6 text-mauve">{t("earnings.platformIntro")}</p>
          </section>
          <section aria-labelledby="marketer-commissions" className="surface min-w-0 p-5 sm:p-7">
            <h2 id="marketer-commissions" className="text-lg font-bold">{t("earnings.marketerTitle")}</h2>
            <dl className="mt-3">
              <dt className="text-sm font-semibold text-muted">{t("earnings.totalCommission")}</dt>
              <dd className="mt-2 text-3xl font-bold leading-tight tabular-nums wrap-anywhere sm:text-4xl">
                <bdi>{formatSyp(revenue.totalMarketerCommissionSyp)}</bdi>
              </dd>
            </dl>
            <p className="mt-3 text-sm leading-6 text-muted">{t("earnings.adminMarketerIntro")}</p>
          </section>
        </div>
      ) : (
        <div className="space-y-3">
          <p role="alert" className="notice-error">{staffError(summaryError, t)}</p>
          <a href={retryHref} className="button-secondary">{t("common.tryAgain")}</a>
        </div>
      )}
      <section aria-labelledby="marketer-details" className="surface overflow-hidden">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-4 sm:px-6">
          <h2 id="marketer-details" className="text-xl font-bold">{t("earnings.marketerDetails")}</h2>
          {marketers && (
            <p className="text-sm text-muted">{t("earnings.marketerCount", { count: formatNumber(marketers.total) })}</p>
          )}
        </header>
        {marketers ? (
          <>
            {marketers.items.length > 0 ? (
              <>
                <div aria-hidden="true" className={`hidden gap-4 border-y border-rule bg-mauve/40 px-6 py-3 text-sm font-semibold text-muted md:grid ${columns}`}>
                  {labels.map((label) => <span key={label}>{label}</span>)}
                </div>
                <ul role="list" className="divide-y divide-rule">
                  {marketers.items.map((marketer) => (
                    <li key={marketer.id} className="px-4 py-4 sm:px-6">
                      <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 text-sm ${columns}`}>
                        {[
                          <bdi key="name" className="font-bold">{marketer.name}</bdi>,
                          <bdi key="phone" dir="ltr">{marketer.phone}</bdi>,
                          formatNumber(marketer.salesCount),
                          <bdi key="commission" className="font-bold">{formatSyp(marketer.totalEarnedSyp)}</bdi>,
                        ].map((value, index) => (
                          <div key={labels[index]} className="min-w-0">
                            <dt className="text-xs font-semibold text-muted md:sr-only">{labels[index]}</dt>
                            <dd className="mt-1 tabular-nums wrap-anywhere md:mt-0">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="border-t border-rule px-4 py-5 text-sm text-muted sm:px-6">
                {t(marketers.total ? "earnings.noMarketersOnPage" : "earnings.noMarketers")}
              </p>
            )}
            {lastPage > 0 && (marketers.previousPage || marketers.nextPage) && (
              <nav aria-label={t("earnings.marketerPages")} className="flex flex-wrap items-center gap-3 border-t border-rule px-4 py-4 sm:px-6">
                {marketers.previousPage && (
                  <Link href={pageHref(Math.min(marketers.previousPage, lastPage))} className="button-secondary">
                    {t("common.previousPage")}
                  </Link>
                )}
                <span className="text-sm text-muted">
                  {t("earnings.marketerPage", { page: formatNumber(marketers.page), total: formatNumber(lastPage) })}
                </span>
                {marketers.nextPage && (
                  <Link href={pageHref(marketers.nextPage)} className="button-secondary">{t("common.nextPage")}</Link>
                )}
              </nav>
            )}
          </>
        ) : (
          <div className="space-y-3 border-t border-rule px-4 py-4 sm:px-6">
            <p role="alert" className="notice-error">{staffError(marketersError, t)}</p>
            <a href={retryHref} className="button-secondary">{t("common.tryAgain")}</a>
          </div>
        )}
      </section>
    </div>
  );
}
