import { StaffNav } from "@/components/staff-nav";
import { getAccount } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  return (
    <>
      {account?.roles.includes("admin") && <StaffNav label="تنقل الإدارة" items={[["/admin/topups", "شحن الأرصدة"]]} />}
      {children}
    </>
  );
}
