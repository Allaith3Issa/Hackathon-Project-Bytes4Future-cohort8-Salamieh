import type { ReactNode } from "react";
import { StaffNav } from "@/components/staff-nav";
import { getI18n } from "@/lib/i18n-server";
import { discoverCampaignsPath, marketerMembershipsPath } from "@/lib/marketer-campaigns";
import { getAccount } from "@/lib/session";

export default async function MarketerLayout({ children }: { children: ReactNode }) {
  const account = await getAccount();
  const { t } = await getI18n();
  return (
    <>
      {account?.roles.includes("marketer") && (
        <StaffNav label={t("marketerCampaigns.navigation")} items={[
          [discoverCampaignsPath, t("marketerCampaigns.discover")],
          [marketerMembershipsPath, t("marketerCampaigns.mine")],
          ["/marketer/earnings", t("earnings.marketerTitle")],
        ]} />
      )}
      {children}
    </>
  );
}
