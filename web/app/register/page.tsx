import type { Metadata } from "next";
import { SignUpForm } from "@/components/sign-up-form";
import { validReferral } from "@/lib/ui";

export const metadata: Metadata = { title: "إنشاء حساب" };

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ offer?: string }>;
}) {
  const { offer } = await searchParams;
  const referral = typeof offer === "string" && validReferral(offer) ? offer : undefined;
  return <SignUpForm offer={referral} />;
}
