"use client";

import { useI18n } from "@/components/i18n-provider";
import Link from "@/components/localized-link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <section className="page-wrap py-16">
      <h1 className="text-2xl font-bold">{t("errors.weCouldnTOpenThisPage")}</h1>
      <p className="mt-2 text-muted">{t("errors.pleaseTryAgainInAMoment")}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={reset} className="button-primary">{t("common.tryAgain")}</button>
        <Link className="text-link" href="/">{t("common.home")}</Link>
      </div>
    </section>
  );
}
