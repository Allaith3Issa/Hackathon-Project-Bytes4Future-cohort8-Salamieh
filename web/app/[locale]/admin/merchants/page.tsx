import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { MerchantVerificationList } from "@/components/merchant-verification-list";
import { RecoveringSession } from "@/components/recovering-session";
import { ApiError } from "@/lib/api";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import { merchantVerificationStatuses, type AdminMerchant, type MerchantVerificationStatus, type Page } from "@/lib/staff-contract";
import { staffError } from "@/lib/staff-ui";

const path = "/admin/merchants";

function verificationUrl(status: MerchantVerificationStatus, page = 1) {
  const query = new URLSearchParams();
  if (status !== "pending") query.set("status", status);
  if (page !== 1) query.set("page", String(page));
  return query.size ? `${path}?${query}` : path;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("verification.title") };
}

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>;
}) {
  if (!(await requirePageRole("admin"))) return <RecoveringSession />;
  const { t, locale, formatNumber } = await getI18n();
  const query = await searchParams;
  const status = merchantVerificationStatuses.find((value) => value === query.status) ?? "pending";
  const page = typeof query.page === "string" && /^[1-9][0-9]{0,7}$/.test(query.page) ? Number(query.page) : 1;
  let queue: Page<AdminMerchant> | undefined;
  let failure: string | undefined;
  try {
    queue = await authenticatedRequest<Page<AdminMerchant>>(`${path}?verificationStatus=${status}&page=${page}`);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    await expiredRedirect(error);
    failure = staffError(error, t);
  }

  return (
    <div className="page-wrap max-w-4xl space-y-6 py-7 sm:py-12">
      <header>
        <h1 className="page-title">{t("verification.title")}</h1>
        <p className="mt-2 max-w-prose leading-7 text-muted">{t("verification.intro")}</p>
      </header>
      <nav aria-label={t("verification.filter")} className="flex flex-wrap gap-2 border-b border-rule pb-3">
        {merchantVerificationStatuses.map((value) => (
          <Link
            key={value}
            href={verificationUrl(value)}
            aria-current={value === status ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-mauve aria-[current=page]:bg-mauve aria-[current=page]:text-ink"
          >
            {t(`verification.${value}`)}
          </Link>
        ))}
      </nav>
      {queue ? (
        <>
          <MerchantVerificationList key={status} status={status} merchants={queue.items} total={queue.total} />
          {(queue.previousPage || queue.nextPage) && (
            <nav aria-label={t("verification.pagination")} className="flex flex-wrap items-center gap-3">
              {queue.previousPage && (
                <Link href={verificationUrl(status, Math.min(queue.previousPage, Math.max(1, Math.ceil(queue.total / queue.pageSize))))} className="button-secondary">
                  {t("common.previousPage")}
                </Link>
              )}
              <span className="text-sm text-muted">{t("verification.page", { page: formatNumber(queue.page) })}</span>
              {queue.nextPage && (
                <Link href={verificationUrl(status, queue.nextPage)} className="button-secondary">{t("common.nextPage")}</Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <>
          <p role="alert" className="notice-error">{failure}</p>
          <a href={localizedPath(verificationUrl(status, page), locale)} className="button-secondary">{t("common.tryAgain")}</a>
        </>
      )}
    </div>
  );
}
