import type { Metadata } from "next";
import { CampaignForm } from "@/components/campaign-form";
import { requireRole } from "@/lib/staff";

export const metadata: Metadata = { title: "حملة جديدة" };

export default async function NewCampaign() {
  await requireRole("merchant");
  return (
    <div className="page-wrap space-y-6 py-7 sm:py-12">
      <h1 className="page-title">حملة جديدة</h1>
      <CampaignForm />
    </div>
  );
}
