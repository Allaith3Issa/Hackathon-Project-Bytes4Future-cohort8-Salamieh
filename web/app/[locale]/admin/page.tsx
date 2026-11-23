import { getI18n, redirectLocalized } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { StaffSignIn } from "@/components/staff-sign-in";
import { getAccount } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("admin.adminSignIn") };
}

export default async function AdminPage() {
  const { t } = await getI18n();
  const account = await getAccount();
  if (account?.roles.includes("admin")) return redirectLocalized("/admin/topups");
  return (
    <div className="page-wrap py-10 sm:py-16">
      <section className="surface mx-auto max-w-md p-5 sm:p-8">
        <h1 className="page-title">{t("admin.adminSignIn")}</h1>
        <p className="mt-2 leading-7 text-muted">{t("admin.signInWithAnAdminAccount")}</p>
        {account && <p className="notice mt-4">{t("admin.youAreSignedInWithA")}</p>}
        <div className="mt-6"><StaffSignIn kind="admin" /></div>
      </section>
    </div>
  );
}
