import { StaffNav } from "@/components/staff-nav";
import { getAccount } from "@/lib/session";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  const merchant = account?.roles.includes("merchant") ? account.merchant : null;
  return (
    <>
      {merchant && (
        <StaffNav label="تنقل التاجر" items={[["/merchant/campaigns/new", "حملة جديدة"], ["/merchant/campaigns", "حملاتي"], ["/merchant/scanner", "الماسح"]]} />
      )}
      {merchant && merchant.verificationStatus !== "verified" && (
        <div className="page-wrap pt-4"><p role="status" className="notice">حساب متجرك لم يُوثَّق بعد. لا يمكنك إطلاق حملات أو تأكيد مبيعات قبل التوثيق.</p></div>
      )}
      {children}
    </>
  );
}
