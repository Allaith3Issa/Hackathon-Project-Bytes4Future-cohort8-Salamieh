import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffSignIn } from "@/components/staff-sign-in";
import { getAccount } from "@/lib/session";

export const metadata: Metadata = { title: "دخول التاجر" };

export default async function MerchantLogin() {
  const account = await getAccount();
  if (account?.roles.includes("merchant")) redirect("/merchant/campaigns/new");
  return (
    <div className="page-wrap py-10 sm:py-16">
      <section className="surface mx-auto max-w-md p-5 sm:p-8">
        <h1 className="page-title">دخول التاجر</h1>
        <p className="mt-2 leading-7 text-muted">سجّل الدخول لإدارة حملاتك وتأكيد مبيعات بطاقات الخصم.</p>
        <div className="mt-6"><StaffSignIn kind="merchant" /></div>
      </section>
    </div>
  );
}
