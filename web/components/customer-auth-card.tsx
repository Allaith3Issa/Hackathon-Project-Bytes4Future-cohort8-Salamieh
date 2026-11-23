import type { ReactNode, Ref } from "react";
import styles from "./customer-auth-card.module.css";

interface CustomerAuthCardProps {
  title: string;
  description: ReactNode;
  icon?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  width?: string;
  children: ReactNode;
}

export function CustomerAuthCard({ title, description, icon, headingRef, width = "max-w-md", children }: CustomerAuthCardProps) {
  return (
    <div className={`${styles.page} grid place-items-center px-4 py-5 sm:px-6 sm:py-8`}>
      <section aria-labelledby="customer-auth-title" className={`surface w-full p-5 sm:p-7 ${width}`}>
        <header className="border-b border-rule pb-4">
          {icon && <span className="mb-3 grid size-9 place-items-center rounded-lg bg-mauve text-ink" aria-hidden="true">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {icon}
            </svg>
          </span>}
          <h1 id="customer-auth-title" ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="page-title">{title}</h1>
          <p className="mt-1.5 leading-7 text-muted">{description}</p>
        </header>
        {children}
      </section>
    </div>
  );
}
