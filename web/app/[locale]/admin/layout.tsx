import { getI18n } from "@/lib/i18n-server";
import { StaffNav } from "@/components/staff-nav";
import { getAccount } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const account = await getAccount();
  return (
    <>
      {account?.roles.includes("admin") && <StaffNav label={t("admin.adminNavigation")} items={[
        ["/admin/revenue", t("earnings.dashboardTitle")],
        ["/admin/topups", t("admin.balanceTopUps")],
        ["/admin/merchants", t("verification.title")],
      ]} />}
      {children}
    </>
  );
}
