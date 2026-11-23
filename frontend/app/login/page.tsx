import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { validReferral } from "@/lib/ui";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string; expired?: string }>;
}) {
  const { offer, expired } = await searchParams;
  const returnTo = typeof offer === "string" && validReferral(offer) ? `/r/${offer}` : "/customer";
  return (
    <div className="page-wrap py-10 sm:py-16">
      <section className="surface mx-auto max-w-md p-5 sm:p-8">
        <h1 className="page-title">تسجيل الدخول</h1>
        <p className="mt-2 leading-7 text-muted">{returnTo === "/customer" ? "سجّل الدخول إلى حساب العميل لمتابعة عروضك والكاش باك." : "سجّل الدخول للعودة إلى عرضك وإصدار بطاقة الخصم."}</p>
        {expired === "1" && <p className="notice mt-4">انتهت جلستك. سجّل الدخول مرة أخرى.</p>}
        <div className="mt-6"><SignInForm returnTo={returnTo} /></div>
      </section>
    </div>
  );
}
