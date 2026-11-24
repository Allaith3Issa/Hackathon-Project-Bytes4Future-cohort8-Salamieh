import type { Metadata } from "next";
import { MarketerCampaignsPage } from "@/components/marketer-campaigns-page";
import { getI18n } from "@/lib/i18n-server";
import { discoverCampaignsPath, type CampaignSearchParams } from "@/lib/marketer-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("marketerCampaigns.discover") };
}

export default async function DiscoverCampaignsPage({ searchParams }: { searchParams: Promise<CampaignSearchParams> }) {
  return <MarketerCampaignsPage path={discoverCampaignsPath} searchParams={await searchParams} />;
}
