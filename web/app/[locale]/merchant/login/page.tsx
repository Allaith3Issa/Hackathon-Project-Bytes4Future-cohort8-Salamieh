import { getI18n, redirectLocalized } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { StaffSignIn } from "@/components/staff-sign-in";
import { getAccount } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("auth.merchantSignIn") };
}

export default async function MerchantLogin() {
  const { t } = await getI18n();
  const account = await getAccount();
  if (account?.roles.includes("merchant")) return redirectLocalized("/merchant/campaigns/new");
  return (
    <div className="page-wrap py-10 sm:py-16">
      <section className="surface mx-auto max-w-md p-5 sm:p-8">
        <h1 className="page-title">{t("auth.merchantSignIn")}</h1>
        <p className="mt-2 leading-7 text-muted">{t("auth.signInToManageYourCampaigns")}</p>
        <div className="mt-6"><StaffSignIn kind="merchant" /></div>
      </section>
    </div>
  );
}
