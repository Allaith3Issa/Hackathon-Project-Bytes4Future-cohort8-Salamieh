import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { CustomerAuthCard } from "@/components/customer-auth-card";
import { SignInForm } from "@/components/sign-in-form";
import { getAccount } from "@/lib/session";
import { validReferral } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("common.signIn") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string; expired?: string }>;
}) {
  const { t } = await getI18n();
  const account = await getAccount().catch(() => null);
  const { offer, expired } = await searchParams;
  const referral = typeof offer === "string" && validReferral(offer) ? offer : undefined;
  const registerHref = referral ? `/register?offer=${referral}` : "/register";
  return (
    <CustomerAuthCard
      title={t("auth.welcomeBackToMardood")}
      description={referral ? t("auth.signInWithAnAccountThat") : t("auth.signInToYourMardoodAccount")}
      icon={<><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>}
    >
      {expired === "1" && <p className="notice mt-4 border border-rule" role="status">{t("auth.yourSessionHasExpiredPleaseSign")}</p>}
      <div className="mt-4"><SignInForm offer={referral} /></div>
      {account && <p className="mt-4 text-center text-sm leading-6 text-muted">
        {t("auth.needAnAccount")}{" "}<Link className="text-link" href={registerHref}>{t("auth.createAccount")}</Link>
      </p>}
    </CustomerAuthCard>
  );
}
