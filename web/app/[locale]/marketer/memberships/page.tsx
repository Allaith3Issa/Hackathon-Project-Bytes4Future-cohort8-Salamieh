import type { Metadata } from "next";
import { MarketerCampaignsPage } from "@/components/marketer-campaigns-page";
import { getI18n } from "@/lib/i18n-server";
import { marketerMembershipsPath, type CampaignSearchParams } from "@/lib/marketer-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("marketerCampaigns.mine") };
}

export default async function MyCampaignsPage({ searchParams }: { searchParams: Promise<CampaignSearchParams> }) {
  return <MarketerCampaignsPage path={marketerMembershipsPath} searchParams={await searchParams} />;
}
