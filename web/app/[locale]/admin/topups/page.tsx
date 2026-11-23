import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import type { Metadata } from "next";
import { TopupForm } from "@/components/topup-form";
import { RecoveringSession } from "@/components/recovering-session";
import { ApiError } from "@/lib/api";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import type { AdminMerchant, Page } from "@/lib/staff-contract";
import { staffError } from "@/lib/staff-ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("admin.topUpAMerchant") };
}

export default async function TopupsPage() {
  const { t, locale } = await getI18n();
  if (!(await requirePageRole("admin"))) return <RecoveringSession />;
  let merchants: AdminMerchant[] = [];
  let failure: string | undefined;
  try {
    merchants = (await authenticatedRequest<Page<AdminMerchant>>("/admin/merchants?verificationStatus=verified&pageSize=100")).items;
  } catch (error) {
    await expiredRedirect(error);
    failure = staffError(error, t);
    if (!(error instanceof ApiError)) throw error;
  }
  return (
    <div className="page-wrap max-w-2xl space-y-6 py-7 sm:py-12">
      <h1 className="page-title">{t("admin.topUpAMerchant")}</h1>
      {failure ? (
        <>
          <p role="alert" className="notice-error">{failure}</p>
          <a href={localizedPath("/admin/topups", locale)} className="button-secondary">{t("common.tryAgain")}</a>
        </>
      ) : merchants.length === 0 ? (
        <p className="notice">{t("admin.thereAreNoVerifiedMerchantsRight")}</p>
      ) : <TopupForm merchants={merchants} />}
    </div>
  );
}
