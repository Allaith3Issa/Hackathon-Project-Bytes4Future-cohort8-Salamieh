# Affiliate Marketing Platform API

**Three-day demo scope.** Product campaigns only, open joining, fixed commission, and one item per sale. Demo accounts are seeded. The core flow is admin top-up, merchant campaign launch, Expo join and share, web referral and Offer QR, manual merchant redemption, commission and cashback updates, and campaign closure with reserve release. Cashback voucher redemption is the first extension. Store discounts, approval workflows, camera scanning, full marketer web, advanced reports, direct merchant referrals, and payout receipt workflows are backlog for this demo. This scope governs the hackathon. The detailed product descriptions below also cover future work.

**Draft v4 · Shared by Next.js and React Native (Expo)**

This contract aligns with [DATABASE_ERD.md](DATABASE_ERD.md) and [Affiliate Marketing Platform.md](Affiliate%20Marketing%20Platform.md). The NestJS implementation must publish the same routes, request/response schemas, status codes, and errors in Swagger. All routes below are relative to `/api/v1`.

## Conventions

- Use JSON and camelCase. IDs are UUID strings unless noted. Timestamps use UTC ISO 8601. Phone numbers match `^09[0-9]{8}$`. Amounts ending in `Syp` are nonnegative whole SYP integers. See [Monetary limits and precision](#monetary-limits-and-precision).
- Protected routes use `Authorization: Bearer <accessToken>`. One user may hold multiple public roles (`customer`, `marketer`, `merchant`). Validate role and resource ownership on every protected request. Provision `admin` out of band.
- Return single resources directly. Paginated lists accept `page` (default `1`) and `pageSize` (default `20`, max `100`) and return `{ items, page, pageSize, total, previousPage, nextPage }`. Default sort is newest first with ID tie-breaker unless specified.
- Backend calculates every display figure (pricing, worst-case reserve, cashback splits, balances, totals, conversion rates, ranks, pagination). Frontends never duplicate business arithmetic.
- Use `Idempotency-Key` UUID header on merchant campaign launches, merchant QR scan redemptions (`offer` and `voucher`), customer voucher issuance, admin merchant top-ups, and marketer payout requests so retries never double-credit or double-deduct. Reusing a committed key with a different payload returns `409 IDEMPOTENCY_KEY_REUSED`.

### Errors

```json
{
  "statusCode": 409,
  "code": "INSUFFICIENT_MERCHANT_BALANCE",
  "message": "Your available balance is lower than the required worst-case campaign reserve."
}
```

Validation errors may include `fieldErrors: Record<string, string[]>`. Scoped private resource lookups return `404 NOT_FOUND` when missing or owned by another user.

| HTTP | Codes |
| --- | --- |
| `400` | `VALIDATION_ERROR` |
| `401` | `AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `REFRESH_TOKEN_INVALID`, `SESSION_EXPIRED` |
| `403` | `FORBIDDEN`, `MERCHANT_NOT_VERIFIED`, `SELF_PROMOTION_FORBIDDEN` |
| `404` | `NOT_FOUND` |
| `409` | `AMOUNT_OUT_OF_RANGE`, `PHONE_ALREADY_REGISTERED`, `CAMPAIGN_ENDED`, `CAMPAIGN_LIMIT_EXCEEDED`, `INSUFFICIENT_MERCHANT_BALANCE`, `INSUFFICIENT_LOCKED_BUDGET`, `INSUFFICIENT_CASHBACK_BALANCE`, `INSUFFICIENT_WALLET_BALANCE`, `JOIN_REQUEST_PENDING`, `INVALID_STATUS_TRANSITION`, `QR_ALREADY_REDEEMED`, `QR_EXPIRED`, `VOUCHER_EXCEEDS_BILL`, `IDEMPOTENCY_KEY_REUSED` |
| `429` | `RATE_LIMITED` |
| `500` | `INTERNAL_ERROR` |

## Authentication and sessions

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /auth/register` | Public | `{ name, phone, password, roles, shop? }`. `roles` is a nonempty distinct array from `["customer", "marketer", "merchant"]`. `shop: { name, details }` is required when `"merchant"` is included. | `201 AuthSession` |
| `POST /auth/login` | Public | `{ phone, password }` | `200 AuthSession` |
| `POST /auth/admin/login` | Public | `{ phone, password }` (admin accounts only; returns `401 INVALID_CREDENTIALS` for non-admin) | `200 AuthSession` |
| `POST /auth/refresh` | Public | `{ refreshToken }` (rotates refresh token; rejects reuse and 30-day inactive sessions) | `200 AuthSession` |
| `POST /auth/logout` | Signed in | `{ refreshToken? }` | `204 No Content` |
| `GET /auth/me` | Signed in | None | `200 Account` |

```ts
type Role = 'admin' | 'customer' | 'marketer' | 'merchant';
type VerificationStatus = 'pending' | 'verified' | 'rejected';

type Account = {
  id: string;
  name: string;
  phone: string;
  roles: Role[];
  createdAt: string;
  merchant: {
    name: string;
    details: string;
    verificationStatus: VerificationStatus;
    contractReference: string | null;
  } | null;
  customer: {
    verifiedPurchaseCount: number;
    availableCashbackSyp: number;
    lockedCashbackSyp: number;
  } | null;
};

type AuthSession = {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  user: Account;
};
```

Web (`frontend/`) stores `accessToken` and `refreshToken` inside server-managed `HttpOnly` cookies via a Next.js session boundary. React Native (Expo) stores them in Secure Storage and sends `Authorization: Bearer <accessToken>`.

## Campaigns and participation

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /campaigns` | Marketer | `page`, `pageSize`, optional `q`, optional `joinMode`, optional `campaignType` | `200 Page<Campaign>` of active campaigns |
| `GET /campaigns/{campaignId}` | Marketer | None | `200 Campaign` |
| `POST /merchant/campaigns/preview` | Merchant | `CampaignPreviewInput` | `200 CampaignPreview`; read-only calculation |
| `POST /merchant/campaigns` | Verified merchant | `CampaignInput` + `Idempotency-Key` | `201 MerchantCampaign`. Atomically creates the campaign and locks `worstCaseReserveSyp`. |
| `GET /merchant/campaigns` | Merchant | Pagination, optional `status` | `200 Page<MerchantCampaign>` |
| `GET /merchant/campaigns/{campaignId}` | Campaign owner | None | `200 MerchantCampaign` |
| `POST /merchant/campaigns/{campaignId}/close` | Campaign owner | None | `200 MerchantCampaign`. Ends campaign and unlocks unused reserve. |
| `GET /merchant/campaigns/{campaignId}/participants` | Campaign owner | Pagination, optional `status` | `200 Page<MerchantParticipant>` |
| `PATCH /merchant/campaigns/{campaignId}/participants/{membershipId}` | Campaign owner | `{ status: "approved" \| "rejected" }` | `200 MerchantParticipant` |
| `POST /marketer/campaigns/{campaignId}/join` | Marketer | None | `201` (or `200` if already approved / resubmitted) `MarketerMembership` |
| `GET /marketer/campaigns/{campaignId}/membership` | Marketer | None | `200 { membership: MarketerMembership \| null }` |
| `GET /marketer/memberships` | Marketer | Pagination, optional `status` | `200 Page<MarketerMembership>` |

```ts
type CampaignType = 'product' | 'store_discount';
type JoinMode = 'open' | 'approval_required';
type CampaignStatus = 'active' | 'ended';
type JoinStatus = 'pending' | 'approved' | 'rejected';

type CommissionSpec =
  | { type: 'fixed'; amountSyp: number }
  | { type: 'percentage'; percent: number };

type CampaignPreviewInput =
  | {
      campaignType: 'product';
      originalPriceSyp: number;
      discountPercent: number;
      commission: CommissionSpec;
      maxItems: number;
    }
  | {
      campaignType: 'store_discount';
      discountPercent: number;
      commission: { type: 'percentage'; percent: number };
      maxSalesVolumeSyp: number;
    };

type CampaignPreview = {
  finalPriceSyp: number | null;
  sampleSaleAmountSyp: number;
  commissionPerUnitSyp: number;
  platformTotalFeeSampleSyp: number;
  customerCashbackSampleSyp: number;
  platformNetFeeSampleSyp: number;
  merchantNetSampleSyp: number;
  worstCaseReserveSyp: number;
  isAffordableByMerchant: boolean;
  merchantAvailableBalanceSyp: number;
};

type CampaignInput = CampaignPreviewInput & {
  productName: string;
  description: string;
  imageUrl: string;
  endsAt: string;
  joinMode: JoinMode;
};

type Campaign = {
  id: string;
  campaignType: CampaignType;
  shopName: string;
  productName: string;
  description: string;
  imageUrl: string;
  originalPriceSyp: number | null;
  discountPercent: number;
  finalPriceSyp: number | null;
  commission: CommissionSpec;
  commissionPerItemSyp: number | null;
  joinMode: JoinMode;
  status: CampaignStatus;
  endsAt: string;
};

type CampaignUsage = {
  maxItems: number | null;
  itemsSold: number;
  itemsLeft: number | null;
  maxSalesVolumeSyp: number | null; // Discounted cash sales cap for store campaigns
  salesVolumeSyp: number;
  salesVolumeLeftSyp: number | null;
  worstCaseReserveSyp: number;
  lockedBudgetSyp: number;
  commissionsPaidSyp: number;
  platformFeesPaidSyp: number;
};

type MerchantCampaign = Campaign & {
  directReferralUrl: string | null; // null when direct referrals are disabled
  usage: CampaignUsage;
  stats: MerchantStats;
};

type Membership = { id: string; status: JoinStatus; requestedAt: string };
type MarketerMembership = Membership & { campaign: Campaign; referralUrl: string | null; stats: MarketerStats };
type MerchantParticipant = Membership & { marketerId: string; name: string; stats: MarketerStats };
```

## Public offers, Customer QR passes & Cashback

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /public/referrals/{code}` | Public | None (works for both marketer `referral_code` and `direct_referral_code`) | `200 PublicOffer` |
| `POST /public/referrals/{code}/clicks` | Public | None (call once on real navigation, never on SSR/prefetch) | `204 No Content` |
| `POST /customer/referrals/{code}/offer-qr` | Customer | None | `200 OfferQrPass` for the existing active pass or `201 OfferQrPass` for a new pass. Concurrent requests for the same customer, campaign and attribution return the same pass. |
| `GET /customer/dashboard` | Customer | None | `200 CustomerDashboard` |
| `GET /customer/purchases` | Customer | Pagination | `200 Page<CustomerPurchase>` |
| `POST /customer/cashback-vouchers` | Customer | `{ amountSyp: number }` + `Idempotency-Key` | `201 CashbackVoucher` |
| `GET /customer/cashback-vouchers` | Customer | Pagination, optional `status` | `200 Page<CashbackVoucher>` |
| `POST /customer/cashback-vouchers/{voucherId}/cancel` | Customer | None | `200 CashbackVoucher` (releases an active reservation or returns the already-cancelled voucher) |

```ts
type PublicOffer = {
  campaignId: string;
  campaignType: CampaignType;
  shopName: string;
  shopDetails: string;
  productName: string;
  description: string;
  imageUrl: string;
  originalPriceSyp: number | null;
  discountPercent: number;
  finalPriceSyp: number | null;
  endsAt: string;
  status: CampaignStatus;
  attributionLabel: string;
};

type OfferQrPass = {
  passId: string;
  campaignId: string;
  campaignType: CampaignType;
  productName: string;
  shopName: string;
  discountPercent: number;
  finalPriceSyp: number | null;
  qrToken: string;
  passCode: string;
  status: 'active' | 'redeemed' | 'expired';
  createdAt: string;
};

type CustomerDashboard = {
  verifiedPurchaseCount: number;
  milestonePurchaseCount: number;
  milestonePurchasesRequired: number;
  milestoneSpendSyp: number;
  milestoneSpendRequiredSyp: number;
  lockedCashbackSyp: number;
  availableCashbackSyp: number;
  totalCashbackUnlockedSyp: number;
};

type CustomerPurchase = {
  saleId: string;
  shopName: string;
  productName: string;
  quantity: number;
  customerPaidCashSyp: number;
  cashbackEarnedSyp: number;
  scannedAt: string;
};

type CashbackVoucher = {
  voucherId: string;
  amountSyp: number;
  qrToken: string;
  voucherCode: string;
  status: 'active' | 'redeemed' | 'cancelled';
  redeemedShopName: string | null;
  createdAt: string;
  redeemedAt: string | null;
};
```

## Merchant QR scanner & Wallet

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /merchant/scanner/lookup` | Verified campaign owner for Offer QR, verified merchant for voucher | `{ code: string }` (accepts `qrToken`, `passCode`, or `voucherCode`) | `200 ScannerLookupResult` (read-only preview before confirmation) |
| `POST /merchant/scanner/redeem-offer` | Verified campaign owner | `{ code: string, quantity?: number, originalBillSyp?: number }` + `Idempotency-Key` | `201 OfferRedeemResult` |
| `POST /merchant/scanner/redeem-voucher` | Verified merchant | `{ code: string, billTotalSyp: number }` + `Idempotency-Key` | `200 VoucherRedeemResult` |
| `GET /merchant/wallet` | Merchant | None | `200 MerchantWallet` |
| `GET /merchant/wallet/transactions` | Merchant | Pagination | `200 Page<MerchantWalletTransaction>` |
| `GET /merchant/dashboard` | Merchant | None | `200 MerchantDashboard` |

```ts
type ScannerLookupResult =
  | {
      kind: 'offer_qr';
      passId: string;
      campaignId: string;
      campaignType: CampaignType;
      productName: string;
      customerName: string;
      discountPercent: number;
      finalPriceSyp: number | null;
      maxQuantity: number | null;
      availableQuantityOptions: { quantity: number; customerPaidCashSyp: number }[];
      status: 'active';
    }
  | {
      kind: 'cashback_voucher';
      voucherId: string;
      customerName: string;
      amountSyp: number;
      status: 'active';
    };

type OfferRedeemResult = {
  saleId: string;
  campaignId: string;
  productName: string;
  quantity: number;
  originalAmountSyp: number;
  customerPaidCashSyp: number;
  marketerCommissionSyp: number;
  platformTotalFeeSyp: number;
  customerCashbackSyp: number;
  platformNetFeeSyp: number;
  remainingLockedBudgetSyp: number;
  campaignStatusAfterSale: CampaignStatus;
  scannedAt: string;
};

type VoucherRedeemResult = {
  voucherId: string;
  amountSyp: number;
  billTotalSyp: number;
  customerPaidCashSyp: number;
  merchantNewAvailableBalanceSyp: number;
  redeemedAt: string;
};

type MerchantWallet = {
  availableBalanceSyp: number;
  totalLockedReservesSyp: number;
  creditLimitSyp: number;
};

type MerchantWalletTransaction = {
  id: string;
  kind:
    | 'merchant_topup'
    | 'campaign_reserve_lock'
    | 'campaign_reserve_unlock'
    | 'sale_reserve_debit'
    | 'cashback_voucher_merchant_credit';
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  referenceNote: string | null;
  createdAt: string;
};
```

### Store-discount checkout

`POST /merchant/scanner/preview-offer` takes `{ code, originalBillSyp }` and requires the verified campaign owner. It returns `200 StoreDiscountPreview`. The pass must belong to a store-discount campaign. Use the same pricing and validation as redemption. Validate the positive bill and discounted cash amount, campaign state, remaining volume and reserve. At confirmation, `redeem-offer` takes the same bill and code and repeats those checks under the campaign lock. Reject discounted cash above the remaining volume with `409 CAMPAIGN_LIMIT_EXCEEDED` and keep the pass active. Reduce remaining volume by discounted cash paid. On reaching the cap, close and release any remaining reserve within the sale transaction.

```ts
type StoreDiscountPreview = {
  customerPaidCashSyp: number;
  marketerCommissionSyp: number;
  platformTotalFeeSyp: number;
  customerCashbackSyp: number;
  platformNetFeeSyp: number;
  totalDeductedReserveSyp: number;
};
```

## Marketer wallet, per-merchant breakdown, payouts & stats

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /marketer/wallet` | Marketer | None | `200 MarketerWallet` |
| `GET /marketer/wallet/by-merchant` | Marketer | Pagination | `200 Page<MarketerMerchantEarnings>` |
| `GET /marketer/wallet/transactions` | Marketer | Pagination | `200 Page<MarketerWalletTransaction>` |
| `POST /marketer/payouts` | Marketer | `{ amountSyp, method, accountDetails }` + `Idempotency-Key` | `201 PayoutRequest` |
| `GET /marketer/payouts` | Marketer | Pagination, optional `status` | `200 Page<PayoutRequest>` |
| `POST /marketer/payouts/{payoutId}/confirm` | Marketer owner | None | `200 PayoutRequest` (`transferred` -> `confirmed`) |
| `POST /marketer/payouts/{payoutId}/dispute` | Marketer owner | `{ reason: string }` | `200 PayoutRequest` (`transferred` -> `disputed`) |
| `GET /marketer/payouts/{payoutId}/receipt` | Payout owner or Admin | None | `200` receipt image bytes |
| `GET /marketer/stats` | Marketer | None | `200 MarketerStats` |
| `GET /public/leaderboard` | Public, optional bearer | Pagination | `200 Page<LeaderboardEntry> & { myRank: number \| null }` |

```ts
type PayoutMethod = 'sham_cash' | 'syriatel_cash' | 'cash';
type PayoutStatus = 'pending_review' | 'transferred' | 'confirmed' | 'disputed' | 'rejected';

type MarketerWallet = {
  availableBalanceSyp: number;
  pendingPayoutSyp: number;
  totalEarnedSyp: number;
  totalConfirmedPaidOutSyp: number;
};

type MarketerMerchantEarnings = {
  merchantId: string;
  shopName: string;
  salesCount: number;
  itemsSold: number;
  totalEarnedSyp: number;
};

type MarketerWalletTransaction = {
  id: string;
  kind: 'marketer_commission_credit' | 'payout_hold' | 'payout_release_refund' | 'payout_completed' | 'payout_transfer_reversal';
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  shopName: string | null;
  createdAt: string;
};

type PayoutRequest = {
  id: string;
  marketerId: string;
  marketerName: string;
  marketerPhone: string;
  amountSyp: number;
  method: PayoutMethod;
  accountDetails: string;
  status: PayoutStatus;
  transferReference: string | null;
  transferReceiptUrl: string | null;
  transferredAt: string | null;
  confirmedAt: string | null;
  disputeReason: string | null;
  rejectionReason: string | null;
  disputeResolution: {
    outcome: 'confirm_paid' | 'return_funds';
    note: string;
    reversalReference: string | null;
    resolvedAt: string;
  } | null;
  createdAt: string;
};

type MarketerStats = { clicks: number; itemsSold: number; earnedSyp: number; conversionRatePercent: number };
type MerchantStats = {
  clicks: number;
  salesCount: number;
  itemsSold: number;
  grossCashSalesSyp: number;
  commissionPaidSyp: number;
  platformFeesPaidSyp: number;
  conversionRatePercent: number;
};
type MerchantDashboard = {
  verificationStatus: VerificationStatus;
  wallet: MerchantWallet;
  activeCampaignsCount: number;
  topCampaign: { campaignId: string; productName: string; grossCashSalesSyp: number; salesCount: number } | null;
  stats: MerchantStats;
};
type LeaderboardEntry = { rank: number; marketerId: string; name: string; earnedSyp: number; registeredAt: string };
```

## Administration

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /admin/merchants` | Admin | Pagination, optional `verificationStatus` | `200 Page<AdminMerchant>` |
| `PATCH /admin/merchants/{merchantId}/verification` | Admin | `{ status: "verified" \| "rejected", contractReference?: string }` | `200 AdminMerchant` |
| `POST /admin/merchants/{merchantId}/topups` | Admin | `{ amountSyp, paymentMethod, referenceNote }` + `Idempotency-Key` | `201 AdminTopupResult` |
| `GET /admin/topups` | Admin | Pagination, optional `merchantId` | `200 Page<AdminTopupResult>` |
| `GET /admin/payouts` | Admin | Pagination, optional `status` | `200 Page<PayoutRequest>` |
| `POST /admin/payouts/{payoutId}/upload-receipt` | Admin | Multipart form image (`receipt`) | `200 { transferReceiptUrl: string }` |
| `PATCH /admin/payouts/{payoutId}/mark-transferred` | Admin | `{ transferReference, transferReceiptUrl }` | `200 PayoutRequest` |
| `PATCH /admin/payouts/{payoutId}/reject` | Admin | `{ reason: string }` | `200 PayoutRequest` (`pending_review` → `rejected`) |
| `PATCH /admin/payouts/{payoutId}/resolve-dispute` | Admin | `{ outcome: 'confirm_paid', note }` or `{ outcome: 'return_funds', note, reversalReference }` | `200 PayoutRequest` (`disputed` → `confirmed` or `rejected`) |
| `GET /admin/users` | Admin | Pagination, optional `role` | `200 Page<AdminUser>` |
| `GET /admin/campaigns` | Admin | Pagination, optional `status` | `200 Page<AdminCampaign>` |
| `GET /admin/overview` | Admin | None | `200 AdminOverview` |

### Payout accounting

- Requesting a payout moves funds from available to pending. Only a `pending_review` request can be rejected before transfer. Rejection releases the hold once.
- After sending funds, the admin records the receipt and a transfer reference unique per payment method. Moving to `transferred` clears the pending hold and records the external cash outflow in the same transaction. Repeating the same recorded transfer returns its existing result. Conflicting transfers or invalid transitions return `409 INVALID_STATUS_TRANSITION`.
- Receipt uploads accept JPEG, PNG, or WebP images up to 5 MB. The API stores images privately and returns a relative `transferReceiptUrl`; fetch the image through the authenticated receipt route as the payout owner or an Admin.
- The marketer can confirm or dispute a transferred payout. A periodic reconciliation marks still-transferred payouts confirmed once 72 hours have passed. Serialize transitions on the payout row and apply any due auto-confirmation before accepting a dispute. Confirmation and dispute change the payout status and preserve the receipt. The wallet was settled when the transfer was recorded.
- An admin resolves a dispute by confirming payment or verifying that the full transfer returned to the platform. On verified return, record the reversal reference and cash inflow, restore the amount to available, and mark the payout rejected in one transaction. Keep the original transfer record. Repeating the same resolution returns the existing result. Conflicting resolutions return `409 INVALID_STATUS_TRANSITION`.
- Pending payout liabilities cover pre-transfer holds. Report transferred or disputed payouts separately and include only confirmed payouts in `totalConfirmedPaidOutSyp`.

```ts
type AdminTopupResult = {
  topupId: string;
  merchantId: string;
  shopName: string;
  amountSyp: number;
  paymentMethod: 'cash' | 'sham_cash' | 'syriatel_cash' | 'bank_transfer';
  referenceNote: string;
  merchantNewAvailableBalanceSyp: number;
  createdAt: string;
};

type AdminUser = Pick<Account, 'id' | 'name' | 'phone' | 'roles' | 'createdAt'>;
type AdminMerchant = AdminUser & {
  merchant: NonNullable<Account['merchant']>;
  wallet: MerchantWallet;
};
type AdminCampaign = MerchantCampaign & { merchantId: string; shopName: string };

type AdminOverview = {
  merchantCount: number;
  marketerCount: number;
  customerCount: number;
  activeCampaignCount: number;
  settledSaleCount: number;
  grossCashSalesVolumeSyp: number;
  totalMerchantTopupsCollectedSyp: number;
  merchantAvailableEscrowSyp: number;
  campaignLockedReservesSyp: number;
  marketerAvailableLiabilitiesSyp: number;
  marketerPendingPayoutLiabilitiesSyp: number;
  marketerTransferredUnconfirmedSyp: number; // Transferred or disputed payouts
  customerLockedCashbackPoolSyp: number;
  customerAvailableCashbackPoolSyp: number;
  customerReservedVoucherCashbackSyp: number; // Sum of active voucher amounts
  netPlatformFeesSyp: number;
};
```

## Monetary limits and precision

- Validate every SYP input as a JSON integer from `0` through `9_007_199_254_740_991` inclusive. Prices, bill amounts, sales caps, top-ups, cashback vouchers and payouts must be positive. A fixed commission may be zero. Validate `maxItems` as an integer from `1` through `2_147_483_647`, matching the database column. Out-of-range inputs return `400 VALIDATION_ERROR`.
- Accept percentages with up to two decimal places. Convert them to integer basis points and use integer or exact decimal arithmetic for intermediate products, divisions and sums. For nonnegative amounts, floor at the points specified in the pricing rules. Validate the final monetary value before converting it to a JavaScript number or writing it to a `bigint` money column.
- Apply the same SYP range to calculated amounts and each resulting financial balance or monetary counter the operation persists. If a derived amount falls outside that range, return `409 AMOUNT_OUT_OF_RANGE` and roll back the operation, including its ledger entries and any reservation. Apply the same check to read-only previews. Calculate reported aggregates exactly and return `409 AMOUNT_OUT_OF_RANGE` if an amount in the response cannot fit in the supported range.

## Calculation and consistency rules

1. Validate `discountPercent` in `0..100`, `commission.percent` in `0..100`, nonnegative integer SYP values, future `endsAt`, valid HTTP/HTTPS `imageUrl`, and positive cap (`maxItems` for `product`, `maxSalesVolumeSyp` for `store_discount`). Apply the monetary and precision limits above.
2. `finalPriceSyp = floor(originalPriceSyp × (1 - discountPercent / 100))`.
3. Every sale calculates on the backend inside an atomic DB transaction:
   - `customerPaidCashSyp = finalPriceSyp × quantity` (for `product`) OR `floor(originalBillSyp × (1 - discountPercent / 100))` (for `store_discount`).
   - `platformTotalFeeSyp = floor(customerPaidCashSyp × 5 / 100)`.
   - `customerCashbackSyp = floor(customerPaidCashSyp × 2 / 100)`.
   - `platformNetFeeSyp = platformTotalFeeSyp - customerCashbackSyp`.
   - `marketerCommissionSyp = 0` for `merchant_direct`, else `commissionPerItemSyp × quantity` (`fixed`) or `floor(customerPaidCashSyp × commission.percent / 100)` (`percentage`).
   - `totalDeductedReserveSyp = marketerCommissionSyp + platformTotalFeeSyp`.
4. Campaign creation checks `merchant.availableBalanceSyp >= worstCaseReserveSyp` under the merchant wallet lock. Commit the new campaign, reserve transfer, ledger movement and saved launch response together. Every scan checks `campaign.lockedBudgetSyp >= totalDeductedReserveSyp` under a row lock.
5. Customer cashback unlocks from `lockedCashbackSyp` to `availableCashbackSyp` when `milestonePurchaseCount >= 5` and `milestoneSpendSyp >= 50000` (configurable thresholds, strictly backed by the 2% pool already collected inside `platformTotalFeeSyp`).
6. Conversion rate = `(itemsSold / clicks) × 100` rounded to 2 decimals (`0` when `clicks === 0`).


## Demo operation rules and shared examples

- `lookup` and both redemption routes accept a QR token or the matching human-readable code. Offer lookup and redemption require a verified merchant who owns the campaign. An out-of-scope code returns `404 NOT_FOUND` without disclosing customer details. Lookup returns the cash amount for quantity 1 before confirmation. The redemption response returns the settlement breakdown.
- Demo offer redemption accepts `{ code }` or `{ code, quantity: 1 }`. Other quantities and `originalBillSyp` return `400 VALIDATION_ERROR`. Demo campaign preview and launch accept product campaigns with fixed commission, a positive whole-SYP final price and a positive merchant net. Launch also requires `joinMode: 'open'`. Page links are `number | null`. For future store discounts, cap volume uses cash paid after discount.
- Offer QR issuance locks the campaign and checks status, end time and referral eligibility before finding or creating the pass. The database allows one active pass per customer, campaign and attribution. Requests serialized behind a successful issuance return `200` and the same pass ID, token and code. A redeemed pass allows a new pass while the campaign and referral remain eligible. Campaign close expires outstanding active passes. Use distinct referral code prefixes for marketer and merchant direct links.
- Replaying a committed key in the same actor and operation scope with the same validated payload returns the original status and body. A different payload returns `409 IDEMPOTENCY_KEY_REUSED`. A new key on a redeemed pass returns `409 QR_ALREADY_REDEEMED`. For each keyed operation, authenticate and validate the request shape, then claim or replay the key before checking mutable business state. Include the target resource identifier in the fingerprint when the route has one. Serialize concurrent use of the same key and store the successful response atomically with the mutation. This applies to launch and to the sale that closes a campaign.
- The campaign service owns close and release. Check caps, end time and reserve inside the sale transaction. Close on cap exhaustion, on explicit close, or through expiry reconciliation. Run reconciliation on reads that expose status or balances and in a periodic pass so idle campaigns release their funds. Closing twice returns the ended campaign without another credit. If settlement reaches the cap, close within that transaction and return `campaignStatusAfterSale: 'ended'` and `remainingLockedBudgetSyp: 0` after releasing any surplus. Store that final response for replay.
- Voucher issuance locks the customer balance, checks available cashback, creates the active reservation and stores the successful idempotency response in one transaction. Cancellation and redemption compete for the same active voucher. Cancellation restores the reservation once. A redeemed voucher rejects cancellation with `409 INVALID_STATUS_TRANSITION`. A cancelled voucher rejects redemption with the same error. A redeemed voucher rejects redemption under a fresh key with `409 QR_ALREADY_REDEEMED`.
- For the voucher extension, use a standalone checkout. The merchant enters `billTotalSyp` after shop discounts and before applying the voucher. It must be a positive safe JSON integer. If `billTotalSyp < amountSyp`, return `409 VOUCHER_EXCEEDS_BILL` and keep the voucher active. Otherwise consume the reservation and credit a verified merchant atomically. Return `customerPaidCashSyp = billTotalSyp - amountSyp`. Active voucher balances count toward the admin cashback liability.

| Scenario | Shared fixture and expected result |
| --- | --- |
| Insufficient balance | Merchant has 100000 SYP and launch needs 435000. Return `409 INSUFFICIENT_MERCHANT_BALANCE`. |
| Top-up and launch | Top up 400000. Product price 100000, discount 10%, fixed commission 10000, maxItems 30, `joinMode: 'open'`, product name and description, a valid image URL, and an end time after the demo. Launch locks 435000 and leaves 65000 available. |
| Lookup and sale | Use the freshly issued pass in the live rehearsal or `OF-DEMO01` in the scanner fixture. Lookup previews 90000 cash. Redeem with a UUID key and return `201` with cash 90000, commission 10000, fee 4500, cashback 1800, net fee 2700, and reserve 420500. |
| Replays | Retry identical body and key to get the original `201` and sale ID. Use another key for the same pass to get `409 QR_ALREADY_REDEEMED`. |
| Close | Close after that one sale. Release 420500, leaving 485500 available and zero locked. |
| Launch retry | In a separate fixture with enough funds for two reserves, resend the same launch body and key after a lost response. Expect the same `201` and campaign ID, with one 435000 SYP reserve lock. Reusing the key with a changed valid body returns `409 IDEMPOTENCY_KEY_REUSED`. |
| Concurrent issuance | Request an Offer QR twice in parallel for the same eligible customer, campaign and referral. Expect one `201` and one `200` with the same pass ID and code. |
| Final sale | In a separate fixture use the same 90000 SYP final price and 10000 SYP commission with `maxItems: 1`. The sale charges 14500 SYP and returns `campaignStatusAfterSale: 'ended'` and `remainingLockedBudgetSyp: 0`. Same-key retry returns the original `201` and sale ID. Explicit close adds no wallet credit. |
| Monetary boundary | With zero discount and commission, `originalPriceSyp: 9007199254740991` and `maxItems: 21` produce an exact reserve of 9457559217478029 SYP. Preview and launch return `409 AMOUNT_OUT_OF_RANGE`. The launch writes no campaign, reserve or ledger movement. An input amount of `9007199254740992` returns `400 VALIDATION_ERROR`. |

### Shared demo seed and API examples

Allaith publishes the resettable seed values and matching request and response samples on Day 1. Give web and Expo the public web and API base URLs, role identities, and the scanner fixture's campaign ID, membership ID, referral URL and pass code. Provide demo credentials through the team's private setup and keep them out of the documents and source control.

| Fixture | Starting state and purpose |
| --- | --- |
| Live rehearsal | Seed an admin, a verified merchant with 100000 SYP available, a marketer and a customer. Start without the live rehearsal campaign. The team creates it after the top-up, joins it from Expo, and issues its pass through the web flow. |
| Scanner development | Use an independent seed or database reset with a funded, active product campaign, approved marketer membership, customer and active Offer QR code `OF-DEMO01`. The campaign owner can preview and redeem this code while live QR issuance is being built. Use the same 90000 SYP final price, 10000 SYP commission and 30-item cap as the live rehearsal, with 435000 SYP already reserved and zero sales. |
| Voucher extension | Seed four settled purchases of 40000 SYP each for the customer in the current milestone cycle. The customer starts at 4 purchases, 160000 SYP of cycle spend and 3200 SYP locked cashback. The 90000 SYP sale adds 1800 SYP, so the fifth purchase unlocks 5000 SYP. Seed a second verified merchant to accept the voucher. Use a separate reset for the voucher integration tests that start with 10000 SYP available. |

The live rehearsal starts with admin top-up, then merchant preview and launch. The marketer calls `POST /marketer/campaigns/{campaignId}/join` with no body and shares the returned `referralUrl`. The web opens `/r/[code]` and calls `GET /public/referrals/{code}` for offer details. The signed-in customer calls `POST /customer/referrals/{code}/offer-qr` with no body. Use the returned `passCode` for merchant lookup and redemption. After settlement, refresh `GET /marketer/wallet` and `GET /customer/dashboard` before closing the campaign.

**Admin top-up.** Send this body to `POST /admin/merchants/{merchantId}/topups` for the live merchant with a fresh UUID in `Idempotency-Key`. Expect `201` and `merchantNewAvailableBalanceSyp: 500000`.

```json
{
  "amountSyp": 400000,
  "paymentMethod": "cash",
  "referenceNote": "Demo cash top-up"
}
```

**Merchant preview and launch.** Use the first five fields below for `POST /merchant/campaigns/preview`. Expect `200`, `finalPriceSyp: 90000`, and `worstCaseReserveSyp: 435000`. Use the full body for `POST /merchant/campaigns` with a fresh UUID in `Idempotency-Key`. Replace the sample image URL with a reachable demo asset and set `endsAt` after the rehearsal. Expect `201` and `usage.lockedBudgetSyp: 435000`.

```json
{
  "campaignType": "product",
  "originalPriceSyp": 100000,
  "discountPercent": 10,
  "commission": { "type": "fixed", "amountSyp": 10000 },
  "maxItems": 30,
  "productName": "Maamoul box",
  "description": "One kilogram",
  "imageUrl": "https://demo.example.test/maamoul.jpg",
  "endsAt": "2030-01-01T00:00:00Z",
  "joinMode": "open"
}
```

**Seeded scanner.** Send the body below to `POST /merchant/scanner/lookup` as the seeded campaign owner. Expect `200` with `availableQuantityOptions: [{ "quantity": 1, "customerPaidCashSyp": 90000 }]`. Send the same body to `POST /merchant/scanner/redeem-offer` with a fresh UUID in `Idempotency-Key`. Expect `201` with `marketerCommissionSyp: 10000`, `platformTotalFeeSyp: 4500`, `customerCashbackSyp: 1800`, `platformNetFeeSyp: 2700` and `remainingLockedBudgetSyp: 420500`. Repeat with the original key for the same result. With a fresh key, expect `409 QR_ALREADY_REDEEMED`.

```json
{
  "code": "OF-DEMO01"
}
```
