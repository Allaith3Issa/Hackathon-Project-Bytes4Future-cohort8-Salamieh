import { getI18n } from "@/lib/i18n-server";
import { StaffNav } from "@/components/staff-nav";
import { getAccount } from "@/lib/session";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const account = await getAccount();
  const merchant = account?.roles.includes("merchant") ? account.merchant : null;
  return (
    <>
      {merchant && (
        <StaffNav label={t("navigation.merchantNavigation")} items={[["/merchant/campaigns/new", t("campaigns.newCampaign")], ["/merchant/campaigns", t("campaigns.myCampaigns")], ["/merchant/scanner", t("navigation.scanner")]]} />
      )}
      {merchant && merchant.verificationStatus !== "verified" && (
        <div className="page-wrap pt-4"><p role="status" className="notice">{t("navigation.yourStoreIsAwaitingVerificationOnce")}</p></div>
      )}
      {children}
    </>
  );
}
