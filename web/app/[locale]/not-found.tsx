import { getI18n } from "@/lib/i18n-server";
import Link from "@/components/localized-link";

export default async function NotFoundPage() {
  const { t } = await getI18n();
  return (
    <section className="page-wrap py-16">
      <h1 className="text-2xl font-bold">{t("errors.pageNotFound")}</h1>
      <Link className="text-link mt-4 inline-block" href="/">{t("errors.backToHome")}</Link>
    </section>
  );
}
