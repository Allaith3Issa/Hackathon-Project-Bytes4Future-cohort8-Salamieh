/**
 * Marketer wallet DTO aligned 1:1 with API_CONTRACT.md (GET /api/v1/marketer/wallet).
 * All figures are nonnegative whole SYP integers computed strictly by the backend.
 */
export interface MarketerWallet {
  availableBalanceSyp: number;
  pendingPayoutSyp: number;
  totalEarnedSyp: number;
  totalConfirmedPaidOutSyp: number;
}
