import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { SignUpForm } from "@/components/sign-up-form";
import { validReferral } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("auth.createAccount") };
}

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ offer?: string }>;
}) {
  const { offer } = await searchParams;
  const referral = typeof offer === "string" && validReferral(offer) ? offer : undefined;
  return <SignUpForm offer={referral} />;
}
