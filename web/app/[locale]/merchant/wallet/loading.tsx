import { getI18n } from "@/lib/i18n-server";

export default async function WalletLoading() {
  const { t } = await getI18n();
  return (
    <div className="page-wrap max-w-4xl space-y-6 py-7 sm:py-12" role="status">
      <h1 className="page-title">{t("merchantReporting.wallet")}</h1>
      <span className="sr-only">{t("merchantReporting.loadingWallet")}</span>
      <div aria-hidden="true" className="h-28 rounded-xl bg-mauve motion-safe:animate-pulse" />
      <div aria-hidden="true" className="surface h-40 motion-safe:animate-pulse" />
    </div>
  );
}
