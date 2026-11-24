export const payoutStatuses = ["pending_review", "confirmed", "rejected"] as const;
export type PayoutStatus = typeof payoutStatuses[number];

export interface Payout {
  id: string;
  amountSyp: number;
  status: PayoutStatus;
  createdAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
}

export interface AdminPayout extends Payout {
  marketerId: string;
  marketerName: string;
}

export const payoutMovementKinds = ["marketer_commission_credit", "payout_hold", "payout_release_refund", "payout_completed"] as const;
export interface PayoutMovement {
  id: string;
  kind: typeof payoutMovementKinds[number];
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  shopName: string | null;
  createdAt: string;
}

export type WithdrawalAttempt = { key: string; expectedAmountSyp: number };
export type PayoutSearchParams = Record<string, string | string[] | undefined>;
export const payoutUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function payoutPage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function payoutStatus(value: string | string[] | undefined) {
  return payoutStatuses.find((status) => status === value);
}

export function payoutListQuery(page: number, status?: PayoutStatus) {
  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) query.set("status", status);
  return query;
}

export function validWithdrawal(value: unknown): value is WithdrawalAttempt {
  if (typeof value !== "object" || value === null) return false;
  const { key, expectedAmountSyp } = value as Partial<WithdrawalAttempt>;
  return typeof key === "string" && payoutUuid.test(key)
    && typeof expectedAmountSyp === "number" && Number.isSafeInteger(expectedAmountSyp) && expectedAmountSyp > 0;
}
