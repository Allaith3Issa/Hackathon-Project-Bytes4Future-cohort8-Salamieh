import type { Metadata } from "next";
import { RecoveringSession } from "@/components/recovering-session";
import { PayoutList } from "@/components/payout-list";
import type { Page } from "@/lib/contract";
import { getI18n } from "@/lib/i18n-server";
import { payoutListQuery, payoutPage, payoutStatus, type AdminPayout, type PayoutSearchParams } from "@/lib/payouts";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import { staffError } from "@/lib/staff-ui";

const path = "/admin/payouts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("payouts.adminTitle") };
}

export default async function AdminPayouts({ searchParams }: { searchParams: Promise<PayoutSearchParams> }) {
  const account = await requirePageRole("admin");
  if (!account) return <RecoveringSession />;
  const i18n = await getI18n();
  const { t } = i18n;
  const incoming = await searchParams;
  const status = incoming.status === "all" ? undefined : payoutStatus(incoming.status) ?? "pending_review";
  const pageHref = (page: number) => `${path}?status=${status ?? "all"}&page=${page}`;
  let data: Page<AdminPayout> | undefined;
  let error: string | undefined;
  try {
    data = await authenticatedRequest<Page<AdminPayout>>(`${path}?${payoutListQuery(payoutPage(incoming.page), status)}`);
  } catch (failure) {
    await expiredRedirect(failure, "admin");
    error = staffError(failure, t);
  }
  return (
    <div className="page-wrap max-w-4xl space-y-5 py-7 sm:py-10">
      <header className="space-y-2">
        <h1 className="page-title">{t("payouts.adminTitle")}</h1>
        <p className="text-muted">{t("payouts.simulation")}</p>
      </header>
      {incoming.decision === "conflict" && <p role="status" className="notice">{t("payouts.decisionConflict")}</p>}
      <PayoutList path={path} data={data} status={status} pageHref={pageHref} i18n={i18n} adminId={account.id} error={error} />
    </div>
  );
}
