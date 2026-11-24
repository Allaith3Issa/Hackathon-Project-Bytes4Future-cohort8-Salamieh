import { getI18n } from "@/lib/i18n-server";
import type { MerchantWallet } from "@/lib/staff-contract";

export async function MerchantBalances({ wallet }: { wallet: MerchantWallet }) {
  const { t, formatSyp } = await getI18n();
  return (
    <dl className="stamp-depth grid overflow-hidden rounded-xl border border-rule sm:grid-cols-[1.2fr_0.8fr]">
      <div className="min-w-0 bg-ink p-5 text-white sm:p-7">
        <dt className="text-sm font-semibold">{t("earnings.availableBalance")}</dt>
        <dd className="mt-2 text-3xl font-bold tabular-nums wrap-anywhere"><bdi>{formatSyp(wallet.availableBalanceSyp)}</bdi></dd>
      </div>
      <div className="min-w-0 bg-mauve p-5 sm:p-7">
        <dt className="text-sm font-semibold">{t("merchantReporting.lockedReserves")}</dt>
        <dd className="mt-2 text-3xl font-bold tabular-nums wrap-anywhere"><bdi>{formatSyp(wallet.totalLockedReservesSyp)}</bdi></dd>
      </div>
    </dl>
  );
}
