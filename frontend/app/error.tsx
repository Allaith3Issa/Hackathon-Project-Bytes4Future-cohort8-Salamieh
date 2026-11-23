"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="page-wrap py-16">
      <h1 className="text-2xl font-bold">تعذّر فتح الصفحة</h1>
      <p className="mt-2 text-muted">حاول مرة أخرى بعد قليل.</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={reset} className="button-primary">إعادة المحاولة</button>
        <Link className="text-link" href="/">الصفحة الرئيسية</Link>
      </div>
    </section>
  );
}
