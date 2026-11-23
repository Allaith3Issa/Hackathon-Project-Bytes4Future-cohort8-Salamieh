import type { Metadata } from "next";
import { ScannerFlow } from "@/components/scanner-flow";
import { requireRole } from "@/lib/staff";

export const metadata: Metadata = { title: "ماسح البطاقات" };

export default async function ScannerPage() {
  await requireRole("merchant");
  return (
    <div className="page-wrap max-w-2xl space-y-6 py-7 sm:py-12">
      <h1 className="page-title">ماسح البطاقات</h1>
      <ScannerFlow />
    </div>
  );
}
