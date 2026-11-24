"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { campaignIdPattern, marketerCampaignDetailPath, marketerMembershipsPath, type MarketerMembership } from "@/lib/marketer-campaigns";
import { authenticatedRequest } from "@/lib/session";
import { expiredRedirect, requireRole } from "@/lib/staff";
import { ApiError } from "@/lib/api";
import { staffError } from "@/lib/staff-ui";

export type JoinState = { error?: string; membership?: MarketerMembership };

export async function joinMarketerCampaign(id: string, expectedAccountId: string, _previous: JoinState): Promise<JoinState> {
  const account = await requireRole("marketer");
  const { t, locale } = await getI18n();
  if (account.id !== expectedAccountId || !campaignIdPattern.test(id)) return { error: t("errors.youDonTHavePermissionTo") };
  try {
    const membership = await authenticatedRequest<MarketerMembership>(`/marketer/campaigns/${id}/join`, { method: "POST" });
    revalidatePath(localizedPath(marketerCampaignDetailPath(id), locale, true));
    revalidatePath(localizedPath(marketerMembershipsPath, locale, true));
    return { membership };
  } catch (error) {
    await expiredRedirect(error, "marketer");
    if (error instanceof ApiError) {
      if (error.code === "SELF_PROMOTION_FORBIDDEN") return { error: t("marketerCampaigns.selfPromotion") };
      if (error.code === "JOIN_REQUEST_PENDING") return { error: t("marketerCampaigns.pending") };
      if (error.code === "CAMPAIGN_ENDED" || error.code === "NOT_FOUND") return { error: t("marketerCampaigns.unavailable") };
    }
    return { error: staffError(error, t) };
  }
}
