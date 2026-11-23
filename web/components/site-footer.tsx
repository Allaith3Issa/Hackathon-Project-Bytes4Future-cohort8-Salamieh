import Link from "next/link";

const linkGroups = [
  {
    id: "footer-pages",
    title: "استكشف مردود",
    links: [
      { href: "/", label: "الرئيسية" },
      { href: "/#how-it-works", label: "كيف يعمل مردود؟" },
      { href: "/about", label: "من نحن" },
      { href: "/#faq", label: "الأسئلة الشائعة" },
    ],
  },
  {
    id: "footer-policies",
    title: "سياسات المنصة",
    links: [
      { href: "/privacy", label: "سياسة الخصوصية" },
      { href: "/terms", label: "شروط الاستخدام" },
    ],
  },
];

export function SiteFooter() {
  const year = new Intl.NumberFormat("ar-SY", { numberingSystem: "arab", useGrouping: false }).format(new Date().getFullYear());

  return (
    <footer className="bg-ink text-white [&_a:focus-visible]:outline-white">
      <div className="page-wrap">
        <div className="grid gap-x-8 gap-y-5 py-7 sm:grid-cols-2 sm:py-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-sm text-2xl font-bold hover:text-mauve">مردود</Link>
            <p className="mt-1 max-w-xs text-sm leading-7 text-mauve">عروض من متاجر سلمية، تستخدمها عند الدفع في المتجر وتتابع الكاش باك على مشترياتك المؤهلة.</p>
          </div>
          {linkGroups.map(({ id, title, links }) => (
            <nav key={id} aria-labelledby={id} className="border-t border-mauve/25 pt-3 sm:border-t-0 md:pt-2">
              <h2 id={id} className="font-bold">{title}</h2>
              <ul role="list" className="mt-1">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="inline-flex min-h-11 items-center rounded-sm text-sm text-mauve underline-offset-4 hover:text-white hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="border-t border-mauve/25 py-4 text-sm text-mauve">© {year} مردود</p>
      </div>
    </footer>
  );
}
