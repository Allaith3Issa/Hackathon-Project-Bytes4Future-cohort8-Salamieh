import type { Metadata } from "next";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api";
import type { PublicOffer } from "@/lib/contract";
import { getAccount } from "@/lib/session";
import { errorMessage, formatDate, formatNumber, formatSyp, validReferral } from "@/lib/ui";
import { SignInForm } from "@/components/sign-in-form";
import { OfferPass, OfferVisit } from "./offer-pass";

export const metadata: Metadata = { title: "تفاصيل العرض" };

function offerImage(url: string) {
  try {
    const parsed = new URL(url);
    if (["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password) return parsed.href;
  } catch {
    return null;
  }
  return null;
}

export default async function OfferPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let offer: PublicOffer;
  try {
    if (!validReferral(code)) throw new ApiError(404, "NOT_FOUND");
    offer = await apiRequest<PublicOffer>(`/public/referrals/${code}`);
  } catch (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <section className="page-wrap py-10 sm:py-14">
        <div className="surface mx-auto max-w-lg p-5 sm:p-8">
          <h1 className="page-title">{missing ? "لم نعثر على رابط الإحالة" : "تعذّر تحميل العرض"}</h1>
          <p className="mt-2 leading-7 text-muted">{missing ? "تحقّق من الرابط الذي وصلك ثم افتحه مرة أخرى." : errorMessage(error)}</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {!missing && <a className="button-primary" href={`/r/${code}`}>إعادة المحاولة</a>}
            <Link href="/" className={missing ? "button-secondary" : "text-link"}>الصفحة الرئيسية</Link>
          </div>
        </div>
      </section>
    );
  }

  const active = offer.status === "active";
  const account = active ? await getAccount() : null;
  const signedIn = account?.roles.includes("customer") ?? false;
  const image = offerImage(offer.imageUrl);

  return (
    <div className="page-wrap py-7 sm:py-12">
      <OfferVisit code={code} />
      <article className="grid items-start gap-5 md:max-lg:mx-auto md:max-lg:max-w-[600px] lg:grid-cols-[0.95fr_1.05fr] lg:gap-x-12 lg:gap-y-6">
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <header>
            <p className="text-sm font-bold text-action">{offer.shopName}</p>
            <h1 className="mt-2 text-[clamp(2rem,4vw,3.5rem)] leading-[1.25] font-bold text-balance">{offer.productName}</h1>
            {offer.description && <p className="mt-2 leading-8 text-muted">{offer.description}</p>}
          </header>
          <div className="border-y border-rule py-3 sm:py-4">
            {offer.finalPriceSyp !== null && <p className="mb-1 text-sm font-semibold text-muted">{offer.discountPercent > 0 ? "السعر بعد الخصم" : "السعر"}</p>}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {offer.finalPriceSyp !== null && (
                <p className="text-[clamp(1.65rem,4vw,2.4rem)] font-bold leading-tight tabular-nums">{formatSyp(offer.finalPriceSyp)}</p>
              )}
              {offer.originalPriceSyp !== null && offer.discountPercent > 0 && (
                <p className="text-sm text-muted"><span className="sr-only">السعر قبل الخصم </span><del>{formatSyp(offer.originalPriceSyp)}</del></p>
              )}
              {offer.discountPercent > 0 && (
                <p className="rounded-md bg-mauve px-2.5 py-0.5 text-sm font-semibold">
                  خصم {formatNumber(offer.discountPercent)}٪
                </p>
              )}
            </div>
            <p className="mt-2 text-sm text-muted"><span className="font-semibold">تاريخ انتهاء العرض</span> <bdi>{formatDate(offer.endsAt)}</bdi></p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl bg-mauve lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {image ? (
            // Merchant-provided image URLs are rendered directly without a server-side image proxy.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={offer.productName} referrerPolicy="no-referrer" className="aspect-[4/3] max-h-[50vh] w-full object-cover lg:aspect-[5/4] lg:max-h-none" />
          ) : (
            <div className="px-5 py-4 sm:px-7 lg:grid lg:min-h-40 lg:content-center lg:gap-2 lg:px-8">
              <h2 className="text-base font-bold lg:text-2xl">عن المتجر</h2>
              <p className="mt-1 text-sm leading-7 text-muted lg:mt-0 lg:text-base">{offer.shopDetails || offer.shopName}</p>
            </div>
          )}
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          {!active ? (
            <p className="notice font-semibold">انتهى هذا العرض.</p>
          ) : signedIn ? (
            <OfferPass key={code} code={code} />
          ) : (
            <section className="surface p-5 sm:p-6">
              <h2 className="text-lg font-bold sm:text-xl">سجّل الدخول لإصدار بطاقة الخصم</h2>
              <div className="mt-4"><SignInForm returnTo={`/r/${code}`} /></div>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
