import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="page-wrap py-16">
      <h1 className="text-2xl font-bold">لم نعثر على الصفحة</h1>
      <Link className="text-link mt-4 inline-block" href="/">العودة إلى الصفحة الرئيسية</Link>
    </section>
  );
}
