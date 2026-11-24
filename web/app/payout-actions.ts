"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { payoutStatuses, payoutUuid, validWithdrawal, type AdminPayout, type Payout, type WithdrawalAttempt } from "@/lib/payouts";
import { authenticatedRequest } from "@/lib/session";
import { requireRole } from "@/lib/staff";
import { staffError } from "@/lib/staff-ui";

const withdrawalRejections = {
  INSUFFICIENT_WALLET_BALANCE: "payouts.noBalance",
  PAYOUT_ALREADY_PENDING: "payouts.alreadyPending",
  PAYOUT_AMOUNT_CHANGED: "payouts.amountChanged",
  IDEMPOTENCY_KEY_REUSED: "payouts.keyConflict",
  INVALID_STATUS_TRANSITION: "payouts.decisionConflict",
  AMOUNT_OUT_OF_RANGE: "errors.theAmountIsOutsideTheSupported",
} as const;

export type WithdrawalResult = { outcome: "success" } | { outcome: "refresh" | "retry"; error: string };
export type AdminDecision = { action: "approve" } | { action: "reject"; reason: string };
export type DecisionResult = { outcome: "success"; status: "confirmed" | "rejected" }
  | { outcome: "conflict" | "retry" | "invalid"; error: string };

export async function requestWithdrawal(accountId: string, attempt: WithdrawalAttempt): Promise<WithdrawalResult> {
  const account = await requireRole("marketer");
  const { t, locale } = await getI18n();
  if (account.id !== accountId || !validWithdrawal(attempt)) return { outcome: "refresh", error: t("payouts.invalidRequest") };
  try {
    const result = await authenticatedRequest<Payout>("/marketer/payouts", {
      method: "POST", idempotencyKey: attempt.key, body: { expectedAmountSyp: attempt.expectedAmountSyp },
    });
    if (!result || !payoutUuid.test(result.id) || result.amountSyp !== attempt.expectedAmountSyp || !payoutStatuses.includes(result.status)) {
      return { outcome: "retry", error: t("payouts.retryWithdrawal") };
    }
    revalidatePath(localizedPath("/marketer/earnings", locale, true));
    return { outcome: "success" };
  } catch (error) {
    // Only the payout domain's conflict responses settle a valid attempt. An
    // intermediary 400/404 or an expired session cannot disprove an earlier commit.
    if (error instanceof ApiError && error.status === 409 && Object.hasOwn(withdrawalRejections, error.code)) {
      return { outcome: "refresh", error: t(withdrawalRejections[error.code as keyof typeof withdrawalRejections]) };
    }
    if (error instanceof ApiError && error.code === "VALIDATION_ERROR") return { outcome: "retry", error: t("payouts.invalidRequest") };
    if (error instanceof ApiError && error.status === 404) return { outcome: "retry", error: t("payouts.unavailable") };
    const needsSignIn = error instanceof ApiError && (error.status === 401 || error.status === 403);
    return { outcome: "retry", error: needsSignIn ? staffError(error, t) : t("payouts.retryWithdrawal") };
  }
}

export async function decidePayout(adminId: string, id: string, decision: AdminDecision): Promise<DecisionResult> {
  const account = await requireRole("admin");
  const { t, locale } = await getI18n();
  if (account.id !== adminId || !payoutUuid.test(id) || !decision || !["approve", "reject"].includes(decision.action)) {
    return { outcome: "invalid", error: t("payouts.invalidRequest") };
  }
  const reason = decision.action === "reject" && typeof decision.reason === "string" ? decision.reason.trim() : "";
  if (decision.action === "reject" && (!reason || reason.length > 500)) {
    return { outcome: "invalid", error: t("payouts.reasonRequired") };
  }
  try {
    const result = await authenticatedRequest<AdminPayout>(`/admin/payouts/${id}/${decision.action}`, {
      method: "PATCH", body: decision.action === "reject" ? { reason } : undefined,
    });
    const expected = decision.action === "approve" ? "confirmed" : "rejected";
    if (!result || result.id !== id || result.status !== expected || (expected === "rejected" && result.rejectionReason !== reason)) {
      return { outcome: "retry", error: t("payouts.retryDecision") };
    }
    revalidatePath(localizedPath("/admin/payouts", locale, true));
    revalidatePath(localizedPath("/admin/revenue", locale, true));
    return { outcome: "success", status: result.status };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "INVALID_STATUS_TRANSITION" || error.status === 404) {
        return { outcome: "conflict", error: t("payouts.decisionConflict") };
      }
      if (error.status === 400 || error.code === "AMOUNT_OUT_OF_RANGE") return { outcome: "invalid", error: staffError(error, t) };
      if (error.status === 401 || error.status === 403) return { outcome: "retry", error: staffError(error, t) };
    }
    return { outcome: "retry", error: t("payouts.retryDecision") };
  }
}
