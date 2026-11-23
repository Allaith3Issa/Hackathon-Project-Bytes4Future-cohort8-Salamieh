import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("privacy.privacyPolicy"), description: t("privacy.thisDraftDescribesTheDataThe") };
}

export default async function PrivacyPage() {
  const { t } = await getI18n();
  const [beforeFlag, afterFlag] = t("privacy.cookieExplanation").split("{flag}");
  return (
    <InformationPage title={t("privacy.privacyPolicy")} introduction={t("privacy.thisDraftDescribesTheDataThe")}>
      <p className="notice">{t("privacy.draftForTheProjectOwnerTo")}</p>
      <section>
        <h2>{t("privacy.accountsAndSignIn")}</h2>
        <p>{t("privacy.youSignInWithAPhone")}</p>
      </section>
      <section>
        <h2>{t("privacy.referralLinksAndDiscountPasses")}</h2>
        <p>{t("privacy.whenYouOpenAnOfferLink")}</p>
      </section>
      <section>
        <h2>{t("privacy.purchasesCashbackAndCommissions")}</h2>
        <p>{t("privacy.aCustomerSAccountShowsConfirmed")}</p>
      </section>
      <section>
        <h2>{t("privacy.sessionCookies")}</h2>
        <p>{beforeFlag}<bdi dir="ltr">HttpOnly</bdi>{afterFlag}</p>
      </section>
      <section>
        <h2>{t("privacy.detailsTheProjectOwnerNeedsTo")}</h2>
        <p>{t("privacy.beforePublicationIdentifyWhoIsResponsible")}</p>
      </section>
    </InformationPage>
  );
}
