/**
 * Customer dashboard DTO aligned 1:1 with CustomerDashboardDto
 * in api/src/reporting/dto/customer-reporting.dto.ts and API_CONTRACT.md.
 * Monetary fields ending in Syp are nonnegative integers in minor units (100 = 1.00 new SYP).
 */
export interface CustomerDashboard {
  verifiedPurchaseCount: number;
  milestonePurchaseCount: number;
  milestonePurchasesRequired: number;
  milestoneSpendSyp: number;
  milestoneSpendRequiredSyp: number;
  lockedCashbackSyp: number;
  availableCashbackSyp: number;
  totalCashbackUnlockedSyp: number;
}
