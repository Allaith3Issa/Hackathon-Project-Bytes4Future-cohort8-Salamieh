import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("about.aboutUs"), description: t("about.mardoodIsAPilotProjectBuilt") };
}

export default async function AboutPage() {
  const { t } = await getI18n();
  return (
    <InformationPage title={t("about.aboutUs")} introduction={t("about.mardoodIsAPilotProjectBuilt")}>
      <section>
        <h2>{t("about.ourIdea")}</h2>
        <p>{t("about.aStoreSOfferCanReach")}</p>
      </section>
      <section>
        <h2>{t("about.howDoWeConnectStoresCustomers")}</h2>
        <p>{t("about.theMerchantCreatesAnOfferAnd")}</p>
      </section>
      <section>
        <h2>{t("about.ourVision")}</h2>
        <p>{t("about.weWantShoppersToFindOffers")}</p>
      </section>
    </InformationPage>
  );
}
