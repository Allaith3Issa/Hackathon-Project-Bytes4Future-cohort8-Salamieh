import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { ScannerFlow } from "@/components/scanner-flow";
import { RecoveringSession } from "@/components/recovering-session";
import { requirePageRole } from "@/lib/staff";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("scanner.passScanner") };
}

export default async function ScannerPage() {
  const { t } = await getI18n();
  const account = await requirePageRole("merchant");
  if (!account) return <RecoveringSession />;
  return (
    <div className="page-wrap max-w-2xl space-y-6 py-7 sm:py-12">
      <h1 className="page-title">{t("scanner.passScanner")}</h1>
      <ScannerFlow key={account.id} merchantId={account.id} />
    </div>
  );
}
