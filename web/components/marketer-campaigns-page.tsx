import Link from "@/components/localized-link";
import { CampaignCard, CampaignFilters, CampaignPagination } from "@/components/marketer-campaign-list";
import { RecoveringSession } from "@/components/recovering-session";
import { ApiError } from "@/lib/api";
import type { Page } from "@/lib/contract";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import {
  campaignListQuery, campaignPageHref, discoverCampaignsPath,
  type CampaignListPath, type CampaignSearchParams, type DiscoverableCampaign, type MarketerMembership,
} from "@/lib/marketer-campaigns";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import { staffError } from "@/lib/staff-ui";

export async function MarketerCampaignsPage({ path, searchParams }: {
  path: CampaignListPath;
  searchParams: CampaignSearchParams;
}) {
  if (!(await requirePageRole("marketer"))) return <RecoveringSession />;
  const i18n = await getI18n();
  const { t, locale, formatNumber } = i18n;
  const discover = path === discoverCampaignsPath;
  const raw = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") raw.set(key, value);
  }
  const query = campaignListQuery(raw, path);
  const apiQuery = new URLSearchParams(query);
  if (!apiQuery.has("page")) apiQuery.set("page", "1");
  if (!apiQuery.has("pageSize")) apiQuery.set("pageSize", "20");
  const endpoint = discover ? "/campaigns" : "/marketer/memberships";
  if (!discover) {
    if (!apiQuery.has("status")) apiQuery.set("status", "approved");
    else if (apiQuery.get("status") === "all") apiQuery.delete("status");
  }

  let result: Page<DiscoverableCampaign | MarketerMembership> | undefined;
  let membershipSnapshot: Page<MarketerMembership> | null = null;
  let failure: string | undefined;
  try {
    [result, membershipSnapshot] = await Promise.all([
      authenticatedRequest<Page<DiscoverableCampaign | MarketerMembership>>(`${endpoint}?${apiQuery}`),
      discover ? authenticatedRequest<Page<MarketerMembership>>("/marketer/memberships?page=1&pageSize=100").catch(() => null) : null,
    ]);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    await expiredRedirect(error, "marketer");
    failure = staffError(error, t);
  }
  const memberships = new Map(membershipSnapshot?.items.map((item) => [item.campaign.id, item.status]));

  return (
    <div className="page-wrap space-y-6 py-7 sm:py-10">
      <header>
        <h1 className="page-title">{t(discover ? "marketerCampaigns.discover" : "marketerCampaigns.mine")}</h1>
        <p className="mt-2 max-w-prose leading-7 text-muted">{t(discover ? "marketerCampaigns.discoverIntro" : "marketerCampaigns.mineIntro")}</p>
      </header>
      <CampaignFilters key={query.toString()} path={path} query={query} i18n={i18n} />
      {result ? (
        <section aria-label={t("marketerCampaigns.results")}>
          <p className="mb-3 text-sm font-semibold text-muted">{t("marketerCampaigns.resultCount", { count: formatNumber(result.total) })}</p>
          {result.items.length ? (
            <ul role="list" className="grid gap-4 md:grid-cols-2">
              {result.items.map((item) => (
                <li key={item.id} className="min-w-0">
                  {"campaign" in item
                    ? <CampaignCard campaign={item.campaign} membership={item} i18n={i18n} />
                    : <CampaignCard campaign={item} i18n={i18n} membershipStatus={memberships.get(item.id)}
                        membershipKnown={membershipSnapshot?.nextPage === null} />}
                </li>
              ))}
            </ul>
          ) : (
            <div className="surface space-y-3 p-5">
              <p className="text-muted">{t(result.total ? "marketerCampaigns.emptyPage" : discover ? "marketerCampaigns.noCampaigns" : "marketerCampaigns.noMemberships")}</p>
              {!discover && !result.total && !query.has("status") && (
                <Link href={discoverCampaignsPath} className="button-secondary">{t("marketerCampaigns.discover")}</Link>
              )}
            </div>
          )}
          <div className="mt-4">
            <CampaignPagination path={path} query={query} result={result} i18n={i18n} />
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          <p role="alert" className="notice-error">{failure}</p>
          <a href={localizedPath(campaignPageHref(path, query), locale)} className="button-secondary">{t("common.tryAgain")}</a>
        </div>
      )}
    </div>
  );
}
