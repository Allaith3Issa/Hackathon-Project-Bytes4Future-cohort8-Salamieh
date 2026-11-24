import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { notFound } from "next/navigation";
import { CloseCampaign } from "@/components/close-campaign";
import { RecoveringSession } from "@/components/recovering-session";
import { ApiError } from "@/lib/api";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import type { MerchantCampaign, MerchantWallet, MerchantWalletTransaction, Page } from "@/lib/staff-contract";
import { staffError, statusLabels } from "@/lib/staff-ui";
import { CampaignImage } from "@/components/campaign-image";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("campaigns.campaignDetails") };
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale, formatNumber, formatSyp: formatMoney, formatDate } = await getI18n();
  if (!(await requirePageRole("merchant"))) return <RecoveringSession />;
  const { id } = await params;
  if (!/^[0-9a-f-]{8,64}$/i.test(id)) notFound();
  let c: MerchantCampaign;
  try {
    c = await authenticatedRequest<MerchantCampaign>(`/merchant/campaigns/${encodeURIComponent(id)}`);
  } catch (error) {
    await expiredRedirect(error, "merchant");
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <div className="page-wrap space-y-4 py-7 sm:py-12">
        <h1 className="page-title">{t("campaigns.campaignDetails")}</h1>
        <p role="alert" className="notice-error max-w-lg">{staffError(error, t)}</p>
        <a href={localizedPath(`/merchant/campaigns/${encodeURIComponent(id)}`, locale)} className="button-secondary">{t("common.tryAgain")}</a>
      </div>
    );
  }
  const u = c.usage;
  const stats: [string, string][] = [
    [t("campaigns.itemsSold"), u.maxItems === null ? formatNumber(u.itemsSold) : t("campaigns.ofTotal", { value0: formatNumber(u.itemsSold), value1: formatNumber(u.maxItems) })],
    [t("campaigns.commissionsPaid"), formatMoney(u.commissionsPaidSyp)], [t("campaigns.platformFeesPaid"), formatMoney(u.platformFeesPaidSyp)],
    [t("campaigns.maximumReserve"), formatMoney(u.worstCaseReserveSyp)],
  ];
  return (
    <div className="page-wrap space-y-6 py-7 sm:py-12">
      <div>
        <h1 className="page-title">{c.productName}</h1>
        <p className="mt-1 text-muted">{t(statusLabels[c.status])}{" "}{t("campaigns.ends2")}{" "}{formatDate(c.endsAt)}</p>
      </div>
      <CampaignImage url={c.imageUrl} alt={c.productName} className="aspect-[4/3] w-full max-w-sm rounded-xl bg-mauve object-cover"
        fallback={<div className="notice max-w-sm">{t("productImage.unavailable")}</div>} />
      <dl className="stamp-depth grid overflow-hidden rounded-xl border border-rule sm:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-ink p-5 text-white sm:p-7">
          <dt className="text-sm font-semibold">{t("campaigns.currentLockedReserve")}</dt>
          <dd className="mt-3 text-3xl font-bold tabular-nums sm:text-4xl">{formatMoney(u.lockedBudgetSyp)}</dd>
        </div>
        <div className="bg-mauve p-5 sm:p-7">
          <dt className="text-sm font-semibold">{t("campaigns.customerSalePrice")}</dt>
          <dd className="mt-3 text-2xl font-bold tabular-nums">{c.finalPriceSyp === null ? "—" : formatMoney(c.finalPriceSyp)}</dd>
        </div>
      </dl>
      <dl className="surface grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        {stats.map(([l, v]) => <div key={l}><dt className="text-sm text-muted">{l}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}
      </dl>
      <section className="surface grid gap-3 p-5 sm:p-6" aria-labelledby="close-title">
        <h2 id="close-title" className="text-xl font-bold">{t("campaigns.closeCampaign")}</h2>
        {c.status === "ended" ? <ClosedCampaignDetails id={c.id} /> : <CloseCampaign id={c.id} />}
      </section>
      <Link href="/merchant/campaigns" className="text-link">{t("campaigns.allCampaigns")}</Link>
    </div>
  );
}

async function ClosedCampaignDetails({ id }: { id: string }) {
  const { t, formatSyp } = await getI18n();
  const [wallet, ledger] = await Promise.allSettled([
    authenticatedRequest<MerchantWallet>("/merchant/wallet"),
    authenticatedRequest<Page<MerchantWalletTransaction>>("/merchant/wallet/transactions"),
  ]);
  const release = ledger.status === "fulfilled"
    ? ledger.value.items.find((line) => line.kind === "campaign_reserve_unlock" && line.campaignId === id)
    : undefined;

  return (
    <>
      <p className="notice">{t("campaigns.thisCampaignHasEndedAndThe")}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">{t("earnings.availableBalance")}</dt>
          <dd className="font-semibold tabular-nums">
            {wallet.status === "fulfilled" ? <bdi>{formatSyp(wallet.value.availableBalanceSyp)}</bdi> : t("merchantReporting.walletUnavailable")}
          </dd>
        </div>
        {release && (
          <div>
            <dt className="text-sm text-muted">{t("merchantReporting.reserveReleased")}</dt>
            <dd className="font-semibold tabular-nums"><bdi>{formatSyp(release.amountSyp)}</bdi></dd>
          </div>
        )}
      </dl>
      <Link className="text-link" href="/merchant/wallet#wallet-history">{t("merchantReporting.walletHistory")}</Link>
    </>
  );
}
