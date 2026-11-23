import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { CampaignForm } from "@/components/campaign-form";
import { RecoveringSession } from "@/components/recovering-session";
import { requirePageRole } from "@/lib/staff";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("campaigns.newCampaign") };
}

export default async function NewCampaign() {
  const { t } = await getI18n();
  if (!(await requirePageRole("merchant"))) return <RecoveringSession />;
  return (
    <div className="page-wrap space-y-6 py-7 sm:py-12">
      <h1 className="page-title">{t("campaigns.newCampaign")}</h1>
      <CampaignForm />
    </div>
  );
}
