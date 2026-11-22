# Affiliate Marketing Platform

**Three-day demo scope.** Product campaigns only, open joining, fixed commission, and one item per sale. Demo accounts are seeded. The core flow is admin top-up, merchant campaign launch, Expo join and share, web referral and Offer QR, manual merchant redemption, commission and cashback updates, and campaign closure with reserve release. Cashback voucher redemption is the first extension. Store discounts, approval workflows, camera scanning, full marketer web, advanced reports, direct merchant referrals, and payout receipt workflows are backlog for this demo. This scope governs the hackathon. The detailed product descriptions below also cover future work.

**B4F Hackathon — Team 3 · Project Specification (Updated Business Logic)**

| Field | Value |
| --- | --- |
| **Project** | Affiliate Marketing Platform (Micro-Influencers & Cashback) |
| **Team leader** | Allaith Issa |
| **Team members** | Laith Alhaj Husain, Tayma Watfa, Alaa Esmail, Esmail Mahfoud |
| **Duration** | 3 days |
| **Deliverables** | Web application (Next.js) + Android mobile application (React Native with Expo) + REST API (NestJS + PostgreSQL) |

*Promote local products, pay cash in store, unlock cashback for customers, and guarantee every marketer commission through prepaid merchant reserves.*

---

## 1. Project Overview

Small businesses in Salamiyah (shops, restaurants, craftspeople) struggle to afford traditional social media ads and need real foot traffic, while local customers prefer paying **cash in store** rather than using online payment gateways. At the same time, local micro-influencers and students want guaranteed extra income from promoting trusted businesses.

The platform connects four parties in a self-enforcing cash-compatible loop:

1. **Merchant** signs a legal agreement and tops up a **Prepaid Balance in SYP** with the platform administration (cash or Sham Cash). The merchant launches a campaign (for a specific product or a store-wide bill discount), locking the **worst-case cost** (all marketer commissions + 5% platform fee) from their available balance. Merchants can also share their own direct campaign link (paying only the 5% platform fee).
2. **Marketer** joins campaigns, shares a personal referral link, and earns guaranteed commissions in one unified platform wallet.
3. **Customer** opens a referral link, signs in with their phone number, and receives a **single-use Offer QR Code**. At the shop, the customer pays **cash** after receiving the offer discount and **requires the merchant to scan their QR code** so the purchase counts toward the customer's **Cashback Milestones**.
4. **Platform (Admin)** verifies merchants, credits merchant top-ups, retains the fee remaining after accruing cashback, approximately **3% of the sale**, and allocates approximately **2% of the sale** to the Customer Cashback Pool, and processes marketer withdrawal requests with **transfer receipt photo proof** confirmed by the marketer.

Prepaid reserves fund commissions for eligible sales settled through the platform. The scan records the sale reported by the merchant.

---

## 2. Team & Ownership

| Member | Area | Repository |
| --- | --- | --- |
| **Allaith Issa (Team Leader)** | Backend (NestJS + PostgreSQL) | Website repo, `api/` |
| **Laith Alhaj Husain** | Backend (NestJS + PostgreSQL) | Website repo, `api/` |
| **Alaa Esmail** | Frontend (Next.js — Public, Customer & Marketer) | Website repo, `frontend/` |
| **Tayma Watfa** | Frontend (Next.js — Merchant & Admin) | Website repo, `frontend/` |
| **Esmail Mahfoud** | Mobile App (React Native with Expo — Marketer) | Mobile app repo |

### Team Responsibility

- The backend is the single source of truth: Next.js and React Native (Expo) consume the same `/api/v1` REST API.
- No direct database access from web or mobile.
- No work pushes directly to `main`; use feature branches and pull requests.
- Secrets (`DATABASE_URL`, `JWT_SECRET`, admin seed config) stay in `.env` and are never committed.

---

## 3. Project Goal

Build a web application and an Android mobile application where:

- A **merchant** can register, sign/complete verification, view their prepaid SYP balance, launch campaigns backed by worst-case budget locking, promote directly or approve marketers, scan customer Offer QRs and Cashback Vouchers in store, and track sales, top-performing offers, and wallet ledger movements.
- A **marketer** can browse campaigns, join or request to join, share referral links, track clicks, sales, per-merchant earnings, and conversion rates, request payouts (Sham Cash / Syriatel Cash / Cash), inspect uploaded transfer receipts, and confirm receipt of funds.
- A **customer** can open a referral link, view the discount offer, generate a single-use Offer QR Code, track their verified purchase count and cashback progress, unlock cashback at milestones, and redeem closed-loop Cashback Vouchers at any participating shop.
- An **admin** can verify/reject merchants, top up merchant prepaid balances, process marketer payout requests by uploading Sham Cash transfer receipts, and monitor separated platform accounting buckets and platform fees retained after cashback.

---

## 4. Technology Constraints

| Area | Requirement |
| --- | --- |
| **Web frontend** | Next.js + TypeScript (Arabic RTL) |
| **Backend** | NestJS + TypeScript |
| **Database** | PostgreSQL |
| **Mobile app** | React Native with Expo + TypeScript (Android) |
| **Payments** | Cash in store; manual/Sham Cash merchant top-ups and marketer payouts tracked in ledger (no live online card gateway) |
| **API** | One REST API (`/api/v1`) documented with Swagger |
| **Hosting** | Verify the demo API and web URLs on Android on Day 1 |

- Do not add paid third-party AI APIs or real credit-card payment gateways.
- All monetary values are stored and calculated in **whole Syrian Pounds (SYP)** on the backend. The [API monetary limits](API_CONTRACT.md#monetary-limits-and-precision) govern input, calculation and response precision.

---

## 5. Roles

| Role | Who | Where | Main Actions |
| --- | --- | --- | --- |
| **Admin** | Platform owner | Website (`/admin`) | Verify/reject merchants, credit merchant prepaid top-ups, upload Sham Cash receipts to fulfill marketer payouts, view separated accounting totals, users, and campaigns |
| **Merchant** | Shop, restaurant, or craftsperson | Website (`/merchant`) | View prepaid balance & locked reserves, create campaigns (product or store-wide discount), share direct link (self-promotion), approve/reject marketers, scan customer Offer QRs & Cashback Vouchers, view offer performance |
| **Marketer** | Anyone with an audience | Website + **Mobile app (Expo)** | Browse & join campaigns, copy/share referral links, track clicks, sales, per-merchant earnings & conversion, request withdrawals, view transfer receipt & confirm payout receipt, view leaderboard |
| **Customer** | Local shopper | Website (`/r/[code]`, `/customer`) | Register/sign in by Syrian phone, obtain single-use Offer QR from referral link, track purchase count & cashback progress, generate & redeem Cashback Vouchers at participating stores |

- One account is uniquely identified by a Syrian mobile number (`^09[0-9]{8}$`).
- One account may hold multiple public roles (`merchant`, `marketer`, `customer`) simultaneously, with separate `merchant` and `marketer` wallets and cashback balances on the customer profile. `admin` is provisioned out of band.

---

## 6. User Scenarios

- **The merchant & prepaid reserve.** Abu Samer owns a sweets shop in Salamiyah. He registers as a merchant, signs the legal contract offline with the team, gets verified by Admin, and pays `500,000 SYP` via Sham Cash to top up his merchant wallet (`availableBalanceSyp = 500,000`). He creates a campaign: *"Maamoul box, 1 kg"*, price `100,000 SYP`, `10%` customer discount (`90,000 SYP` final), fixed marketer commission `10,000 SYP`, max `30` items. Worst-case reserve = `30 × (10,000 commission + 4,500 platform 5% fee) = 435,000 SYP`. Launching the campaign moves `435,000 SYP` from his available balance into the campaign's `lockedBudgetSyp`, leaving `65,000 SYP` available.
- **Self-marketing vs marketer.** Abu Samer sets the campaign to `approval_required` and approves Rahaf (who gets her personal link). Abu Samer also copies his own **Merchant Direct Link** to post on his shop's Facebook page.
- **In-store cash sale & QR scan.** Ali opens Rahaf's link (recording 1 click for Rahaf), signs in with his phone, and receives a single-use Offer QR. At the shop, Ali pays `90,000 SYP` **cash** to Abu Samer and asks him to scan his Offer QR so Ali gets his cashback progress. Abu Samer scans it once:
  - `14,500 SYP` is deducted from `campaign.lockedBudgetSyp`:
    - `10,000 SYP` credited immediately to Rahaf's marketer wallet.
    - `4,500 SYP` (5% platform fee) split into `1,800 SYP` (2% of `90,000`) to Ali's locked cashback piggy-bank and `2,700 SYP` (3% of `90,000`) to Net Platform Fees.
  - Ali's purchase counter increments by 1. Scanning the same QR again is rejected.
- **Self-promoted sale.** Sara uses Abu Samer's direct link and buys 1 box for `90,000 SYP` cash. Only the 5% platform fee (`4,500 SYP`) is deducted from `lockedBudgetSyp` (`1,800 SYP` to Sara's cashback + `2,700 SYP` net platform fees). The unused `10,000 SYP` remains in the campaign budget and returns to Abu Samer if unused when the campaign ends.
- **Customer cashback milestone & voucher redemption.** After 5 verified purchases totaling `250,000 SYP`, Ali's accumulated `5,000 SYP` locked cashback unlocks into `availableCashbackSyp`. Ali generates a `5,000 SYP` Cashback Voucher QR and uses it at a participating restaurant: he pays `5,000 SYP` less cash, and the platform credits `+5,000 SYP` back to the restaurant's merchant available balance.
- **Marketer payout & Sham Cash receipt confirmation.** Rahaf opens the Expo Android app, sees `100,000 SYP` in her wallet (broken down by shop earnings), and taps **Request Payout** via Sham Cash. Admin sends `100,000 SYP`, uploads the dated Sham Cash transfer receipt photo, and marks it `transferred`. Rahaf sees the receipt photo in the app and taps **Confirm Receipt**.

---

## 7. Business Rules

### Accounts & Verification
1. Every account uses a unique Syrian mobile number (`09` + 8 digits).
2. A single account can hold `customer`, `marketer`, and/or `merchant` roles.
3. Merchant status is `pending`, `verified`, or `rejected`. Only `verified` merchants can receive top-ups and launch campaigns.
4. Only `admin` can verify/reject merchants and credit merchant top-ups.

### Merchant Prepaid Wallet & Worst-Case Campaign Locking
1. Merchants have two wallet figures: `availableBalanceSyp` (spendable for launching campaigns) and `lockedBudgetSyp` (sum of active campaign reserves). Balances can never go negative.
2. Every campaign must define a finite cap. Product campaigns use `maxItems`. Store discounts use `maxSalesVolumeSyp`, measured in discounted cash paid.
3. Formula for worst-case reserve:
   - **Product campaign**: `maxItems × (fixedCommissionSyp + floor(finalPriceSyp × 5 / 100))` for the one-item demo. For future multi-item campaigns, reserve against the full discounted cap value before flooring percentage commission and fees.
   - **Store-wide bill discount campaign**: `floor(maxSalesVolumeSyp × (commissionPercent + 5) / 100)`, where the cap uses discounted cash paid. Check the cap in the checkout preview and recheck it at settlement. Close and release any remaining reserve when the cap is reached.
4. A merchant cannot launch a campaign if `availableBalanceSyp < worstCaseReserveSyp`.
5. Launching atomically locks `worstCaseReserveSyp` into `campaign.lockedBudgetSyp`. Retrying the original launch with the same idempotency key returns the same campaign and retains one reserve lock.
6. When a campaign ends (expiry, cap reached, budget exhausted, or closed early by merchant), any unused `lockedBudgetSyp` automatically returns to `merchant.availableBalanceSyp`.

### Campaigns, Referrals & Self-Marketing
1. Campaigns support two types: `product` (fixed item price & discount) and `store_discount` (percentage discount on a store bill entered at scan time).
2. `finalPriceSyp = floor(originalPriceSyp × (1 - discountPercent / 100))`.
3. Total deductions (`commission + 5% platform fee`) must leave a positive merchant net revenue (`commissionPercent + 5 < 100`, or `commissionPerItem + fee < finalPrice`).
4. Price, discount, and commission terms are locked after launch.
5. Join mode is `open` or `approval_required`. A merchant cannot join their own campaign as a marketer (`SELF_PROMOTION_FORBIDDEN`), but may use their dedicated **Merchant Direct Link** (`0` marketer commission).
6. Each approved marketer gets one unique referral link per campaign (`https://<web-host>/r/<referral-code>`). Every genuine opening records a click. Ended campaigns show `"انتهى هذا العرض"` and block QR generation.

### In-Store Cash Checkout, QR Scanning & Cashback
1. There is no online checkout or online order escrow; all sales occur in store in cash and are finalized when the **campaign owner** scans the customer's single-use Offer QR.
2. A customer must be signed in to generate an Offer QR so purchase counts and cashback accrue to their account. Repeated or concurrent requests reuse the same active pass for the customer, campaign and referral attribution.
3. Each Offer QR can be redeemed **once**, only by the owning merchant, while the campaign is `active` and has enough `lockedBudgetSyp`.
4. **5% Platform Fee Split**:
   - `platformTotalFeeSyp = floor(customerPaidCashSyp × 5 / 100)`
   - `cashbackSyp = floor(customerPaidCashSyp × 2 / 100)`
   - `platformNetFeeSyp = platformTotalFeeSyp - cashbackSyp`
   - Cashback never exceeds the platform fee on the same recorded sale.
5. **Cashback Milestone Unlock**:
   - Every verified scan adds `cashbackSyp` to `customer.lockedCashbackSyp` and increments `customer.milestonePurchaseCount` and `customer.milestoneSpendSyp`.
   - When a milestone threshold is reached (**5 verified purchases** AND at least **50,000 SYP** cumulative spend in the current cycle), `lockedCashbackSyp` unlocks into `availableCashbackSyp` and the cycle resets cleanly for the next milestone.
6. **Closed-Loop Cashback Redemption**:
   - Customers generate a single-use **Cashback Voucher QR** from `availableCashbackSyp` and present it at any verified participating merchant.
   - Issuing the voucher reserves its amount from `customer.availableCashbackSyp`. Cancellation restores that amount. Redemption consumes the reservation and credits the verified merchant's available balance once, in the same transaction. Active vouchers remain part of the Cashback Pool liability. The merchant enters the bill total before the voucher. A bill smaller than the voucher leaves it active. A valid redemption reduces cash due by the voucher amount. The extension uses standalone voucher checkout.

### Marketer Payouts & Accounting Separation
1. Marketer earnings settle immediately into `marketer.availableBalanceSyp` at QR scan time.
2. Marketers request withdrawals in the web or Expo mobile app (`pending_review`). Requested funds move into `pendingPayoutSyp` immediately to prevent double withdrawal.
3. Admin sends funds (Sham Cash / Syriatel Cash / Cash), uploads the **transfer receipt image + reference + timestamp** (`transferred`), and the marketer confirms receipt (`confirmed`) or raises a dispute (`disputed`). Recording the transfer clears the pending hold and records the external payment. Uncontested transfers auto-confirm after 72 hours. An admin resolves a dispute by confirming payment or restoring the marketer’s available balance after verifying that the full amount returned. Keep the original receipt and resolution record.
4. Admin reporting strictly separates: **Merchant Available Escrow**, **Locked Campaign Reserves**, **Pending/Available Marketer Liabilities**, **Customer Cashback Pool**, and **net platform fees**.

---

## 8. Required Screens

### Website: Public & Customer (Alaa)
- **Home (`/`)**: Value proposition for merchants, marketers, and shoppers with a demo sign-in link. Registration and leaderboard links belong to the full release.
- **Register / Login (`/register`, `/login`)**: Syrian phone, password, name, role choices (`customer`, `marketer`, `merchant`). Shop name & details shown when `merchant` is selected.
- **Offer Page (`/r/[code]`)**: Product/store offer details, discount, final price, end date, `"انتهى هذا العرض"` state, quick customer sign-in/register prompt if guest, and **"إصدار رمز الخصم (QR)"** button returning the single-use Offer QR + human-readable code.
- **Customer Cashback Dashboard (`/customer`)**: Total verified purchases, progress toward the 5-purchase / spending milestone, `lockedCashbackSyp` vs `availableCashbackSyp`, purchase history, and **Generate Cashback Voucher QR** button + active voucher display.
- **Public Leaderboard (`/leaderboard`)**: Ranked marketers by total earnings, registration date, and highlighted row for signed-in marketer.

### Website & Expo Mobile App: Marketer (Alaa on Web · Esmail on React Native Expo)
- **Browse Campaigns**: Active campaigns (`product` & `store_discount`), discount, commission, end date, join mode, search & filter.
- **Campaign Details**: Full offer details, Join / Request to Join, status (`pending`, `approved`, `rejected`), and referral link when approved.
- **My Campaigns**: Joined campaigns with Copy and Native Share buttons, clicks, sales, and earnings per campaign.
- **Wallet & Payouts**: Available balance, pending payout balance, total earned, **earnings breakdown by merchant**, transaction history, **Request Payout** form (Sham Cash / Syriatel Cash / Cash), and **Payout History** showing Admin's **transfer receipt image** with **Confirm Receipt** / **Dispute** actions.
- **Statistics**: Totals for clicks, items/bills sold, total earnings, and conversion rate.
- **Leaderboard**: Same ranking as public leaderboard with marketer's own rank highlighted.

### Website: Merchant (Tayma)
- **Dashboard**: Verification status, `availableBalanceSyp`, `lockedBudgetSyp`, total clicks, sales, gross revenue, commissions paid, fees paid, and direct links to Create Campaign & Scan QR.
- **Campaigns & Create Campaign**: List of campaigns (active/ended, locked budget remaining, sales count) + creation form (`product` or `store_discount`) with **live worst-case reserve & per-sale breakdown preview** from the backend.
- **Campaign Details**: Performance totals, **Merchant Direct Link** (for self-promotion), participant list (clicks, sales, commissions earned), and approve/reject pending marketer requests.
- **In-Store QR Scanner (`/merchant/scanner`)**: Camera QR scan + manual code entry supporting **both** Customer Offer QRs (with bill amount entry for `store_discount` or quantity 1–10 for `product`) **and** Customer Cashback Voucher QRs.
- **Wallet & Ledger (`/merchant/wallet`)**: Top-up history (Admin credits), campaign reserve locks/unlocks, per-sale deductions, and Cashback Voucher reimbursements.

### Website: Admin (Tayma)
- **Admin Login & Overview (`/admin`)**: Dedicated sign-in + platform overview with separated accounting buckets (Total Merchant Top-ups, Merchant Available Balances, Locked Campaign Reserves, Marketer Unpaid Liabilities, Customer Cashback Pool, Net Platform Fees).
- **Merchant Verification (`/admin/merchants`)**: Pending queue with shop details + Approve / Reject actions.
- **Merchant Top-Ups (`/admin/topups`)**: Select verified merchant, enter received SYP amount + payment reference/note (cash / Sham Cash), credit `availableBalanceSyp`, view top-up ledger.
- **Marketer Payouts (`/admin/payouts`)**: View pending withdrawal requests, upload **Sham Cash transfer receipt image + reference**, record the transfer, and resolve disputes with a note and a reversal reference when funds return.
- **Users & Campaigns (`/admin/users`, `/admin/campaigns`)**: Paginated oversight tables with role/status filters.

---

## 9. Required Calculations (Whole SYP, Backend-Calculated)

| Metric | Formula |
| --- | --- |
| **Final Price** | `floor(originalPriceSyp × (1 - discountPercent / 100))` |
| **Customer Paid Cash** | `finalPriceSyp × quantity` (product) OR `floor(originalBillSyp × (1 - discountPercent / 100))` (store discount) |
| **Marketer Commission** | `commissionPerItemSyp × quantity` OR `floor(customerPaidCashSyp × commissionPercent / 100)` (`0` on merchant direct link) |
| **Platform Total Fee (5%)** | `floor(customerPaidCashSyp × 5 / 100)` |
| **Customer Cashback (2%)** | `floor(customerPaidCashSyp × 2 / 100)` |
| **Net Platform Fees (~3%)** | `platformTotalFeeSyp - customerCashbackSyp` |
| **Worst-Case Reserve (Product)** | One-item demo formula in §7. For multi-item sales, let `capValueSyp = maxItems × finalPriceSyp`. Reserve `maxItems × commissionPerItemSyp` for fixed commission or `floor(capValueSyp × commissionPercent / 100)` for percentage commission, plus `floor(capValueSyp × 5 / 100)`. |
| **Worst-Case Reserve (Store Discount)** | `floor(maxSalesVolumeSyp × (commissionPercent + 5) / 100)` using the discounted cash cap |
| **Conversion Rate** | `round((salesItemsCount / clicks) × 100, 2)` (`0` when `clicks === 0`) |
