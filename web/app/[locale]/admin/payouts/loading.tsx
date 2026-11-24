import { getI18n } from "@/lib/i18n-server";

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <div className="page-wrap max-w-4xl space-y-4 py-7 sm:py-10">
      <h1 className="page-title">{t("payouts.adminTitle")}</h1>
      <p role="status" className="text-sm text-muted">{t("payouts.loading")}</p>
      <div aria-hidden="true" className="surface h-40 motion-safe:animate-pulse" />
    </div>
  );
}
