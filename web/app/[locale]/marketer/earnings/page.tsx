import type { Metadata } from "next";
import { RecoveringSession } from "@/components/recovering-session";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requirePageRole } from "@/lib/staff";
import type { MarketerWallet } from "@/lib/staff-contract";
import { staffError } from "@/lib/staff-ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("earnings.marketerTitle") };
}

export default async function MarketerEarningsPage() {
  if (!(await requirePageRole("marketer"))) return <RecoveringSession />;
  const { t, locale, formatSyp } = await getI18n();
  let wallet: MarketerWallet | undefined;
  let failure: string | undefined;
  try {
    wallet = await authenticatedRequest<MarketerWallet>("/marketer/wallet");
  } catch (error) {
    await expiredRedirect(error);
    failure = staffError(error, t);
  }

  return (
    <div className="page-wrap max-w-3xl space-y-6 py-7 sm:py-12">
      <header>
        <h1 className="page-title">{t("earnings.marketerTitle")}</h1>
        <p className="mt-2 max-w-prose leading-7 text-muted">{t("earnings.marketerIntro")}</p>
      </header>
      {wallet ? (
        <dl className="grid overflow-hidden rounded-xl border border-rule sm:grid-cols-2">
          <div className="min-w-0 bg-ink p-5 text-white sm:p-7">
            <dt className="text-sm font-semibold">{t("earnings.totalCommission")}</dt>
            <dd className="mt-3 text-3xl font-bold leading-tight tabular-nums wrap-anywhere sm:text-4xl">
              <bdi>{formatSyp(wallet.totalEarnedSyp)}</bdi>
            </dd>
          </div>
          <div className="min-w-0 bg-mauve p-5 sm:p-7">
            <dt className="text-sm font-semibold">{t("earnings.availableBalance")}</dt>
            <dd className="mt-3 text-3xl font-bold leading-tight tabular-nums wrap-anywhere sm:text-4xl">
              <bdi>{formatSyp(wallet.availableBalanceSyp)}</bdi>
            </dd>
          </div>
        </dl>
      ) : (
        <>
          <p role="alert" className="notice-error">{failure}</p>
          <a href={localizedPath("/marketer/earnings", locale)} className="button-secondary">{t("common.tryAgain")}</a>
        </>
      )}
    </div>
  );
}
