import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { authenticatedRequest } from "@/lib/session";
import { RecoveringSession } from "@/components/recovering-session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import type { MerchantCampaign, Page } from "@/lib/staff-contract";
import { staffError, statusLabels } from "@/lib/staff-ui";
import { CampaignImage } from "@/components/campaign-image";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("campaigns.myCampaigns") };
}

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { t, locale, formatDate, formatSyp: formatMoney } = await getI18n();
  if (!(await requirePageRole("merchant"))) return <RecoveringSession />;
  const { page } = await searchParams;
  const n = typeof page === "string" && /^[1-9][0-9]{0,7}$/.test(page) ? page : "1";
  let data: Page<MerchantCampaign>;
  try {
    data = await authenticatedRequest<Page<MerchantCampaign>>(`/merchant/campaigns?page=${n}`);
  } catch (error) {
    await expiredRedirect(error, "merchant");
    return (
      <div className="page-wrap space-y-4 py-7 sm:py-12">
        <h1 className="page-title">{t("campaigns.myCampaigns")}</h1>
        <p role="alert" className="notice-error max-w-lg">{staffError(error, t)}</p>
        <a href={localizedPath(`/merchant/campaigns?page=${n}`, locale)} className="button-secondary">{t("common.tryAgain")}</a>
      </div>
    );
  }
  return (
    <div className="page-wrap space-y-6 py-7 sm:py-12">
      <h1 className="page-title">{t("campaigns.myCampaigns")}</h1>
      {data.items.length === 0 ? (
        <p className="notice">{t("campaigns.thereAreNoCampaignsYet")}{" "}<Link className="text-link" href="/merchant/campaigns/new">{t("campaigns.launchYourFirstCampaign")}</Link>.</p>
      ) : (
        <ul className="surface divide-y divide-rule overflow-hidden">
          {data.items.map((c) => (
            <li key={c.id}>
              <Link href={`/merchant/campaigns/${encodeURIComponent(c.id)}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-mauve">
                <span className="flex min-w-0 items-center gap-3">
                  <CampaignImage url={c.imageUrl} alt="" className="size-14 shrink-0 rounded-lg bg-mauve object-cover"
                    fallback={<span aria-hidden="true" className="size-14 shrink-0 rounded-lg bg-mauve" />} />
                  <span className="min-w-0"><span className="block font-semibold wrap-anywhere">{c.productName}</span><span className="text-sm text-muted">{t("campaigns.ends")}{" "}{formatDate(c.endsAt)}</span></span>
                </span>
                <span className="text-sm tabular-nums">{c.finalPriceSyp === null ? "" : `${formatMoney(c.finalPriceSyp)} · `}{t(statusLabels[c.status])}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(data.previousPage !== null || data.nextPage !== null) && (
        <nav aria-label={t("campaigns.campaignPages")} className="flex gap-3">
          {data.previousPage !== null && <Link className="button-secondary" href={`/merchant/campaigns?page=${data.previousPage}`}>{t("common.previousPage")}</Link>}
          {data.nextPage !== null && <Link className="button-secondary" href={`/merchant/campaigns?page=${data.nextPage}`}>{t("common.nextPage")}</Link>}
        </nav>
      )}
    </div>
  );
}
