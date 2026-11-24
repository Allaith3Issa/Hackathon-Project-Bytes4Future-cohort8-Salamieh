# Affiliate Marketing Platform API

**Three-day demo scope.** Product campaigns only, open joining, fixed commission, and one item per sale. Demo accounts are seeded. The core flow is admin top-up, merchant campaign launch, Expo join and share, web referral and Offer QR, manual merchant redemption, commission and cashback updates, and campaign closure with reserve release. Cashback voucher redemption is the first extension. Store discounts, approval workflows, camera scanning, full marketer web, advanced reports, direct merchant referrals, and payout receipt workflows are backlog for this demo. This scope governs the hackathon. The detailed product descriptions below also cover future work.

**Draft v4 · Shared by Next.js and React Native (Expo)**

This contract aligns with [DATABASE_ERD.md](DATABASE_ERD.md) and [Affiliate Marketing Platform.md](Affiliate%20Marketing%20Platform.md). The NestJS implementation must publish the same routes, request/response schemas, status codes, and errors in Swagger. All routes below are relative to `/api/v1`.

Endpoint groups identify any planned routes. See [implementation status](IMPLEMENTATION_STATUS.md) for tested workflows and known discrepancies.

## Conventions

- Use JSON and camelCase. IDs are UUID strings unless noted. Timestamps use UTC ISO 8601. Phone numbers match `^09[0-9]{8}$`. Monetary fields ending in `Syp` carry nonnegative JSON integers in minor units of the new Syrian Pound. Existing field names and JSON types are retained for MVP client compatibility. See [Monetary limits and precision](#monetary-limits-and-precision).
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
| `409` | `AMOUNT_OUT_OF_RANGE`, `PHONE_ALREADY_REGISTERED`, `CAMPAIGN_ENDED`, `CAMPAIGN_LIMIT_EXCEEDED`, `INSUFFICIENT_MERCHANT_BALANCE`, `INSUFFICIENT_LOCKED_BUDGET`, `INSUFFICIENT_CASHBACK_BALANCE`, `INSUFFICIENT_WALLET_BALANCE`, `PAYOUT_ALREADY_PENDING`, `PAYOUT_AMOUNT_CHANGED`, `JOIN_REQUEST_PENDING`, `INVALID_STATUS_TRANSITION`, `QR_ALREADY_REDEEMED`, `QR_EXPIRED`, `VOUCHER_EXCEEDS_BILL`, `IDEMPOTENCY_KEY_REUSED` |
| `429` | `RATE_LIMITED` |
| `500` | `INTERNAL_ERROR` |
| `503` | `DATABASE_UNAVAILABLE` |

## Service readiness

| Method and path | Access | Request | Responses |
| --- | --- | --- | --- |
| `GET /health` | Public | None | `200 { "status": "ok" }` or `503 DATABASE_UNAVAILABLE` |

This implemented operational endpoint at `/api/v1/health` checks PostgreSQL connectivity with a 2.5-second deadline and returns `Cache-Control: no-store`. The error response uses the standard envelope and omits connection details.

## Authentication and sessions

All routes in this section are implemented. Public registration is an implemented extension to the seeded-account demo.

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /auth/register` | Public | `{ name, phone, password, roles, shop? }`. `roles` is a nonempty distinct array from `["customer", "marketer", "merchant"]`. `shop: { name, details }` is required when `"merchant"` is included. | `201 AuthSession` |
| `POST /auth/login` | Public | `{ phone, password }` | `200 AuthSession` |
| `POST /auth/admin/login` | Public | `{ phone, password }` (admin accounts only; returns `401 INVALID_CREDENTIALS` for non-admin) | `200 AuthSession` |
| `POST /auth/refresh` | Refresh token | `{ refreshToken }` | `200 AuthSession` |
| `POST /auth/logout` | Valid access JWT for the session | `{ refreshToken? }` | `204 No Content` |
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

Web (`web/`) stores `accessToken` and `refreshToken` in server-managed `HttpOnly` cookies via a Next.js session boundary. Expo clients should use Secure Storage and send `Authorization: Bearer <accessToken>` on protected requests.

Access JWTs last 30 minutes (`expiresInSeconds: 1800`). Database sessions expire 30 days after creation, including admin sessions. Successful refresh rotates the opaque token and replaces its stored hash without changing expiry or the activity timestamp. The previous token cannot be reused. Logout revokes the session identified by the valid access JWT. If a refresh token is supplied, it must match the token currently bound to that session. Web logout with only a refresh cookie remains pending under [WEB-02](IMPLEMENTATION_STATUS.md#pending-and-deferred-audit-items).

Public accounts can hold multiple public roles. Public registration cannot assign `admin`. Provision the first admin manually with the [bootstrap CLI](../../api/ADMIN_BOOTSTRAP.md) after migrations. NestJS verifies the session, current roles, and relevant ownership independently of client navigation.

## Campaigns and participation

The MVP implements product campaign preview and launch with fixed commission and open joining, plus campaign listing, detail, closure, and marketer membership reads. Both `/participants` routes below describe deferred approval workflows. Store-discount types and related request shapes are retained for the deferred extension.

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

### Merchant product image upload

`POST /api/v1/merchant/uploads/image` accepts one `multipart/form-data` file part named `file`. It requires a Bearer access token for a verified merchant. It returns `201` with exactly `{ "imageUrl": "https://ik.imagekit.io/your-imagekit-id/mardood/products/example.webp" }` and `Cache-Control: no-store`. The URL uses the server’s configured delivery endpoint.

The input cap is **500,000 bytes**. The API accepts static JPEG, PNG and WebP and checks the decoded format and pixels. It rejects malformed images, MIME mismatches, SVG, GIF and multi-frame images. It limits decoded images to 16,000,000 pixels, applies EXIF orientation, strips source metadata and encodes a transparent-capable WebP. The initial maximum edge is 1,200 px without upscaling. Encoding starts at quality 80, with bounded fallback to lower quality and a smaller edge. The output cap is also **500,000 bytes**.

| Status | Domain code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing file, extra field or file, invalid multipart, corrupted image, or MIME/content mismatch |
| 401 | `AUTH_REQUIRED`, `SESSION_EXPIRED` | Bearer authentication failed |
| 403 | `FORBIDDEN`, `MERCHANT_NOT_VERIFIED` | Merchant role or verification required |
| 413 | `IMAGE_TOO_LARGE` | Input bytes, decoded pixels or processed output exceed the limit |
| 415 | `UNSUPPORTED_IMAGE_FORMAT` | Unsupported MIME type or multi-frame image |
| 429 | `RATE_LIMITED` | More than 10 upload attempts per merchant per minute on this API instance |
| 502 | `IMAGE_UPLOAD_FAILED` | ImageKit failed, timed out, or returned an unexpected delivery URL |
| 503 | `IMAGE_UPLOAD_UNAVAILABLE` | Upload configuration is incomplete |

**Configuration.** Set `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` from the same ImageKit account on the API server in Render, or privately in the local API environment. `IMAGEKIT_PUBLIC_KEY` is optional and unused by this server-side integration. Missing configuration leaves existing APIs available. Complete settings are validated at startup. Credentials stay on the server. The API writes public, uniquely named WebP assets under `/mardood/products/` and verifies the returned URL. Images are processed in memory. The per-merchant limit uses process-local storage and applies independently on each API instance.

Use the returned HTTPS URL as `imageUrl` in the existing campaign launch request. Existing external image URLs remain supported. Render the public ImageKit URL with the existing image component. If Web uses `next/image` for product images, its `remotePatterns` must match the configured delivery hostname and base path followed by `/mardood/products/**`. Upload and campaign launch are separate operations. Retries after an uncertain upload, abandoned drafts, and image replacement can leave unused assets. The MVP has no automatic deletion or cleanup.

**Client preparation.** Select a local JPEG, PNG or WebP. Offer browser capture where supported and both camera and gallery on Expo. Resize the longest edge to at most 1,200 px while maintaining aspect ratio and avoiding upscaling. Start at quality 80%, target 150–300 KB, preserve transparency when needed, and reject client output over 500,000 bytes. Show a local preview before upload. Handle picker cancellation, compression errors and upload/network failures. Let users retry or replace the image. Do not submit a campaign using a local file URI.

```bash
curl --fail-with-body 'https://api.example.com/api/v1/merchant/uploads/image' \
  -H 'Authorization: Bearer REPLACE_WITH_MERCHANT_ACCESS_TOKEN' \
  -F 'file=@./product.webp;type=image/webp'
```

**Next.js.** `browser-image-compression` can prepare a `File` in the browser. Pass that file to a Next.js Server Action or Route Handler, and forward it using the existing server-side merchant session. Example forwarding on the server:

```ts
const body = new FormData();
body.append("file", compressedFile, compressedFile.name);
const response = await fetch(`${apiV1Base}/merchant/uploads/image`, {
  method: "POST",
  headers: { Authorization: `Bearer ${serverAccessToken}` },
  body,
});
```

**Expo.** Install compatible SDK 58 packages when implementing the client. Use `expo-image-picker` with `launchImageLibraryAsync` or camera permissions and `launchCameraAsync`. Use `ImageManipulator.manipulate(asset.uri)`, call `resize` with the calculated smaller dimensions if needed, then `renderAsync` and `saveAsync({ compress: 0.8, format: SaveFormat.WEBP })`. Preview the saved URI and verify its actual byte size before posting with the signed-in session.

```ts
const body = new FormData();
body.append("file", { uri: compressedUri, name: "product.webp", type: "image/webp" } as unknown as Blob);
const response = await fetch(`${apiV1Base}/merchant/uploads/image`, {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}` },
  body,
});
```

In both examples, let the HTTP client generate the multipart `Content-Type` and boundary. Inspect `response.ok` and map the API error code before using the returned URL. See the [Expo SDK 58 ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/), [ImageManipulator](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/) and [Next.js image host policy](https://nextjs.org/docs/messages/next-image-unconfigured-host).


## Public offers, Customer QR passes & Cashback

Public offer resolution and click tracking, Offer QR issuance, and customer cashback and purchase reporting are implemented. The three `/customer/cashback-vouchers` operations are the deferred first extension. The API can resolve a persisted direct referral code. Merchant-facing direct link creation and management are deferred. Public offer reads currently return `404 NOT_FOUND` for ended or expired offers as well as unknown codes. See [open integration items](IMPLEMENTATION_STATUS.md#pending-and-deferred-audit-items).

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

Current scanner lookup and redemption support Offer QRs only. Voucher lookup and redemption, store-discount preview, and store-discount checkout are deferred. Merchant wallet, transaction history, and dashboard reads are implemented extra endpoints.

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

### Store-discount checkout (future)

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

The wallet, per-merchant earnings, transaction history, stats and simulated payout routes below are implemented. `/public/leaderboard` is deferred.

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /marketer/wallet` | Marketer | None | `200 MarketerWallet` |
| `GET /marketer/wallet/by-merchant` | Marketer | Pagination | `200 Page<MarketerMerchantEarnings>` |
| `GET /marketer/wallet/transactions` | Marketer | Pagination | `200 Page<MarketerWalletTransaction>` |
| `POST /marketer/payouts` | Marketer | `{ expectedAmountSyp: number }` + `Idempotency-Key` (UUID) | `201 PayoutRequest` |
| `GET /marketer/payouts` | Marketer | Pagination, optional `status` | `200 Page<PayoutRequest>` |
| `GET /marketer/stats` | Marketer | None | `200 MarketerStats` |
| `GET /public/leaderboard` | Public, optional bearer | Pagination | `200 Page<LeaderboardEntry> & { myRank: number \| null }` |

```ts
type PayoutStatus = 'pending_review' | 'confirmed' | 'rejected';

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
  kind: 'marketer_commission_credit' | 'payout_hold' | 'payout_release_refund' | 'payout_completed';
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  shopName: string | null;
  createdAt: string;
};

type PayoutRequest = {
  id: string;
  amountSyp: number;
  status: PayoutStatus;
  createdAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
};

type AdminPayoutRequest = PayoutRequest & { marketerId: string; marketerName: string };

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

Merchant verification, top-up and top-up history, simulated payout decisions, and the three `/admin/revenue` reads are implemented. `/admin/users`, `/admin/campaigns`, and `/admin/overview` remain deferred. The future overview will derive marketer liabilities from available and pending wallet balances. Simulated completions do not count as platform revenue or external cash transfers.

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /admin/merchants` | Admin | Pagination, optional `verificationStatus` | `200 Page<AdminMerchant>` |
| `PATCH /admin/merchants/{merchantId}/verification` | Admin | `{ status: "verified" \| "rejected", contractReference?: string }` | `200 AdminMerchant` |
| `POST /admin/merchants/{merchantId}/topups` | Admin | `{ amountSyp, paymentMethod, referenceNote }` + `Idempotency-Key` | `201 AdminTopupResult` |
| `GET /admin/topups` | Admin | Pagination, optional `merchantId` | `200 Page<AdminTopupHistoryEntry>` |
| `GET /admin/payouts` | Admin | Pagination, optional `status` | `200 Page<AdminPayoutRequest>` |
| `PATCH /admin/payouts/{payoutId}/approve` | Admin | None | `200 AdminPayoutRequest` (`pending_review` → `confirmed`) |
| `PATCH /admin/payouts/{payoutId}/reject` | Admin | `{ reason: string }` | `200 AdminPayoutRequest` (`pending_review` → `rejected`) |
| `GET /admin/users` | Admin | Pagination, optional `role` | `200 Page<AdminUser>` |
| `GET /admin/campaigns` | Admin | Pagination, optional `status` | `200 Page<AdminCampaign>` |
| `GET /admin/overview` | Admin | None | `200 AdminOverview` |
| `GET /admin/revenue` | Admin | None | `200 AdminRevenue` |
| `GET /admin/revenue/summary` | Admin | None | `200 AdminRevenueSummary` |
| `GET /admin/revenue/marketers` | Admin | Pagination | `200 Page<AdminMarketerEarnings>` |

For the MVP, merchant verification changes `pending` to `verified` or `rejected`. Repeating the same decision returns `200`. Supplying `contractReference` sets it, and omitting it preserves the current value. Reversing a decided status returns `409 INVALID_STATUS_TRANSITION`. When conflicting decisions arrive concurrently, the first committed decision wins.

Top-ups record confirmed offline payments to verified merchants. The amount must be a positive safe integer in new SYP minor units, and `referenceNote` must be nonblank and at most 256 characters. The post-credit balance is captured when the wallet is credited. POST always returns a number. History returns that stored balance and uses `null` only for legacy records whose post-credit balance cannot be verified. History is ordered by creation time descending, then top-up ID descending.

Revenue is the all-time sum of the persisted net platform fees on committed sales, in new SYP minor units. Unredeemed or expired offers, failed or rolled-back settlements, top-ups, and reserve movements contribute nothing. Replaying a settlement does not add revenue. The endpoint returns `Cache-Control: no-store`, returns `0` when no sales exist, and returns `409 AMOUNT_OUT_OF_RANGE` if the total exceeds the monetary limit.

The revenue summary returns net platform fees and the total commissions earned by all marketers from the same set of settled sales. Both amounts use the same no-store, zero, and range rules as platform revenue.

The marketer earnings list returns one row per marketer account, including multi-role accounts and marketers with no settled sales. Rows contain `id`, `name`, `phone`, `salesCount` (settled sales attributed to that marketer), and `totalEarnedSyp` (commission from those sales in new SYP minor units). Rows are ordered by account creation time descending, then ID descending. Marketers without settled sales have zero sales and zero commission. This admin-only report uses the same no-store and monetary range rules.

### Simulated payouts

All payout reads and decisions use `Cache-Control: no-store`. Marketers see only their own payout history. Admins can filter the complete queue by `pending_review`, `confirmed` or `rejected`. Both lists use the standard page envelope, ordered by `createdAt` descending and then `id` descending. The admin response adds only `marketerId` and `marketerName`.

Submit the exact displayed available balance as a positive safe integer. A successful request moves the full balance from available to pending and posts `payout_hold`. A same-key replay returns the original `201` and body even after a decision. A different valid payload with a committed key returns `409 IDEMPOTENCY_KEY_REUSED`. A new request while a hold exists returns `409 PAYOUT_ALREADY_PENDING`. A zero available balance returns `409 INSUFFICIENT_WALLET_BALANCE`; a stale positive balance returns `409 PAYOUT_AMOUNT_CHANGED` and requires a fresh wallet read and confirmation.

Admin approval accepts no body. It clears the hold, records the deciding admin and time, and posts `payout_completed` without debiting available again. Rejection accepts a trimmed, nonempty `reason` of at most 500 characters. It clears the hold, restores the reserved amount, records the decision, and posts `payout_release_refund`. Repeating the same decision returns `200` with the stored result. A conflicting decision or changed rejection reason returns `409 INVALID_STATUS_TRANSITION`. Unknown payout IDs return `404 NOT_FOUND`.

All amounts are new SYP minor units. Payout results change neither lifetime commission, merchant wallets, campaign reserves, customer cashback, settled sales nor platform revenue. `totalConfirmedPaidOutSyp` sums confirmed simulations. Wallet history shows the three payout movements with null campaign and shop fields. The scanner checks available plus pending plus the incoming commission under the marketer wallet lock. An overflow returns `409 AMOUNT_OUT_OF_RANGE` and rolls back settlement. An approval that would overflow the confirmed cumulative total also returns that error. Invalid body, UUID, query or key responses use `400 VALIDATION_ERROR`; missing or invalid authentication uses `401 AUTH_REQUIRED` or `SESSION_EXPIRED`; wrong-role requests use `403 FORBIDDEN`; unexpected failures use sanitized `500 INTERNAL_ERROR`. All errors use `{ statusCode, code, message }`.

#### Web and Expo integration

- **Alaa, marketer Web.** Read `GET /api/v1/marketer/wallet` and `GET /api/v1/marketer/payouts`. Disable withdrawal when available is zero or a request is pending. Confirm the exact shown amount. Send `POST /api/v1/marketer/payouts` with `Idempotency-Key: <UUID>` and `{ "expectedAmountSyp": 50000 }`. Retry an ambiguous response with the same key and body. On `PAYOUT_AMOUNT_CHANGED`, refresh and require reconfirmation. Refresh the wallet and history after mutations and display decisions and rejection reasons.
- **Tayma, Admin Web.** Read `GET /api/v1/admin/payouts?status=pending_review&page=1&pageSize=20`. Display marketer name, amount, date and status. Confirm an empty-body `PATCH /api/v1/admin/payouts/<UUID>/approve` or send `PATCH /api/v1/admin/payouts/<UUID>/reject` with `{ "reason": "The request could not be approved" }`. Disable duplicate submissions while pending and refresh the queue and related reports afterward.
- **Ismail, Expo.** Use the same authenticated marketer URLs, amount confirmation and retry rules. Display available/pending amounts and history, including terminal decisions. Invalidate wallet and payout history caches after changes and on relevant refreshes. Keep Arabic, English and RTL behavior.

All clients use the real API, display minor units at scale 100, preserve their existing session boundary, and label the actions **simulated**.

### Deferred external payout workflow

Real money transfers, payment account details, transfer receipts, cash-out references, confirmations, disputes and automatic confirmation remain deferred. Any future implementation must distinguish real transfers and their accounting from simulated records. The former design proposed these operations and extensions. They are not part of the simulated contract.

| Future operation | Proposed input and behavior |
| --- | --- |
| `POST /marketer/payouts` | Extended request `{ amountSyp, method, accountDetails }` with `Idempotency-Key`; method `sham_cash`, `syriatel_cash` or `cash` |
| `GET /marketer/payouts`, `GET /admin/payouts` | Expanded history with transfer metadata and the future `transferred` and `disputed` statuses |
| `POST /marketer/payouts/{payoutId}/confirm` | Owner confirms receipt of a transferred payout |
| `POST /marketer/payouts/{payoutId}/dispute` | Owner disputes a transfer with `{ reason }` |
| `POST /admin/payouts/{payoutId}/upload-receipt` | Multipart `receipt`, returning `{ transferReceiptUrl }` |
| `PATCH /admin/payouts/{payoutId}/mark-transferred` | `{ transferReference, transferReceiptUrl }` |
| `PATCH /admin/payouts/{payoutId}/reject` | Pre-transfer rejection with `{ reason }` |
| `PATCH /admin/payouts/{payoutId}/resolve-dispute` | `{ outcome: 'confirm_paid', note }` or `{ outcome: 'return_funds', note, reversalReference }` |

The deferred expanded record included marketer phone, method and account details, transfer reference and receipt URL, transferred and confirmed timestamps, dispute reason, rejection reason, and resolution outcome, note, reversal reference and timestamp. A verified reversal would add `payout_transfer_reversal` to history.

- Requesting a payout moves funds from available to pending. Only a `pending_review` request can be rejected before transfer. Rejection releases the hold once.
- After sending funds, the admin records the receipt and a transfer reference unique per payment method. Moving to `transferred` clears the pending hold and records the external cash outflow in the same transaction. Repeating the same recorded transfer returns its existing result. Conflicting transfers or invalid transitions return `409 INVALID_STATUS_TRANSITION`.
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

type AdminTopupHistoryEntry = Omit<AdminTopupResult, 'merchantNewAvailableBalanceSyp'> & {
  merchantNewAvailableBalanceSyp: number | null;
};

type AdminUser = Pick<Account, 'id' | 'name' | 'phone' | 'roles' | 'createdAt'>;
type AdminMerchant = AdminUser & {
  merchant: NonNullable<Account['merchant']>;
  wallet: MerchantWallet;
};
type AdminCampaign = MerchantCampaign & { merchantId: string; shopName: string };

type AdminRevenue = {
  netPlatformFeesSyp: number;
};

type AdminRevenueSummary = AdminRevenue & {
  totalMarketerCommissionSyp: number;
};

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

- One new SYP equals 100 minor units. Since 100 old SYP equals one new SYP, a verified old whole-SYP integer carries over unchanged as a minor-unit integer. For example, `100000` means `1,000.00` new SYP on screen. Monetary fields in requests, responses and stored idempotency responses all use minor units.
- Validate every monetary input as a JSON integer from `0` through `9_007_199_254_740_991` inclusive. Prices, bill amounts, sales caps, top-ups, cashback vouchers and payouts must be positive. A fixed commission may be zero. Validate `maxItems` as an integer from `1` through `2_147_483_647`, matching the database column. Out-of-range inputs return `400 VALIDATION_ERROR`.
- Accept percentages with up to two decimal places. Parse percentages exactly into integer basis points. Use `bigint` for monetary products, divisions and sums. For nonnegative amounts, floor to one minor unit only at the points specified in the pricing rules. Validate the final monetary value before converting it to a JavaScript number or writing it to a `bigint` money column.
- Apply the same minor-unit range to calculated amounts and each resulting financial balance or monetary counter the operation persists. If a derived amount falls outside that range, return `409 AMOUNT_OUT_OF_RANGE` and roll back the operation, including its ledger entries and any reservation. Apply the same check to read-only previews. Calculate reported aggregates exactly and return `409 AMOUNT_OUT_OF_RANGE` if an amount in the response cannot fit in the supported range.
- Web and Expo display amounts in new SYP by formatting the integer quotient and fractional remainder at a scale of 100. Parse localized monetary input with up to two fractional digits into minor units before sending it. For example, `12.34` new SYP becomes `1234`. Keep monetary input parsing separate from percentage and quantity parsing and use integer arithmetic at this boundary.

## Calculation and consistency rules

All monetary operands and results below are integer minor units. Percentages, item quantities and counts retain their own units.

1. Validate `discountPercent` in `0..100`, `commission.percent` in `0..100`, nonnegative integer minor-unit values, future `endsAt`, valid HTTP/HTTPS `imageUrl`, and positive cap (`maxItems` for `product`, `maxSalesVolumeSyp` for `store_discount`). Apply the monetary and precision limits above.
2. `finalPriceSyp = floor(originalPriceSyp × (1 - discountPercent / 100))`.
3. Every sale calculates on the backend inside an atomic DB transaction:
   - `customerPaidCashSyp = finalPriceSyp × quantity` (for `product`) OR `floor(originalBillSyp × (1 - discountPercent / 100))` (for `store_discount`).
   - `platformTotalFeeSyp = floor(customerPaidCashSyp × 5 / 100)`.
   - `customerCashbackSyp = floor(customerPaidCashSyp × 2 / 100)`.
   - `platformNetFeeSyp = platformTotalFeeSyp - customerCashbackSyp`.
   - `marketerCommissionSyp = 0` for `merchant_direct`, else `commissionPerItemSyp × quantity` (`fixed`) or `floor(customerPaidCashSyp × commission.percent / 100)` (`percentage`).
   - `totalDeductedReserveSyp = marketerCommissionSyp + platformTotalFeeSyp`.
4. Campaign creation checks `merchant.availableBalanceSyp >= worstCaseReserveSyp` under the merchant wallet lock. Commit the new campaign, reserve transfer, ledger movement and saved launch response together. Every scan checks `campaign.lockedBudgetSyp >= totalDeductedReserveSyp` under a row lock.
5. Customer cashback unlocks from `lockedCashbackSyp` to `availableCashbackSyp` when both configured thresholds are reached. The defaults are `milestonePurchaseCount >= 5` and `milestoneSpendSyp >= 50000` (500.00 new SYP). Optional overrides `CASHBACK_MILESTONE_PURCHASES` and `CASHBACK_MILESTONE_SPEND_SYP` are validated before the HTTP server starts in every environment. Cashback is backed by the 2% pool collected inside `platformTotalFeeSyp`.
6. Conversion rate = `(itemsSold / clicks) × 100` rounded to 2 decimals (`0` when `clicks === 0`).


## Demo operation rules and shared examples

- `lookup` and both redemption routes accept a QR token or the matching human-readable code. Offer lookup and redemption require a verified merchant who owns the campaign. An out-of-scope code returns `404 NOT_FOUND` without disclosing customer details. Lookup returns the cash amount for quantity 1 before confirmation. The redemption response returns the settlement breakdown.
- Demo offer redemption accepts `{ code }` or `{ code, quantity: 1 }`. Other quantities and `originalBillSyp` return `400 VALIDATION_ERROR`. Demo campaign preview and launch accept product campaigns with fixed commission, a positive integer minor-unit final price and a positive merchant net. Launch also requires `joinMode: 'open'`. Page links are `number | null`. For future store discounts, cap volume uses cash paid after discount.
- Offer QR issuance locks the campaign and checks status, end time and referral eligibility before finding or creating the pass. The database allows one active pass per customer, campaign and attribution. Requests serialized behind a successful issuance return `200` and the same pass ID, token and code. A redeemed pass allows a new pass while the campaign and referral remain eligible. Campaign close expires outstanding active passes. Use distinct referral code prefixes for marketer and merchant direct links.
- When the customer and the attributed marketer are the same account, Offer QR issuance and scanner redemption return `403 SELF_PROMOTION_FORBIDDEN`. Redemption checks the stored pass and membership, including passes issued before this rule. A rejected request makes no settlement changes. Merchant-direct offers remain eligible under their existing rules and carry zero marketer commission.
- Replaying a committed key in the same actor and operation scope with the same validated payload returns the original status and body. A different payload returns `409 IDEMPOTENCY_KEY_REUSED`. A new key on a redeemed pass returns `409 QR_ALREADY_REDEEMED`. For each keyed operation, authenticate and validate the request shape, then claim or replay the key before checking mutable business state. Include the target resource identifier in the fingerprint when the route has one. Serialize concurrent use of the same key and store the successful response atomically with the mutation. This applies to launch and to the sale that closes a campaign.
- The campaign service owns close and release. Check caps, end time and reserve inside the sale transaction. Close on cap exhaustion, on explicit close, or through expiry reconciliation. Run reconciliation on reads that expose status or balances and in a periodic pass so idle campaigns release their funds. Closing twice returns the ended campaign without another credit. If settlement reaches the cap, close within that transaction and return `campaignStatusAfterSale: 'ended'` and `remainingLockedBudgetSyp: 0` after releasing any surplus. Store that final response for replay.
- Voucher issuance locks the customer balance, checks available cashback, creates the active reservation and stores the successful idempotency response in one transaction. Cancellation and redemption compete for the same active voucher. Cancellation restores the reservation once. A redeemed voucher rejects cancellation with `409 INVALID_STATUS_TRANSITION`. A cancelled voucher rejects redemption with the same error. A redeemed voucher rejects redemption under a fresh key with `409 QR_ALREADY_REDEEMED`.
- For the voucher extension, use a standalone checkout. The merchant enters `billTotalSyp` after shop discounts and before applying the voucher. It must be a positive safe JSON integer. If `billTotalSyp < amountSyp`, return `409 VOUCHER_EXCEEDS_BILL` and keep the voucher active. Otherwise consume the reservation and credit a verified merchant atomically. Return `customerPaidCashSyp = billTotalSyp - amountSyp`. Active voucher balances count toward the admin cashback liability.

The figures below are in minor units. Human-facing prices and balances display the corresponding new-SYP amount with up to two fractional digits.

| Scenario | Shared fixture and expected result |
| --- | --- |
| Insufficient balance | Merchant has 100000 minor units and launch needs 435000. Return `409 INSUFFICIENT_MERCHANT_BALANCE`. |
| Top-up and launch | Top up 400000. Product price 100000, discount 10%, fixed commission 10000, maxItems 30, `joinMode: 'open'`, product name and description, a valid image URL, and an end time after the demo. Launch locks 435000 and leaves 65000 available. |
| Lookup and sale | Use the freshly issued pass in the live rehearsal or `OF-DEMO01` in the scanner fixture. Lookup previews 90000 cash. Redeem with a UUID key and return `201` with cash 90000, commission 10000, fee 4500, cashback 1800, net fee 2700, and reserve 420500. |
| Replays | Retry identical body and key to get the original `201` and sale ID. Use another key for the same pass to get `409 QR_ALREADY_REDEEMED`. |
| Close | Close after that one sale. Release 420500, leaving 485500 available and zero locked. |
| Launch retry | In a separate fixture with enough funds for two reserves, resend the same launch body and key after a lost response. Expect the same `201` and campaign ID, with one reserve lock of 435000 minor units. Reusing the key with a changed valid body returns `409 IDEMPOTENCY_KEY_REUSED`. |
| Concurrent issuance | Request an Offer QR twice in parallel for the same eligible customer, campaign and referral. Expect one `201` and one `200` with the same pass ID and code. |
| Final sale | In a separate fixture use the same final price of 90000 and commission of 10000, with `maxItems: 1`. The sale debits 14500 minor units from the reserve and returns `campaignStatusAfterSale: 'ended'` and `remainingLockedBudgetSyp: 0`. Same-key retry returns the original `201` and sale ID. Explicit close adds no wallet credit. |
| Monetary boundary | With zero discount and commission, `originalPriceSyp: 9007199254740991` and `maxItems: 21` produce an exact reserve of 9457559217478029 minor units. Preview and launch return `409 AMOUNT_OUT_OF_RANGE`. The launch writes no campaign, reserve or ledger movement. An input amount of `9007199254740992` returns `400 VALIDATION_ERROR`. |

### Shared demo seed and API examples

Allaith publishes the resettable seed values and matching request and response samples on Day 1. Give web and Expo the public web and API base URLs, role identities, and the scanner fixture's campaign ID, membership ID, referral URL and pass code. Provide demo credentials through the team's private setup and keep them out of the documents and source control.

The JSON examples and fixture amounts use minor units. For example, the scanner's `90000` cash price displays as `900.00` new SYP.

| Fixture | Starting state and purpose |
| --- | --- |
| Live rehearsal | Seed an admin, a verified merchant with 100000 minor units available, a marketer and a customer. Start without the live rehearsal campaign. The team creates it after the top-up, joins it from Expo, and issues its pass through the web flow. |
| Scanner development | Use an independent seed or database reset with a funded, active product campaign, approved marketer membership, customer and active Offer QR code `OF-DEMO01`. The campaign owner can preview and redeem this code while live QR issuance is being built. Use the same final price of 90000, commission of 10000 and 30-item cap as the live rehearsal, with 435000 already reserved and zero sales. |
| Voucher extension (planned fixture) | Seed four settled purchases of 40000 each for the customer in the current milestone cycle. The customer starts at 4 purchases, 160000 of cycle spend and 3200 of locked cashback. The sale of 90000 adds 1800, so the fifth purchase unlocks 5000. Seed a second verified merchant to accept the voucher. Use a separate fresh test database for voucher integration tests that start with 10000 available. |

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
