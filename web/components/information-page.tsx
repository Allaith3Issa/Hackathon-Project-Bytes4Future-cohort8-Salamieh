import type { ReactNode } from "react";

export function InformationPage({ title, introduction, children }: { title: string; introduction: string; children: ReactNode }) {
  return (
    <article className="page-wrap py-7 sm:py-12">
      <div className="surface mx-auto max-w-3xl px-5 py-6 sm:px-9 sm:py-9">
        <h1 className="page-title">{title}</h1>
        <p className="mt-3 max-w-[65ch] leading-8 text-muted">{introduction}</p>
        <div className="mt-6 max-w-[65ch] space-y-5 leading-8 text-muted [&_h2]:text-xl [&_h2]:leading-7 [&_h2]:font-bold [&_h2]:text-ink [&_section]:space-y-2 [&_section]:border-t [&_section]:border-rule [&_section]:pt-4">
          {children}
        </div>
      </div>
    </article>
  );
}
