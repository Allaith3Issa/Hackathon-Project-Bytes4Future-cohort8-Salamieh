# Affiliate Marketing Platform

**Three-day demo scope.** Product campaigns only, open joining, fixed commission, and one item per sale. Demo accounts are seeded. The core flow is admin top-up, merchant campaign launch, Expo join and share, web referral and Offer QR, manual merchant redemption, commission and cashback updates, and campaign closure with reserve release. Cashback voucher redemption is the first extension. Store discounts, approval workflows, camera scanning, full marketer web, advanced reports, direct merchant referrals, and payout receipt workflows are backlog for this demo. This scope governs the hackathon. The detailed product descriptions below also cover future work.

**Team 3 · Proposed PostgreSQL entity-relationship diagram (Updated Cash-in-Store, Prepaid Reserve & Cashback Logic)**

One account is uniquely identified by a Syrian mobile number and can hold `customer`, `marketer`, and/or `merchant` roles simultaneously. Customers register once by phone to receive single-use Offer QR codes, pay cash in store, and accumulate cashback unlocked at milestones. Merchants prepay SYP balances via Admin top-ups and lock worst-case reserves per campaign. Marketers earn into one unified wallet and withdraw via Admin-verified Sham Cash transfers with receipt confirmation.

```mermaid
erDiagram
    USERS ||--o{ IDEMPOTENCY_RECORDS : "owns replay records"
    USERS ||--o{ USER_SESSIONS : "holds refresh sessions"
    USERS ||--o| MERCHANT_PROFILES : "has when merchant"
    USERS ||--o| CUSTOMER_PROFILES : "has when customer"
    USERS ||..o{ WALLETS : "holds per role"
    USERS ||..o{ CAMPAIGN_MARKETERS : "joins through"
    MERCHANT_PROFILES ||..o{ MERCHANT_TOPUPS : "receives prepaid credits"
    MERCHANT_PROFILES ||..o{ CAMPAIGNS : "launches and locks budget"
    CAMPAIGNS ||..o{ CAMPAIGN_MARKETERS : "has participants"
    CAMPAIGNS ||..o{ REFERRAL_CLICKS : "tracks direct and affiliate clicks"
    CAMPAIGN_MARKETERS |o..o{ REFERRAL_CLICKS : "tracks marketer clicks"
    CAMPAIGNS ||..o{ OFFER_QR_PASSES : "issues single-use passes"
    CAMPAIGN_MARKETERS |o..o{ OFFER_QR_PASSES : "attributes pass when marketer"
    CUSTOMER_PROFILES ||..o{ OFFER_QR_PASSES : "owns pass"
    OFFER_QR_PASSES ||--o| SALES : "settles on scan"
    CUSTOMER_PROFILES ||..o{ CASHBACK_VOUCHERS : "redeems unlocked cashback"
    MERCHANT_PROFILES |o..o{ CASHBACK_VOUCHERS : "redeems voucher in store"
    WALLETS ||..o{ PAYOUT_REQUESTS : "requests withdrawals"
    WALLETS |o..o{ MONEY_MOVEMENTS : "posts wallet ledger entries"
    CAMPAIGNS |o..o{ MONEY_MOVEMENTS : "locks and unlocks reserves"
    SALES |o..o{ MONEY_MOVEMENTS : "records 5pct split and commission"
    MERCHANT_TOPUPS |o..o{ MONEY_MOVEMENTS : "records topup credit"
    PAYOUT_REQUESTS |o..o{ MONEY_MOVEMENTS : "records payout hold and settlement"
    CASHBACK_VOUCHERS |o..o{ MONEY_MOVEMENTS : "records closed-loop reimbursement"

    USERS {
        uuid id PK
        varchar phone UK
        text name
        text password_hash
        boolean is_customer
        boolean is_marketer
        boolean is_admin
        timestamptz created_at
    }
    USER_SESSIONS {
        uuid id PK
        uuid user_id FK
        text refresh_token_hash UK
        timestamptz last_activity_at
        timestamptz expires_at
        timestamptz revoked_at "nullable"
        timestamptz created_at
    }
    MERCHANT_PROFILES {
        uuid user_id PK, FK
        text shop_name
        text shop_details
        text contract_reference "nullable"
        enum verification_status "pending, verified, rejected"
        bigint credit_limit_syp "default 0 for strict prepaid"
    }
    CUSTOMER_PROFILES {
        uuid user_id PK, FK
        integer verified_purchase_count
        integer milestone_purchase_count
        bigint milestone_spend_syp
        bigint locked_cashback_syp
        bigint available_cashback_syp
    }
    MERCHANT_TOPUPS {
        uuid id PK
        uuid merchant_id FK
        uuid admin_id FK
        bigint amount_syp
        enum payment_method "cash, sham_cash, syriatel_cash, bank_transfer"
        text reference_note
        timestamptz created_at
    }
    CAMPAIGNS {
        uuid id PK
        uuid merchant_id FK
        enum campaign_type "product, store_discount"
        text product_name
        text description
        text image_url
        bigint original_price_syp "nullable for store_discount"
        numeric discount_percent
        enum commission_type "fixed, percentage"
        numeric commission_value
        enum join_mode "open, approval_required"
        integer max_items "required for product"
        bigint max_sales_volume_syp "required for store_discount, in discounted cash paid"
        bigint worst_case_reserve_syp
        bigint locked_budget_syp
        varchar direct_referral_code UK "nullable when direct referrals are disabled"
        enum status "active, ended"
        timestamptz ends_at
        timestamptz closed_at "nullable"
        timestamptz created_at
    }
    CAMPAIGN_MARKETERS {
        uuid id PK
        uuid campaign_id FK
        uuid marketer_id FK
        enum status "pending, approved, rejected"
        varchar referral_code UK "only when approved"
        timestamptz requested_at
    }
    REFERRAL_CLICKS {
        bigint id PK
        uuid campaign_id FK
        uuid campaign_marketer_id FK "nullable for merchant direct link"
        timestamptz opened_at
    }
    OFFER_QR_PASSES {
        uuid id PK
        uuid campaign_id FK
        uuid campaign_marketer_id FK "nullable for merchant direct link"
        uuid customer_id FK
        varchar qr_token UK
        varchar pass_code UK
        enum status "active, redeemed, expired"
        timestamptz created_at
        timestamptz redeemed_at "nullable"
    }
    SALES {
        uuid id PK
        uuid offer_qr_pass_id UK, FK
        uuid campaign_id FK
        uuid merchant_id FK
        uuid campaign_marketer_id FK "nullable for merchant direct"
        uuid customer_id FK
        enum attribution_source "marketer, merchant_direct"
        integer quantity
        bigint original_amount_syp
        bigint customer_paid_cash_syp
        bigint marketer_commission_syp
        bigint platform_total_fee_syp
        bigint customer_cashback_syp
        bigint platform_net_fee_syp
        bigint total_deducted_reserve_syp
        timestamptz scanned_at
    }
    CASHBACK_VOUCHERS {
        uuid id PK
        uuid customer_id FK
        bigint amount_syp
        varchar qr_token UK
        varchar voucher_code UK
        enum status "active, redeemed, cancelled"
        uuid redeemed_by_merchant_id FK "nullable"
        bigint redeemed_bill_total_syp "nullable until redeemed"
        timestamptz created_at
        timestamptz redeemed_at "nullable"
    }
    WALLETS {
        uuid id PK
        uuid user_id FK
        enum role "merchant, marketer"
        bigint available_balance_syp
        bigint pending_payout_syp
    }
    PAYOUT_REQUESTS {
        uuid id PK
        uuid marketer_id FK
        uuid wallet_id FK
        bigint amount_syp
        enum method "sham_cash, syriatel_cash, cash"
        text account_details
        enum status "pending_review, transferred, confirmed, disputed, rejected"
        text transfer_reference "nullable"
        text transfer_receipt_url "nullable"
        timestamptz transferred_at "nullable"
        timestamptz confirmed_at "nullable"
        text dispute_reason "nullable"
        text rejection_reason "nullable"
        enum dispute_resolution_outcome "confirm_paid, return_funds, nullable"
        text dispute_resolution_note "nullable"
        text reversal_reference "nullable"
        uuid dispute_resolved_by_admin_id FK "nullable"
        timestamptz dispute_resolved_at "nullable"
        timestamptz created_at
    }
    IDEMPOTENCY_RECORDS {
        uuid actor_id FK
        text operation
        uuid request_key
        text request_fingerprint
        integer response_status
        jsonb response_body
        timestamptz created_at
    }
    MONEY_MOVEMENTS {
        uuid id PK
        uuid wallet_id FK "nullable"
        uuid campaign_id FK "nullable"
        uuid sale_id FK "nullable"
        uuid topup_id FK "nullable"
        uuid payout_id FK "nullable"
        uuid voucher_id FK "nullable"
        uuid customer_id FK "nullable"
        enum kind
        bigint amount_syp
        timestamptz created_at
    }
```

`PK` is a primary key, `FK` is a foreign key, and `UK` marks a unique column.

## Rules that go with the diagram

- **Demo reserve.** Use `max_items × (fixed_commission_syp + floor(final_price_syp × 5 / 100))` with one item per sale. For future multi-item pricing, bound percentage charges using the full discounted cap before flooring.
- **Idempotency.** Enforce uniqueness on `(actor_id, operation, request_key)`. Claim or replay the key before locking or changing business records. Commit each successful mutation with its response. For campaign launch, this commits the campaign, wallet reserve transfer, ledger movement and launch response together. Serialize concurrent retries on the unique key and replay the recorded response for an identical request.
- **Active Offer QR uniqueness.** Create a partial unique index on `(campaign_id, customer_id, campaign_marketer_id)` for active passes with a non-null `campaign_marketer_id`. A second partial unique index on `(campaign_id, customer_id)` covers active passes where `campaign_marketer_id IS NULL`. Lock the campaign before checking eligibility and reusing or issuing a pass. If an insert conflicts with the active-pass index, use conflict handling that keeps the transaction open, then load the winning active pass.
- **Monetary bounds.** Use exact integer or decimal arithmetic for pricing, ledger sums and aggregate reads. Bound persisted SYP values to `0..9007199254740991` and check resulting monetary balances before commit. Follow the [shared API limits](API_CONTRACT.md#monetary-limits-and-precision) for response conversion and error behavior.
- **Shared close.** Use one campaign service operation for explicit close, cap exhaustion and expiry. Lock the campaign first for existing-campaign mutations, then the pass when applicable and the affected balances in a consistent order. Expire outstanding active passes and return the unused reserve once with its ledger movement. A final-sale mutation stores its response after this close operation, with zero remaining locked budget.
- **Voucher liability.** Active voucher amounts are reserved customer liabilities. Voucher issuance locks the customer row and commits the debit, active voucher and idempotency result together. Redemption and cancellation lock the voucher, update its state conditionally and settle the reservation once. On redemption require the bill total to cover the voucher, store the bill total, and credit the merchant in the same transaction.

- **Accounts and sessions.** Enforce unique `phone` (`^09[0-9]{8}$`). Track refresh sessions in `USER_SESSIONS` with rotated token hashes and 30-day inactivity expiry. Only verified merchants may receive top-ups and launch campaigns.
- **Prepaid balance and worst-case campaign locking.** Give each merchant one `WALLETS` row (`role = 'merchant'`) and each marketer one `WALLETS` row (`role = 'marketer'`), unique on `(user_id, role)`. Launching a campaign computes `worst_case_reserve_syp` (all marketer commissions + 5% platform fee across `max_items` or `max_sales_volume_syp`), verifies `available_balance_syp >= worst_case_reserve_syp` under a wallet row lock, and atomically moves that amount into `CAMPAIGNS.locked_budget_syp`. When a campaign ends or is closed early, any remaining `locked_budget_syp` unlocks back into `available_balance_syp`.
- **Joining and self-promotion.** Enforce unique `(campaign_id, marketer_id)` in `CAMPAIGN_MARKETERS`. Block merchants from joining their own campaigns as marketers, and issue a `direct_referral_code` when direct referrals are enabled so the merchant can self-promote with `0` marketer commission (paying only the 5% platform fee).
- **Single-use Offer QR and atomic settlement.** A signed-in customer receives an `OFFER_QR_PASSES` entry bound to `(campaign_id, campaign_marketer_id?, customer_id)`. Only the campaign owner may scan it, inside a single DB transaction locking `CAMPAIGNS` before `OFFER_QR_PASSES`. On scan: compute `customer_paid_cash_syp`, `marketer_commission_syp` (`0` if `merchant_direct`), `platform_total_fee_syp = floor(paid * 5 / 100)`, `customer_cashback_syp = floor(paid * 2 / 100)`, and `platform_net_fee_syp = platform_total_fee_syp - customer_cashback_syp`. Deduct `marketer_commission_syp + platform_total_fee_syp` from `CAMPAIGNS.locked_budget_syp`, credit the marketer's wallet immediately, and update `CUSTOMER_PROFILES`. Automatically end the campaign at the applicable cap or expiry and release the unused reserve. For future store discounts, sum `sales.customer_paid_cash_syp` under the campaign lock. Reject a sale that would exceed `max_sales_volume_syp` and keep the pass active. If the sale reaches the cap, close and release in the same transaction.
- **Cashback milestones and closed-loop vouchers.** When `CUSTOMER_PROFILES` reaches the milestone criteria (`milestone_purchase_count >= 5` and `milestone_spend_syp >= 50000`), move `locked_cashback_syp` into `available_cashback_syp` and reset the current milestone counters. Generating a `CASHBACK_VOUCHERS` record reserves funds from `available_cashback_syp` (cancelled vouchers return it). When a verified merchant scans a voucher, deduct/finalize the voucher and credit `+amount_syp` into that merchant's `available_balance_syp`.
- **Marketer payouts and receipt proof.** In the future payout flow, requesting a payout moves funds from available to pending under a wallet lock. Pre-transfer rejection releases the hold. Recording a transfer clears pending and posts the cash outflow with its receipt and a reference unique per payment method. Confirmation, including automatic confirmation after 72 hours, and disputes update the payout state. Admin dispute resolution records the outcome, admin, note and time. On verified full reversal, log the external cash inflow and restore available funds in one transaction. Keep the original receipt. Lock the payout and any affected wallet and record each financial transition once.
- **Accounting separation.** Derive platform overview totals strictly from `MONEY_MOVEMENTS` and wallet tables so Merchant Escrow, Locked Campaign Reserves, Marketer Liabilities, Customer Cashback Pool, and Net Platform Fees never mix.
