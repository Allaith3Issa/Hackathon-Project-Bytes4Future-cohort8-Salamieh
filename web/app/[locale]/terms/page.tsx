import { getI18n } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";
import { RecoveringSession } from "@/components/recovering-session";
import { requirePageAccount } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("terms.termsOfUse"), description: t("terms.thisDraftExplainsHowOffersDiscount") };
}

export default async function TermsPage() {
  if (!(await requirePageAccount())) return <RecoveringSession />;
  const { t } = await getI18n();
  return (
    <InformationPage title={t("terms.termsOfUse")} introduction={t("terms.thisDraftExplainsHowOffersDiscount")}>
      <p className="notice">{t("privacy.draftForTheProjectOwnerTo")}</p>
      <section>
        <h2>{t("terms.purposeOfThePlatformAndYour")}</h2>
        <p>{t("terms.mardoodHelpsYouFindOffersFrom")}</p>
      </section>
      <section>
        <h2>{t("terms.offerAvailabilityAndExpiration")}</h2>
        <p>{t("terms.checkTheProductPriceAndExpiration")}</p>
      </section>
      <section>
        <h2>{t("terms.discountPassesAndMerchantConfirmation")}</h2>
        <p>{t("terms.showTheQrCodeOrManual")}</p>
      </section>
      <section>
        <h2>{t("terms.cashbackEligibility")}</h2>
        <p>{t("terms.cashbackIsRecordedAfterAnEligible")}</p>
      </section>
      <section>
        <h2>{t("terms.acceptableUseAndPilotLimits")}</h2>
        <p>{t("terms.useAPassForAGenuine")}</p>
      </section>
      <section>
        <h2>{t("privacy.detailsTheProjectOwnerNeedsTo")}</h2>
        <p>{t("terms.beforePublicationApproveTheOperatorS")}</p>
      </section>
    </InformationPage>
  );
}
