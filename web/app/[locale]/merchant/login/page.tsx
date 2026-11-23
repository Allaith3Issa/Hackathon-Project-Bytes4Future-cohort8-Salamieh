import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { RecoveringSession } from "@/components/recovering-session";
import { StaffSignIn } from "@/components/staff-sign-in";
import { canShowGuestAuthForm } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("auth.merchantSignIn") };
}

export default async function MerchantLogin() {
  if (!(await canShowGuestAuthForm())) return <RecoveringSession authPage />;
  const { t } = await getI18n();
  return (
    <div className="page-wrap py-10 sm:py-16">
      <section className="surface mx-auto max-w-md p-5 sm:p-8">
        <h1 className="page-title">{t("auth.merchantSignIn")}</h1>
        <p className="mt-2 leading-7 text-muted">{t("auth.signInToManageYourCampaigns")}</p>
        <div className="mt-6"><StaffSignIn kind="merchant" /></div>
        <p className="mt-4 text-sm text-muted">
          {t("auth.needAnAccount")}{" "}<Link className="text-link" href="/register">{t("auth.createAccount")}</Link>
        </p>
      </section>
    </div>
  );
}
