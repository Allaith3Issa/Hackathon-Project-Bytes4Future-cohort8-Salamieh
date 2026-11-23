import { getI18n } from "@/lib/i18n-server";
export default async function OfferLoading() {
  const { t } = await getI18n();
  return (
    <section className="page-wrap py-8 sm:py-12">
      <h1 className="page-title">{t("offers.offerDetails")}</h1>
      <p role="status" className="notice mt-4 max-w-lg">{t("offers.loadingTheOffer")}</p>
    </section>
  );
}
