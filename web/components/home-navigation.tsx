"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const homeLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/#how-it-works", label: "كيف يعمل مردود؟" },
  { href: "/#benefits", label: "مزايا مردود" },
  { href: "/#faq", label: "الأسئلة الشائعة" },
  { href: "/about", label: "من نحن" },
];

export function HomeNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname !== "/") return children;

  return (
    <>
      <nav aria-label="صفحات مردود" className="home-navigation hidden items-center gap-1 lg:flex xl:gap-3">
        {homeLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={href === "/" ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold whitespace-nowrap text-muted decoration-2 underline-offset-8 hover:bg-mauve/60 hover:text-ink aria-[current=page]:text-action-hover aria-[current=page]:underline"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="home-navigation flex items-center gap-2">
        {children}
        <details
          className="group relative lg:hidden"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !event.currentTarget.open) return;
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }}
        >
          <summary aria-controls="home-mobile-links" className="grid size-11 cursor-pointer list-none place-items-center rounded-lg border border-rule text-ink hover:bg-mauve group-open:bg-mauve [&::-webkit-details-marker]:hidden">
            <span className="sr-only">قائمة صفحات مردود</span>
            <span aria-hidden="true" className="relative h-0.5 w-4 rounded-full bg-current before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:rounded-full before:bg-current after:absolute after:inset-x-0 after:top-1.5 after:h-0.5 after:rounded-full after:bg-current" />
          </summary>
          <nav id="home-mobile-links" aria-label="صفحات مردود" className="surface absolute end-0 top-full z-20 mt-2 grid w-56 max-w-[calc(100vw-2rem)] gap-0.5 p-2 shadow-sm shadow-ink/10">
            {homeLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={href === "/" ? "page" : undefined}
                onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-mauve aria-[current=page]:text-action-hover"
              >
                {label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </>
  );
}
