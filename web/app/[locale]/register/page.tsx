import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { SignUpForm } from "@/components/sign-up-form";
import { RecoveringSession } from "@/components/recovering-session";
import { requirePageAccount } from "@/lib/session";
import { validReferral } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("auth.createAccount") };
}

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ offer?: string }>;
}) {
  if (!(await requirePageAccount())) return <RecoveringSession />;
  const { offer } = await searchParams;
  const referral = typeof offer === "string" && validReferral(offer) ? offer : undefined;
  return <SignUpForm offer={referral} />;
}
