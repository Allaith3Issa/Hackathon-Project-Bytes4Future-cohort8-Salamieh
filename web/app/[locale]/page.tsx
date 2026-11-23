import { getI18n } from "@/lib/i18n-server";
import Link from "@/components/localized-link";
import { getAccount } from "@/lib/session";

const steps = [
  { number: "home.stepOne", title: "home.openTheOfferLink", detail: "home.checkTheOfferDetailsAndPrice" },
  { number: "home.stepTwo", title: "home.showYourDiscountPass", detail: "home.getThePassFromTheOffer" },
  { number: "home.stepThree", title: "home.trackYourCashback", detail: "home.afterThePurchaseIsConfirmedCheck" },
] as const;

const benefits = [
  { title: "home.offersFromLocalStores", detail: "home.discoverOffersFromParticipatingStoresIn", icon: "M3 9l2-5h14l2 5M3 9v2a2 2 0 0 0 4 0 2 2 0 0 0 5 0 2 2 0 0 0 5 0 2 2 0 0 0 4 0V9M3 9h18M5 13v7h14v-7m-9 7v-4h4v4" },
  { title: "home.discountsWhenYouPayCash", detail: "home.useOffersWhenYouPayCash", icon: "M3 6h18v12H3zM7 12h.01M17 12h.01M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" },
  { title: "home.cashbackOnYourPurchases", detail: "home.earnCashbackOnEligiblePurchasesAnd", icon: "M20 8H6a2 2 0 0 1 0-4h12M4 6v12a2 2 0 0 0 2 2h14V8m0 4h-5a2 2 0 0 0 0 4h5m-5-2h.01" },
] as const;

const questions = [
  { title: "home.whatIsMardood", answer: "home.mardoodConnectsStoresInSalamiehWith" },
  { title: "home.howDoIUseADiscount", answer: "home.openTheOfferLinkAndReview" },
  { title: "home.doINeedToPayOnline", answer: "home.youPayTheMerchantInCash" },
  { title: "home.whenIsCashbackAddedToMy", answer: "home.afterAnEligiblePurchaseIsConfirmed" },
  { title: "home.howIsAPurchaseConfirmed", answer: "home.theMerchantThatOwnsTheOffer" },
  { title: "home.whatIfTheQrCodeWon", answer: "home.showTheMerchantTheManualCode" },
] as const;

async function OfferSteps({ className }: { className: string }) {
  const { t } = await getI18n();
  return (
    <ol role="list" className={className}>
      {steps.map(({ number, title, detail }) => (
        <li key={number} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 border-t border-rule pt-3">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-full border border-dusty-mauve/50 bg-mauve text-sm leading-none font-semibold text-ink">{t(number)}</span>
          <div>
            <h3 className="leading-6 font-bold">{t(title)}</h3>
            <p className="mt-1 text-sm leading-6 text-pretty text-muted">{t(detail)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const passPattern = [
  "111010111",
  "101100101",
  "111010111",
  "000101000",
  "101011010",
  "011100101",
  "111001011",
  "101010110",
  "111101001",
];

async function OfferPreview() {
  const { t, formatPercent } = await getI18n();
  return (
    <figure aria-labelledby="offer-preview-title" className="mx-auto w-full max-w-lg min-w-0 rounded-2xl border border-dusty-mauve/40 bg-mauve/50 p-2.5 sm:p-5 lg:bg-canvas/70">
      <figcaption id="offer-preview-title" className="mb-1.5 text-xs font-semibold text-muted sm:mb-2.5 sm:text-sm">{t("home.example")}</figcaption>
      <div className="overflow-hidden rounded-xl border border-rule bg-white shadow-sm shadow-ink/10">
        <div className="flex items-center gap-3 border-b border-dashed border-rule bg-canvas p-2.5 sm:gap-4 sm:p-5">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-action text-xl leading-none font-bold text-white sm:size-14 sm:text-3xl">{formatPercent(100).match(/[%٪]/)?.[0]}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-action">{t("home.discountOffer")}</p>
            <p className="mt-0.5 leading-tight font-bold sm:text-2xl">{t("home.saveWhenYouPayInStore")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-rule bg-mauve p-2 sm:gap-3 sm:p-3">
            <div aria-hidden="true" className="grid size-10 shrink-0 grid-cols-9 grid-rows-9 rounded-md bg-white p-1.5 sm:size-14 sm:p-2">
              {passPattern.flatMap((row, y) => [...row].map((cell, x) => (
                <span key={`${y}-${x}`} className={cell === "1" ? "bg-ink" : undefined} />
              )))}
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-5 font-bold">{t("home.discountPass")}</p>
              <p className="mt-0.5 text-sm leading-5 text-muted">{t("home.showAtCheckout")}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col justify-center rounded-lg bg-ink p-2.5 text-white sm:p-3">
            <p className="text-sm leading-5 font-semibold text-mauve">{t("common.cashback")}</p>
            <p className="mt-0.5 text-lg leading-tight font-bold sm:text-2xl">{t("home.balanceProgress")}</p>
          </div>
        </div>
      </div>
    </figure>
  );
}

export default async function Home() {
  const { t } = await getI18n();
  const [beforeCity, punctuation, afterCity] = t("home.title").split(/\{city\}(،?)/);
  const account = await getAccount().catch(() => null);
  const roles = account?.roles ?? [];
  const primaryAction = roles.includes("customer") ? { href: "/customer", label: t("home.viewCashback") }
    : roles.includes("merchant") ? { href: "/merchant/campaigns", label: t("navigation.merchantDashboard") }
    : roles.includes("admin") ? { href: "/admin/topups", label: t("navigation.admin") }
    : roles.includes("marketer") ? null
    : { href: "/login", label: t("common.signIn") };
  return (
    <>
      <section className="relative isolate overflow-hidden bg-[linear-gradient(135deg,var(--color-mauve)_0%,var(--color-canvas)_100%)] lg:bg-none">
        <div aria-hidden="true" className="absolute inset-y-0 end-0 -z-10 hidden w-1/2 bg-linear-to-l from-mauve from-70% to-canvas rtl:bg-linear-to-r lg:block" />
        <div className="page-wrap grid items-center gap-4 py-6 sm:gap-6 sm:py-8 md:max-lg:max-w-[44rem] lg:min-h-[25rem] lg:max-w-7xl lg:grid-cols-2 lg:gap-10 lg:py-8 xl:gap-12">
          <div className="min-w-0">
            <h1 className="max-w-xl text-[clamp(1.875rem,8vw,2.625rem)] leading-[1.2] font-bold text-balance md:text-4xl lg:text-[clamp(2.5rem,3.4vw,3rem)]">
              {beforeCity}<span className="text-action">{t("home.city")}</span>{punctuation}<span className="lg:block">{afterCity}</span>
            </h1>
            <p className="mt-3 max-w-md leading-7 text-pretty text-muted sm:text-lg sm:leading-8 lg:max-w-[25rem]">
              {t("home.openTheOfferLinkAndShow")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5">
                {primaryAction ? (
                  <Link href={primaryAction.href} className="button-primary">{primaryAction.label}</Link>
                ) : (
                  <p className="text-sm font-semibold text-muted">{t("home.youReSignedInAsA")}</p>
                )}
              <button
                type="button"
                {...{ command: "show-modal", commandfor: "how-it-works-dialog" }}
                aria-haspopup="dialog"
                aria-controls="how-it-works-dialog"
                className="text-link inline-flex min-h-11 cursor-pointer items-center text-sm text-action-hover sm:text-base"
              >
                {t("home.howDoIUseAnOffer")}
              </button>
            </div>
          </div>
          <OfferPreview />
        </div>
      </section>
      <section id="how-it-works" aria-labelledby="how-section-title" className="scroll-mt-6 border-y border-rule bg-white">
        <div className="page-wrap py-6 sm:py-8">
          <h2 id="how-section-title" className="text-xl leading-tight font-bold sm:text-2xl">{t("home.howMardoodWorks")}</h2>
          <OfferSteps className="mt-4 grid gap-y-4 md:grid-cols-3 md:gap-x-6" />
        </div>
      </section>
      <section id="benefits" aria-labelledby="benefits-title" className="page-wrap scroll-mt-6 py-7 sm:py-9">
        <h2 id="benefits-title" className="text-xl leading-tight font-bold sm:text-2xl">{t("home.whyChooseMardood")}</h2>
        <ul role="list" className="mt-4 grid gap-3 md:grid-cols-3 md:gap-4">
          {benefits.map(({ title, detail, icon }) => (
            <li key={title} className="surface grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-4">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-mauve text-ink">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
              </span>
              <div>
                <h3 className="leading-6 font-bold">{t(title)}</h3>
                <p className="mt-1 text-sm leading-6 text-pretty text-muted">{t(detail)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-6 border-t border-rule bg-white">
        <div className="page-wrap grid gap-4 py-7 sm:py-9 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,1fr)] lg:gap-10">
          <h2 id="faq-title" className="text-xl leading-tight font-bold sm:text-2xl">{t("home.frequentlyAskedQuestions")}</h2>
          <div className="divide-y divide-rule border-y border-rule">
            {questions.map(({ title, answer }) => (
              <details key={title} name="mardood-faq" className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-sm px-2 py-2.5 font-semibold hover:bg-mauve/50 focus-visible:outline-offset-0 motion-safe:transition-colors [&::-webkit-details-marker]:hidden">
                  {t(title)}
                  <span aria-hidden="true" className="relative grid size-6 shrink-0 place-items-center rounded-full bg-mauve text-ink before:h-px before:w-2.5 before:bg-current after:absolute after:h-2.5 after:w-px after:bg-current group-open:after:hidden" />
                </summary>
                <p className="max-w-[65ch] px-2 pt-1 pb-4 leading-7 text-muted">{t(answer)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <dialog
        id="how-it-works-dialog"
        aria-labelledby="how-title"
        closedby="any"
        className="surface m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto bg-canvas p-5 text-ink backdrop:bg-ink/45 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 id="how-title" className="text-xl leading-tight font-bold sm:text-2xl">{t("home.howDoIUseAnOffer")}</h2>
          <form method="dialog">
            <button type="submit" className="button-secondary cursor-pointer px-3 text-sm">{t("common.close")}</button>
          </form>
        </div>
        <OfferSteps className="mt-4 grid gap-y-3" />
      </dialog>
    </>
  );
}
