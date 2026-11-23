import type { Metadata } from "next";
import Link from "next/link";
import { CustomerAuthCard } from "@/components/customer-auth-card";
import { SignInForm } from "@/components/sign-in-form";
import { validReferral } from "@/lib/ui";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string; expired?: string }>;
}) {
  const { offer, expired } = await searchParams;
  const referral = typeof offer === "string" && validReferral(offer) ? offer : undefined;
  const returnTo = referral ? `/r/${referral}` : "/customer";
  const registerHref = referral ? `/register?offer=${referral}` : "/register";
  return (
    <CustomerAuthCard
      title="أهلاً بعودتك إلى مردود"
      description={referral ? "سجّل الدخول للعودة إلى عرضك وإصدار بطاقة الخصم." : "سجّل الدخول لمتابعة عروضك ورصيد الكاش باك."}
      icon={<><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>}
    >
      {expired === "1" && <p className="notice mt-4 border border-rule" role="status">انتهت جلستك. سجّل الدخول مرة أخرى.</p>}
      <div className="mt-4"><SignInForm returnTo={returnTo} /></div>
      <p className="mt-4 text-center text-sm leading-6 text-muted">
        ليس لديك حساب؟ <Link className="text-link" href={registerHref}>إنشاء حساب</Link>
      </p>
    </CustomerAuthCard>
  );
}
