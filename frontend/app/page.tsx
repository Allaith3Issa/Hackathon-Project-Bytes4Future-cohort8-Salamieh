import Link from "next/link";
import Image from "next/image";
import { sessionTokens } from "@/lib/session";

const steps = [
  { title: "افتح رابط العرض", detail: "اطّلع على تفاصيل المنتج وسعره قبل زيارة المتجر." },
  { title: "أبرز بطاقة الخصم", detail: "أصدر البطاقة من العرض، وقدّمها للتاجر عند الدفع نقداً." },
  { title: "تابع الكاش باك", detail: "بعد تأكيد الشراء، راجع رصيدك وتقدّمك من حسابك." },
];

export default async function Home() {
  const { accessToken } = await sessionTokens();
  return (
    <>
      <section className="page-wrap grid items-center gap-6 py-8 sm:gap-10 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:py-16">
        <div className="max-w-xl">
          <h1 className="text-[clamp(2.3rem,3.75vw,3.625rem)] leading-[1.24] font-bold text-balance">
            عروض من <span className="text-action">السلمية</span>، تستخدمها في المتجر
          </h1>
          <p className="mt-4 max-w-md text-base leading-8 text-muted sm:text-lg sm:leading-9">
            افتح رابط العرض، وأبرز بطاقة الخصم عند الدفع نقداً. تابع الكاش باك من حسابك بعد تسجيل الشراء.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 sm:mt-7">
            <Link href={accessToken ? "/customer" : "/login"} className="button-primary">
              {accessToken ? "عرض الكاش باك" : "تسجيل الدخول"}
            </Link>
            <a href="#how-it-works" className="text-link inline-flex min-h-11 items-center">كيف تستخدم العرض؟</a>
          </div>
        </div>
        <div className="relative aspect-[5/4] overflow-hidden rounded-xl bg-mauve sm:aspect-[3/2] lg:aspect-[5/4]">
          <Image
            src="/images/local-bakery.webp"
            alt="يد ترتّب قطع المعمول في علبة داخل مخبز"
            fill
            preload
            sizes="(min-width: 1200px) 610px, (min-width: 1024px) 53vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-6 border-y border-rule bg-mauve">
        <div className="page-wrap py-8 sm:py-10">
          <h2 id="how-title" className="text-xl font-bold sm:text-2xl">كيف تستخدم العرض؟</h2>
          <ol className="mt-5 grid gap-y-4 sm:grid-cols-3 sm:gap-x-5">
            {steps.map(({ title, detail }) => (
              <li key={title} className="border-t border-rule pt-3">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-7 text-muted">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
