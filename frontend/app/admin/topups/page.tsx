import type { Metadata } from "next";
import { TopupForm } from "@/components/topup-form";
import { ApiError } from "@/lib/api";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requireRole } from "@/lib/staff";
import type { AdminMerchant, Page } from "@/lib/staff-contract";
import { staffError } from "@/lib/staff-ui";

export const metadata: Metadata = { title: "شحن رصيد تاجر" };

export default async function TopupsPage() {
  await requireRole("admin");
  let merchants: AdminMerchant[] = [];
  let failure: string | undefined;
  try {
    merchants = (await authenticatedRequest<Page<AdminMerchant>>("/admin/merchants?verificationStatus=verified&pageSize=100")).items;
  } catch (error) {
    expiredRedirect(error, "admin");
    failure = staffError(error);
    if (!(error instanceof ApiError)) throw error;
  }
  return (
    <div className="page-wrap max-w-2xl space-y-6 py-7 sm:py-12">
      <h1 className="page-title">شحن رصيد تاجر</h1>
      {failure ? (
        <>
          <p role="alert" className="notice-error">{failure}</p>
          <a href="/admin/topups" className="button-secondary">إعادة المحاولة</a>
        </>
      ) : merchants.length === 0 ? (
        <p className="notice">لا يوجد تجار موثّقون حالياً.</p>
      ) : <TopupForm merchants={merchants} />}
    </div>
  );
}
