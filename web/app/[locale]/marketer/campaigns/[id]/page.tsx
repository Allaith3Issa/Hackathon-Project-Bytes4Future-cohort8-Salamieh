import { notFound } from "next/navigation";
import { joinMarketerCampaign } from "@/app/marketer-actions";
import { JoinMarketerCampaign } from "@/components/join-marketer-campaign";
import Link from "@/components/localized-link";
import { CampaignCard } from "@/components/marketer-campaign-list";
import { RecoveringSession } from "@/components/recovering-session";
import { ApiError } from "@/lib/api";
import { getI18n } from "@/lib/i18n-server";
import { campaignIdPattern, discoverCampaignsPath, marketerCampaignDetailPath, marketerMembershipsPath, type DiscoverableCampaign, type MarketerMembership } from "@/lib/marketer-campaigns";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import { staffError } from "@/lib/staff-ui";

export default async function MarketerCampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const account = await requirePageRole("marketer");
  if (!account) return <RecoveringSession />;
  const { id } = await params;
  if (!campaignIdPattern.test(id)) notFound();
  const i18n = await getI18n();
  const { t } = i18n;
  const [detail, lookup] = await Promise.allSettled([
    authenticatedRequest<DiscoverableCampaign>(`/campaigns/${id}`),
    authenticatedRequest<{ membership: MarketerMembership | null }>(`/marketer/campaigns/${id}/membership`),
  ]);
  const unavailable = detail.status === "rejected" && detail.reason instanceof ApiError && detail.reason.status === 404;
  if (detail.status === "rejected" && !unavailable) await expiredRedirect(detail.reason, "marketer");
  if (lookup.status === "rejected") await expiredRedirect(lookup.reason, "marketer");
  const failure = lookup.status === "rejected" ? lookup.reason
    : detail.status === "rejected" && !unavailable ? detail.reason : undefined;
  if (failure) return (
    <div className="page-wrap space-y-4 py-7 sm:py-10">
      <h1 className="page-title">{t("campaigns.campaignDetails")}</h1>
      <p role="alert" className="notice-error">{staffError(failure, t)}</p>
      <Link className="button-secondary" href={marketerCampaignDetailPath(id)}>{t("common.tryAgain")}</Link>
    </div>
  );
  const membership = lookup.status === "fulfilled" ? lookup.value.membership : null;
  const campaign = detail.status === "fulfilled" ? detail.value : membership?.campaign;
  if (!campaign) return (
    <div className="page-wrap space-y-4 py-7 sm:py-10">
      <h1 className="page-title">{t("campaigns.campaignDetails")}</h1>
      <p className="notice">{t("marketerCampaigns.unavailable")}</p>
      <Link className="button-secondary" href={discoverCampaignsPath}>{t("marketerCampaigns.discover")}</Link>
    </div>
  );
  const canJoin = !unavailable && campaign.status === "active" && campaign.joinMode === "open"
    && (!membership || membership.status === "rejected");
  return (
    <div className="page-wrap max-w-3xl space-y-5 py-7 sm:py-10">
      <Link className="text-link" href={membership ? marketerMembershipsPath : discoverCampaignsPath}>
        {t(membership ? "marketerCampaigns.mine" : "marketerCampaigns.discover")}
      </Link>
      <CampaignCard campaign={campaign} membership={membership ?? undefined} i18n={i18n} details unavailable={unavailable} />
      {canJoin && <JoinMarketerCampaign join={joinMarketerCampaign.bind(null, id, account.id)} resubmitting={membership?.status === "rejected"} />}
      {unavailable && <p className="notice">{t("marketerCampaigns.unavailable")}</p>}
    </div>
  );
}
