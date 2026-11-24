import { getI18n } from "@/lib/i18n-server";
import Link from "@/components/localized-link";

const footerLinks = [
  {
    title: "footer.exploreMardood",
    links: [
      { href: "/", label: "navigation.home2" },
      { href: "/#how-it-works", label: "home.howMardoodWorks" },
      { href: "/about", label: "navigation.aboutUs" },
      { href: "/#faq", label: "home.frequentlyAskedQuestions" },
    ],
  },
  {
    title: "footer.platformPolicies",
    links: [
      { href: "/privacy", label: "privacy.privacyPolicy" },
      { href: "/terms", label: "terms.termsOfUse" },
    ],
  },
] as const;

export async function SiteFooter() {
  const { t, locale } = await getI18n();
  const year = new Intl.NumberFormat(locale === "ar" ? "ar-SY" : "en", { useGrouping: false }).format(new Date().getFullYear());

  return (
    <footer className="footer-lattice bg-ink text-white [&_a:focus-visible]:outline-white">
      <div className="page-wrap">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-x-4 gap-y-3 pt-4 pb-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.85fr)] sm:gap-x-8 sm:pt-5 sm:pb-3">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-bold">{t("common.brand")}</p>
            <p className="mt-1 max-w-xs text-sm leading-5 text-mauve sm:leading-6">{t("footer.getOffersFromSalamiehStoresUse")}</p>
          </div>
          {footerLinks.map(({ title, links }) => (
            <nav key={title} aria-label={t(title)}>
              <p className="text-sm font-bold">{t(title)}</p>
              <ul role="list" className="mt-1">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="inline-flex min-h-8 items-center rounded-sm text-sm leading-5 text-mauve underline-offset-4 hover:text-white hover:underline sm:min-h-7">
                      {t(label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="border-t border-mauve/30 py-2.5 text-xs text-mauve">© <bdi>{year}</bdi>{" "}{t("common.brand")}</p>
      </div>
    </footer>
  );
}
