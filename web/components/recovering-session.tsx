import { getI18n } from "@/lib/i18n-server";
import Link from "./localized-link";

export async function RecoveringSession() {
  const { t } = await getI18n();
  return (
    <div className="page-wrap py-12">
      <p role="status" className="notice max-w-lg">{t("customer.refreshingYourSession")}</p>
      <Link href="/login" className="text-link mt-4 inline-block">{t("common.signIn")}</Link>
    </div>
  );
}
