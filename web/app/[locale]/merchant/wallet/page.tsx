import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { MerchantBalances } from "@/components/merchant-balances";
import { RecoveringSession } from "@/components/recovering-session";
import { ApiError } from "@/lib/api";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import type { MerchantWallet, MerchantWalletTransaction, Page } from "@/lib/staff-contract";
import { staffError } from "@/lib/staff-ui";

const path = "/merchant/wallet";
const pageLink = (page: number) => page === 1 ? path : `${path}?page=${page}`;
const movementLabels = {
  merchant_topup: "merchantReporting.topUp",
  campaign_reserve_lock: "merchantReporting.reserveLocked",
  campaign_reserve_unlock: "merchantReporting.reserveReleased",
  sale_reserve_debit: "merchantReporting.saleDebit",
  cashback_voucher_merchant_credit: "merchantReporting.voucherCredit",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("merchantReporting.wallet") };
}

export default async function MerchantWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  if (!(await requirePageRole("merchant"))) return <RecoveringSession />;
  const { t, locale, formatDate, formatNumber, formatSyp } = await getI18n();
  const { page: requestedPage } = await searchParams;
  const page = typeof requestedPage === "string" && /^[1-9][0-9]{0,7}$/.test(requestedPage) ? Number(requestedPage) : 1;
  let report: [MerchantWallet, Page<MerchantWalletTransaction>];
  try {
    report = await Promise.all([
      authenticatedRequest<MerchantWallet>(path),
      authenticatedRequest<Page<MerchantWalletTransaction>>(`${path}/transactions?page=${page}`),
    ]);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    await expiredRedirect(error, "merchant");
    return (
      <div className="page-wrap space-y-4 py-7 sm:py-12">
        <h1 className="page-title">{t("merchantReporting.wallet")}</h1>
        <p role="alert" className="notice-error">{staffError(error, t)}</p>
        <a className="button-secondary" href={localizedPath(pageLink(page), locale)}>{t("common.tryAgain")}</a>
      </div>
    );
  }
  const [wallet, ledger] = report;

  return (
    <div className="page-wrap max-w-4xl space-y-6 py-7 sm:py-12">
      <h1 className="page-title">{t("merchantReporting.wallet")}</h1>
      <MerchantBalances wallet={wallet} />
      <section id="wallet-history" className="surface overflow-hidden" aria-labelledby="wallet-history-title">
        <h2 id="wallet-history-title" className="border-b border-rule px-5 py-4 text-xl font-bold sm:px-7">
          {t("merchantReporting.walletHistory")}
        </h2>
        {ledger.items.length ? (
          <ul role="list" className="divide-y divide-rule">
            {ledger.items.map((movement) => (
              <li key={movement.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-7">
                <div className="min-w-0">
                  <p className="font-semibold">{t(movementLabels[movement.kind])}</p>
                  {movement.campaignName && <p className="text-sm text-muted wrap-anywhere">{movement.campaignName}</p>}
                  {movement.referenceNote && <p className="text-sm text-muted wrap-anywhere"><bdi>{movement.referenceNote}</bdi></p>}
                  <time className="text-sm text-muted" dateTime={movement.createdAt}>{formatDate(movement.createdAt)}</time>
                </div>
                <bdi className="min-w-0 font-bold tabular-nums wrap-anywhere">{formatSyp(movement.amountSyp)}</bdi>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-5 text-muted sm:px-7">{t(ledger.total ? "merchantReporting.emptyPage" : "merchantReporting.emptyWallet")}</p>
        )}
        {(ledger.previousPage || ledger.nextPage) && (
          <nav aria-label={t("merchantReporting.walletPages")} className="flex flex-wrap items-center gap-3 border-t border-rule px-5 py-4 sm:px-7">
            {ledger.previousPage && <Link href={pageLink(ledger.previousPage)} className="button-secondary">{t("common.previousPage")}</Link>}
            <span className="text-sm text-muted">{t("verification.page", { page: formatNumber(ledger.page) })}</span>
            {ledger.nextPage && <Link href={pageLink(ledger.nextPage)} className="button-secondary">{t("common.nextPage")}</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}
