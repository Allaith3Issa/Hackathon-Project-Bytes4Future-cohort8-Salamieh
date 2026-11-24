import Link from "@/components/localized-link";
import { CampaignImage } from "@/components/campaign-image";
import { ReferralActions } from "@/components/referral-actions";
import type { Page } from "@/lib/contract";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import {
  campaignJoinModes, campaignPageHref, campaignTypes, discoverCampaignsPath, marketerCampaignDetailPath, membershipStatuses, publicReferral,
  type CampaignListPath, type DiscoverableCampaign, type MarketerMembership,
} from "@/lib/marketer-campaigns";
import { fieldClass, statusLabels } from "@/lib/staff-ui";

type I18n = Awaited<ReturnType<typeof getI18n>>;

export function CampaignFilters({ path, query, i18n }: { path: CampaignListPath; query: URLSearchParams; i18n: I18n }) {
  const { locale, t } = i18n;
  const discover = path === discoverCampaignsPath;
  const filters = discover
    ? [{ key: "campaignType", options: campaignTypes }, { key: "joinMode", options: campaignJoinModes }] as const
    : [{ key: "status", options: membershipStatuses }] as const;
  const pageSize = query.get("pageSize");
  return (
    <form method="get" action={localizedPath(path, locale)} className="surface grid gap-4 p-4 sm:grid-cols-2 sm:items-end sm:p-5 lg:flex lg:flex-wrap">
      {pageSize && <input type="hidden" name="pageSize" value={pageSize} />}
      {discover && (
        <label className="grid min-w-0 gap-1.5 sm:col-span-2 lg:min-w-52 lg:flex-1">
          {t("marketerCampaigns.search")}
          <input type="search" name="q" maxLength={100} defaultValue={query.get("q") ?? ""} placeholder={t("marketerCampaigns.searchPlaceholder")} />
        </label>
      )}
      {filters.map(({ key, options }) => (
        <label key={key} className="grid min-w-0 gap-1.5">
          {t(`marketerCampaigns.${key}`)}
          <select name={key} defaultValue={query.get(key) ?? (discover ? "" : "approved")} className={fieldClass}>
            <option value={discover ? "" : "all"}>{t("marketerCampaigns.all")}</option>
            {options.map((option) => <option key={option} value={option}>{t(`marketerCampaigns.${option}`)}</option>)}
          </select>
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="button-primary">{t("marketerCampaigns.apply")}</button>
        <Link href={path} className="button-secondary">{t("marketerCampaigns.clear")}</Link>
      </div>
    </form>
  );
}

export function CampaignCard({ campaign, membership, membershipStatus = membership?.status, membershipKnown, i18n, details = false, unavailable = false }: {
  campaign: DiscoverableCampaign;
  membership?: MarketerMembership;
  membershipStatus?: MarketerMembership["status"];
  membershipKnown?: boolean;
  i18n: I18n;
  details?: boolean;
  unavailable?: boolean;
}) {
  const { t, formatSyp, formatDate, formatNumber, formatPercent } = i18n;
  const commission = campaign.commission.type === "fixed"
    ? formatSyp(campaign.commission.amountSyp)
    : formatPercent(campaign.commission.percent);
  const referral = membership?.status === "approved"
    ? publicReferral(membership.referralUrl)
    : null;
  const Title = details ? "h1" : "h2";
  const hasEnded = campaign.status === "ended" || Date.parse(campaign.endsAt) <= Date.now();
  const canJoin = membershipKnown && !hasEnded && campaign.joinMode === "open" && (!membershipStatus || membershipStatus === "rejected");
  const detailPath = marketerCampaignDetailPath(campaign.id);
  return (
    <article className="surface flex h-full min-w-0 flex-col gap-4 p-5 sm:p-6">
      <CampaignImage url={campaign.imageUrl} alt={campaign.productName} className="aspect-[16/9] w-full rounded-lg bg-mauve object-cover"
        fallback={<div className="grid aspect-[16/9] place-items-center rounded-lg bg-mauve p-4 text-center text-sm text-muted">{t("productImage.unavailable")}</div>} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted wrap-anywhere"><bdi>{campaign.shopName}</bdi></p>
          <Title className={`${details ? "page-title" : "text-xl font-bold"} mt-1 wrap-anywhere`}><bdi>{campaign.productName}</bdi></Title>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-sm font-semibold ${membershipStatus === "approved" ? "bg-success-bg text-success" : "bg-mauve text-ink"}`}>
          {membershipStatus ? t(`marketerCampaigns.${membershipStatus}`) : t(`marketerCampaigns.${campaign.joinMode}`)}
        </span>
      </div>
      {campaign.description && <p className="leading-7 text-muted wrap-anywhere"><bdi>{campaign.description}</bdi></p>}
      <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-rule pt-3 text-sm">
        <div>
          <dt className="text-muted">{campaign.finalPriceSyp === null ? t("offers.discount") : t("offers.discountedPrice")}</dt>
          <dd className="mt-1 font-bold wrap-anywhere"><bdi>{campaign.finalPriceSyp === null ? formatPercent(campaign.discountPercent) : formatSyp(campaign.finalPriceSyp)}</bdi></dd>
        </div>
        {campaign.originalPriceSyp !== null && <div><dt className="text-muted">{t("offers.originalPrice")}</dt><dd><bdi>{formatSyp(campaign.originalPriceSyp)}</bdi></dd></div>}
        {campaign.finalPriceSyp !== null && <div><dt className="text-muted">{t("offers.discount")}</dt><dd><bdi>{formatPercent(campaign.discountPercent)}</bdi></dd></div>}
        <div>
          <dt className="text-muted">{t("marketerCampaigns.commission")}</dt>
          <dd className="mt-1 font-bold wrap-anywhere"><bdi>{commission}</bdi></dd>
        </div>
        <div>
          <dt className="text-muted">{t("marketerCampaigns.campaignType")}</dt>
          <dd className="mt-1 font-semibold">{t(`marketerCampaigns.${campaign.campaignType}`)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("offers.offerEnds")}</dt>
          <dd className="mt-1 font-semibold"><time dateTime={campaign.endsAt}>{formatDate(campaign.endsAt)}</time></dd>
        </div>
      </dl>
      {membership && (
        <>
          <dl className="grid grid-cols-2 gap-3 border-t border-rule pt-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">{t("merchantReporting.referralClicks")}</dt><dd className="font-bold"><bdi>{formatNumber(membership.stats.clicks)}</bdi></dd></div>
            <div><dt className="text-muted">{t("marketerCampaigns.itemsSold")}</dt><dd className="font-bold"><bdi>{formatNumber(membership.stats.itemsSold)}</bdi></dd></div>
            <div><dt className="text-muted">{t("earnings.commissionEarned")}</dt><dd className="font-bold wrap-anywhere"><bdi>{formatSyp(membership.stats.earnedSyp)}</bdi></dd></div>
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted">{t(hasEnded ? statusLabels.ended : unavailable ? "marketerCampaigns.unavailable" : statusLabels[campaign.status])}</span>
          </div>
          {referral && <ReferralActions url={referral} ended={unavailable || hasEnded} />}
        </>
      )}
      {!details && (
        <div className="flex flex-wrap gap-2">
          <Link href={detailPath} className="button-secondary">{t("campaigns.campaignDetails")}</Link>
          {canJoin && <Link href={`${detailPath}#join-campaign`} className="button-primary">{t(membershipStatus === "rejected" ? "marketerCampaigns.rejoin" : "marketerCampaigns.join")}</Link>}
        </div>
      )}
    </article>
  );
}

export function CampaignPagination({ path, query, result, i18n }: {
  path: CampaignListPath;
  query: URLSearchParams;
  result: Page<unknown>;
  i18n: I18n;
}) {
  const { t, formatNumber } = i18n;
  const last = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (!result.previousPage && !result.nextPage) return null;
  return (
    <nav aria-label={t("marketerCampaigns.pages")} className="flex flex-wrap items-center gap-3">
      {result.previousPage && <Link href={campaignPageHref(path, query, Math.min(last, result.previousPage))} className="button-secondary">{t("common.previousPage")}</Link>}
      <span className="text-sm font-semibold text-muted">{t("verification.page", { page: formatNumber(result.page) })}</span>
      {result.nextPage && <Link href={campaignPageHref(path, query, result.nextPage)} className="button-secondary">{t("common.nextPage")}</Link>}
    </nav>
  );
}
