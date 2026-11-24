import Link from "@/components/localized-link";
import { AdminPayoutDecision } from "@/components/admin-payout-decision";
import type { Page } from "@/lib/contract";
import type { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { payoutStatuses, type Payout, type PayoutStatus } from "@/lib/payouts";

type I18n = Awaited<ReturnType<typeof getI18n>>;

export function PayoutNavigation({ data, href, i18n }: { data: Page<unknown>; href: (page: number) => string; i18n: I18n }) {
  const { t, formatNumber } = i18n;
  const last = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (!data.previousPage && !data.nextPage) return null;
  return (
    <nav aria-label={t("payouts.pages")} className="flex flex-wrap items-center gap-2 border-t border-rule p-4">
      {data.previousPage && <Link className="button-secondary" href={href(Math.min(last, data.previousPage))}>{t("common.previousPage")}</Link>}
      <span className="text-sm text-muted">{t("verification.page", { page: formatNumber(data.page) })}</span>
      {data.nextPage && <Link className="button-secondary" href={href(data.nextPage)}>{t("common.nextPage")}</Link>}
    </nav>
  );
}

export function PayoutList({ path, data, status, pageHref, i18n, adminId, activityPage, error }: {
  path: "/marketer/earnings" | "/admin/payouts";
  data?: Page<Payout>;
  status?: PayoutStatus;
  pageHref: (page: number) => string;
  i18n: I18n;
  adminId?: string;
  activityPage?: number;
  error?: string;
}) {
  const { t, locale, formatDate, formatSyp } = i18n;
  const statusColor = {
    pending_review: "bg-mauve text-ink",
    confirmed: "bg-success-bg text-success",
    rejected: "bg-info-bg text-info",
  } as const;
  return (
    <section id="payout-history" aria-labelledby="payout-history-title" className="surface scroll-mt-4">
      <div className="space-y-3 px-5 py-4">
        <h2 id="payout-history-title" className="text-xl font-bold">{t(adminId ? "payouts.queue" : "payouts.history")}</h2>
        <form action={localizedPath(path, locale)} method="get" className="flex flex-wrap items-end gap-2">
          {!!activityPage && activityPage > 1 && <input type="hidden" name="activityPage" value={activityPage} />}
          <label className="grid gap-1">
            {t("payouts.status")}
            <select key={status ?? "all"} name="status" defaultValue={status ?? "all"} className="min-h-11 rounded-lg border border-control bg-white px-3">
              <option value="all">{t("marketerCampaigns.all")}</option>
              {payoutStatuses.map((value) => <option value={value} key={value}>{t(`payouts.${value}`)}</option>)}
            </select>
          </label>
          <button type="submit" className="button-secondary">{t("marketerCampaigns.apply")}</button>
        </form>
      </div>
      {!data ? (
        <div className="border-t border-rule p-5">
          <p role="alert" className="notice-error">{error}</p>
          <a className="button-secondary mt-3" href={localizedPath(pageHref(1), locale)}>{t("common.tryAgain")}</a>
        </div>
      ) : data.items.length ? (
        <ul role="list" className="divide-y divide-rule border-t border-rule">
          {data.items.map((item) => (
            <li key={item.id} className="grid gap-3 px-5 py-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  {"marketerName" in item && typeof item.marketerName === "string" && (
                    <p className="font-semibold wrap-anywhere"><bdi>{item.marketerName}</bdi></p>
                  )}
                  <p className="text-lg font-bold wrap-anywhere"><bdi>{formatSyp(item.amountSyp)}</bdi></p>
                  <p className="text-sm text-muted">{t("payouts.requested")} <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></p>
                  {item.decidedAt && <p className="text-sm text-muted">{t("payouts.decided")} <time dateTime={item.decidedAt}>{formatDate(item.decidedAt)}</time></p>}
                </div>
                <span className={`rounded-md px-2 py-1 text-sm font-semibold ${statusColor[item.status]}`}>{t(`payouts.${item.status}`)}</span>
              </div>
              {item.rejectionReason && <p className="text-sm wrap-anywhere"><strong>{t("payouts.reason")}</strong>{" "}<bdi>{item.rejectionReason}</bdi></p>}
              {adminId && item.status === "pending_review" && "marketerName" in item && typeof item.marketerName === "string" && (
                <AdminPayoutDecision adminId={adminId} payout={{ id: item.id, amountSyp: item.amountSyp, marketerName: item.marketerName }} />
              )}
            </li>
          ))}
        </ul>
      ) : <p className="border-t border-rule p-5 text-muted">{t("payouts.empty")}</p>}
      {data && <PayoutNavigation data={data} href={pageHref} i18n={i18n} />}
    </section>
  );
}
