# Affiliate Marketing Platform API

**Draft v1 · Shared by Next.js and React Native**

This contract covers the hackathon scope in the project brief and uses the entities in [DATABASE_ERD.md](DATABASE_ERD.md). The NestJS implementation must publish the same routes, request and response schemas, and errors in Swagger. The routes below are relative to `/api/v1`.

## Conventions

- Use JSON and camelCase. IDs are UUID strings unless otherwise noted. Timestamps use UTC ISO 8601. Phone numbers are strings matching `^09[0-9]{8}$`. Amounts with a `Syp` suffix are nonnegative, JSON-safe whole SYP integers. Use exact decimal arithmetic on the backend for percentages.
- Protected routes use `Authorization: Bearer <accessToken>`. A user may have multiple roles. Validate session validity, role, and ownership on the backend for every protected request. A public registration can grant only `merchant`, `marketer`, or both. Provision the existing admin through backend initialization.
- Return single resources directly. Paginated lists accept `page` and `pageSize`, default to `1` and `20`, and cap `pageSize` at `100`. Return `{ items, page, pageSize, total, previousPage, nextPage }`. `previousPage` and `nextPage` are integers or `null` when there is no page in that direction. Lists default to newest first with an ID tie-breaker unless specified otherwise. The backend calculates values needed for display and navigation, including pricing, totals, limits, statistics, and page numbers.
- Require the `Idempotency-Key` UUID header on checkout and simulated plan purchases. A committed request replay with the same key and payload returns the original status and body. Reusing a committed key with a different payload returns `409 IDEMPOTENCY_KEY_REUSED`. Plan purchase keys are scoped to the merchant. Checkout keys are unique across checkouts and must be unguessable. Generate one key per purchase attempt and reuse it on uncertain retries. Retain enough immutable data with the committed purchase to detect a changed payload and replay the original result after the resource changes state.
- Simulator requests accept `demoPayment: "approve" | "decline"`. Clients may show a simulated payment form. Send only the simulator choice and the declared non-card fields over the API. Never accept or persist card numbers, CVVs, or other real payment credentials.

### Errors

```json
{
  "statusCode": 409,
  "code": "CAMPAIGN_LIMIT_EXCEEDED",
  "message": "This purchase exceeds the available quantity or commission budget."
}
```

Handlers may include `fieldErrors: Record<string, string[]>` for validation. Use request field paths such as `delivery.phone` as keys and readable correction messages as values. Keep `message` short, safe to show, and actionable when recovery is available. The Arabic-only web UI maps `code` and field errors to Arabic before displaying them. Resource lookups scoped to a merchant or marketer return `404` for missing resources and for other accounts’ private resources.

| HTTP | Codes |
| --- | --- |
| `400` | `VALIDATION_ERROR` |
| `401` | `AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `ACCESS_TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN`, `SESSION_EXPIRED` |
| `402` | `PAYMENT_DECLINED` |
| `403` | `FORBIDDEN`, `MERCHANT_NOT_VERIFIED`, `SELF_PROMOTION_FORBIDDEN` |
| `404` | `NOT_FOUND` |
| `409` | `PHONE_ALREADY_REGISTERED`, `CAMPAIGN_ENDED`, `CAMPAIGN_LIMIT_EXCEEDED`, `JOIN_REQUEST_PENDING`, `INVALID_STATUS_TRANSITION`, `RECEIPT_ALREADY_REDEEMED`, `PLAN_REQUIRED`, `PLAN_LIMIT_REACHED`, `IDEMPOTENCY_KEY_REUSED` |
| `429` | `RATE_LIMITED` |
| `500` | `INTERNAL_ERROR` |

## Authentication and account

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /auth/register` | Public | `{ name, phone, password, roles, shop? }`. `roles` is a nonempty array of distinct public roles. `shop: { name, details }` is required for a merchant. | `201 AuthSession`. Create pending merchant profile and Free plan when the merchant role is selected. |
| `POST /auth/login` | Public | `{ phone, password }` | `200 AuthSession` for a regular account |
| `POST /auth/admin/login` | Public sign-in form | `{ phone, password }` | `200 AuthSession` for an existing admin only |
| `POST /auth/refresh` | Refresh token | `{ refreshToken }` | `200 SessionTokens` with a rotated refresh token |
| `POST /auth/activity` | Signed in | None | `204 No Content`. Record deliberate user activity using the server clock. |
| `POST /auth/logout` | Refresh token | `{ refreshToken }` | `204 No Content`. Revoke the session. An already-ended session is a no-op. |
| `GET /auth/me` | Signed in | None | `200 Account` |

```ts
type Role = 'admin' | 'merchant' | 'marketer';
type VerificationStatus = 'pending' | 'verified' | 'rejected';
type Account = {
  id: string;
  name: string;
  phone: string;
  roles: Role[];
  createdAt: string;
  merchant: { name: string; details: string; verificationStatus: VerificationStatus } | null;
};
type SessionTokens = { accessToken: string; refreshToken: string; expiresInSeconds: number };
type AuthSession = SessionTokens & { user: Account };
```

The access token lifetime is 15 minutes (`expiresInSeconds: 900`). The signed-in web app requests refresh every 15 minutes through its Next.js server boundary, which calls the API and replaces both HttpOnly cookies. The browser does not read either token. Return `ACCESS_TOKEN_EXPIRED` if only the access token has expired and the session remains valid. The web app can attempt a refresh before asking the user to sign in again. Android stores session credentials in secure device storage.

NestJS expires sessions after 30 days without qualifying user activity, including admin sessions. The activity clock starts at sign-in. Only `POST /auth/activity` records later activity. Call it for deliberate authenticated interaction and exclude automatic refresh, polling, and background requests. Refresh does not move the inactivity deadline. Return `SESSION_EXPIRED` when the session is expired or revoked, or `INVALID_REFRESH_TOKEN` for an invalid or already-rotated refresh token. Clear the local session when refresh is rejected. Explicit sign-out revokes the server session and clears the client credentials.

At `<hostname>/admin`, the web app shows the Arabic admin sign-in form unless a valid admin session already exists. The form uses `/auth/admin/login`. A regular account cannot sign in through that endpoint, and the admin account uses it to sign in. Return `INVALID_CREDENTIALS` for a failed admin login without identifying which credential or role failed. The backend initializer ensures the configured admin account exists after migrations, using backend-only credentials and preserving existing admin credentials. Admin routes always require the admin role on the server.

## Campaigns and participation

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /campaigns` | Marketer | `page`, `pageSize`, optional `q` for product name, optional `joinMode` | `200 Page<Campaign>` of active campaigns |
| `GET /campaigns/{campaignId}` | Marketer | None | `200 Campaign`, including an ended campaign |
| `POST /merchant/campaigns/pricing-preview` | Merchant | `PricingInput` | `200 Pricing`; read-only calculation |
| `POST /merchant/campaigns` | Verified merchant | `CampaignInput` | `201 MerchantCampaign`. Check plan quota and launch atomically. |
| `GET /merchant/campaigns` | Merchant | Pagination, optional `status` | `200 Page<MerchantCampaign>` of owned campaigns |
| `GET /merchant/campaigns/{campaignId}` | Campaign owner | None | `200 MerchantCampaign` |
| `GET /merchant/campaigns/{campaignId}/participants` | Campaign owner | Pagination, optional `status` | `200 Page<MerchantParticipant>` |
| `PATCH /merchant/campaigns/{campaignId}/participants/{membershipId}` | Campaign owner | `{ status: "approved" \| "rejected" }` | `200 MerchantParticipant`. Only pending memberships can be decided. |
| `POST /marketer/campaigns/{campaignId}/join` | Marketer | None | `201 MarketerMembership` for first join, `200` if already approved or if a rejected membership is resubmitted |
| `GET /marketer/campaigns/{campaignId}/membership` | Marketer | None | `200 { membership: MarketerMembership \| null }` for the caller |
| `GET /marketer/memberships` | Marketer | Pagination, optional `status` | `200 Page<MarketerMembership>` of the caller’s memberships |

```ts
type JoinMode = 'open' | 'approval_required';
type CampaignStatus = 'active' | 'ended';
type JoinStatus = 'pending' | 'approved' | 'rejected';
type PricingInput = {
  originalPriceSyp: number;
  discountPercent: number;
  commission: { type: 'fixed'; amountSyp: number } | { type: 'percentage'; percent: number };
};
type Pricing = {
  finalPriceSyp: number;
  commissionPerItemSyp: number;
  platformFeeForOneItemSyp: number;
  merchantShareForOneItemSyp: number;
};
type CampaignInput = PricingInput & {
  productName: string;
  description: string;
  imageUrl: string;
  endsAt: string;
  joinMode: JoinMode;
  maxItems?: number | null;
  commissionBudgetSyp?: number | null;
};
type Campaign = Omit<CampaignInput, 'maxItems' | 'commissionBudgetSyp'> & {
  id: string;
  status: CampaignStatus;
  finalPriceSyp: number;
  commissionPerItemSyp: number;
};
type CampaignUsage = {
  maxItems: number | null;
  commissionBudgetSyp: number | null;
  itemsSold: number;
  itemsReserved: number;
  itemsLeft: number | null;
  commissionPaidSyp: number;
  commissionReservedSyp: number;
  commissionBudgetLeftSyp: number | null;
};
type MerchantCampaign = Campaign & { pricing: Pricing; usage: CampaignUsage; stats: MerchantStats };
type Membership = { id: string; status: JoinStatus; requestedAt: string };
type MarketerMembership = Membership & { campaign: Campaign; referralUrl: string | null; stats: MarketerStats };
type MerchantParticipant = Membership & { marketerId: string; name: string; stats: MarketerStats };
```

An open campaign approves the marketer immediately. Approval-required campaigns return `pending` with `referralUrl: null`. A repeated pending request returns `409 JOIN_REQUEST_PENDING`. Block self-promotion and new joins to ended campaigns. An approved membership retains exactly one referral code, and the API returns a full public web URL such as `https://<web-host>/r/<referral-code>`.

## Public offers and checkout

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /public/referrals/{code}` | Public | None | `200 PublicOffer`, including `status: "ended"` for an ended offer |
| `POST /public/referrals/{code}/clicks` | Public | None | `204 No Content`. Send once per actual link opening, including ended offers. |
| `POST /public/referrals/{code}/checkout` | Public | `CheckoutInput` and `Idempotency-Key` | `201 CheckoutResult`. Charge simulated payment and reserve capacity or settle in one transaction. |

```ts
type PublicOffer = {
  productName: string;
  description: string;
  imageUrl: string;
  originalPriceSyp: number;
  discountPercent: number;
  finalPriceSyp: number;
  endsAt: string;
  status: CampaignStatus;
  maxCheckoutQuantity: number;
  checkoutOptions: { quantity: number; amountPaidSyp: number }[];
};
type DemoPayment = 'approve' | 'decline';
type Delivery = { name: string; phone: string; address: string };
type CheckoutInput = { quantity: number; demoPayment: DemoPayment } & (
  | { channel: 'in_store' }
  | { channel: 'online'; delivery: Delivery }
);
type ReceiptDetails = { receiptNumber: string; qrToken: string };
type PaidSale = { saleId: string; productName: string; quantity: number; amountPaidSyp: number; paidAt: string };
type CheckoutResult = PaidSale & (
  | { channel: 'in_store'; paymentStatus: 'settled'; receipt: ReceiptDetails }
  | { channel: 'online'; paymentStatus: 'held'; orderStatus: 'pending' }
);
```

`quantity` must be an integer from `1` to `10`. `maxCheckoutQuantity` is an integer from `0` to `10`. `checkoutOptions` contains each currently available quantity in ascending order and its server-calculated total. Ended offers return `maxCheckoutQuantity: 0` and `checkoutOptions: []`. The client displays the total for the selected option and submits the quantity. The API recalculates the charge and rechecks capacity at purchase time.

Count click events from navigation, never from a GET, prefetch, or server render. Invalid referral codes return `404 NOT_FOUND`. Ended campaigns reject checkout with `409 CAMPAIGN_ENDED`. A purchase above the available quantity on an active campaign returns `409 CAMPAIGN_LIMIT_EXCEEDED`. A declined payment creates no sale, receipt, order, reservation, or wallet credit.

## Merchant receipts and online orders

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /merchant/receipts/lookup` | Campaign owner | `{ lookupCode: string }` containing a QR token or receipt number | `200 MerchantReceipt`. Read-only lookup. |
| `POST /merchant/receipts/{saleId}/redeem` | Campaign owner | None | `200 MerchantReceipt` with `redeemedAt` populated |
| `GET /merchant/orders` | Merchant | Pagination, optional `status` | `200 Page<MerchantOrder>` |
| `PATCH /merchant/orders/{saleId}/status` | Campaign owner | `{ status: "accepted" \| "delivered" \| "rejected" }` | `200 MerchantOrder` |

```ts
type PaymentStatus = 'held' | 'settled' | 'refunded';
type OrderStatus = 'pending' | 'accepted' | 'delivered' | 'rejected';
type MerchantReceipt = PaidSale & { receiptNumber: string; redeemedAt: string | null };
type MerchantOrder = PaidSale & {
  campaignId: string;
  delivery: Delivery;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
};
```

Redeem only once for a settled in-store sale. A second redeem or lookup of a redeemed receipt returns `409 RECEIPT_ALREADY_REDEEMED`. The QR encodes the opaque `qrToken`. Accepted orders settle the held amount and post credits once. Pending orders may be accepted or rejected. Accepted orders may be marked delivered. Rejection refunds the entire amount and frees the reservation. Other transitions, including repeated actions, return `409 INVALID_STATUS_TRANSITION`. A merchant can settle or reject existing orders even after the campaign ends.

## Plans, wallets and reporting

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /merchant/plans` | Merchant | None | `200 { currentPlan: PlanUsage, plans: PlanOption[] }` |
| `POST /merchant/plans/subscribe` | Merchant | `{ tier: "basic" \| "pro", demoPayment: DemoPayment }` and `Idempotency-Key` | `201 PlanUsage` |
| `GET /merchant/wallet` | Merchant | None | `200 Wallet` |
| `GET /marketer/wallet` | Marketer | None | `200 Wallet` |
| `GET /merchant/wallet/transactions` | Merchant | Pagination | `200 Page<WalletTransaction>` |
| `GET /marketer/wallet/transactions` | Marketer | Pagination | `200 Page<WalletTransaction>` |
| `GET /merchant/dashboard` | Merchant | None | `200 MerchantDashboard` |
| `GET /marketer/stats` | Marketer | None | `200 MarketerStats` |
| `GET /public/leaderboard` | Public, optional bearer | Pagination | `200 Page<LeaderboardEntry> & { myRank: number \| null }` |

```ts
type Tier = 'free' | 'basic' | 'pro';
type PlanOption = { tier: Tier; priceSyp: number; campaignLimit: number | null };
type PlanUsage = {
  tier: Tier;
  status: 'active' | 'expired';
  startsAt: string;
  endsAt: string;
  campaignsCreated: number;
  campaignLimit: number | null;
  campaignsLeft: number | null;
};
type Wallet = { role: 'merchant' | 'marketer'; balanceSyp: number };
type WalletTransaction = {
  id: string;
  kind: 'merchant_credit' | 'marketer_credit';
  amountSyp: number;
  campaignId: string;
  campaignName: string;
  saleId: string;
  createdAt: string;
};
type MarketerStats = { clicks: number; itemsSold: number; earnedSyp: number; conversionRatePercent: number };
type MerchantStats = {
  clicks: number;
  itemsSold: number;
  revenueSyp: number;
  commissionPaidSyp: number;
  conversionRatePercent: number;
};
type MerchantDashboard = {
  verificationStatus: VerificationStatus;
  currentPlan: PlanUsage;
  walletBalanceSyp: number;
  stats: MerchantStats;
};
type LeaderboardEntry = { rank: number; marketerId: string; name: string; earnedSyp: number; registeredAt: string };
```

Free has a three-campaign quota for one calendar month from merchant registration. Basic allows ten campaigns per 30 days. Pro is unlimited for 30 days. For an unlimited plan, both `campaignLimit` and `campaignsLeft` are `null`. For an expired limited plan, `campaignsLeft` is `0`. Return the last plan as `expired` until a new plan is active. After a successful simulated upgrade or renewal, the new 30-day period starts immediately. Existing campaigns keep running and count against their original period. The team must supply Basic and Pro’s simulated prices in backend configuration before enabling paid-plan checkout.

The leaderboard orders by settled commission descending, then registration timestamp ascending, then marketer ID ascending. `myRank` is the authenticated marketer’s overall rank regardless of the current page, or `null` when unavailable. The client can highlight the corresponding entry.

## Administration

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /admin/merchants` | Admin | Pagination, optional `verificationStatus` | `200 Page<AdminMerchant>` |
| `PATCH /admin/merchants/{merchantId}/verification` | Admin | `{ status: "verified" \| "rejected" }` | `200 AdminMerchant`. Only pending merchants can be decided. |
| `GET /admin/users` | Admin | Pagination, optional `role` | `200 Page<AdminUser>` |
| `GET /admin/campaigns` | Admin | Pagination, optional `status` | `200 Page<AdminCampaign>` |
| `GET /admin/overview` | Admin | None | `200 AdminOverview` |

```ts
type AdminUser = Pick<Account, 'id' | 'name' | 'phone' | 'roles' | 'createdAt'>;
type AdminMerchant = AdminUser & { merchant: NonNullable<Account['merchant']> };
type AdminCampaign = MerchantCampaign & { merchantId: string; shopName: string };
type AdminOverview = {
  merchantCount: number;
  marketerCount: number;
  activeCampaignCount: number;
  settledSaleCount: number;
  salesAmountSyp: number;
  platformFeeIncomeSyp: number;
  planIncomeSyp: number;
  totalPlatformIncomeSyp: number;
};
```

`merchantId` is the merchant’s user ID. `salesAmountSyp` sums settled checkout payments. `totalPlatformIncomeSyp` is settled platform fees plus successful simulated plan payments.

## Calculation and consistency rules

1. Validate a positive original price and final price, a discount and percentage commission from `0` to `100`, a nonnegative fixed commission in whole SYP, a future end time, and positive optional limits. Accept a valid HTTP or HTTPS image URL. Keep campaign price, discount and commission fixed after launch.
2. Calculate `finalPriceSyp = floor(originalPriceSyp × (1 − discountPercent / 100))`. Round percentage commission down per item. For checkout, multiply final price and commission per item by quantity. Calculate the fee as `floor(amountPaidSyp × 3 / 100)` once for the entire checkout. Merchant share is the exact remainder. Reject campaign terms or a checkout if commission plus fee would leave no merchant share. The one-item preview uses the same formula with quantity `1`.
3. At successful payment, count both held and settled sales toward item and commission limits. `itemsLeft` and `commissionBudgetLeftSyp` subtract both; `itemsSold` and `commissionPaidSyp` reflect settled sales. An offer is ended if its deadline has passed or one more item cannot fit within its item or commission limits. A rejected order restores both limits and can reopen the offer before expiry. An expired subscription only blocks new campaign creation.
4. Record payment, refund, credits, fees and plan payments as money movements. Post wallet credits only at settlement. Purchase, capacity, order, receipt and ledger changes must commit together where applicable. Lock the campaign while checking and reserving capacity. Serialize plan-quota checks with plan changes. Make settlement, refund, and receipt redemption conditional on their current state so they happen once.
5. Base merchant revenue on settled merchant shares and marketer earnings on settled commissions. Report conversion as `itemsSold / clicks × 100`, rounded to two decimal places; use `0` when clicks are zero. A multi-item sale can produce a conversion figure over `100` under this formula.

### Demo checkout example

`POST /api/v1/public/referrals/rahaf-maamoul/checkout` with `Idempotency-Key: a2448dc2-c692-4417-ae43-4f5049c4f207`

```json
{
  "channel": "in_store",
  "quantity": 1,
  "demoPayment": "approve"
}
```

```json
{
  "saleId": "ec3fb4ee-dc8f-4e1d-9874-dc5f6a718d14",
  "productName": "علبة معمول، ١ كغ",
  "quantity": 1,
  "amountPaidSyp": 90000,
  "paidAt": "2026-11-22T12:00:00Z",
  "channel": "in_store",
  "paymentStatus": "settled",
  "receipt": {
    "receiptNumber": "R-DEMO-001",
    "qrToken": "demo-only-opaque-token"
  }
}
```

The demo’s 100,000 SYP original price, 10% customer discount and 10,000 SYP fixed commission yield 90,000 SYP paid, 10,000 SYP commission, 2,700 SYP platform fee, and 77,300 SYP merchant share. An online checkout for two at the same price holds 180,000 SYP until acceptance or full refund.
