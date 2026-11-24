import type { Metadata } from "next";
import { PayoutList, PayoutNavigation } from "@/components/payout-list";
import { WithdrawalRequest } from "@/components/withdrawal-request";
import { RecoveringSession } from "@/components/recovering-session";
import type { Page } from "@/lib/contract";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { payoutListQuery, payoutPage, payoutStatus, type Payout, type PayoutMovement, type PayoutSearchParams } from "@/lib/payouts";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import type { MarketerWallet } from "@/lib/staff-contract";
import { staffError } from "@/lib/staff-ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("earnings.marketerTitle") };
}

const path = "/marketer/earnings";

export default async function MarketerEarningsPage({ searchParams }: { searchParams: Promise<PayoutSearchParams> }) {
  const account = await requirePageRole("marketer");
  if (!account) return <RecoveringSession />;
  const i18n = await getI18n();
  const { t, locale, formatSyp, formatDate } = i18n;
  const incoming = await searchParams;
  const status = payoutStatus(incoming.status);
  const page = payoutPage(incoming.page);
  const activityPage = payoutPage(incoming.activityPage);
  const [wallet, payouts, ledger] = await Promise.allSettled([
    authenticatedRequest<MarketerWallet>("/marketer/wallet"),
    authenticatedRequest<Page<Payout>>(`/marketer/payouts?${payoutListQuery(page, status)}`),
    authenticatedRequest<Page<PayoutMovement>>(`/marketer/wallet/transactions?${payoutListQuery(activityPage)}`),
  ]);
  for (const result of [wallet, payouts, ledger]) {
    if (result.status === "rejected") await expiredRedirect(result.reason, "marketer");
  }
  const href = (history: number, activity: number, anchor: string) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (history > 1) query.set("page", String(history));
    if (activity > 1) query.set("activityPage", String(activity));
    return `${path}${query.size ? `?${query}` : ""}#${anchor}`;
  };

  return (
    <div className="page-wrap max-w-3xl space-y-6 py-7 sm:py-12">
      <header>
        <h1 className="page-title">{t("earnings.marketerTitle")}</h1>
        <p className="mt-2 max-w-prose leading-7 text-muted">{t("earnings.marketerIntro")}</p>
      </header>
      {wallet.status === "fulfilled" ? (
        <>
          <dl className="surface grid overflow-hidden sm:grid-cols-2">
            {([
              ["earnings.availableBalance", wallet.value.availableBalanceSyp, "bg-ink text-white"],
              ["payouts.pendingBalance", wallet.value.pendingPayoutSyp, "bg-mauve"],
              ["earnings.totalCommission", wallet.value.totalEarnedSyp, "border-t border-rule"],
              ["payouts.completedBalance", wallet.value.totalConfirmedPaidOutSyp, "border-t border-rule"],
            ] as const).map(([label, amount, style]) => (
              <div key={label} className={`min-w-0 p-5 sm:p-6 ${style}`}>
                <dt className="text-sm font-semibold">{t(label)}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums wrap-anywhere"><bdi>{formatSyp(amount)}</bdi></dd>
              </div>
            ))}
          </dl>
          <WithdrawalRequest key={account.id} accountId={account.id} balance={wallet.value.availableBalanceSyp}
            pendingBalance={wallet.value.pendingPayoutSyp} available={payouts.status === "fulfilled"} />
        </>
      ) : (
        <>
          <p role="alert" className="notice-error">{staffError(wallet.reason, t)}</p>
          <a href={localizedPath(href(page, activityPage, "main-content"), locale)} className="button-secondary">{t("common.tryAgain")}</a>
        </>
      )}
      <PayoutList path={path} status={status} activityPage={activityPage} pageHref={(next) => href(next, activityPage, "payout-history")}
        i18n={i18n} data={payouts.status === "fulfilled" ? payouts.value : undefined}
        error={payouts.status === "rejected" ? staffError(payouts.reason, t) : undefined} />
      <section id="wallet-activity" aria-labelledby="wallet-activity-title" className="surface scroll-mt-4">
        <h2 id="wallet-activity-title" className="border-b border-rule px-5 py-4 text-xl font-bold">{t("payouts.activity")}</h2>
        {ledger.status === "rejected" ? (
          <div className="p-5">
            <p role="alert" className="notice-error">{staffError(ledger.reason, t)}</p>
            <a href={localizedPath(href(page, activityPage, "wallet-activity"), locale)} className="button-secondary mt-3">{t("common.tryAgain")}</a>
          </div>
        ) : (
          <>
            {ledger.value.items.length ? <ul role="list" className="divide-y divide-rule">
              {ledger.value.items.map((movement) => (
                <li key={movement.id} className="flex flex-wrap justify-between gap-2 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{t(`payouts.${movement.kind}`)}</p>
                    {(movement.campaignName || movement.shopName) && (
                      <p className="text-sm text-muted wrap-anywhere"><bdi>{[movement.campaignName, movement.shopName].filter(Boolean).join(" · ")}</bdi></p>
                    )}
                    <time dateTime={movement.createdAt} className="text-sm text-muted">{formatDate(movement.createdAt)}</time>
                  </div>
                  <bdi className="font-bold tabular-nums wrap-anywhere">{formatSyp(movement.amountSyp)}</bdi>
                </li>
              ))}
            </ul> : <p className="p-5 text-muted">{t("payouts.emptyActivity")}</p>}
            <PayoutNavigation data={ledger.value} i18n={i18n} href={(next) => href(page, next, "wallet-activity")} />
          </>
        )}
      </section>
    </div>
  );
}
