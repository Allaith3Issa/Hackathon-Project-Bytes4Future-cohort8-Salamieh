import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { CampaignForm } from "@/components/campaign-form";
import { RecoveringSession } from "@/components/recovering-session";
import { requirePageRole } from "@/lib/staff";
import { campaignFormSession } from "@/lib/campaign-upload";
import { campaignAction } from "@/app/staff-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("campaigns.newCampaign") };
}

export default async function NewCampaign() {
  const { t } = await getI18n();
  const merchant = await requirePageRole("merchant");
  if (!merchant) return <RecoveringSession />;
  const session = await campaignFormSession(merchant.id);
  if (!session) return <p className="page-wrap notice-error my-6">{t("productImage.sessionChanged")}</p>;
  return (
    <div className="page-wrap space-y-6 py-7 sm:py-12">
      <h1 className="page-title">{t("campaigns.newCampaign")}</h1>
      <CampaignForm key={session.scope} submitCampaign={campaignAction.bind(null, session.scope)} />
    </div>
  );
}
