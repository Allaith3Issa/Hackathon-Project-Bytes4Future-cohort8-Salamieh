import { getI18n } from "@/lib/i18n-server";
import Link from "@/components/localized-link";

const linkGroups = [
  {
    id: "footer-pages",
    title: "footer.exploreMardood",
    links: [
      { href: "/", label: "navigation.home2" },
      { href: "/#how-it-works", label: "home.howMardoodWorks" },
      { href: "/about", label: "navigation.aboutUs" },
      { href: "/#faq", label: "home.frequentlyAskedQuestions" },
    ],
  },
  {
    id: "footer-policies",
    title: "footer.platformPolicies",
    links: [
      { href: "/privacy", label: "privacy.privacyPolicy" },
      { href: "/terms", label: "terms.termsOfUse" },
    ],
  },
] as const;

export async function SiteFooter({ signedIn }: { signedIn: boolean }) {
  const { t, locale } = await getI18n();
  const year = new Intl.NumberFormat(locale === "ar" ? "ar-SY" : "en", { useGrouping: false }).format(new Date().getFullYear());

  return (
    <footer className="bg-ink text-white [&_a:focus-visible]:outline-white">
      <div className="page-wrap">
        <div className="grid gap-x-8 gap-y-5 py-7 sm:grid-cols-2 sm:py-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="sm:col-span-2 md:col-span-1">
            <Link href={signedIn ? "/" : "/login"} className="inline-flex min-h-11 items-center rounded-sm text-2xl font-bold hover:text-mauve">{t("common.brand")}</Link>
            <p className="mt-1 max-w-xs text-sm leading-7 text-mauve">{t("footer.getOffersFromSalamiehStoresUse")}</p>
          </div>
          {signedIn && linkGroups.map(({ id, title, links }) => (
            <nav key={id} aria-labelledby={id} className="border-t border-mauve/25 pt-3 sm:border-t-0 md:pt-2">
              <h2 id={id} className="font-bold">{t(title)}</h2>
              <ul role="list" className="mt-1">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="inline-flex min-h-11 items-center rounded-sm text-sm text-mauve underline-offset-4 hover:text-white hover:underline">
                      {t(label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="border-t border-mauve/25 py-4 text-sm text-mauve">© {year}{" "}{t("common.brand")}</p>
      </div>
    </footer>
  );
}
