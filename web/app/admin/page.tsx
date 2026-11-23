import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffSignIn } from "@/components/staff-sign-in";
import { getAccount } from "@/lib/session";

export const metadata: Metadata = { title: "دخول الإدارة" };

export default async function AdminPage() {
  const account = await getAccount();
  if (account?.roles.includes("admin")) redirect("/admin/topups");
  return (
    <div className="page-wrap py-10 sm:py-16">
      <section className="surface mx-auto max-w-md p-5 sm:p-8">
        <h1 className="page-title">دخول الإدارة</h1>
        <p className="mt-2 leading-7 text-muted">سجّل الدخول بحساب الإدارة لشحن أرصدة التجار.</p>
        {account && <p className="notice mt-4">أنت مسجّل بحساب غير إداري. سجّل الدخول بحساب الإدارة للمتابعة.</p>}
        <div className="mt-6"><StaffSignIn kind="admin" /></div>
      </section>
    </div>
  );
}
