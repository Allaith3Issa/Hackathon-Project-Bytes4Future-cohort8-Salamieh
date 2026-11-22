# Affiliate Marketing Platform

**Team 3 · Proposed PostgreSQL entity-relationship diagram**

One account can be both a merchant and a marketer. Each sale traces back to an approved marketer’s referral link, and online customers check out as guests.

```mermaid
erDiagram
    USERS ||--o| MERCHANT_PROFILES : "has"
    USERS ||..o{ SESSIONS : "starts"
    USERS ||..o{ CAMPAIGN_MARKETERS : "joins through"
    USERS ||..o{ WALLETS : "holds"
    MERCHANT_PROFILES ||..o{ SUBSCRIPTIONS : "has plan periods"
    SUBSCRIPTIONS ||..o{ CAMPAIGNS : "counts toward quota"
    CAMPAIGNS ||..o{ CAMPAIGN_MARKETERS : "has participants"
    CAMPAIGN_MARKETERS ||..o{ REFERRAL_CLICKS : "tracks"
    CAMPAIGN_MARKETERS ||..o{ SALES : "gets attribution"
    SALES ||--o| RECEIPTS : "issues in store"
    SALES ||--o| ONLINE_ORDERS : "has for delivery"
    SALES |o..o{ MONEY_MOVEMENTS : "records payment activity"
    SUBSCRIPTIONS |o..o{ MONEY_MOVEMENTS : "records plan payment"
    WALLETS |o..o{ MONEY_MOVEMENTS : "receives wallet credits"

    USERS {
        uuid id PK
        varchar phone UK
        text name
        text password_hash
        boolean is_marketer
        boolean is_admin
        timestamptz created_at
    }
    SESSIONS {
        uuid id PK
        uuid user_id FK
        text refresh_token_hash UK
        timestamptz created_at
        timestamptz last_activity_at
        timestamptz revoked_at "nullable"
    }
    MERCHANT_PROFILES {
        uuid user_id PK, FK
        text shop_name
        text shop_details
        enum verification_status "pending, verified, rejected"
    }
    SUBSCRIPTIONS {
        uuid id PK
        uuid merchant_id FK
        enum plan_tier "free, basic, pro"
        integer campaign_limit "null for unlimited"
        timestamptz starts_at
        timestamptz ends_at
    }
    CAMPAIGNS {
        uuid id PK
        uuid subscription_id FK
        text product_name
        text description
        text image_url
        bigint original_price_syp
        numeric discount_percent
        enum commission_type "fixed, percentage"
        numeric commission_value
        enum join_mode "open, approval_required"
        integer max_items "nullable"
        bigint commission_budget_syp "nullable"
        timestamptz ends_at
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
        uuid campaign_marketer_id FK
        timestamptz opened_at
    }
    SALES {
        uuid id PK
        uuid campaign_marketer_id FK
        uuid checkout_key UK
        enum channel "in_store, online"
        enum payment_status "held, settled, refunded"
        integer quantity
        bigint unit_price_syp
        bigint amount_paid_syp
        bigint commission_syp
        bigint platform_fee_syp
        bigint merchant_share_syp
        timestamptz paid_at
    }
    RECEIPTS {
        uuid sale_id PK, FK
        varchar receipt_number UK
        varchar qr_token UK
        timestamptz redeemed_at "nullable"
    }
    ONLINE_ORDERS {
        uuid sale_id PK, FK
        text customer_name
        varchar customer_phone
        text delivery_address
        enum status "pending, accepted, delivered, rejected"
    }
    WALLETS {
        uuid id PK
        uuid user_id FK
        enum role "merchant, marketer"
    }
    MONEY_MOVEMENTS {
        uuid id PK
        uuid sale_id FK "nullable"
        uuid subscription_id FK "nullable"
        uuid wallet_id FK "nullable"
        enum kind
        bigint amount_syp
        timestamptz created_at
    }
```

`PK` is a primary key, `FK` is a foreign key and `UK` marks a unique column.

## Rules that go with the diagram

- **Sessions and refresh.** One user can have multiple sessions, including for admin sign-in. Initialize `last_activity_at` at sign-in. Store only the hash of the current refresh token and replace it atomically on refresh, so the old token stops working. The frontend requests refresh every 15 minutes. Protected requests check that the access token refers to a valid session.
- **Inactivity and sign-out.** Expire a session after 30 days without deliberate authenticated user activity. Refresh, polling, and background requests do not update `last_activity_at`. Explicit sign-out sets `revoked_at` and invalidates the session. The backend rejects inactive or revoked sessions even if a client still has a token.
- **Campaigns and referrals.** Only verified merchants can create campaigns within their current plan quota. Enforce one membership per `(campaign_id, marketer_id)`, block merchants from joining their own campaigns, and generate a referral code on approval. Each campaign keeps its original subscription link so its creation counts toward the right plan period.
- **Checkout and receipts.** An in-store sale settles immediately and creates one receipt. Only the campaign owner can redeem it, once. An online sale creates one order and holds the payment until the merchant accepts or rejects it. Acceptance settles the sale. Rejection records a full refund and releases the item and commission reservations.
- **Money and limits.** Store amounts in whole SYP and enforce that the three payout amounts add up to the amount paid. Lock the campaign row while checking capacity and recording payment so simultaneous purchases cannot exceed the limits. Count held and settled sales toward capacity. We propose reopening a campaign after a refund if it has capacity again and its end time has not passed.
- **Wallets and reporting.** Give dual-role accounts one wallet per role with a unique `(user_id, role)` pair. Record each payment, credit, fee, or refund as a money movement tied to either a sale or a subscription. Derive balances and the leaderboard from posted credits, and campaign statistics from clicks and sales.

Sources · *Affiliate Marketing Platform*, B4F Hackathon Team 3 project specification, and the [API contract](API_CONTRACT.md#authentication-and-account).
