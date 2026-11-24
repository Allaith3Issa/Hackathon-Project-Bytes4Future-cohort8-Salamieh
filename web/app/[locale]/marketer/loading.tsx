import { getI18n } from "@/lib/i18n-server";

export default async function MarketerLoading() {
  const { t } = await getI18n();
  return (
    <div className="page-wrap space-y-4 py-7 sm:py-10">
      <p role="status" className="text-sm font-semibold text-muted">{t("marketerCampaigns.loading")}</p>
      <div aria-hidden="true" className="grid gap-4 motion-safe:animate-pulse md:grid-cols-2">
        <div className="surface h-40" />
        <div className="surface h-40" />
      </div>
    </div>
  );
}
